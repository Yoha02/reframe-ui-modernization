import { CanvasLayoutSchema } from '../../shared/schemas/canvasLayout';
import { ApiError,requireDB } from '../db/bindings';
import type { RuntimeEnv } from '../index';
import { jsonBody } from './projectActions';
export async function canvasRoutes(request: Request,env: RuntimeEnv) {
  const match = new URL(request.url).pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/canvas-layout$/); if (!match) return null;
  const db = requireDB(env),projectId = match[1];
  const row = await db.prepare('SELECT canvas_json FROM Projects WHERE id = ?').bind(projectId).first<{ canvas_json: string | null }>();
  if (!row) throw new ApiError('PROJECT_NOT_FOUND',404,'Project not found.');
  const current = CanvasLayoutSchema.parse(row.canvas_json ? JSON.parse(row.canvas_json) : { rowVersion: 0,nodes: [],viewport: null });
  if (request.method === 'GET') return Response.json(current,{ headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'PUT') return null;
  const body = CanvasLayoutSchema.parse(await jsonBody(request));
  if (body.rowVersion !== current.rowVersion) throw new ApiError('CANVAS_CHANGED',409,'The board changed in another window. Reload before saving.');
  const known = (await db.prepare('SELECT evidence_json FROM Components WHERE project_id = ?').bind(projectId).all<{ evidence_json: string }>()).results.map(row => JSON.parse(row.evidence_json).stableId);
  if (body.nodes.some(node => !known.includes(node.id))) throw new ApiError('CANVAS_INVALID_NODE',400,'The board references an unknown component.');
  const next = { ...body,rowVersion: current.rowVersion + 1 };
  const result = await db.prepare('UPDATE Projects SET canvas_json = ? WHERE id = ? AND canvas_json IS ?').bind(JSON.stringify(next),projectId,row.canvas_json).run();
  if (!result.meta?.changes) throw new ApiError('CANVAS_CHANGED',409,'The board changed while saving. Reload and retry.');
  return Response.json(next);
}
