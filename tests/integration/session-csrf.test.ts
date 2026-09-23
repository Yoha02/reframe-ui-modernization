// @vitest-environment node
import { expect, it } from 'vitest';
import worker from '../../src/worker';
import { context } from '../fixtures/runtime-env';
import { securityEnv, authorHeaders } from '../fixtures/security/session-fixtures';
it('guards project requests before handlers and issues an owner-only secure session', async () => {
  const call = (path: string, method = 'GET', headers = {}) => worker.fetch(new Request(`https://reframe.test${path}`,{ method, headers: { ...authorHeaders,...headers } }),securityEnv,context);
  expect((await call('/api/projects','POST')).status).toBe(401);
  const response = await call('/api/session');
  expect(response.status).toBe(200);
  const cookie = response.headers.get('Set-Cookie')!;
  for (const attr of ['HttpOnly','Secure','SameSite=Strict','Path=/']) expect(cookie).toContain(attr);
  const { csrfToken } = await response.json() as { csrfToken: string };
  expect((await call('/api/projects','POST',{ Cookie: cookie })).status).toBe(403);
  const mismatch = await call('/api/projects','POST',{ Cookie: cookie,'X-CSRF-Token': 'wrong' });
  expect(mismatch.status).toBe(403); expect(await mismatch.json()).toMatchObject({ errorCode: 'csrf_invalid' });
  // Guard success reaches the existing router; project creation is a later work order.
  expect((await call('/api/projects','POST',{ Cookie: cookie,'X-CSRF-Token': csrfToken })).status).toBe(404);
  expect((await call('/api/projects','GET',{ Cookie: cookie })).status).toBe(404);
  expect((await call('/api/projects','POST',{ Cookie: cookie,'X-CSRF-Token': csrfToken,Origin: 'https://other.test' })).status).toBe(403);
  expect((await call('/api/session','GET',{ 'oai-authenticated-user-email': '' })).status).toBe(401);
  const renewed = await call('/api/session','GET',{ Cookie: cookie });
  expect(renewed.headers.get('Set-Cookie')).toBeNull();
});
