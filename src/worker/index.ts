import { z } from 'zod';
import { authorIdentity, createSessionCookie, readSession, SecurityError, type SecurityEnvironment } from './security/session';
import { createCsrfToken, validateCsrfToken } from './security/csrf';
import { ApiError, type D1Binding } from './db/bindings';
import { getProjectState } from './api/projectState';
import { projectRoutes } from './api/projectActions';
import { StorageError,type FilesEnvironment } from './storage/filesRepository';
import { modelRoutes } from './api/modelActions';
import { releaseRoutes } from './api/releases';
import { ensureDatabase } from './db/initialize';
import { canvasRoutes } from './api/canvas';
import { componentCorrectionRoutes } from './api/componentCorrections';
import { getModelProviderConfigStatus,type ModelEnv } from './model/providerAdapter';
export interface AssetFetcher { fetch(request: Request): Promise<Response> }
export interface RuntimeEnv extends SecurityEnvironment,FilesEnvironment,ModelEnv { ASSETS?: AssetFetcher; DB?: D1Binding; RELEASE_ORIGIN?: string; RELEASE_PUBLISH_SECRET?: string }
export interface RuntimeContext { waitUntil(promise: Promise<unknown>): void }

export default {
  async fetch(request: Request, env: RuntimeEnv, _ctx: RuntimeContext): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/api/config/status' && request.method === 'GET') return Response.json(getModelProviderConfigStatus(env),{ headers: { 'Cache-Control': 'no-store' } });
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
        if (env.DB) await ensureDatabase(env.DB);
        if (['POST','PUT','PATCH','DELETE'].includes(request.method)) {
          const origin = request.headers.get('Origin');
          if (origin && origin !== new URL(request.url).origin) throw new SecurityError('csrf_invalid',403,'Cross-origin changes are not accepted.');
          await validateCsrfToken(request.headers.get('X-CSRF-Token'),session,env);
        }
        const stateMatch = path.match(/^\/api\/projects\/([^/]+)\/state$/);
        if (stateMatch && request.method === 'GET') return await getProjectState(stateMatch[1],env);
        const canvas = await canvasRoutes(request,env);
        if (canvas) return canvas;
        const correction = await componentCorrectionRoutes(request,env);
        if (correction) return correction;
        const response = await projectRoutes(request,env);
        if (response) return response;
        const generated = await modelRoutes(request,env);
        if (generated) return generated;
        const released = await releaseRoutes(request,env);
        if (released) return released;
      }
    } catch (error) {
      if (error instanceof z.ZodError) return Response.json({ error: { code: 'INVALID_REQUEST',message: 'The request did not match the expected format.' } },{ status: 400 });
      if (error instanceof SecurityError) return Response.json({ errorCode: error.errorCode, message: error.message },{ status: error.status, headers: { 'Cache-Control': 'no-store' } });
      if (error instanceof ApiError) return Response.json({ error: { code: error.code,message: error.message,details: error.details } },{ status: error.status,headers: { 'Cache-Control': 'no-store' } });
      if (error instanceof StorageError) return Response.json({ error: { code: error.errorCode,message: error.message } },{ status: error.errorCode === 'object_not_found' ? 404 : 503 });
      return Response.json({ error: { code: 'INTERNAL_ERROR',message: 'The request could not be completed.' } },{ status: 500 });
    }
    if (path === '/api' || path.startsWith('/api/')) {
      return Response.json({ error: 'not_found', path }, { status: 404 });
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Static application assets are not bound.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  },
};
