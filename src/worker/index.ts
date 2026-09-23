export interface AssetFetcher { fetch(request: Request): Promise<Response> }
export interface RuntimeEnv { ASSETS?: AssetFetcher }
export interface RuntimeContext { waitUntil(promise: Promise<unknown>): void }

export default {
  async fetch(request: Request, env: RuntimeEnv, _ctx: RuntimeContext): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/api' || path.startsWith('/api/')) {
      return Response.json({ error: 'not_found', path }, { status: 404 });
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Static application assets are not bound.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  },
};
