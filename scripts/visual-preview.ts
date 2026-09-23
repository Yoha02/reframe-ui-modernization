import { Miniflare,convertV4MiniflareOptions } from 'miniflare';
import { randomBytes } from 'node:crypto';
const mf = new Miniflare(convertV4MiniflareOptions({ host: '127.0.0.1',port: 8789,modules: true,scriptPath: 'dist/visual-worker.js',compatibilityDate: '2026-09-01',d1Databases: ['DB'],r2Buckets: ['FILES'],bindings: { LOCAL_DEVELOPMENT: 'true',SESSION_SIGNING_SECRET: randomBytes(48).toString('hex'),OPENAI_API_KEY: 'visual-fixture-only',OPENAI_BUDGET_USD: '3' },assets: { directory: 'dist/client',binding: 'ASSETS',run_worker_first: true,routerConfig: { has_user_worker: true } } }));
await mf.ready;
process.stdout.write('Clearly labelled local visual fixture ready at http://127.0.0.1:8789\n');
process.on('SIGINT',async () => { await mf.dispose(); process.exit(0); });
