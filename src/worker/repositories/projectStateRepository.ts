import { parseProjectStateResponse, type ProjectStateResponse, type StageStatus } from '../../shared/schemas/projectState';
import type { D1Binding } from '../db/bindings';
export interface ProjectRow { id: string; name: string; created_at: string; updated_at: string; source_fingerprint: string | null; manifest_json: string | null; findings_json: string | null; }
export interface PageRow { id: string; route: string; title: string; status: string; specification_hash: string | null; specification_json: string | null; }
export interface DesignRow { id: string; status: string; active: number; source_fingerprint: string; version: number; }
export interface RunRow { id: string; page_id: string | null; stage: string; status: string; retry_count: number; started_at: string; completed_at: string | null; error_json: string | null; dependency_fingerprint: string; }
export interface ApprovalRow { page_id: string; design_system_version_id: string; specification_hash: string; }
export interface ReleaseRow { id: string; public_state: string; public_url: string | null; zip_object_key: string; verified_at: string | null; }
export interface ProjectStateRows { project: ProjectRow; pages: PageRow[]; designs: DesignRow[]; runs: RunRow[]; approvals: ApprovalRow[]; releases: ReleaseRow[]; componentCount: number; }
export async function getProjectStateRows(db: D1Binding, projectId: string): Promise<ProjectStateRows | null> {
  // A D1 batch gives all summaries the same transactional view during concurrent changes.
  const statements = [
    'SELECT * FROM Projects WHERE id = ?',
    'SELECT * FROM Pages WHERE project_id = ? ORDER BY route',
    'SELECT * FROM DesignSystemVersions WHERE project_id = ? ORDER BY version DESC',
    'SELECT * FROM GenerationRuns WHERE project_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 100',
    'SELECT * FROM PageApprovals WHERE project_id = ?',
    'SELECT * FROM Releases WHERE project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',
    'SELECT COUNT(*) AS n FROM Components WHERE project_id = ?',
  ].map(sql => db.prepare(sql).bind(projectId));
  const results = await db.batch(statements);
  const project = results[0].results[0] as unknown as ProjectRow | undefined;
  if (!project) return null;
  return { project, pages: results[1].results as unknown as PageRow[], designs: results[2].results as unknown as DesignRow[], runs: results[3].results as unknown as RunRow[],
    approvals: results[4].results as unknown as ApprovalRow[], releases: results[5].results as unknown as ReleaseRow[], componentCount: Number(results[6].results[0]?.n ?? 0) };
}
export function mapRunStateToWorkflowStatus(status: string): StageStatus {
  return ({ started: 'Generating', failed: 'Failed', retryable: 'Failed', completed: 'Completed', cached: 'Completed' } as Record<string,StageStatus>)[status] ?? 'Draft';
}
export function deriveProjectStateSummary(rows: ProjectStateRows): ProjectStateResponse {
  const { project, pages, designs, runs, approvals, releases } = rows;
  const approved = designs.find(row => row.status === 'approved' && row.active === 1);
  const draft = designs.find(row => row.status === 'draft');
  const designStale = !!approved && approved.source_fingerprint !== project.source_fingerprint;
  const currentApproval = (page: PageRow) => !!approved && !designStale && page.status !== 'stale' && !!page.specification_hash &&
    approvals.some(row => row.page_id === page.id && row.design_system_version_id === approved.id && row.specification_hash === page.specification_hash);
  const pageSummaries = pages.map(page => ({ id: page.id, title: page.title, route: page.route,
    status: (page.status === 'stale' || designStale ? 'Needs refresh' : currentApproval(page) ? 'Approved' : page.status === 'failed' ? 'Failed' : 'Draft') as StageStatus,
    approvalState: currentApproval(page) ? 'Approved' as const : 'Draft' as const,
    needsRefresh: page.status === 'stale' || designStale,
    latestGenerationRunId: runs.find(run => run.page_id === page.id && run.stage === 'rebuild')?.id ?? null }));
  const hasEvidence = pages.length > 0 && !!project.manifest_json;
  const evaluated = hasEvidence && !!project.findings_json;
  const decomposed = evaluated && rows.componentCount > 0;
  const allBuilt = pages.length > 0 && pages.every(page => !!page.specification_json) && !pageSummaries.some(page => page.needsRefresh);
  const allApproved = pages.length > 0 && pageSummaries.every(page => page.approvalState === 'Approved');
  const release = releases[0];
  const published = release?.public_state === 'published' && !!release.public_url && !!release.verified_at;
  const definitions = [
    ['import','Import',hasEvidence ? 'Completed' : 'Draft',null,'Import evidence'],
    ['evaluate','Evaluate',evaluated ? 'Completed' : hasEvidence ? 'Ready' : 'Blocked',hasEvidence ? null : 'Import source evidence first.','Evaluate site'],
    ['decompose','Decompose',decomposed ? 'Completed' : evaluated ? 'Ready' : 'Blocked',evaluated ? null : 'Evaluate the site first.','Map components'],
    ['design_system','Design System',designStale ? 'Needs refresh' : approved ? 'Approved' : draft ? 'Draft' : decomposed ? 'Ready' : 'Blocked',decomposed ? null : 'Evaluate and map components first.','Create design system'],
    ['rebuild','Rebuild',allBuilt ? 'Completed' : approved && !designStale ? 'Ready' : 'Blocked',approved && !designStale ? null : 'Approve the current design system first.','Rebuild page'],
    ['review','Review',allApproved ? 'Approved' : allBuilt ? 'Ready' : 'Blocked',allBuilt ? null : 'Rebuild a page before review.','Review pages'],
    ['publish','Publish',published ? 'Published' : allApproved ? 'Ready' : 'Blocked',allApproved ? null : 'Approve every included page first.','Publish release'],
  ] as const;
  const stages = Object.fromEntries(definitions.map(([key,label,status,blockedReason,primaryAction]) => {
    const lastRun = runs.find(run => run.stage === key && run.dependency_fingerprint === project.source_fingerprint);
    const runStatus = lastRun && ['started','failed','retryable'].includes(lastRun.status) ? mapRunStateToWorkflowStatus(lastRun.status) : status;
    return [key,{ key,label,status: runStatus,blockedReason,primaryAction }];
  }));
  return parseProjectStateResponse({ project: { id: project.id,name: project.name,createdAt: project.created_at,updatedAt: project.updated_at }, stages, pages: pageSummaries,
    designSystem: { draftVersionId: draft?.id ?? null,approvedVersionId: approved?.id ?? null,status: designStale ? 'Needs refresh' : approved ? 'Approved' : 'Draft',needsRefresh: designStale },
    generationRuns: runs.map(run => ({ id: run.id,stage: run.stage,status: mapRunStateToWorkflowStatus(run.status),retryable: run.status === 'retryable' && run.retry_count < 1,startedAt: run.started_at,completedAt: run.completed_at,errorCode: run.error_json ? String((JSON.parse(run.error_json) as { code?: string }).code ?? 'GENERATION_FAILED') : null })),
    approvals: { approvedPageCount: pageSummaries.filter(page => page.approvalState === 'Approved').length,requiredPageCount: pages.length },
    release: { latestReleaseId: release?.id ?? null,status: published ? 'Published' : ['failed','compatibility_error'].includes(release?.public_state ?? '') ? 'Failed' : 'Draft',publicUrl: published ? release.public_url : null,zipObjectKey: release?.zip_object_key ?? null },
  });
}
