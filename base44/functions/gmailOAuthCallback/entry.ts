import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Google OAuth redirect target for the in-app "Connect Gmail" flow.
// Exchanges the authorization code, verifies the account is the company
// inbox, persists the refresh token in SyncState (key "gmail_oauth"), and
// bounces the admin back to Company Profile with a status flag.

const EXPECTED_GMAIL_EMAIL = 'info@coenconstruction.com';
const APP_ID = Deno.env.get('BASE44_APP_ID') || '69cf342e607cf2b57ec285ff';

function appBase() {
  return (Deno.env.get('BASE44_APP_URL') || 'https://www.coenconstruction.com').replace(/\/$/, '');
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
    const oauthError = url.searchParams.get('error');

    if (oauthError) return back({ gmail_error: `Google returned: ${oauthError}` });
    if (!code) return back({ gmail_error: 'Missing authorization code.' });
    if (!(await verifyState(state, Deno.env.get('ADMIN_SESSION_SECRET')))) {
      return back({ gmail_error: 'Connection link expired — please click Connect Gmail again.' });
    }

    const redirectUri = `${appBase()}/api/apps/${APP_ID}/functions/gmailOAuthCallback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GMAIL_CLIENT_ID') || '',
        client_secret: Deno.env.get('GMAIL_CLIENT_SECRET') || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    const tokens = await tokenRes.json();

    if (!tokens.access_token) {
      return back({ gmail_error: `Token exchange failed: ${tokens.error_description || tokens.error || 'unknown error'}` });
    }
    if (!tokens.refresh_token) {
      return back({ gmail_error: 'Google did not issue a refresh token. Remove the app at myaccount.google.com/permissions, then connect again.' });
    }

    // Verify the connected mailbox is the company inbox
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();
    const email = String(profile.emailAddress || '').toLowerCase();
    if (email !== EXPECTED_GMAIL_EMAIL) {
      return back({ gmail_error: `Wrong account (${email || 'unknown'}). Please connect ${EXPECTED_GMAIL_EMAIL}.` });
    }

    // Persist the refresh token (SyncState key "gmail_oauth")
    const base44 = createClientFromRequest(req);
    const states = await base44.asServiceRole.entities.SyncState.filter({ key: 'gmail_oauth' });
    const payload = { sync_token: tokens.refresh_token, last_synced_at: new Date().toISOString() };
    if (states[0]) await base44.asServiceRole.entities.SyncState.update(states[0].id, payload);
    else await base44.asServiceRole.entities.SyncState.create({ key: 'gmail_oauth', ...payload });

    return back({ gmail: 'connected' });
  } catch (error) {
    return back({ gmail_error: error.message });
  }
});
