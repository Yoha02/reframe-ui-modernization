import { z } from 'zod';
import { EvaluationSchema,DecompositionSchema,DesignResponseSchema,PagePlanSchema } from '../../shared/schemas/modelResponses';
import { DesignSystemVersionSchema,DesignTokensSchema,type DesignSystemVersion } from '../../shared/schemas/designSystemVersion';
import { PageSchema,type PageSpecification } from '../../shared/schemas/pageSchema';
import type { EvidenceManifest } from '../../shared/schemas/evidenceManifest';
import { ApiError,requireDB } from '../db/bindings';
import type { RuntimeEnv } from '../index';
import { getProjectStateRows,deriveProjectStateSummary } from '../repositories/projectStateRepository';
import { assertWorkflowGateAllowed } from '../workflow/WorkflowStateModule';
import { loadManifest } from '../services/importService';
import { FilesRepository,sha256 } from '../storage/filesRepository';
import { executeModelRun } from '../model/modelRunExecutor';
import { renderStaticPage } from '../services/staticRenderer';
import { jsonBody } from './projectActions';
import { authorIdentity } from '../security/session';

function validateRefs(refs: { pageId: string; sourceId: string | null; regionId: string | null }[],manifest: EvidenceManifest) {
  for (const ref of refs) {
    const page = manifest.pages.find(page => page.id === ref.pageId);
    if (!page || (ref.sourceId && !page.content.some(item => item.id === ref.sourceId)) || (ref.regionId && !page.regions.some(item => item.id === ref.regionId))) throw new ApiError('MODEL_EVIDENCE_REFERENCE_INVALID',422,'The model cited evidence that is not in this project.');
  }
}
function toBase64(bytes: Uint8Array) { let text = ''; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i,i + 8192)); return btoa(text); }
export async function modelRoutes(request: Request,env: RuntimeEnv): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/(.+)$/);
  if (!match) return null;
  const [,projectId,action] = match,db = requireDB(env);
  if (!['workspace','evaluation','decomposition','design-systems','design-systems/generate'].includes(action) && !/^design-systems\/[^/]+\/(approve|tokens)$/.test(action) && !/^pages\/[^/]+\/(rebuild|approve|preview)$/.test(action)) return null;
  const rows = await getProjectStateRows(db,projectId);
  if (!rows) throw new ApiError('PROJECT_NOT_FOUND',404,'Project not found.');
  if (action === 'workspace' && request.method === 'GET') {
    const components = await db.prepare('SELECT evidence_json,decision_json FROM Components WHERE project_id = ? ORDER BY rowid').bind(projectId).all<{ evidence_json: string; decision_json: string | null }>();
    const design = await db.prepare("SELECT manifest_json FROM DesignSystemVersions WHERE project_id = ? ORDER BY (status = 'draft') DESC,version DESC LIMIT 1").bind(projectId).first<{ manifest_json: string }>();
    return Response.json({ manifest: rows.project.manifest_json ? JSON.parse(rows.project.manifest_json) : null,findings: rows.project.findings_json ? JSON.parse(rows.project.findings_json) : null,
      components: components.results.map(row => ({ ...JSON.parse(row.evidence_json),correction: row.decision_json ? JSON.parse(row.decision_json) : null })),
      design: design ? JSON.parse(design.manifest_json) : null,designHash: design ? await sha256(new TextEncoder().encode(design.manifest_json).buffer) : null,
      pages: rows.pages.map(page => ({ id: page.id,specification: page.specification_json ? JSON.parse(page.specification_json) : null })),
    },{ headers: { 'Cache-Control': 'no-store' } });
  }
  const manifest = await loadManifest(projectId,env),state = deriveProjectStateSummary(rows),files = new FilesRepository(env);
  const fingerprint = rows.project.source_fingerprint!;
  const context = JSON.stringify({ site: manifest.title,pages: manifest.pages,assets: manifest.assets,findings: rows.project.findings_json ? JSON.parse(rows.project.findings_json) : null });
  const base = { projectId,fingerprint,db,env,context };
  async function screenshots() { return Promise.all(manifest.pages.map(async page => ({ mediaType: page.screenshot.mediaType,base64: toBase64(new Uint8Array(await (await files.getObject(page.screenshot.objectKey)).arrayBuffer())) }))); }
  if (action === 'evaluation' && request.method === 'POST') {
    assertWorkflowGateAllowed(state,'START_EVALUATION');
    const result = await executeModelRun({ ...base,stage: 'evaluate',schema: EvaluationSchema,images: await screenshots(),
      instruction: 'Evaluate navigation, readability, semantics, responsiveness, consistency and preservation. Identify 6–10 concrete opportunities with existing page/region/source references. Label visual observations observed; label interpretations inferred. Do not invent numeric UI scores or measured results.',
      validate: value => validateRefs(value.findings.flatMap(finding => finding.evidenceRefs),manifest),
      persist: async value => [db.prepare("UPDATE Projects SET findings_json = ?,active_stage = 'decompose',updated_at = ? WHERE id = ?").bind(JSON.stringify(value),new Date().toISOString(),projectId)],
    }); return Response.json(result,{ status: 201 });
  }
  if (action === 'decomposition' && request.method === 'POST') {
    assertWorkflowGateAllowed(state,'START_DECOMPOSITION');
    const result = await executeModelRun({ ...base,stage: 'decompose',schema: DecompositionSchema,
      instruction: 'Identify 8–16 meaningful existing UI components across the pages. Each component must cite an existing regionId and sourceIds from its sourcePageId. Group related navigation pieces into reusable components and describe what to retain, rebuild or merge. Stable identifiers must be unique. Do not invent visual geometry.',
      validate: value => { if (new Set(value.components.map(c => c.stableId)).size !== value.components.length) throw new ApiError('MODEL_RESPONSE_VALIDATION_FAILED',422,'Duplicate component identities.');
        for (const c of value.components) validateRefs(c.sourceIds.map(sourceId => ({ pageId: c.sourcePageId,sourceId,regionId: c.regionId })),manifest); },
      persist: async (value,runId) => value.components.map(c => db.prepare('INSERT INTO Components (id,project_id,page_id,run_id,name,kind,evidence_json) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET run_id=excluded.run_id,name=excluded.name,kind=excluded.kind,evidence_json=excluded.evidence_json')
        .bind(`${projectId}_${c.stableId}`,projectId,c.sourcePageId,runId,c.label,c.semanticRole,JSON.stringify(c))),
    }); return Response.json(result,{ status: 201 });
  }
  if (['design-systems','design-systems/generate'].includes(action) && request.method === 'POST') {
    assertWorkflowGateAllowed(state,'GENERATE_DESIGN_SYSTEM');
    const components = (await db.prepare('SELECT evidence_json,decision_json FROM Components WHERE project_id = ?').bind(projectId).all()).results;
    const result = await executeModelRun({ ...base,context: `${context}\nReviewed components: ${JSON.stringify(components)}`,stage: 'design_system',schema: DesignResponseSchema,images: await screenshots(),
      instruction: 'Create a distinctive, coherent modernization design system derived from this site. Preserve recognizable brand colors while improving readability. Choose warm or atmospheric backgrounds suited to the source, contrasting foregrounds, restrained accent, strong typography, deliberate spacing and component recipes. Avoid generic enterprise dashboard styling. Explain each decision with existing evidence references. Target accessible text contrast; do not claim a measured contrast ratio.',
      validate: value => validateRefs(value.evidenceRationale.flatMap(reason => reason.evidenceRefs),manifest),
      persist: async value => {
        const version = Math.max(0,...rows.designs.map(row => row.version)) + 1;
        const design = DesignSystemVersionSchema.parse({ id: crypto.randomUUID(),projectId,version,name: value.name,status: 'draft',immutable: false,sourceFingerprint: fingerprint,tokens: value.tokens,componentStyles: value.componentStyles,
          rationale: value.evidenceRationale.map(reason => ({ decision: reason.decision,evidence: reason.evidenceRefs.map(ref => ({ pageId: ref.pageId,...(ref.regionId ? { regionId: ref.regionId } : {}),...(ref.sourceId ? { sourceId: ref.sourceId } : {}) })) })),createdAt: new Date().toISOString() });
        return [db.prepare('INSERT INTO DesignSystemVersions (id,project_id,version,source_fingerprint,tokens_json,manifest_json) VALUES (?,?,?,?,?,?)').bind(design.id,projectId,version,fingerprint,JSON.stringify(design.tokens),JSON.stringify(design))];
      },
    }); return Response.json(result,{ status: 201 });
  }
  const designAction = action.match(/^design-systems\/([^/]+)\/(approve|tokens)$/);
  if (designAction && ['POST','PATCH'].includes(request.method)) {
    const row = await db.prepare('SELECT manifest_json FROM DesignSystemVersions WHERE id = ? AND project_id = ?').bind(designAction[1],projectId).first<{ manifest_json: string }>();
    if (!row) throw new ApiError('DESIGN_NOT_FOUND',404,'Design version not found.');
    const current = DesignSystemVersionSchema.parse(JSON.parse(row.manifest_json));
    if (current.status !== 'draft') throw new ApiError('DESIGN_IMMUTABLE',409,'Approved design versions are immutable. Generate a new draft to make changes.');
    if (state.generationRuns.some(run => run.status === 'Generating')) throw new ApiError('ACTION_ALREADY_RUNNING',409,'Wait for the current operation to finish.');
    const body = z.strictObject({ confirm: z.boolean().optional(),expectedHash: z.string(),tokens: DesignTokensSchema.optional() }).parse(await jsonBody(request));
    if (body.expectedHash !== await sha256(new TextEncoder().encode(row.manifest_json).buffer)) throw new ApiError('DESIGN_CHANGED',409,'The design changed. Reload and review its latest version.');
    if (designAction[2] === 'tokens') {
      if (!body.tokens) throw new ApiError('INVALID_REQUEST',400,'Provide the edited design tokens.');
      const updated = { ...current,tokens: body.tokens };
      const saved = await db.prepare("UPDATE DesignSystemVersions SET tokens_json = ?,manifest_json = ? WHERE id = ? AND project_id = ? AND status = 'draft' AND manifest_json = ?").bind(JSON.stringify(body.tokens),JSON.stringify(updated),current.id,projectId,row.manifest_json).run();
      if (!saved.meta?.changes) throw new ApiError('DESIGN_CHANGED',409,'The design changed. Reload before saving again.');
      return Response.json({ status: 'draft' });
    }
    assertWorkflowGateAllowed(state,'APPROVE_DESIGN_SYSTEM');
    if (body.confirm !== true) throw new ApiError('EXPLICIT_APPROVAL_REQUIRED',400,'Explicit design approval is required.');
    const approvedAt = new Date().toISOString(),approvedBy = authorIdentity(request,env);
    const approved = DesignSystemVersionSchema.parse({ ...current,status: 'approved',immutable: true,approvedAt,approvedBy });
    const exists = "EXISTS (SELECT 1 FROM DesignSystemVersions WHERE id = ? AND status = 'draft' AND manifest_json = ?)";
    const results = await db.batch([
      db.prepare(`UPDATE DesignSystemVersions SET active = 0 WHERE project_id = ? AND active = 1 AND ${exists}`).bind(projectId,current.id,row.manifest_json),
      db.prepare("UPDATE DesignSystemVersions SET status = 'approved',immutable = 1,active = 1,manifest_json = ?,approved_at = ?,approved_by = ? WHERE id = ? AND status = 'draft' AND manifest_json = ?").bind(JSON.stringify(approved),approvedAt,approvedBy,current.id,row.manifest_json),
      db.prepare("UPDATE Pages SET status = 'stale' WHERE project_id = ? AND specification_json IS NOT NULL AND EXISTS (SELECT 1 FROM DesignSystemVersions WHERE id = ? AND active = 1 AND manifest_json = ?)").bind(projectId,current.id,JSON.stringify(approved)),
    ]);
    if (!results[1].meta?.changes) throw new ApiError('DESIGN_CHANGED',409,'The design changed during approval. Reload before continuing.');
    return Response.json({ versionId: current.id,status: 'approved',approvedAt });
  }
  const pageAction = action.match(/^pages\/([^/]+)\/(rebuild|approve|preview)$/);
  if (pageAction) {
    const page = manifest.pages.find(page => page.id === pageAction[1]);
    if (!page) throw new ApiError('PAGE_NOT_FOUND',404,'Page not found.');
    if (pageAction[2] === 'preview' && request.method === 'GET') {
      const stored = rows.pages.find(row => row.id === page.id)?.specification_json;
      if (!stored) throw new ApiError('PAGE_NOT_BUILT',404,'Rebuild this page to create a preview.');
      const spec = PageSchema.parse(JSON.parse(stored));
      const designRow = await db.prepare('SELECT manifest_json FROM DesignSystemVersions WHERE id = ? AND project_id = ?').bind(spec.designSystemVersionId,projectId).first<{ manifest_json: string }>();
      const rendered = await renderStaticPage(spec,JSON.parse(designRow!.manifest_json) as DesignSystemVersion,manifest);
      return Response.json({ html: rendered.html,css: rendered.css,specification: spec });
    }
    if (pageAction[2] === 'approve' && request.method === 'POST') {
      assertWorkflowGateAllowed(state,'APPROVE_PAGE');
      const body = z.strictObject({ generationId: z.string(),confirm: z.literal(true) }).parse(await jsonBody(request));
      const stored = rows.pages.find(row => row.id === page.id)!;
      const spec = stored.specification_json ? PageSchema.parse(JSON.parse(stored.specification_json)) : null;
      if (!spec || spec.id !== body.generationId || stored.status === 'stale' || spec.designSystemVersionId !== state.designSystem.approvedVersionId) throw new ApiError('PAGE_NEEDS_REFRESH',409,'Review the current rebuilt page before approving.');
      const id = `${spec.id}-approval`,now = new Date().toISOString();
      const results = await db.batch([
        db.prepare("INSERT OR IGNORE INTO PageApprovals (id,project_id,page_id,design_system_version_id,specification_hash,approved_at,approved_by) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM Pages p JOIN DesignSystemVersions d ON d.project_id = p.project_id WHERE p.id = ? AND p.specification_hash = ? AND p.status != 'stale' AND d.id = ? AND d.active = 1)").bind(id,projectId,page.id,spec.designSystemVersionId,stored.specification_hash,now,authorIdentity(request,env),page.id,stored.specification_hash,spec.designSystemVersionId),
        db.prepare("UPDATE Pages SET status = 'approved',updated_at = ? WHERE id = ? AND specification_hash = ? AND status != 'stale' AND EXISTS (SELECT 1 FROM PageApprovals a JOIN DesignSystemVersions d ON d.id = a.design_system_version_id WHERE a.id = ? AND d.active = 1)").bind(now,page.id,stored.specification_hash,id),
      ]);
      if (!results[1].meta?.changes) throw new ApiError('PAGE_NEEDS_REFRESH',409,'The page or design changed during approval. Reload and review again.');
      return Response.json({ approvalId: id,pageId: page.id,approved: true });
    }
    if (pageAction[2] === 'rebuild' && request.method === 'POST') {
      assertWorkflowGateAllowed(state,'REBUILD_PAGE');
      const designRow = await db.prepare('SELECT manifest_json FROM DesignSystemVersions WHERE id = ? AND project_id = ? AND active = 1').bind(state.designSystem.approvedVersionId,projectId).first<{ manifest_json: string }>();
      const design = DesignSystemVersionSchema.parse(JSON.parse(designRow!.manifest_json));
      const result = await executeModelRun({ ...base,pageId: page.id,stage: 'rebuild',schema: PagePlanSchema,context: JSON.stringify({ page,assets: manifest.assets,approvedDesign: design }),
        instruction: 'Arrange this existing page into a striking, modern static page using the approved design. Return ordered sections referring only to existing sourceIds. Use a hero for prominent brand imagery, a card_grid for navigation, and footer for legal material. Keep image/link pairs adjacent. Every source content item must appear in a section; do not invent headings, copy or URLs.',
        validate: value => { const ids = new Set(page.content.map(item => item.id)); if (value.sections.some(section => section.sourceIds.some(id => !ids.has(id)))) throw new ApiError('MODEL_EVIDENCE_REFERENCE_INVALID',422,'The page plan referenced missing content.'); },
        persist: async (value,runId) => {
          const spec: PageSpecification = PageSchema.parse({ schemaVersion: 1,id: runId,projectId,pageId: page.id,designSystemVersionId: design.id,title: page.title,route: page.route,description: '',preservedContent: page.content,sections: value.sections.map(section => ({ ...section,assetIds: [],links: [] })),artifactReferences: [] });
          const rendered = await renderStaticPage(spec,design,manifest);
          spec.artifactReferences = [await files.putGeneratedArtifact(projectId,runId,rendered.htmlPath,new TextEncoder().encode(rendered.html).buffer,{ mediaType: 'text/html',artifactKind: 'html' }),await files.putGeneratedArtifact(projectId,runId,'styles.css',new TextEncoder().encode(rendered.css).buffer,{ mediaType: 'text/css',artifactKind: 'css' })];
          const serialized = JSON.stringify(spec),hash = await sha256(new TextEncoder().encode(serialized).buffer);
          return [db.prepare("UPDATE Pages SET specification_json = ?,specification_hash = ?,status = 'draft',updated_at = ? WHERE id = ? AND project_id = ?").bind(serialized,hash,new Date().toISOString(),page.id,projectId)];
        },
      }); return Response.json(result,{ status: 201 });
    }
  }
  return null;
}
