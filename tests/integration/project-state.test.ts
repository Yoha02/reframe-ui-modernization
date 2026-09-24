// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import worker from '../../src/worker';
import { deriveProjectStateSummary, getProjectStateRows } from '../../src/worker/repositories/projectStateRepository';
import { parseProjectStateResponse } from '../../src/shared/schemas/projectState';
import { SqliteD1 } from '../fixtures/db/sqliteD1';
import { securityEnv,authorHeaders } from '../fixtures/security/session-fixtures';
import { context } from '../fixtures/runtime-env';
const read = (path: string) => readFileSync(new URL(path,import.meta.url),'utf8');
let db: SqliteD1;
beforeEach(() => { db = new SqliteD1(read('../../migrations/0001_initial_workflow.sql')); db.sqlite.exec(read('../fixtures/db/seed-workflow.sql')); });
afterEach(() => db.close());
it('aggregates persisted design approvals and releases without inventing publication or exposing secrets', async () => {
  const state = deriveProjectStateSummary((await getProjectStateRows(db,'sample-project'))!);
  expect(state.designSystem.approvedVersionId).toBe('sample-design');
  expect(state.release.status).toBe('Draft'); expect(state.release.publicUrl).toBeNull();
  expect(() => parseProjectStateResponse({ ...state,stages: {} })).toThrow();
  expect(JSON.stringify(state)).not.toMatch(/apiKey|providerKey|credential|secret|token/);
});
it('preserves empty and failed states and blocks stale approvals', async () => {
  db.sqlite.exec("INSERT INTO Projects (id,name) VALUES ('empty','Empty')");
  const empty = deriveProjectStateSummary((await getProjectStateRows(db,'empty'))!);
  expect(empty.pages).toEqual([]); expect(empty.stages.import.status).toBe('Draft');
  db.sqlite.exec("UPDATE GenerationRuns SET status = 'retryable', failed_at = started_at, error_json = '{\"code\":\"MODEL_TIMEOUT\"}'; UPDATE Projects SET source_fingerprint = 'changed'");
  const failed = deriveProjectStateSummary((await getProjectStateRows(db,'sample-project'))!);
  expect(failed.generationRuns[0]).toMatchObject({ status: 'Failed',retryable: true,errorCode: 'MODEL_TIMEOUT' });
  expect(failed.designSystem.needsRefresh).toBe(true); expect(failed.approvals.approvedPageCount).toBe(0);
});
it('serves the authenticated Worker state route and honest missing-project response without other services', async () => {
  const staticFetch = vi.fn(); const env = { ...securityEnv,DB: db,ASSETS: { fetch: staticFetch } };
  const session = await worker.fetch(new Request('https://reframe.test/api/session',{ headers: authorHeaders }),env,context);
  const headers = { ...authorHeaders,Cookie: session.headers.get('Set-Cookie')! };
  const response = await worker.fetch(new Request('https://reframe.test/api/projects/sample-project/state',{ headers }),env,context);
  expect(response.status).toBe(200); expect(parseProjectStateResponse(await response.json()).project.id).toBe('sample-project');
  const missing = await worker.fetch(new Request('https://reframe.test/api/projects/missing/state',{ headers }),env,context);
  expect(missing.status).toBe(404); expect(await missing.json()).toMatchObject({ error: { code: 'PROJECT_NOT_FOUND' } });
  expect(staticFetch).not.toHaveBeenCalled();
});
