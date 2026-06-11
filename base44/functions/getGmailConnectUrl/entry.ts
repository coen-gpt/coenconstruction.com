import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyAdminSession(req, permission, body) {
  const base44 = createClientFromRequest(req);
  const auth = req.headers.get('authorization') || '';
  const token = String(body?.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
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
const APP_ID = Deno.env.get('BASE44_APP_ID') || '69cf342e607cf2b57ec285ff';

function appBase() {
  return (Deno.env.get('BASE44_APP_URL') || 'https://coenconstruction.com').replace(/\/$/, '');
}

// HMAC-signed OAuth state (CSRF protection), verified by gmailOAuthCallback
async function signState(secret) {
  const exp = String(Math.floor(Date.now() / 1000) + 15 * 60);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(exp));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${exp}.${hex}`;
}

// Returns the real Google OAuth consent URL for connecting info@coenconstruction.com.
// The callback (gmailOAuthCallback) stores the refresh token in SyncState so the
// connection survives without manually minting tokens into env secrets.
Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    await verifyAdminSession(req, 'can_access_invoices', body);

    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const redirectUri = `${appBase()}/api/apps/${APP_ID}/functions/gmailOAuthCallback`;

    if (!clientId || !Deno.env.get('GMAIL_CLIENT_SECRET')) {
      return Response.json({
        error: 'GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET secrets are not configured.',
        redirect_uri: redirectUri,
      }, { status: 503 });
    }

    const state = await signState(Deno.env.get('ADMIN_SESSION_SECRET'));
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.modify',
      access_type: 'offline',
      prompt: 'consent',
      login_hint: EXPECTED_GMAIL_EMAIL,
      state,
    });

    return Response.json({
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      redirect_uri: redirectUri,
      note: `Sign in as ${EXPECTED_GMAIL_EMAIL}. If Google shows a redirect_uri_mismatch error, add the redirect_uri above to the OAuth client's Authorized redirect URIs in Google Cloud Console.`,
    });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});
