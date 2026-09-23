import { z } from 'zod';
import { ApiError,requireDB } from '../db/bindings';
import type { RuntimeEnv } from '../index';
import { getProjectStateRows,deriveProjectStateSummary } from '../repositories/projectStateRepository';
import { assertWorkflowGateAllowed } from '../workflow/WorkflowStateModule';
import { importBundle,loadManifest } from '../services/importService';
import { importLimits } from '../imports/evidenceImporter';
import { FilesRepository } from '../storage/filesRepository';
export async function boundedBody(request: Request,maxBytes: number): Promise<Uint8Array> {
  if (Number(request.headers.get('Content-Length')) > maxBytes) throw new ApiError('IMPORT_UPLOAD_TOO_LARGE',413,'The request exceeds the allowed size.');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  while (true) { const next = await reader.read(); if (next.done) break; length += next.value.length;
    if (length > maxBytes) { await reader.cancel(); throw new ApiError('IMPORT_UPLOAD_TOO_LARGE',413,'The request exceeds the allowed size.'); }
    chunks.push(next.value);
  }
  const result = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { result.set(chunk,offset); offset += chunk.length; } return result;
}
export async function jsonBody(request: Request,maxBytes = 100000): Promise<unknown> {
  try { return JSON.parse(new TextDecoder().decode(await boundedBody(request,maxBytes))); }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('INVALID_REQUEST',400,'The request must contain valid JSON.'); }
}
export async function projectRoutes(request: Request,env: RuntimeEnv): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname, db = requireDB(env);
  if (path === '/api/projects' && request.method === 'GET') return Response.json((await db.prepare('SELECT id,name,active_stage,updated_at FROM Projects ORDER BY updated_at DESC LIMIT 50').all()).results);
  if (path === '/api/projects' && request.method === 'POST') {
    const parsed = z.strictObject({ name: z.string().trim().min(1).max(100) }).safeParse(await jsonBody(request));
    if (!parsed.success) throw new ApiError('INVALID_REQUEST',400,'Enter a project name.');
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO Projects (id,name) VALUES (?,?)').bind(id,parsed.data.name).run();
    return Response.json({ id,name: parsed.data.name },{ status: 201 });
  }
  const match = path.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/(.+)$/);
  if (!match) return null;
  const [,projectId,action] = match;
  if (action === 'evidence' && request.method === 'GET') return Response.json(await loadManifest(projectId,env),{ headers: { 'Cache-Control': 'no-store' } });
  if (action === 'objects' && request.method === 'GET') {
    const key = url.searchParams.get('key');
    if (!key?.startsWith(`projects/${projectId}/`)) throw new ApiError('OBJECT_NOT_FOUND',404,'Object not found.');
    const object = await new FilesRepository(env).getObject(key);
    const type = object.httpMetadata?.contentType ?? 'application/octet-stream';
    return new Response(await object.arrayBuffer(),{ headers: { 'Content-Type': type.startsWith('image/') ? type : 'text/plain; charset=utf-8','X-Content-Type-Options': 'nosniff','Content-Security-Policy': "default-src 'none'; sandbox",'Cache-Control': 'private, max-age=300' } });
  }
  if ((action === 'imports' || action === 'actions/rebuild') && request.method === 'POST') {
    const rows = await getProjectStateRows(db,projectId);
    if (!rows) throw new ApiError('PROJECT_NOT_FOUND',404,'Project not found.');
    assertWorkflowGateAllowed(deriveProjectStateSummary(rows),action === 'imports' ? 'START_IMPORT' : 'REBUILD_PAGE');
    if (action === 'actions/rebuild') return null;
    let bytes: Uint8Array; let sourceType: string;
    if (request.headers.get('Content-Type')?.includes('application/json')) {
      const body = z.strictObject({ sourceType: z.literal('sample'),sampleId: z.string() }).safeParse(await jsonBody(request));
      if (!body.success) throw new ApiError('INVALID_REQUEST',400,'Choose a sample or upload an evidence ZIP.');
      if (body.data.sampleId !== 'spacejam-1996') throw new ApiError('IMPORT_SAMPLE_NOT_FOUND',400,'That sample is not available.');
      if (!env.ASSETS) throw new ApiError('SAMPLE_UNAVAILABLE',503,'Sample assets are not bound.');
      const sample = await env.ASSETS.fetch(new Request(new URL('/samples/spacejam-1996.zip',request.url)));
      if (!sample.ok) throw new ApiError('SAMPLE_UNAVAILABLE',503,'The sample bundle is unavailable.');
      bytes = await boundedBody(new Request(request.url,{ method: 'POST',body: await sample.arrayBuffer() }),importLimits.maxUploadBytes); sourceType = 'sample';
    } else if (request.headers.get('Content-Type')?.includes('multipart/form-data')) {
      const bounded = await boundedBody(request,importLimits.maxUploadBytes + 65536);
      const form = await new Response(Uint8Array.from(bounded).buffer,{ headers: { 'Content-Type': request.headers.get('Content-Type')! } }).formData();
      const file = form.get('bundle');
      if (!(file instanceof File)) throw new ApiError('IMPORT_BUNDLE_REQUIRED',400,'Choose an evidence ZIP file.');
      bytes = new Uint8Array(await file.arrayBuffer()); sourceType = 'upload';
    } else throw new ApiError('IMPORT_UNSUPPORTED_MEDIA_TYPE',415,'Use a sample selection or a multipart evidence ZIP.');
    return Response.json({ ...await importBundle(projectId,bytes,env),sourceType },{ status: 201 });
  }
  return null;
}
