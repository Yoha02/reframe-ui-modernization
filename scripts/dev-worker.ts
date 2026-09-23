import { Miniflare,convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const mf = new Miniflare(convertV4MiniflareOptions({
  host: '127.0.0.1',port: 8787,modules: true,scriptPath: 'dist/worker/index.js',compatibilityDate: '2026-09-01',
  d1Databases: ['DB'],d1Persist: '.wrangler/state/d1',r2Buckets: ['FILES'],r2Persist: '.wrangler/state/r2',
  bindings: { LOCAL_DEVELOPMENT: 'true',SESSION_SIGNING_SECRET: randomBytes(48).toString('hex') },
  assets: { directory: 'dist/client',binding: 'ASSETS',run_worker_first: true,routerConfig: { has_user_worker: true } },
}));
await mf.ready;
const db = await mf.getD1Database('DB');
const exists = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Projects'").first();
if (!exists) {
  const sql = await readFile('migrations/0001_initial_workflow.sql','utf8');
  const statements = sql.split(/;\s*(?=CREATE|--|$)/i).map(value => value.trim()).filter(Boolean);
  await db.batch(statements.map(statement => db.prepare(statement)));
}
process.stdout.write('Reframe local Worker ready at http://127.0.0.1:8787 (persistent D1 and FILES; live AI disabled).\n');
process.on('SIGINT',async () => { await mf.dispose(); process.exit(0); });
