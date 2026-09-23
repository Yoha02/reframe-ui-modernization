export const workflowStages = ['import','evaluate','decompose','design_system','rebuild','review','publish'] as const;
export const workflowActions = ['START_IMPORT','START_EVALUATION','START_DECOMPOSITION','GENERATE_DESIGN_SYSTEM','APPROVE_DESIGN_SYSTEM','REBUILD_PAGE','APPROVE_PAGE','PUBLISH_RELEASE'] as const;
export type WorkflowAction = typeof workflowActions[number];
export type WorkflowGateDecision = { allowed: true; action: WorkflowAction; requiredRefs: { designSystemVersionId?: string } } |
  { allowed: false; action: WorkflowAction; reason: string; message: string };
