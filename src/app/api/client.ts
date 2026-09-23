let csrfToken = '';
export async function connectSession() {
  const response = await fetch('/api/session'); const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? 'Sign in to open this workspace.');
  csrfToken = data.csrfToken;
}
export async function api<T>(path: string,method = 'GET',body?: unknown): Promise<T> {
  const multipart = body instanceof FormData;
  const response = await fetch(path,{ method,headers: { ...(method !== 'GET' ? { 'X-CSRF-Token': csrfToken } : {}),...(!multipart && body !== undefined ? { 'Content-Type': 'application/json' } : {}) },body: body === undefined ? undefined : multipart ? body : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? data.message ?? `This action could not finish (${response.status}).`);
  return data as T;
}
export const objectUrl = (projectId: string,key: string) => `/api/projects/${projectId}/objects?key=${encodeURIComponent(key)}`;
