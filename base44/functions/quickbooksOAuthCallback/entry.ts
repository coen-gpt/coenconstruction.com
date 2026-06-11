import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Intuit OAuth redirect target for the in-app "Connect QuickBooks" flow.
// Exchanges the authorization code, persists the refresh token + realm id in
// SyncState (key "quickbooks_oauth"), and bounces the admin back to Company
// Profile with a status flag. After this runs once, createDepositInvoice and
// syncEstimateToQuickBooks authenticate entirely from SyncState — Intuit's
// rotated refresh tokens are persisted on every API call.

const APP_ID = Deno.env.get('BASE44_APP_ID') || '69cf342e607cf2b57ec285ff';

function appBase() {
  return (Deno.env.get('BASE44_APP_URL') || 'https://coenconstruction.com').replace(/\/$/, '');
}

function back(params) {
  const qs = new URLSearchParams(params).toString();
  return new Response(null, {
    status: 302,
    headers: { Location: `${appBase()}/admin/profile?${qs}` },
  });
}

async function verifyState(state, secret) {
  const [exp, hex] = String(state || '').split('.');
  if (!exp || !hex || !secret) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(exp));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return expected === hex;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const realmId = url.searchParams.get('realmId');
    const oauthError = url.searchParams.get('error');

    if (oauthError) return back({ qb_error: `Intuit returned: ${oauthError}` });
    if (!code) return back({ qb_error: 'Missing authorization code.' });
    if (!realmId) return back({ qb_error: 'Intuit did not return a company (realm) id.' });
    if (!(await verifyState(state, Deno.env.get('ADMIN_SESSION_SECRET')))) {
      return back({ qb_error: 'Connection link expired — please click Connect QuickBooks again.' });
    }

    const redirectUri = `${appBase()}/api/apps/${APP_ID}/functions/quickbooksOAuthCallback`;
    const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${Deno.env.get('QUICKBOOKS_CLIENT_ID') || ''}:${Deno.env.get('QUICKBOOKS_CLIENT_SECRET') || ''}`),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    const intuitTid = tokenRes.headers.get('intuit_tid');
    const tokens = await tokenRes.json().catch(() => ({}));

    if (!tokens.refresh_token) {
      console.error('QuickBooks token exchange failed', { status: tokenRes.status, intuit_tid: intuitTid, error: tokens.error });
      return back({ qb_error: `Token exchange failed: ${tokens.error_description || tokens.error || tokenRes.status}` });
    }

    // Persist refresh token + realm id (SyncState key "quickbooks_oauth")
    const base44 = createClientFromRequest(req);
    const states = await base44.asServiceRole.entities.SyncState.filter({ key: 'quickbooks_oauth' });
    const payload = {
      sync_token: tokens.refresh_token,
      last_synced_at: new Date().toISOString(),
      data: JSON.stringify({ realm_id: realmId }),
    };
    if (states[0]) await base44.asServiceRole.entities.SyncState.update(states[0].id, payload);
    else await base44.asServiceRole.entities.SyncState.create({ key: 'quickbooks_oauth', ...payload });

    return back({ qb: 'connected' });
  } catch (error) {
    return back({ qb_error: error.message });
  }
});
