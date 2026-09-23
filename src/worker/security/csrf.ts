import { SecurityError, signPayload, verifyPayload, type SecurityEnvironment, type Session } from './session';
export const CSRF_TTL = 15 * 60 * 1000;
export function createCsrfToken(session: Session, env: SecurityEnvironment, issuedAt = Date.now()) {
  return signPayload({ type: 'csrf', sessionId: session.id, issuedAt, expiresAt: Math.min(issuedAt + CSRF_TTL,session.expiresAt) },env);
}
export async function validateCsrfToken(token: string | null, session: Session, env: SecurityEnvironment, now = Date.now()) {
  if (!token) throw new SecurityError('csrf_missing',403,'Refresh the page to obtain an authoring token.');
  const value = await verifyPayload(token,env) as { type?: string; sessionId?: string; issuedAt?: number; expiresAt?: number } | null;
  if (!value || value.type !== 'csrf' || value.sessionId !== session.id || typeof value.issuedAt !== 'number' || typeof value.expiresAt !== 'number' ||
    value.issuedAt > now || value.expiresAt > value.issuedAt + CSRF_TTL || value.expiresAt > session.expiresAt) {
    throw new SecurityError('csrf_invalid',403,'The authoring token does not match this session.');
  }
  if (value.expiresAt <= now) throw new SecurityError('csrf_expired',403,'Refresh the page to renew the authoring token.');
}
