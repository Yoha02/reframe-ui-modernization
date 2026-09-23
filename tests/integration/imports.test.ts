// @vitest-environment node
import { readFileSync } from 'node:fs';
import { zipSync,strToU8 } from 'fflate';
import { afterEach,beforeEach,expect,it } from 'vitest';
import worker from '../../src/worker';
import { SqliteD1 } from '../fixtures/db/sqliteD1';
import { MemoryBucket } from '../fixtures/files/memoryBucket';
import { securityEnv,authorHeaders } from '../fixtures/security/session-fixtures';
import { context } from '../fixtures/runtime-env';
import { readBoundedZip,validateEvidenceBundle } from '../../src/worker/imports/evidenceImporter';
let db: SqliteD1;
const archive = Uint8Array.from(readFileSync(new URL('../../public/samples/spacejam-1996.zip',import.meta.url)));
beforeEach(() => { db = new SqliteD1(readFileSync(new URL('../../migrations/0001_initial_workflow.sql',import.meta.url),'utf8')); db.sqlite.exec("INSERT INTO Projects (id,name) VALUES ('p','Space Jam')"); });
afterEach(() => db.close());
it('validates the three-page real capture with exact reference hashes', async () => {
  const { manifest } = await validateEvidenceBundle(archive);
  expect(manifest.pages.map(page => page.title)).toEqual(['Home','The Lineup','Jam Central']);
  expect(manifest.pages.every(page => page.regions.length > 0)).toBe(true);
  expect(manifest.pages[1].links.some(link => link.origin === 'image_map')).toBe(true);
});
it('imports through the Worker, persists state and blocks rebuild before explicit approval', async () => {
  const files = new MemoryBucket();
  const env = { ...securityEnv,DB: db,FILES: files,ASSETS: { fetch: async () => new Response(archive) } };
  const session = await worker.fetch(new Request('https://reframe.test/api/session',{ headers: authorHeaders }),env,context);
  const body = await session.json() as { csrfToken: string };
  const headers = { ...authorHeaders,Cookie: session.headers.get('Set-Cookie')!,'X-CSRF-Token': body.csrfToken,'Content-Type': 'application/json' };
  const response = await worker.fetch(new Request('https://reframe.test/api/projects/p/imports',{ method: 'POST',headers,body: JSON.stringify({ sourceType: 'sample',sampleId: 'spacejam-1996' }) }),env,context);
  expect(response.status).toBe(201); expect(await response.json()).toMatchObject({ status: 'completed',sourceType: 'sample' });
  expect(db.sqlite.prepare('SELECT COUNT(*) n FROM Pages').get()?.n).toBe(3);
  expect(files.objects.size).toBe(23);
  const blocked = await worker.fetch(new Request('https://reframe.test/api/projects/p/actions/rebuild',{ method: 'POST',headers,body: '{}' }),env,context);
  expect(blocked.status).toBe(409); expect(await blocked.json()).toMatchObject({ error: { code: 'WORKFLOW_GATE_BLOCKED',details: { reason: 'DESIGN_SYSTEM_APPROVAL_REQUIRED' } } });
  expect(db.sqlite.prepare("SELECT COUNT(*) n FROM GenerationRuns WHERE stage = 'rebuild'").get()?.n).toBe(0);
});
it('rejects traversal, duplicate casing, excessive counts, size lies and missing manifests before storage', async () => {
  expect(() => readBoundedZip(zipSync({ '../secret': strToU8('secret') }))).toThrow(expect.objectContaining({ code: 'IMPORT_PATH_TRAVERSAL' }));
  expect(() => readBoundedZip(zipSync({ 'a.txt': strToU8('a'),'A.txt': strToU8('b') }))).toThrow(expect.objectContaining({ code: 'IMPORT_DUPLICATE_PATH' }));
  expect(() => readBoundedZip(zipSync({ 'a.txt': strToU8('aaa') }),{ maxUploadBytes: 1000,maxExpandedBytes: 10,maxFileBytes: 1,maxFileCount: 2 })).toThrow(expect.objectContaining({ code: 'IMPORT_FILE_TOO_LARGE' }));
  await expect(validateEvidenceBundle(zipSync({ 'source.html': strToU8('<script>alert(1)</script>') }))).rejects.toMatchObject({ code: 'IMPORT_INCOMPATIBLE_MANIFEST' });
});
