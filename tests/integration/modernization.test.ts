// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import worker,{ type RuntimeEnv } from '../../src/worker';
import { SqliteD1 } from '../fixtures/db/sqliteD1';
import { MemoryBucket } from '../fixtures/files/memoryBucket';
import { securityEnv,authorHeaders } from '../fixtures/security/session-fixtures';
import { context } from '../fixtures/runtime-env';
import { importBundle,loadManifest } from '../../src/worker/services/importService';
import type { EvidenceManifest } from '../../src/shared/schemas/evidenceManifest';
import type { DesignSystemVersion } from '../../src/shared/schemas/designSystemVersion';
import type { PageSpecification } from '../../src/shared/schemas/pageSchema';
import { renderStaticPage } from '../../src/worker/services/staticRenderer';
import releaseWorker from '../../src/release-worker';
import { unzipSync,zipSync,strToU8 } from 'fflate';
import { sha256 } from '../../src/worker/storage/filesRepository';
let db: SqliteD1,env: RuntimeEnv,headers: Record<string,string>,manifest: EvidenceManifest;
const read = (path: string) => readFileSync(new URL(path,import.meta.url));
const tokens = JSON.parse(read('../fixtures/schemas/design-system-version.valid.json').toString()).tokens;
async function request(action: string,body?: unknown,method = body === undefined ? 'GET' : 'POST') {
  return worker.fetch(new Request(`https://reframe.test/api/projects/p/${action}`,{ method,headers,...(body === undefined ? {} : { body: JSON.stringify(body) }) }),env,context);
}
async function workspace() { return (await request('workspace')).json() as Promise<{ design: DesignSystemVersion; designHash: string; pages: { id: string; specification: PageSpecification | null }[] }>; }
beforeEach(async () => {
  db = new SqliteD1(read('../../migrations/0001_initial_workflow.sql').toString());
  db.sqlite.exec("INSERT INTO Projects (id,name) VALUES ('p','Space Jam')");
  env = { ...securityEnv,DB: db,FILES: new MemoryBucket(),OPENAI_API_KEY: 'test-only-never-sent',OPENAI_BUDGET_USD: '2' };
  await importBundle('p',Uint8Array.from(read('../../public/samples/spacejam-1996.zip')),env);
  manifest = await loadManifest('p',env);
  const session = await worker.fetch(new Request('https://reframe.test/api/session',{ headers: authorHeaders }),env,context);
  headers = { ...authorHeaders,Cookie: session.headers.get('Set-Cookie')!,'X-CSRF-Token': (await session.json() as { csrfToken: string }).csrfToken,'Content-Type': 'application/json' };
});
afterEach(() => { vi.unstubAllGlobals(); db.close(); });
function mockModel() {
  const page = manifest.pages[0],ref = { pageId: page.id,regionId: page.regions[0].id,sourceId: page.content[0].id };
  const fetchMock = vi.fn(async (_url: string,init: RequestInit) => {
    const input = JSON.parse(init.body as string),stage = input.text.format.name;
    const value = stage === 'reframe_evaluate' ? { summary: 'Test-only fixture evaluation',findings: [{ id: 'readability',category: 'readability',title: 'Review small navigation',description: 'Captured links use compact image labels.',severity: 'important',observedVsInferred: 'observed',evidenceRefs: [ref] }] }
      : stage === 'reframe_decompose' ? { components: [{ stableId: 'navigation',sourcePageId: page.id,semanticRole: 'navigation',reusableGroupId: 'nav',label: 'Source navigation',sourceIds: [page.content[0].id],regionId: page.regions[0].id,recommendation: 'rebuild',note: 'Preserve links' }] }
      : stage === 'reframe_design_system' ? { name: 'Test-only fixture design',tokens,componentStyles: [{ name: 'navigation',recipe: 'quiet',rationale: 'Content first' }],evidenceRationale: [{ decision: 'Readable source navigation',evidenceRefs: [ref] }] }
      : { sections: [{ id: 'hero',kind: 'hero',sourceIds: JSON.parse(input.input[0].content[0].text).page.content.map((item: { id: string }) => item.id),layout: 'grid',emphasis: 'accent' }] };
    return Response.json({ status: 'completed',output: [{ content: [{ type: 'output_text',text: JSON.stringify(value) }] }],usage: { input_tokens: 1200,output_tokens: 800 } });
  });
  vi.stubGlobal('fetch',fetchMock); return fetchMock;
}
it('runs validated model stages, freezes reviewed design, preserves source and requires individual page approval', async () => {
  const model = mockModel();
  expect((await request('design-systems',{})).status).toBe(409);
  expect(model).not.toHaveBeenCalled();
  for (const stage of ['evaluation','decomposition','design-systems']) expect((await request(stage,{})).status,stage).toBe(201);
  const draft = await workspace();
  expect((await request(`design-systems/${draft.design.id}/approve`,{ confirm: true,expectedHash: 'stale' })).status).toBe(409);
  expect((await request(`design-systems/${draft.design.id}/approve`,{ confirm: true,expectedHash: draft.designHash })).status).toBe(200);
  expect((await request(`design-systems/${draft.design.id}/tokens`,{ expectedHash: draft.designHash,tokens },'PATCH')).status).toBe(409);
  const page = manifest.pages[0];
  const built = await request(`pages/${page.id}/rebuild`,{}); expect(built.status,JSON.stringify(await built.clone().json())).toBe(201);
  const generated = await workspace(),spec = generated.pages[0].specification!;
  expect(spec.preservedContent).toEqual(page.content);
  const first = await renderStaticPage(spec,generated.design,manifest),second = await renderStaticPage(spec,generated.design,manifest);
  expect(first).toEqual(second); expect(first.html).not.toContain('<script');
  expect(first.css).toContain('@font-face'); expect(first.css).toContain('data:font/woff2');
  expect((await request(`pages/${page.id}/approve`,{ generationId: 'wrong',confirm: true })).status).toBe(409);
  expect((await request(`pages/${page.id}/approve`,{ generationId: spec.id,confirm: true })).status).toBe(200);
  const state = await (await request('state')).json() as { approvalCounts: { approved: number }; stages: { publish: { status: string } } };
  expect(state.stages.publish.status).toBe('Blocked');
  expect(db.sqlite.prepare('SELECT COUNT(*) n FROM PageApprovals').get()!.n).toBe(1);
  expect(model).toHaveBeenCalledTimes(4);
  for (const next of manifest.pages.slice(1)) {
    expect((await request(`pages/${next.id}/rebuild`,{})).status).toBe(201);
    const builtPage = (await workspace()).pages.find(page => page.id === next.id)!.specification!;
    expect((await request(`pages/${next.id}/approve`,{ generationId: builtPage.id,confirm: true })).status).toBe(200);
  }
  const publicEnv = { FILES: new MemoryBucket(),RELEASE_PUBLISH_SECRET: 'test-only-release-secret' };
  env.RELEASE_ORIGIN = 'https://releases.test'; env.RELEASE_PUBLISH_SECRET = publicEnv.RELEASE_PUBLISH_SECRET;
  vi.stubGlobal('fetch',vi.fn(async (url: string | URL,init?: RequestInit) => releaseWorker.fetch(new Request(url,init),publicEnv)));
  const published = await request('releases',{}); expect(published.status,JSON.stringify(await published.clone().json())).toBe(201);
  const release = await published.json() as { releaseId: string; publicUrl: string };
  const publicPage = await releaseWorker.fetch(new Request(release.publicUrl),publicEnv);
  expect(publicPage.status).toBe(200); expect(publicPage.headers.get('Cache-Control')).toContain('immutable');
  expect((await releaseWorker.fetch(new Request(`${env.RELEASE_ORIGIN}/api/projects`),publicEnv)).status).toBe(404);
  expect((await releaseWorker.fetch(new Request(release.publicUrl,{ method: 'POST' }),publicEnv)).status).toBe(405);
  expect((await releaseWorker.fetch(new Request(`${env.RELEASE_ORIGIN}/internal/publish`,{ method: 'POST' }),publicEnv)).status).toBe(401);
  const download = await request(`releases/${release.releaseId}/download`),zip = unzipSync(new Uint8Array(await download.arrayBuffer()));
  expect(new TextDecoder().decode(zip['index.html'])).toBe(await publicPage.text());
  expect(zip['the-lineup/index.html']).toBeTruthy(); expect(zip['jam-central/index.html']).toBeTruthy();
  expect(db.sqlite.prepare('SELECT public_state FROM Releases').get()!.public_state).toBe('published');
  const repeated = await releaseWorker.fetch(new Request(`${env.RELEASE_ORIGIN}/internal/publish`,{ method: 'POST',headers: { Authorization: `Bearer ${publicEnv.RELEASE_PUBLISH_SECRET}` },body: Uint8Array.from(zipSync(zip)) }),publicEnv);
  expect(repeated.status).toBe(200);
  const savedHome = await (await releaseWorker.fetch(new Request(release.publicUrl),publicEnv)).text();
  zip['index.html'] = strToU8(savedHome + '<p>Changed</p>');
  const changedManifest = JSON.parse(new TextDecoder().decode(zip['release-manifest.json']));
  const homeEntry = changedManifest.files.find((file: { path: string }) => file.path === 'index.html');
  homeEntry.sha256 = await sha256(Uint8Array.from(zip['index.html']).buffer); homeEntry.byteSize = zip['index.html'].length;
  zip['release-manifest.json'] = strToU8(JSON.stringify(changedManifest));
  const overwrite = await releaseWorker.fetch(new Request(`${env.RELEASE_ORIGIN}/internal/publish`,{ method: 'POST',headers: { Authorization: `Bearer ${publicEnv.RELEASE_PUBLISH_SECRET}` },body: Uint8Array.from(zipSync(zip)) }),publicEnv);
  expect(overwrite.status).toBe(409);
  expect(await (await releaseWorker.fetch(new Request(release.publicUrl),publicEnv)).text()).toBe(savedHome);
  expect((await request(`pages/${page.id}/rebuild`,{})).status).toBe(201);
  expect(model).toHaveBeenCalledTimes(6);
});
it('rejects malformed model output without advancing state, and retains a visible failed run', async () => {
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ status: 'completed',output: [{ content: [{ type: 'output_text',text: '{"invented":true}' }] }] })));
  const response = await request('evaluation',{});
  expect(response.status).toBe(422);
  expect(db.sqlite.prepare('SELECT findings_json FROM Projects').get()!.findings_json).toBeNull();
  expect(db.sqlite.prepare("SELECT status FROM GenerationRuns WHERE stage='evaluate'").get()!.status).toBe('failed');
});
it('persists reviewed component decisions and canvas positions, rejects stale board edits and freezes decisions once design begins', async () => {
  mockModel(); await request('evaluation',{}); await request('decomposition',{});
  const correction = await request('components/navigation/corrections',{ action: 'rename',value: 'Reviewed navigation' },'PATCH');
  expect(correction.status).toBe(200);
  expect(await correction.json()).toMatchObject({ effectiveComponent: { label: 'Reviewed navigation' } });
  const original = db.sqlite.prepare('SELECT evidence_json FROM Components').get()!.evidence_json as string;
  expect(JSON.parse(original).label).toBe('Source navigation');
  expect((await request('components/other/corrections',{ action: 'rename',value: 'Other' },'PATCH')).status).toBe(404);
  const board = { rowVersion: 0,nodes: [{ id: 'navigation',x: 520,y: -30 }],viewport: { x: 20,y: 40,zoom: .7 } };
  expect((await request('canvas-layout',board,'PUT')).status).toBe(200);
  expect(await (await request('canvas-layout')).json()).toEqual({ ...board,rowVersion: 1 });
  expect((await request('canvas-layout',board,'PUT')).status).toBe(409);
  await request('design-systems',{});
  expect((await request('components/navigation/corrections',{ action: 'rename',value: 'Too late' },'PATCH')).status).toBe(409);
});
it('does not contact the provider without both a key and approved budget', async () => {
  const model = mockModel(); env.OPENAI_BUDGET_USD = undefined;
  expect((await request('evaluation',{})).status).toBe(424); expect(model).not.toHaveBeenCalled();
  env.OPENAI_BUDGET_USD = '0.05';
  expect((await request('evaluation',{})).status).toBe(409); expect(model).not.toHaveBeenCalled();
});
