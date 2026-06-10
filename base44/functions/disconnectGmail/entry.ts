import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyAdminSession(req, permission, parsedBody) {
  const base44 = createClientFromRequest(req);
  const body = parsedBody || await req.clone().json().catch(() => ({}));
  const auth = req.headers.get('authorization') || '';
  const token = String(body.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
  if (!token) throw new Error('Unauthorized');
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) throw new Error('Unauthorized');
  const secret = Deno.env.get('ADMIN_SESSION_SECRET');
  if (!secret || !(await verifySignature(`${header}.${payload}`, signature, secret).catch(() => false))) throw new Error('Unauthorized');
  const session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  if (Number(session.exp || 0) < Math.floor(Date.now() / 1000)) throw new Error('Session expired');
  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: String(session.email || '').toLowerCase() });
  const user = users[0];
  if (!user || user.active === false) throw new Error('Forbidden');
  if (permission && user.role !== 'admin' && !user[permission]) throw new Error('Forbidden');
  return { base44, user };
}

// Clears the refresh token saved by the in-app "Connect Gmail" flow. If a
// GMAIL_REFRESH_TOKEN env secret also exists it will still act as a fallback
// until removed; full revocation is done from the Google account itself.
Deno.serve(async (req) => {
  try {
    const { base44 } = await verifyAdminSession(req, 'can_access_invoices');

    const states = await base44.asServiceRole.entities.SyncState.filter({ key: 'gmail_oauth' });
    let cleared = false;
    if (states[0]) {
      await base44.asServiceRole.entities.SyncState.update(states[0].id, { sync_token: '', last_synced_at: new Date().toISOString() });
      cleared = true;
    }

    return Response.json({
      success: true,
      cleared,
      message: cleared
        ? 'Stored Gmail connection cleared. To fully revoke access, also remove the app at https://myaccount.google.com/permissions.'
        : 'No stored connection found. If a GMAIL_REFRESH_TOKEN secret is set, remove it in app secrets to fully disconnect.',
    });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});