import type { ProjectStateResponse } from '../../shared/schemas/projectState';
import type { WorkflowAction, WorkflowGateDecision } from '../../shared/workflow/workflowTypes';
import { ApiError } from '../db/bindings';
export { mapRunStateToWorkflowStatus } from '../repositories/projectStateRepository';
const actionStage = { START_IMPORT: 'import',START_EVALUATION: 'evaluate',START_DECOMPOSITION: 'decompose',GENERATE_DESIGN_SYSTEM: 'design_system',APPROVE_DESIGN_SYSTEM: 'design_system',REBUILD_PAGE: 'rebuild',APPROVE_PAGE: 'review',PUBLISH_RELEASE: 'publish' } as const;
export const deriveStageStatuses = (state: ProjectStateResponse) => state.stages;
export function evaluateWorkflowGate(state: ProjectStateResponse, action: WorkflowAction): WorkflowGateDecision {
  const blocked = (reason: string,message: string): WorkflowGateDecision => ({ allowed: false,action,reason,message });
  if (state.generationRuns.some(run => run.status === 'Generating')) return blocked('ACTION_ALREADY_RUNNING','Wait for the current operation to finish.');
  if (action !== 'START_IMPORT' && state.stages.import.status !== 'Completed') return blocked('IMPORT_REQUIRED','Import source evidence first.');
  if (['START_DECOMPOSITION','GENERATE_DESIGN_SYSTEM','APPROVE_DESIGN_SYSTEM'].includes(action) && state.stages.evaluate.status !== 'Completed') return blocked('EVALUATION_REQUIRED','Evaluate the imported site first.');
  if (['GENERATE_DESIGN_SYSTEM','APPROVE_DESIGN_SYSTEM'].includes(action) && state.stages.decompose.status !== 'Completed') return blocked('DECOMPOSITION_REQUIRED','Map the existing components first.');
  if (action === 'APPROVE_DESIGN_SYSTEM' && !state.designSystem.draftVersionId) return blocked('DESIGN_SYSTEM_REQUIRED','Generate a design system before approving it.');
  if (['REBUILD_PAGE','APPROVE_PAGE','PUBLISH_RELEASE'].includes(action) && (!state.designSystem.approvedVersionId || state.designSystem.status !== 'Approved' || state.designSystem.needsRefresh)) return blocked('DESIGN_SYSTEM_APPROVAL_REQUIRED','Approve the current design system first.');
  if (action === 'APPROVE_PAGE' && !state.pages.length) return blocked('PAGE_REQUIRED','Select a rebuilt page to review.');
  if (action === 'PUBLISH_RELEASE' && (!state.pages.length || state.pages.some(page => page.approvalState !== 'Approved' || page.needsRefresh))) return blocked('PAGE_APPROVAL_REQUIRED','Rebuild and approve every included page using the current design system.');
  return { allowed: true,action,requiredRefs: state.designSystem.approvedVersionId ? { designSystemVersionId: state.designSystem.approvedVersionId } : {} };
}
export function assertWorkflowGateAllowed(state: ProjectStateResponse,action: WorkflowAction) {
  const decision = evaluateWorkflowGate(state,action);
  if (!decision.allowed) throw new ApiError('WORKFLOW_GATE_BLOCKED',409,decision.message,{ reason: decision.reason,stage: actionStage[action],action });
  return decision;
}
