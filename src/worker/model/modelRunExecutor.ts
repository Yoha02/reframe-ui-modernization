import type { z } from 'zod';
import { ApiError,type D1Binding,type D1Statement } from '../db/bindings';
import { sha256 } from '../storage/filesRepository';
import { callOpenAI,getModelProviderConfigStatus,type ModelEnv,type ProviderCall } from './providerAdapter';
export async function executeModelRun<T>(options: { projectId: string; pageId?: string; stage: string; fingerprint: string; context: string; instruction: string; schema: z.ZodType<T>; images?: { mediaType: string; base64: string }[]; db: D1Binding; env: ModelEnv; provider?: ProviderCall; validate: (value: T) => void; persist: (value: T,runId: string) => Promise<D1Statement[]> }) {
  const { db,env } = options;
  const config = getModelProviderConfigStatus(env);
  if (!config.ready) throw new ApiError('MODEL_CONFIGURATION_MISSING',424,'Live generation needs an OpenAI key and an approved spending limit.',{ missing: config.missing });
  const dependency = await sha256(new TextEncoder().encode(JSON.stringify([options.fingerprint,options.context,options.instruction,config.selectedModel.value])).buffer);
  const cacheKey = `${options.stage}:${options.pageId ?? 'project'}:${dependency}`;
  const cached = await db.prepare("SELECT id,result_json FROM GenerationRuns WHERE project_id = ? AND cache_key = ? AND dependency_fingerprint = ? AND status = 'completed' ORDER BY started_at DESC LIMIT 1").bind(options.projectId,cacheKey,options.fingerprint).first<{ id: string; result_json: string }>();
  if (cached) { const value = options.schema.parse(JSON.parse(cached.result_json)); options.validate(value); return { runId: cached.id,status: 'completed',cached: true,result: value }; }
  const runId = crypto.randomUUID(), startedAt = new Date().toISOString();
  // Conservative reservation (not an exact provider bill). Failed/unknown requests retain it.
  const reservation = 0.1;
  const started = await db.prepare(`INSERT INTO GenerationRuns (id,project_id,page_id,stage,status,dependency_fingerprint,cache_key,started_at,usage_json)
    SELECT ?,?,?,?,'started',?,?,?,? WHERE
    COALESCE((SELECT SUM(CAST(json_extract(usage_json,'$.reservedUsd') AS REAL)) FROM GenerationRuns),0) + ? <= ?
    AND NOT EXISTS (SELECT 1 FROM GenerationRuns WHERE project_id = ? AND status = 'started')`)
    .bind(runId,options.projectId,options.pageId ?? null,options.stage,options.fingerprint,cacheKey,startedAt,JSON.stringify({ reservedUsd: reservation }),reservation,config.budget.limit,options.projectId).run();
  if (!started.meta?.changes) throw new ApiError('MODEL_BUDGET_OR_RUN_BLOCKED',409,'The spending limit is reached or another operation is still running.');
  try {
    const response = await (options.provider ?? callOpenAI)({ schema: options.schema,name: `reframe_${options.stage}`,instruction: options.instruction,context: options.context,images: options.images ?? [],env });
    const parsed = options.schema.safeParse(response.value);
    if (!parsed.success) throw new ApiError('MODEL_RESPONSE_VALIDATION_FAILED',422,'The model result did not match the required format. No downstream result was saved.');
    options.validate(parsed.data);
    const writes = await options.persist(parsed.data,runId);
    const usage = { reservedUsd: reservation,inputTokens: response.inputTokens,outputTokens: response.outputTokens,estimatedUsd: (response.inputTokens * 0.4 + response.outputTokens * 1.6) / 1e6 };
    await db.batch([...writes,db.prepare("UPDATE GenerationRuns SET status = 'completed',completed_at = ?,result_json = ?,usage_json = ? WHERE id = ? AND status = 'started'").bind(new Date().toISOString(),JSON.stringify(parsed.data),JSON.stringify(usage),runId)]);
    return { runId,status: 'completed',cached: false,result: parsed.data };
  } catch (error) {
    const code = error instanceof ApiError ? error.code : 'GENERATION_FAILED';
    await db.prepare("UPDATE GenerationRuns SET status = 'failed',failed_at = ?,error_json = ? WHERE id = ? AND status = 'started'").bind(new Date().toISOString(),JSON.stringify({ code }),runId).run();
    if (error instanceof ApiError) throw error;
    throw new ApiError(code,500,'Generation could not be saved. Review the failed run and try again.');
  }
}
