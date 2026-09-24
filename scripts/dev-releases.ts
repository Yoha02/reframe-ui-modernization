import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { loadLocalBindings } from './local-env';

const { RELEASE_PUBLISH_SECRET } = loadLocalBindings();
if (!RELEASE_PUBLISH_SECRET || RELEASE_PUBLISH_SECRET.length < 32) {
  throw new Error('Set RELEASE_PUBLISH_SECRET to at least 32 characters in your ignored .env file.');
}
const mf = new Miniflare(convertV4MiniflareOptions({
  host: '127.0.0.1', port: 8788, modules: true,
  scriptPath: 'dist/releases/index.js', compatibilityDate: '2026-09-01',
  r2Buckets: ['FILES'], r2Persist: '.wrangler/state/releases-r2',
  bindings: { RELEASE_PUBLISH_SECRET },
}));
await mf.ready;
process.stdout.write('Reframe local release service ready at http://127.0.0.1:8788\n');
process.on('SIGINT', async () => { await mf.dispose(); process.exit(0); });
