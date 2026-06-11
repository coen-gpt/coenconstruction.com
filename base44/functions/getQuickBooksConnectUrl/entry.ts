import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyAdminSession(req, body) {
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
  if (user.role !== 'admin') throw new Error('Forbidden');
  return { base44, user };
}

const APP_ID = Deno.env.get('BASE44_APP_ID') || '69cf342e607cf2b57ec285ff';

function appBase() {
  return (Deno.env.get('BASE44_APP_URL') || 'https://coenconstruction.com').replace(/\/$/, '');
}

// HMAC-signed OAuth state (CSRF protection), verified by quickbooksOAuthCallback
async function signState(secret) {
  const exp = String(Math.floor(Date.now() / 1000) + 15 * 60);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(exp));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${exp}.${hex}`;
}

// Returns Intuit's OAuth consent URL for connecting the company QuickBooks
// Online account, plus current connection status. The callback
// (quickbooksOAuthCallback) stores the refresh token + realm id in SyncState
// so no tokens are ever copied around by hand.
Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { base44 } = await verifyAdminSession(req, body);

    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const redirectUri = `${appBase()}/api/apps/${APP_ID}/functions/quickbooksOAuthCallback`;

    // Connection status for the settings card. SyncState (written by the
    // in-app connect flow) wins over env vars; stale env secrets must not
    // mask the real connection state.
    const states = await base44.asServiceRole.entities.SyncState.filter({ key: 'quickbooks_oauth' });
    const stored = states[0];
    let realmId = null;
    if (stored?.data) {
      try { realmId = JSON.parse(stored.data).realm_id || null; } catch (_) {}
    }
    realmId = realmId || Deno.env.get('QUICKBOOKS_REALM_ID') || null;
    const connected = !!(stored?.sync_token || Deno.env.get('QUICKBOOKS_REFRESH_TOKEN'));

    if (body?.action === 'status') {
      return Response.json({ connected, realm_id: realmId, connected_at: stored?.last_synced_at || null, redirect_uri: redirectUri });
    }

    if (!clientId || !Deno.env.get('QUICKBOOKS_CLIENT_SECRET')) {
      return Response.json({
        error: 'QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET secrets are not configured.',
        redirect_uri: redirectUri,
      }, { status: 503 });
    }

    const state = await signState(Deno.env.get('ADMIN_SESSION_SECRET'));
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      state,
    });

    return Response.json({
      url: `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`,
      redirect_uri: redirectUri,
      connected,
      note: 'Sign in as the QuickBooks company admin. If Intuit shows a redirect URI error, add the redirect_uri above to the app\'s Production Redirect URIs on developer.intuit.com.',
    });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});
