import { z } from 'zod';
import { IdSchema, RunStatusSchema, Sha256Schema, TimestampSchema, WorkflowStageSchema } from './common';

export const GenerationRunSchema = z.strictObject({
  id: IdSchema, projectId: IdSchema, pageId: IdSchema.optional(), stage: WorkflowStageSchema, status: RunStatusSchema,
  retryCount: z.number().int().min(0).max(1), maxAttempts: z.number().int().min(1).max(2),
  dependencyFingerprint: Sha256Schema, cacheKey: z.string().min(1).max(500), cachedFromRunId: IdSchema.optional(),
  startedAt: TimestampSchema, completedAt: TimestampSchema.optional(), failedAt: TimestampSchema.optional(),
  durationMs: z.number().int().nonnegative().optional(), errorCode: z.string().max(100).optional(),
  model: z.string().max(100).optional(), inputTokens: z.number().int().nonnegative().optional(), outputTokens: z.number().int().nonnegative().optional(),
}).superRefine((run, ctx) => {
  if (['completed', 'cached'].includes(run.status) && !run.completedAt) ctx.addIssue({ code: 'custom', message: 'Completed runs require completedAt' });
  if (['failed', 'retryable'].includes(run.status) && (!run.failedAt || !run.errorCode)) ctx.addIssue({ code: 'custom', message: 'Failures require failedAt and errorCode' });
  if (run.status === 'cached' && !run.cachedFromRunId) ctx.addIssue({ code: 'custom', message: 'Cache hits require source run provenance' });
  if (run.status === 'retryable' && run.retryCount + 1 >= run.maxAttempts) ctx.addIssue({ code: 'custom', message: 'Retry limit exhausted' });
});
export type GenerationRun = z.infer<typeof GenerationRunSchema>;
