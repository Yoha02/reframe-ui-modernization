import { ReleaseTransferSchema } from '../shared/schemas/releaseTransfer';
import { SafePathSchema,IdSchema } from '../shared/schemas/common';
import { readBoundedZip } from '../worker/imports/evidenceImporter';
import { sha256,type FilesEnvironment } from '../worker/storage/filesRepository';
export interface ReleaseEnv extends FilesEnvironment { RELEASE_PUBLISH_SECRET?: string; }
const securityHeaders = { 'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'X-Content-Type-Options': 'nosniff','Referrer-Policy': 'no-referrer' };
export default { async fetch(request: Request,env: ReleaseEnv): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/internal/publish') {
    if (request.method !== 'POST') return new Response('Method not allowed',{ status: 405 });
    if (!env.RELEASE_PUBLISH_SECRET || request.headers.get('Authorization') !== `Bearer ${env.RELEASE_PUBLISH_SECRET}`) return new Response('Unauthorized',{ status: 401 });
    if (!env.FILES) return new Response('Storage unavailable',{ status: 503 });
    try {
      const reader = request.body?.getReader(); if (!reader) return new Response('Bundle required',{ status: 400 });
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > 20 * 1024 * 1024) { await reader.cancel(); return new Response('Bundle too large',{ status: 413 }); } chunks.push(next.value); }
      const bytes = new Uint8Array(size); let at = 0; for (const chunk of chunks) { bytes.set(chunk,at); at += chunk.length; }
      const files = readBoundedZip(bytes),raw = files.get('release-manifest.json'); if (!raw) return new Response('Manifest required',{ status: 400 });
      const manifest = ReleaseTransferSchema.parse(JSON.parse(new TextDecoder().decode(raw))),digest = await sha256(Uint8Array.from(raw).buffer);
      if (files.size !== manifest.files.length + 1) return new Response('Unexpected files',{ status: 400 });
      const markerKey = `releases/${manifest.releaseId}/published.json`,existing = await env.FILES.get(markerKey);
      if (existing) { const marker = JSON.parse(new TextDecoder().decode(await existing.arrayBuffer())); return Response.json({ releaseId: manifest.releaseId },{ status: marker.digest === digest ? 200 : 409 }); }
      for (const entry of manifest.files) {
        const file = files.get(entry.path);
        if (!file || file.length !== entry.byteSize || await sha256(Uint8Array.from(file).buffer) !== entry.sha256) return new Response('Artifact verification failed',{ status: 422 });
      }
      for (const entry of manifest.files) {
        const key = `releases/${manifest.releaseId}/${digest}/${entry.path}`;
        await env.FILES.put(key,Uint8Array.from(files.get(entry.path)!).buffer,{ httpMetadata: { contentType: entry.mediaType },customMetadata: { sha256: entry.sha256 },onlyIf: { etagDoesNotMatch: '*' } });
      }
      const marker = new TextEncoder().encode(JSON.stringify({ digest,manifest }));
      const saved = await env.FILES.put(markerKey,marker.buffer,{ httpMetadata: { contentType: 'application/json' },customMetadata: { sha256: digest },onlyIf: { etagDoesNotMatch: '*' } });
      return Response.json({ releaseId: manifest.releaseId },{ status: saved ? 201 : 409 });
    } catch { return new Response('Invalid release bundle',{ status: 400 }); }
  }
  if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{ status: 405,headers: { Allow: 'GET, HEAD' } });
  if (url.pathname === '/') return new Response('<!doctype html><html lang="en"><title>Reframe releases</title><body><h1>Reframe releases</h1><p>Approved static transformations. Open a release link from your Reframe workspace.</p></body></html>',{ headers: { ...securityHeaders,'Content-Type': 'text/html; charset=utf-8' } });
  const match = url.pathname.match(/^\/sites\/([^/]+)\/(.*)$/); if (!match || !IdSchema.safeParse(match[1]).success || !env.FILES) return new Response('Not found',{ status: 404 });
  const filePath = !match[2] || match[2].endsWith('/') ? `${match[2]}index.html` : match[2];
  if (!SafePathSchema.safeParse(filePath).success) return new Response('Not found',{ status: 404 });
  const marker = await env.FILES.get(`releases/${match[1]}/published.json`); if (!marker) return new Response('Not found',{ status: 404 });
  const { digest,manifest } = JSON.parse(new TextDecoder().decode(await marker.arrayBuffer()));
  const entry = ReleaseTransferSchema.parse(manifest).files.find(file => file.path === filePath); if (!entry) return new Response('Not found',{ status: 404 });
  const object = await env.FILES.get(`releases/${match[1]}/${digest}/${filePath}`); if (!object) return new Response('Not found',{ status: 404 });
  return new Response(request.method === 'HEAD' ? null : await object.arrayBuffer(),{ headers: { ...securityHeaders,'Content-Type': entry.mediaType,'Cache-Control': 'public, max-age=31536000, immutable',ETag: `"${entry.sha256}"` } });
} };
