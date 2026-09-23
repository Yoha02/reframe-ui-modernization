import { zipSync,strToU8,type Zippable } from 'fflate';
import { ReleaseTransferSchema,type ReleaseTransfer } from '../../shared/schemas/releaseTransfer';
import { ReleaseManifestSchema,type ReleaseManifest } from '../../shared/schemas/releaseManifest';
import { DesignSystemVersionSchema } from '../../shared/schemas/designSystemVersion';
import { PageSchema } from '../../shared/schemas/pageSchema';
import { getProjectStateRows,deriveProjectStateSummary } from '../repositories/projectStateRepository';
import { assertWorkflowGateAllowed } from '../workflow/WorkflowStateModule';
import { ApiError,requireDB } from '../db/bindings';
import { FilesRepository,sha256 } from '../storage/filesRepository';
import { renderStaticPage,assetFile } from '../services/staticRenderer';
import { loadManifest } from '../services/importService';
import type { RuntimeEnv } from '../index';
export async function releaseRoutes(request: Request,env: RuntimeEnv): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/releases(?:\/([a-zA-Z0-9_-]+)\/download)?$/);
  if (!match) return null;
  const [,projectId,downloadId] = match,db = requireDB(env),repository = new FilesRepository(env);
  if (downloadId && request.method === 'GET') {
    const release = await db.prepare('SELECT zip_object_key FROM Releases WHERE id = ? AND project_id = ?').bind(downloadId,projectId).first<{ zip_object_key: string }>();
    if (!release) throw new ApiError('RELEASE_NOT_FOUND',404,'Release not found.');
    const file = await repository.getObject(release.zip_object_key);
    return new Response(await file.arrayBuffer(),{ headers: { 'Content-Type': 'application/zip','Content-Disposition': `attachment; filename="reframe-${downloadId}.zip"`,'Cache-Control': 'private, no-store' } });
  }
  if (request.method !== 'POST' || downloadId) return null;
  const rows = await getProjectStateRows(db,projectId); if (!rows) throw new ApiError('PROJECT_NOT_FOUND',404,'Project not found.');
  const state = deriveProjectStateSummary(rows); assertWorkflowGateAllowed(state,'PUBLISH_RELEASE');
  if (!env.RELEASE_ORIGIN || !env.RELEASE_PUBLISH_SECRET) throw new ApiError('PUBLISH_CONFIGURATION_MISSING',424,'The public release site is not connected yet. Your approvals are saved.');
  const origin = new URL(env.RELEASE_ORIGIN); if (origin.protocol !== 'https:' && !(env.LOCAL_DEVELOPMENT === 'true' && origin.hostname === '127.0.0.1')) throw new ApiError('PUBLISH_CONFIGURATION_INVALID',503,'Release hosting must use HTTPS.');
  const releaseId = crypto.randomUUID(),createdAt = new Date().toISOString(),designId = state.designSystem.approvedVersionId!;
  const designRow = await db.prepare('SELECT manifest_json FROM DesignSystemVersions WHERE id = ? AND project_id = ? AND active = 1').bind(designId,projectId).first<{ manifest_json: string }>();
  const design = DesignSystemVersionSchema.parse(JSON.parse(designRow!.manifest_json)),evidence = await loadManifest(projectId,env);
  const bundle = new Map<string,{ bytes: Uint8Array; mediaType: ReleaseTransfer['files'][number]['mediaType'] }>(),routes: ReleaseManifest['routes'] = [];
  for (const page of rows.pages) {
    const spec = PageSchema.parse(JSON.parse(page.specification_json!)),rendered = await renderStaticPage(spec,design,evidence);
    const approval = await db.prepare('SELECT id FROM PageApprovals WHERE project_id = ? AND page_id = ? AND specification_hash = ? AND design_system_version_id = ? ORDER BY approved_at DESC LIMIT 1').bind(projectId,page.id,page.specification_hash,designId).first<{ id: string }>();
    if (!approval) throw new ApiError('PAGE_APPROVAL_REQUIRED',409,'Every included page needs current approval.');
    bundle.set(rendered.htmlPath,{ bytes: strToU8(rendered.html),mediaType: 'text/html' });
    bundle.set('styles.css',{ bytes: strToU8(rendered.css),mediaType: 'text/css' });
    routes.push({ pageId: page.id,route: page.route,artifactKey: `projects/${projectId}/releases/${releaseId}/site/${rendered.htmlPath}`,approvalId: approval.id });
  }
  for (const asset of evidence.assets) bundle.set(assetFile(asset),{ bytes: new Uint8Array(await (await repository.getObject(asset.file.objectKey)).arrayBuffer()),mediaType: asset.file.mediaType as ReleaseTransfer['files'][number]['mediaType'] });
  const transfer = ReleaseTransferSchema.parse({ releaseId,files: await Promise.all([...bundle].map(async ([path,file]) => ({ path,mediaType: file.mediaType,byteSize: file.bytes.length,sha256: await sha256(Uint8Array.from(file.bytes).buffer) }))) });
  const zipped: Zippable = {}; for (const [path,file] of bundle) zipped[path] = [file.bytes,{ mtime: new Date(createdAt) }];
  zipped['release-manifest.json'] = [strToU8(JSON.stringify(transfer,null,2)),{ mtime: new Date(createdAt) }];
  const zip = zipSync(zipped,{ level: 6 }),artifacts: ReleaseManifest['artifacts'] = [];
  for (const entry of transfer.files) {
    const kind = entry.mediaType === 'text/html' ? 'html' : entry.mediaType === 'text/css' ? 'css' : 'image';
    artifacts.push({ ...await repository.putReleaseArtifact(projectId,releaseId,entry.path,Uint8Array.from(bundle.get(entry.path)!.bytes).buffer,{ mediaType: entry.mediaType,artifactKind: kind,sha256: entry.sha256 }),kind,immutable: true });
  }
  artifacts.push({ ...await repository.putReleaseArtifact(projectId,releaseId,'release.zip',Uint8Array.from(zip).buffer,{ mediaType: 'application/zip',artifactKind: 'zip' }),kind: 'zip',immutable: true });
  const manifest = ReleaseManifestSchema.parse({ schemaVersion: 1,releaseId,projectId,designSystemVersionId: designId,immutable: true,createdAt,...(rows.releases[0] ? { previousReleaseId: rows.releases[0].id } : {}),routes,artifacts,hashes: Object.fromEntries(artifacts.map(file => [file.objectKey,file.sha256])),zipArtifactKey: artifacts.at(-1)!.objectKey,publicState: 'publishing' });
  // Freeze the reviewed snapshot. Later edits create a new release, never mutate these files.
  const checks = rows.pages.map(() => "EXISTS (SELECT 1 FROM Pages WHERE id = ? AND specification_hash = ? AND status = 'approved')").join(' AND ');
  const inserted = await db.prepare(`INSERT INTO Releases (id,project_id,design_system_version_id,previous_release_id,public_state,routes_json,hashes_json,artifact_manifest_json,zip_object_key,created_at) SELECT ?,?,?,?,'publishing',?,?,?,?,? WHERE EXISTS (SELECT 1 FROM DesignSystemVersions WHERE id = ? AND active = 1) AND ${checks}`).bind(releaseId,projectId,designId,manifest.previousReleaseId ?? null,JSON.stringify(routes),JSON.stringify(manifest.hashes),JSON.stringify(manifest),manifest.zipArtifactKey,createdAt,designId,...rows.pages.flatMap(page => [page.id,page.specification_hash])).run();
  if (!inserted.meta?.changes) throw new ApiError('RELEASE_INPUT_CHANGED',409,'A page or design changed. Review the current versions before publishing.');
  await db.batch(artifacts.map((file,index) => db.prepare('INSERT INTO ReleaseArtifacts (id,project_id,release_id,object_key,kind,sha256,media_type,byte_size) VALUES (?,?,?,?,?,?,?,?)').bind(`${releaseId}-${index}`,projectId,releaseId,file.objectKey,file.kind,file.sha256,file.mediaType,file.byteSize)));
  try {
    const published = await fetch(new URL('/internal/publish',origin),{ method: 'POST',headers: { Authorization: `Bearer ${env.RELEASE_PUBLISH_SECRET}`,'Content-Type': 'application/zip' },body: Uint8Array.from(zip),signal: AbortSignal.timeout(55000) });
    if (!published.ok) throw new Error('Release receiver rejected upload');
    const publicUrl = new URL(`/sites/${releaseId}/`,origin).href;
    for (const entry of transfer.files) {
      const check = await fetch(new URL(entry.path,publicUrl),{ redirect: 'manual',signal: AbortSignal.timeout(15000) });
      if (!check.ok || await sha256(await check.arrayBuffer()) !== entry.sha256) throw new Error('Public artifact verification failed');
    }
    const verifiedAt = new Date().toISOString(),complete = ReleaseManifestSchema.parse({ ...manifest,publicState: 'published',publicUrl,verifiedAt });
    await db.prepare("UPDATE Releases SET public_state = 'published',public_url = ?,verified_at = ?,artifact_manifest_json = ? WHERE id = ? AND public_state = 'publishing'").bind(publicUrl,verifiedAt,JSON.stringify(complete),releaseId).run();
    return Response.json({ releaseId,publicUrl,verifiedAt,downloadUrl: `/api/projects/${projectId}/releases/${releaseId}/download` },{ status: 201 });
  } catch {
    await db.prepare("UPDATE Releases SET public_state = 'failed' WHERE id = ?").bind(releaseId).run();
    throw new ApiError('PUBLICATION_NOT_VERIFIED',502,'The frozen release and ZIP are saved, but its public files could not be verified. Review hosting configuration before publishing again.');
  }
}
