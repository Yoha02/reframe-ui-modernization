import { parseProjectStateResponse, type ProjectStateResponse } from '../../shared/schemas/projectState';
export class ProjectStateClientError extends Error {
  constructor(public readonly statusCode: number,public readonly code: string,message: string) { super(message); }
}
export async function fetchProjectState(projectId: string): Promise<ProjectStateResponse> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/state`);
  const body = await response.json();
  if (!response.ok) throw new ProjectStateClientError(response.status,body.error?.code ?? body.errorCode ?? 'REQUEST_FAILED',body.error?.message ?? body.message ?? 'Unable to load this project.');
  return parseProjectStateResponse(body);
}
