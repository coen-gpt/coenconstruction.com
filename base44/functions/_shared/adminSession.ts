import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const encoder = new TextEncoder();

function base64UrlEncode(input: ArrayBuffer | Uint8Array | string) {
  const bytes = typeof input === 'string'
    ? encoder.encode(input)
    : input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : input;
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - input.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function timingSafeEqual(a: string, b: string) {
  const aa = encoder.encode(a);
  const bb = encoder.encode(b);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

function getSessionSecret() {
  const secret = Deno.env.get('ADMIN_SESSION_SECRET') || Deno.env.get('ADMIN_LEADS_PASSWORD');
  if (!secret) throw new Error('ADMIN_SESSION_SECRET must be configured for admin session signing.');
  return secret;
}

async function hmac(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return base64UrlEncode(sig);
}

export async function signAdminSession(user: any) {
  const secret = getSessionSecret();
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const payload = base64UrlEncode(JSON.stringify({ uid: user.id, email: user.email, exp }));
  const signature = await hmac(payload, secret);
  return `${payload}.${signature}`;
}

function safeAdminUser(user: any, sessionToken?: string) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    can_access_estimates: user.can_access_estimates,
    can_access_leads: user.can_access_leads,
    can_access_invoices: user.can_access_invoices,
    can_access_blog: user.can_access_blog,
    can_access_cms: user.can_access_cms,
    can_access_seo: user.can_access_seo,
    can_access_team: user.can_access_team,
    can_access_tracking: user.can_access_tracking,
    ...(sessionToken ? { session_token: sessionToken } : {}),
  };
}

export function hasAdminPermission(user: any, permission?: string) {
  if (!permission) return true;
  if (user?.role === 'admin') return true;
  return user?.[permission] === true;
}

export async function verifyAdminSession(req: Request, permission?: string, bodyOverride?: any) {
  const base44 = createClientFromRequest(req);
  let body: any = bodyOverride || {};
  if (!bodyOverride) {
    try { body = await req.clone().json(); } catch { body = {}; }
  }
  const authHeader = req.headers.get('authorization') || '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const token = body?.admin_session_token || bearer;

  if (token) {
    const [payload, signature] = String(token).split('.');
    if (payload && signature) {
      const secret = getSessionSecret();
      const expected = await hmac(payload, secret);
      if (timingSafeEqual(signature, expected)) {
        const decoded = JSON.parse(base64UrlDecode(payload));
        if (decoded.exp && decoded.exp >= Date.now()) {
          const users = await base44.asServiceRole.entities.AdminUser.filter({ id: decoded.uid });
          const user = users[0];
          if (user && user.active !== false && hasAdminPermission(user, permission)) {
            return { base44, user: safeAdminUser(user) };
          }
          if (user && user.active !== false) throw new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
        }
      }
    }
  }

  // Backward-compatible fallback for Base44-native authenticated users.
  try {
    const me = await base44.auth.me();
    if (me) {
      const users = await base44.asServiceRole.entities.AdminUser.filter({ email: me.email?.toLowerCase?.() || me.email });
      const user = users[0] || me;
      if (user && user.active !== false && hasAdminPermission(user, permission)) {
        return { base44, user: safeAdminUser(user) };
      }
      throw new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }
  } catch (err) {
    if (err instanceof Response) throw err;
  }

  throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}

export { safeAdminUser };
