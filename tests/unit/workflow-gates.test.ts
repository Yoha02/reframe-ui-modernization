import { describe, expect, it } from 'vitest';
import { evaluateWorkflowGate } from '../../src/worker/workflow/WorkflowStateModule';
import { deriveProjectStateSummary, type ProjectStateRows } from '../../src/worker/repositories/projectStateRepository';
const rows: ProjectStateRows = {
  project: { id: 'p',name: 'Example',created_at: 'now',updated_at: 'now',source_fingerprint: 'source',manifest_json: '{}',findings_json: null },
  pages: [{ id: 'home',route: '/',title: 'Home',status: 'imported',specification_hash: null,specification_json: null }], designs: [],runs: [],approvals: [],releases: [],componentCount: 0,
};
describe('authoritative workflow gates', () => {
  it('requires evaluation, decomposition and explicit design approval', () => {
    const imported = deriveProjectStateSummary(rows);
    expect(evaluateWorkflowGate(imported,'START_EVALUATION').allowed).toBe(true);
    expect(evaluateWorkflowGate(imported,'GENERATE_DESIGN_SYSTEM')).toMatchObject({ allowed: false,reason: 'EVALUATION_REQUIRED' });
    expect(evaluateWorkflowGate(imported,'REBUILD_PAGE')).toMatchObject({ allowed: false,reason: 'DESIGN_SYSTEM_APPROVAL_REQUIRED' });
    const evaluated = deriveProjectStateSummary({ ...rows,project: { ...rows.project,findings_json: '{}' } });
    expect(evaluateWorkflowGate(evaluated,'GENERATE_DESIGN_SYSTEM')).toMatchObject({ reason: 'DECOMPOSITION_REQUIRED' });
  });
  it('allows current approved pages only and never mutates a published release', () => {
    const ready = deriveProjectStateSummary({ ...rows,project: { ...rows.project,findings_json: '{}' },componentCount: 1,
      designs: [{ id: 'design',status: 'approved',active: 1,source_fingerprint: 'source',version: 1 }],
      pages: [{ ...rows.pages[0],specification_hash: 'hash',specification_json: '{}' }],
      approvals: [{ page_id: 'home',design_system_version_id: 'design',specification_hash: 'hash' }] });
    expect(evaluateWorkflowGate(ready,'PUBLISH_RELEASE').allowed).toBe(true);
    ready.pages[0].needsRefresh = true;
    expect(evaluateWorkflowGate(ready,'PUBLISH_RELEASE')).toMatchObject({ reason: 'PAGE_APPROVAL_REQUIRED' });
    ready.designSystem.needsRefresh = true;
    expect(evaluateWorkflowGate(ready,'REBUILD_PAGE')).toMatchObject({ reason: 'DESIGN_SYSTEM_APPROVAL_REQUIRED' });
  });
  it('blocks duplicate operations while preserving the original run', () => {
    const state = deriveProjectStateSummary(rows);
    state.generationRuns.push({ id: 'run',stage: 'evaluate',status: 'Generating',retryable: false,startedAt: 'now',completedAt: null,errorCode: null });
    expect(evaluateWorkflowGate(state,'START_EVALUATION')).toMatchObject({ reason: 'ACTION_ALREADY_RUNNING' });
  });
});
