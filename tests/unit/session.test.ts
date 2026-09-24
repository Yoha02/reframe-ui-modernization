// @vitest-environment node
import { expect, it } from 'vitest';
import { createSessionCookie, readSession, SESSION_TTL } from '../../src/worker/security/session';
import { securityEnv, authorHeaders } from '../fixtures/security/session-fixtures';
import { issuedAt, afterSessionExpiry } from '../fixtures/security/time';
it('signs a secure, absolutely bounded session and rejects expiry, tampering and another identity', async () => {
  const { session, cookie } = await createSessionCookie(securityEnv,'owner@example.test',issuedAt,'fixture-session');
  expect(session.expiresAt).toBe(issuedAt + SESSION_TTL);
  for (const attribute of ['HttpOnly','Secure','SameSite=Strict','Path=/']) expect(cookie).toContain(attribute);
  const request = (value = cookie, identity = authorHeaders) => new Request('https://reframe.test/api/projects',{ headers: { Cookie: value, ...identity } });
  expect(await readSession(request(),securityEnv,issuedAt + 1)).toMatchObject(session);
  await expect(readSession(request(),securityEnv,afterSessionExpiry)).rejects.toMatchObject({ status: 401 });
  await expect(readSession(request(cookie.replace('=','=bad')),securityEnv,issuedAt + 1)).rejects.toMatchObject({ status: 401 });
  await expect(readSession(request(cookie,{ 'oai-authenticated-user-email': 'other@example.test' }),securityEnv,issuedAt + 1)).rejects.toMatchObject({ status: 401 });
  await expect(createSessionCookie({},'owner',issuedAt)).rejects.toMatchObject({ errorCode: 'session_config_missing' });
});
