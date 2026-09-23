import { authorIdentity, createSessionCookie, readSession, SecurityError, type SecurityEnvironment } from './security/session';
import { createCsrfToken, validateCsrfToken } from './security/csrf';
export interface AssetFetcher { fetch(request: Request): Promise<Response> }
export interface RuntimeEnv extends SecurityEnvironment { ASSETS?: AssetFetcher }
export interface RuntimeContext { waitUntil(promise: Promise<unknown>): void }

export default {
  async fetch(request: Request, env: RuntimeEnv, _ctx: RuntimeContext): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/api/session' && request.method === 'GET') {
        const subject = authorIdentity(request,env);
        let session; let cookie: string | undefined;
        try { session = await readSession(request,env); }
        catch (error) {
          if (!(error instanceof SecurityError) || error.status !== 401) throw error;
          const created = await createSessionCookie(env,subject); session = created.session; cookie = created.cookie;
        }
        return Response.json({ csrfToken: await createCsrfToken(session,env), expiresAt: new Date(session.expiresAt).toISOString() },
          { headers: { 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
      }
      if (path === '/api/projects' || path.startsWith('/api/projects/')) {
        const session = await readSession(request,env);
        if (['POST','PUT','PATCH','DELETE'].includes(request.method)) {
          const origin = request.headers.get('Origin');
          if (origin && origin !== new URL(request.url).origin) throw new SecurityError('csrf_invalid',403,'Cross-origin changes are not accepted.');
          await validateCsrfToken(request.headers.get('X-CSRF-Token'),session,env);
        }
      }
    } catch (error) {
      if (error instanceof SecurityError) return Response.json({ errorCode: error.errorCode, message: error.message },{ status: error.status, headers: { 'Cache-Control': 'no-store' } });
      throw error;
    }
    if (path === '/api' || path.startsWith('/api/')) {
      return Response.json({ error: 'not_found', path }, { status: 404 });
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Static application assets are not bound.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  },
};
