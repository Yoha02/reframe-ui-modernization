import { z } from 'zod';
import type { Component } from '../../shared/schemas/modelResponses';
import { ApiError,requireDB } from '../db/bindings';
import { authorIdentity } from '../security/session';
import { jsonBody } from './projectActions';
import type { RuntimeEnv } from '../index';
const CorrectionSchema = z.discriminatedUnion('action',[
  z.strictObject({ action: z.literal('rename'),value: z.string().trim().min(1).max(150) }),
  z.strictObject({ action: z.literal('reclassify'),value: z.enum(['navigation','brand','hero','content','image','footer']) }),
  z.strictObject({ action: z.literal('recommend'),value: z.enum(['retain','rebuild','merge']) }),
  z.strictObject({ action: z.literal('updateAnnotation'),value: z.string().trim().min(1).max(800) }),
  z.strictObject({ action: z.literal('reject'),value: z.boolean() }),
]);
type Correction = z.infer<typeof CorrectionSchema> & { at: string; by: string };
export function effectiveComponent(row: { evidence_json: string; decision_json: string | null }): Component & { rejected: boolean } {
  const result = { ...JSON.parse(row.evidence_json) as Component,rejected: false };
  for (const correction of JSON.parse(row.decision_json || '[]') as Correction[]) {
    if (correction.action === 'rename') result.label = correction.value;
    if (correction.action === 'reclassify') result.semanticRole = correction.value;
    if (correction.action === 'recommend') result.recommendation = correction.value;
    if (correction.action === 'updateAnnotation') result.note = correction.value;
    if (correction.action === 'reject') result.rejected = correction.value;
  }
  return result;
}
export async function componentCorrectionRoutes(request: Request,env: RuntimeEnv) {
  const match = new URL(request.url).pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/components\/([a-zA-Z0-9_-]+)\/corrections$/);
  if (!match || request.method !== 'PATCH') return null;
  const [,projectId,componentId] = match,db = requireDB(env);
  const row = await db.prepare('SELECT id,evidence_json,decision_json FROM Components WHERE project_id = ? AND id = ?').bind(projectId,`${projectId}_${componentId}`).first<{ id: string; evidence_json: string; decision_json: string | null }>();
  if (!row) throw new ApiError('COMPONENT_NOT_FOUND',404,'Component not found.');
  if (await db.prepare('SELECT id FROM DesignSystemVersions WHERE project_id = ? LIMIT 1').bind(projectId).first()) throw new ApiError('COMPONENT_REVIEW_CLOSED',409,'The design already uses this component review. Source decisions are frozen for this project.');
  const correction = CorrectionSchema.parse(await jsonBody(request)),history = JSON.parse(row.decision_json || '[]') as Correction[];
  if (history.length >= 20) throw new ApiError('CORRECTION_LIMIT',409,'This component has reached its review history limit.');
  history.push({ ...correction,at: new Date().toISOString(),by: authorIdentity(request,env) });
  const next = JSON.stringify(history);
  const result = await db.prepare('UPDATE Components SET decision_json = ? WHERE id = ? AND decision_json IS ? AND NOT EXISTS (SELECT 1 FROM DesignSystemVersions WHERE project_id = ?) AND NOT EXISTS (SELECT 1 FROM GenerationRuns WHERE project_id = ? AND status = \'started\')').bind(next,row.id,row.decision_json,projectId,projectId).run();
  if (!result.meta?.changes) throw new ApiError('COMPONENT_CHANGED',409,'The component changed or generation started. Reload before editing.');
  return Response.json({ effectiveComponent: effectiveComponent({ ...row,decision_json: next }) });
}
