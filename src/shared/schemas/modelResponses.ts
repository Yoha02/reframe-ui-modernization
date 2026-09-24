import { z } from 'zod';
import { IdSchema } from './common';
import { DesignTokensSchema } from './designSystemVersion';
import { ComponentKindSchema } from './pageSchema';
export const MODEL_RESPONSE_SCHEMA_VERSION = '1';
const EvidenceRef = z.strictObject({ pageId: IdSchema,regionId: IdSchema.nullable(),sourceId: IdSchema.nullable() });
export const EvaluationSchema = z.strictObject({
  summary: z.string().min(1).max(2000),
  findings: z.array(z.strictObject({ id: IdSchema,category: z.enum(['navigation','readability','semantics','responsiveness','consistency','preservation']),title: z.string().min(1).max(150),description: z.string().min(1).max(1500),severity: z.enum(['opportunity','important','critical']),observedVsInferred: z.enum(['observed','inferred']),evidenceRefs: z.array(EvidenceRef).min(1).max(10) })).min(1).max(20),
});
export const DecompositionSchema = z.strictObject({ components: z.array(z.strictObject({ stableId: IdSchema,sourcePageId: IdSchema,semanticRole: z.enum(['navigation','brand','hero','content','image','footer']),reusableGroupId: IdSchema,label: z.string().min(1).max(150),sourceIds: z.array(IdSchema).min(1).max(100),regionId: IdSchema,recommendation: z.enum(['retain','rebuild','merge']),note: z.string().max(1000) })).min(1).max(40) });
export const DesignResponseSchema = z.strictObject({ name: z.string().min(1).max(150),tokens: DesignTokensSchema,
  componentStyles: z.array(z.strictObject({ name: z.string().min(1).max(100),recipe: z.enum(['solid','outline','quiet','elevated']),rationale: z.string().max(1500) })).min(1).max(20),
  evidenceRationale: z.array(z.strictObject({ decision: z.string().min(1).max(1500),evidenceRefs: z.array(EvidenceRef).min(1).max(10) })).min(1).max(20),
});
export const PagePlanSchema = z.strictObject({ sections: z.array(z.strictObject({ id: IdSchema,kind: ComponentKindSchema,sourceIds: z.array(IdSchema).min(1).max(100),layout: z.enum(['stack','split','grid','wide']),emphasis: z.enum(['normal','quiet','accent']) })).min(1).max(30) });
export const parseEvaluationFindingsResponse = (value: unknown) => EvaluationSchema.parse(value);
export const parseComponentDecompositionResponse = (value: unknown) => DecompositionSchema.parse(value);
export const parseDesignTokensResponse = (value: unknown) => DesignResponseSchema.parse(value);
export const parsePagePlanResponse = (value: unknown) => PagePlanSchema.parse(value);
export type Evaluation = z.infer<typeof EvaluationSchema>;
export type Component = z.infer<typeof DecompositionSchema>['components'][number];
export type PagePlan = z.infer<typeof PagePlanSchema>;
