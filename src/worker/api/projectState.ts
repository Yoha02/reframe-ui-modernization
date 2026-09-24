import { IdSchema } from '../../shared/schemas/common';
import { deriveProjectStateSummary, getProjectStateRows } from '../repositories/projectStateRepository';
import { ApiError, requireDB, type D1Binding } from '../db/bindings';
export async function getProjectState(projectId: string, env: { DB?: D1Binding }): Promise<Response> {
  if (!IdSchema.safeParse(projectId).success) throw new ApiError('PROJECT_NOT_FOUND',404,'Project not found.');
  const rows = await getProjectStateRows(requireDB(env),projectId);
  if (!rows) throw new ApiError('PROJECT_NOT_FOUND',404,'Project not found.');
  return Response.json(deriveProjectStateSummary(rows),{ headers: { 'Cache-Control': 'no-store' } });
}
