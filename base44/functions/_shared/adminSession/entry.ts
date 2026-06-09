import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SESSION_TTL_SECONDS = 60 * 60 * 12;
const LEGACY_ADMIN_JWT_SECRET = 'coen_admin_jwt_secret_v1';

function jsonError(message: string, status = 401) {
  return Response.json({ error: message }, { status });
}

function b64urlEncode(input: Uint8Array | string) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0));
}

function getSessionSecrets() {
  return [
    Deno.env.get('ADMIN_SESSION_SECRET'),
    Deno.env.get('ADMIN_LEADS_PASSWORD'),
    LEGACY_ADMIN_JWT_SECRET,
  ].filter(Boolean) as string[];
}

async function hmacKey(secret: string, usage: KeyUsage) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  );
}

async function sign(data: string, secret: string) {
  const key = await hmacKey(secret, 'sign');
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return b64urlEncode(new Uint8Array(signature));
}

async function verifySignature(data: string, signature: string, secret: string) {
  try {
    const key = await hmacKey(secret, 'verify');
    return await crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
  } catch {
    return false;
  }
}

function getToken(req: Request, body?: Record<string, unknown>) {
  const auth = req.headers.get('authorization') || '';
  return String(body?.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
}

export function hasAdminPermission(user: Record<string, unknown>, permission?: string) {
  if (!permission) return true;
  if (user?.role === 'admin') return true;
  return Boolean(user?.[permission]);
}

export function safeAdminUser(user: Record<string, unknown>, sessionToken?: string) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.name || user.full_name,
    name: user.name || user.full_name,
    role: user.role,
    can_access_estimates: Boolean(user.can_access_estimates),
    can_access_leads: Boolean(user.can_access_leads),
    can_access_invoices: Boolean(user.can_access_invoices),
    can_access_blog: Boolean(user.can_access_blog),
    can_access_cms: Boolean(user.can_access_cms),
    can_access_seo: Boolean(user.can_access_seo),
    can_access_team: Boolean(user.can_access_team),
    can_access_tracking: Boolean(user.can_access_tracking),
    can_access_field_crew: Boolean(user.can_access_field_crew),
    can_approve_payroll: Boolean(user.can_approve_payroll),
    session_token: sessionToken,
  };
}

export async function signAdminSession(user: Record<string, unknown>) {
  const secret = getSessionSecrets()[0];
  if (!secret) throw new Error('Admin session secret is not configured');

  const now = Math.floor(Date.now() / 1000);
  const header = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64urlEncode(JSON.stringify({
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  }));
  const data = `${header}.${payload}`;
  return `${data}.${await sign(data, secret)}`;
}

export async function verifyAdminSession(req: Request, permission?: string, parsedBody?: Record<string, unknown>) {
  const body = parsedBody || await req.clone().json().catch(() => ({}));
  const token = getToken(req, body);
  if (!token) throw jsonError('Unauthorized', 401);

  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) throw jsonError('Unauthorized', 401);

  const data = `${header}.${payload}`;
  const secrets = getSessionSecrets();
  let valid = false;
  for (const secret of secrets) {
    if (await verifySignature(data, signature, secret)) {
      valid = true;
      break;
    }
  }
  if (!valid) throw jsonError('Unauthorized', 401);

  let session: Record<string, unknown>;
  try {
    session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  } catch {
    throw jsonError('Unauthorized', 401);
  }

  if (Number(session.exp || 0) < Math.floor(Date.now() / 1000)) {
    throw jsonError('Session expired', 401);
  }

  const base44 = createClientFromRequest(req);
  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: String(session.email || '').toLowerCase() });
  const user = users[0];
  if (!user || user.active === false) throw jsonError('Forbidden', 403);
  if (!hasAdminPermission(user, permission)) throw jsonError('Forbidden', 403);

  return { base44, user, session, sessionToken: token };
}