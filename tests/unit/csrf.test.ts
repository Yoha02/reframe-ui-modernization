// @vitest-environment node
import { expect, it } from 'vitest';
import { createSessionCookie } from '../../src/worker/security/session';
import { createCsrfToken, validateCsrfToken } from '../../src/worker/security/csrf';
import { securityEnv } from '../fixtures/security/session-fixtures';
import { issuedAt, afterCsrfExpiry } from '../fixtures/security/time';
it('accepts matching tokens and rejects missing, mismatched, tampered and stale tokens', async () => {
  const { session } = await createSessionCookie(securityEnv,'owner@example.test',issuedAt,'fixture-session');
  const token = await createCsrfToken(session,securityEnv,issuedAt);
  await expect(validateCsrfToken(token,session,securityEnv,issuedAt + 1)).resolves.toBeUndefined();
  await expect(validateCsrfToken(null,session,securityEnv,issuedAt + 1)).rejects.toMatchObject({ errorCode: 'csrf_missing' });
  await expect(validateCsrfToken(token,{ ...session,id: 'other' },securityEnv,issuedAt + 1)).rejects.toMatchObject({ errorCode: 'csrf_invalid' });
  await expect(validateCsrfToken(`bad${token}`,session,securityEnv,issuedAt + 1)).rejects.toMatchObject({ errorCode: 'csrf_invalid' });
  await expect(validateCsrfToken(token,session,securityEnv,afterCsrfExpiry)).rejects.toMatchObject({ errorCode: 'csrf_expired' });
});
