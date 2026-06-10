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

const EXPECTED_GMAIL_EMAIL = 'info@coenconstruction.com';

async function resolveGmailRefreshToken(base44) {
  // Prefer the refresh token saved by the in-app "Connect Gmail" OAuth flow
  // (SyncState key "gmail_oauth"); fall back to the GMAIL_REFRESH_TOKEN secret.
  try {
    const states = await base44.asServiceRole.entities.SyncState.filter({ key: 'gmail_oauth' });
    if (states[0]?.sync_token) return states[0].sync_token;
  } catch { /* fall through to env */ }
  return Deno.env.get('GMAIL_REFRESH_TOKEN');
}

async function getGmailAccessToken(base44) {
  const refreshToken = await resolveGmailRefreshToken(base44);
  if (!refreshToken) {
    throw new Error('Gmail is not connected. Go to Company Profile \u2192 Email Integration and click "Connect Gmail".');
  }
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GMAIL_CLIENT_ID'),
      client_secret: Deno.env.get('GMAIL_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(tokenData.error === 'invalid_grant'
      ? 'Gmail access was revoked or expired \u2014 reconnect from Company Profile \u2192 Email Integration.'
      : 'Gmail connection could not be refreshed. Check Gmail OAuth secrets.');
  }
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  try {
    const { base44 } = await verifyAdminSession(req);
    const accessToken = await getGmailAccessToken(base44);

    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const profile = await profileRes.json();

    if (profile.emailAddress) {
      const email = String(profile.emailAddress).toLowerCase();
      if (email !== EXPECTED_GMAIL_EMAIL) {
        return Response.json({ connected: false, email: profile.emailAddress, error: `Connected Gmail must be ${EXPECTED_GMAIL_EMAIL}.` });
      }
      return Response.json({ connected: true, email: profile.emailAddress, source: 'production_token' });
    }
    return Response.json({ connected: false });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ connected: false, error: error.message }, { status });
  }
});