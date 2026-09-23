import type { EvidenceManifest } from '../../shared/schemas/evidenceManifest';
import { ApiError, requireDB, type D1Binding } from '../db/bindings';
import { FilesRepository, sha256, type FilesEnvironment } from '../storage/filesRepository';
import { validateEvidenceBundle } from '../imports/evidenceImporter';
export async function importBundle(projectId: string,bytes: Uint8Array,env: FilesEnvironment & { DB?: D1Binding }) {
  const db = requireDB(env); const project = await db.prepare('SELECT id,manifest_json FROM Projects WHERE id = ?').bind(projectId).first();
  if (!project) throw new ApiError('PROJECT_NOT_FOUND',404,'Project not found.');
  // The demo retains an imported baseline; a fresh project is the explicit way to change source evidence.
  if (project.manifest_json) throw new ApiError('EVIDENCE_ALREADY_IMPORTED',409,'Create a new project to import another evidence baseline.');
  const runId = crypto.randomUUID(), startedAt = new Date().toISOString(), fingerprint = await sha256(Uint8Array.from(bytes).buffer);
  const started = await db.prepare("INSERT INTO GenerationRuns (id,project_id,stage,status,dependency_fingerprint,cache_key,started_at) SELECT ?,?,'import','started',?,?,? WHERE NOT EXISTS (SELECT 1 FROM GenerationRuns WHERE project_id = ? AND status = 'started') AND EXISTS (SELECT 1 FROM Projects WHERE id = ? AND manifest_json IS NULL)").bind(runId,projectId,fingerprint,`import-${fingerprint}`,startedAt,projectId,projectId).run();
  if (!started.meta?.changes) throw new ApiError('IMPORT_ALREADY_RUNNING',409,'This project has already imported evidence or has an operation in progress.');
  try {
    const { manifest: original,files,warnings } = await validateEvidenceBundle(bytes);
    const repository = new FilesRepository(env); const manifest = structuredClone(original);
    const written = new Map<string,Awaited<ReturnType<FilesRepository['putEvidenceObject']>>>();
    const refs = [...manifest.assets.map(asset => asset.file),...manifest.pages.flatMap(page => [page.html,page.screenshot])];
    for (const ref of refs) {
      const originalKey = ref.objectKey;
      let stored = written.get(originalKey);
      if (!stored) {
        stored = await repository.putEvidenceObject(projectId,`${runId}/${originalKey}`,Uint8Array.from(files.get(originalKey)!).buffer,
          { mediaType: ref.mediaType,artifactKind: ref.mediaType.startsWith('image/') ? 'image' : 'text',sha256: ref.sha256,byteSize: ref.byteSize });
        written.set(originalKey,stored);
      }
      Object.assign(ref,stored);
    }
    const pageIds = new Map(manifest.pages.map(page => [page.id,`${projectId}_${page.id}`]));
    for (const page of manifest.pages) { page.id = pageIds.get(page.id)!; for (const frame of page.frames) if (frame.contentPageId) frame.contentPageId = pageIds.get(frame.contentPageId); }
    const statements = manifest.pages.map(page => db.prepare('INSERT INTO Pages (id,project_id,title,route,source_url) VALUES (?,?,?,?,?)').bind(page.id,projectId,page.title,page.route,page.sourceUrl));
    for (const [originalKey,ref] of written) statements.push(db.prepare('INSERT INTO EvidenceObjects (id,project_id,page_id,object_key,sha256,media_type,byte_size,provenance_json) VALUES (?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),projectId,manifest.pages.find(page => [page.html.objectKey,page.screenshot.objectKey].includes(ref.objectKey))?.id ?? null,ref.objectKey,ref.sha256,ref.mediaType,ref.byteSize,JSON.stringify({ ...original.provenance,originalKey,runId })));
    const finishedAt = new Date().toISOString();
    statements.push(db.prepare("UPDATE Projects SET manifest_json = ?,source_fingerprint = ?,status = 'active',active_stage = 'evaluate',updated_at = ? WHERE id = ? AND manifest_json IS NULL").bind(JSON.stringify(manifest),fingerprint,finishedAt,projectId));
    statements.push(db.prepare("UPDATE GenerationRuns SET status = 'completed',completed_at = ?,result_json = ? WHERE id = ?").bind(finishedAt,JSON.stringify({ durationMs: Date.now() - Date.parse(startedAt),pageCount: manifest.pages.length }),runId));
    await db.batch(statements);
    return { projectId,importRunId: runId,status: 'completed',inventory: { pages: manifest.pages.map(page => ({ id: page.id,title: page.title,route: page.route })),evidenceObjectCount: written.size },warnings,unsupportedBehaviors: ['Original scripts and legacy interactive behavior are not executed.'] };
  } catch (error) {
    const code = error instanceof ApiError ? error.code : 'IMPORT_STORAGE_FAILED';
    await db.prepare("UPDATE GenerationRuns SET status = 'failed',failed_at = ?,error_json = ? WHERE id = ?").bind(new Date().toISOString(),JSON.stringify({ code }),runId).run();
    if (error instanceof ApiError) throw error;
    throw new ApiError(code,500,'Import could not finish. The project was not advanced.');
  }
}
export async function loadManifest(projectId: string,env: { DB?: D1Binding }): Promise<EvidenceManifest> {
  const row = await requireDB(env).prepare('SELECT manifest_json FROM Projects WHERE id = ?').bind(projectId).first<{ manifest_json: string | null }>();
  if (!row) throw new ApiError('PROJECT_NOT_FOUND',404,'Project not found.');
  if (!row.manifest_json) throw new ApiError('IMPORT_REQUIRED',409,'Import evidence first.');
  return JSON.parse(row.manifest_json) as EvidenceManifest;
}
