export interface SecurityEnvironment { SESSION_SIGNING_SECRET?: string; AUTHOR_EMAIL?: string; AUTHOR_EMAILS?: string; LOCAL_DEVELOPMENT?: string; }
export interface Session { id: string; subject: string; issuedAt: number; expiresAt: number; }
export class SecurityError extends Error {
  constructor(public readonly errorCode: string, public readonly status: number, message: string) { super(message); this.name = 'SecurityError'; }
}
export const SESSION_COOKIE = '__Host-reframe-session';
export const SESSION_TTL = 8 * 60 * 60 * 1000;
const encoder = new TextEncoder();
function base64url(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function unbase64url(value: string) { return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),char => char.charCodeAt(0)); }
async function signingKey(env: SecurityEnvironment) {
  if (!env.SESSION_SIGNING_SECRET || env.SESSION_SIGNING_SECRET.length < 32) throw new SecurityError('session_config_missing',503,'The authoring session is not configured.');
  return crypto.subtle.importKey('raw',encoder.encode(env.SESSION_SIGNING_SECRET),{ name: 'HMAC', hash: 'SHA-256' },false,['sign','verify']);
}
export async function signPayload(value: object, env: SecurityEnvironment): Promise<string> {
  const payload = base64url(encoder.encode(JSON.stringify(value)));
  const signature = await crypto.subtle.sign('HMAC',await signingKey(env),encoder.encode(payload));
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}
export async function verifyPayload(token: string, env: SecurityEnvironment): Promise<unknown | null> {
  const key = await signingKey(env);
  try {
    if (token.length > 4096 || token.split('.').length !== 2) return null;
    const [payload, signature] = token.split('.');
    if (!await crypto.subtle.verify('HMAC',key,unbase64url(signature),encoder.encode(payload))) return null;
    return JSON.parse(new TextDecoder().decode(unbase64url(payload)));
  } catch { return null; }
}
export function authorIdentity(request: Request, env: SecurityEnvironment): string {
  const url = new URL(request.url);
  if (env.LOCAL_DEVELOPMENT === 'true' && ['localhost','127.0.0.1'].includes(url.hostname)) return 'local-author';
  const allowed = (env.AUTHOR_EMAILS || env.AUTHOR_EMAIL || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) throw new SecurityError('author_config_missing',503,'An author account must be configured before editing.');
  const identity = request.headers.get('oai-authenticated-user-email');
  if (!identity || !allowed.includes(identity.toLowerCase())) throw new SecurityError('unauthenticated',401,'Sign in with an approved author account to open your workspace.');
  return identity.toLowerCase();
}
export async function createSessionCookie(env: SecurityEnvironment, subject: string, issuedAt = Date.now(), sessionId: string = crypto.randomUUID()) {
  const session: Session = { id: sessionId, subject, issuedAt, expiresAt: issuedAt + SESSION_TTL };
  const value = await signPayload({ type: 'session', ...session },env);
  return { session, cookie: `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${new Date(session.expiresAt).toUTCString()}; Max-Age=${SESSION_TTL / 1000}` };
}
export async function readSession(request: Request, env: SecurityEnvironment, now = Date.now()): Promise<Session> {
  const cookie = request.headers.get('Cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!cookie) throw new SecurityError('unauthenticated',401,'An authoring session is required.');
  const value = await verifyPayload(cookie,env);
  if (!value || typeof value !== 'object') throw new SecurityError('unauthenticated',401,'The authoring session is invalid or expired.');
  const session = value as Partial<Session> & { type?: string };
  if (session.type !== 'session' || typeof session.id !== 'string' || typeof session.subject !== 'string' ||
    typeof session.issuedAt !== 'number' || typeof session.expiresAt !== 'number' || session.issuedAt > now ||
    session.expiresAt <= now || session.expiresAt > session.issuedAt + SESSION_TTL || session.subject !== authorIdentity(request,env)) {
    throw new SecurityError('unauthenticated',401,'The authoring session is invalid or expired.');
  }
  return session as Session;
}
