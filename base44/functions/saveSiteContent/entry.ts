import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const LEGACY_ADMIN_JWT_SECRET = 'coen_admin_jwt_secret_v1';

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0));
}

function getSecrets() {
  return [Deno.env.get('ADMIN_SESSION_SECRET'), LEGACY_ADMIN_JWT_SECRET].filter(Boolean);
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyCmsAdmin(req, body, base44) {
  const auth = req.headers.get('authorization') || '';
  const token = String(body.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
  if (!token) return { error: 'Unauthorized', status: 401 };

  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) return { error: 'Unauthorized', status: 401 };

  const data = `${header}.${payload}`;
  let valid = false;
  for (const secret of getSecrets()) {
    if (await verifySignature(data, signature, secret).catch(() => false)) {
      valid = true;
      break;
    }
  }
  if (!valid) return { error: 'Unauthorized', status: 401 };

  const session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  if (Number(session.exp || 0) < Math.floor(Date.now() / 1000)) return { error: 'Session expired', status: 401 };

  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: String(session.email || '').toLowerCase() });
  const user = users[0];
  if (!user || user.active === false) return { error: 'Forbidden', status: 403 };
  if (user.role !== 'admin' && !user.can_access_cms) return { error: 'Forbidden', status: 403 };

  return { user };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const auth = await verifyCmsAdmin(req, body, base44);
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

    const { key, value } = body;
    if (!key) return Response.json({ error: 'key is required' }, { status: 400 });

    const stringVal = typeof value === 'string' ? value : JSON.stringify(value ?? null);
    const existing = await base44.asServiceRole.entities.AppSettings.filter({ key });
    const record = existing.length
      ? await base44.asServiceRole.entities.AppSettings.update(existing[0].id, { key, value: stringVal })
      : await base44.asServiceRole.entities.AppSettings.create({ key, value: stringVal });

    return Response.json({ success: true, record });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});