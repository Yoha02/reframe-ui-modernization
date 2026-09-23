import { z } from 'zod';
import { IdSchema, WorkflowStageSchema } from './common';
export const StageStatusSchema = z.enum(['Draft','Ready','Generating','Failed','Approved','Needs refresh','Published','Blocked','Completed']);
export const StageSummarySchema = z.strictObject({ key: WorkflowStageSchema, label: z.string(), status: StageStatusSchema, blockedReason: z.string().nullable(), primaryAction: z.string().nullable() });
export const ProjectStateResponseSchema = z.strictObject({
  project: z.strictObject({ id: IdSchema, name: z.string(), createdAt: z.string(), updatedAt: z.string() }),
  stages: z.record(WorkflowStageSchema,StageSummarySchema),
  pages: z.array(z.strictObject({ id: IdSchema, route: z.string(), title: z.string(), status: StageStatusSchema, approvalState: z.enum(['Draft','Approved']), needsRefresh: z.boolean(), latestGenerationRunId: z.string().nullable() })),
  designSystem: z.strictObject({ draftVersionId: z.string().nullable(), approvedVersionId: z.string().nullable(), status: StageStatusSchema, needsRefresh: z.boolean() }),
  generationRuns: z.array(z.strictObject({ id: IdSchema, stage: WorkflowStageSchema, status: StageStatusSchema, retryable: z.boolean(), startedAt: z.string(), completedAt: z.string().nullable(), errorCode: z.string().nullable() })),
  approvals: z.strictObject({ approvedPageCount: z.number().int().nonnegative(), requiredPageCount: z.number().int().nonnegative() }),
  release: z.strictObject({ latestReleaseId: z.string().nullable(), status: StageStatusSchema, publicUrl: z.string().nullable(), zipObjectKey: z.string().nullable() }),
});
export type ProjectStateResponse = z.infer<typeof ProjectStateResponseSchema>;
export type StageStatus = z.infer<typeof StageStatusSchema>;
export const parseProjectStateResponse = (value: unknown) => ProjectStateResponseSchema.parse(value);
