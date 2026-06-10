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

async function resolveGmailRefreshToken(base44) {
  // Prefer the refresh token saved by the in-app "Connect Gmail" OAuth flow
  // (SyncState key "gmail_oauth"); fall back to the GMAIL_REFRESH_TOKEN secret.
  try {
    const states = await base44.asServiceRole.entities.SyncState.filter({ key: 'gmail_oauth' });
    if (states[0]?.sync_token) return states[0].sync_token;
  } catch { /* fall through to env */ }
  return Deno.env.get('GMAIL_REFRESH_TOKEN');
}

async function getAccessToken(base44) {
  const refreshToken = await resolveGmailRefreshToken(base44);
  if (!refreshToken) throw new Error('Gmail is not connected.');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GMAIL_CLIENT_ID'),
      client_secret: Deno.env.get('GMAIL_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get Gmail access token');
  return data.access_token;
}

function extractAttachmentMeta(payload, result = []) {
  if (!payload) return result;
  if (payload.filename && payload.filename.trim().length > 0 && payload.body?.attachmentId) {
    result.push({
      name: payload.filename,
      attachmentId: payload.body.attachmentId,
      mimeType: payload.mimeType || 'application/octet-stream',
      size: payload.body.size || 0,
    });
  }
  if (payload.parts) {
    for (const p of payload.parts) extractAttachmentMeta(p, result);
  }
  return result;
}

Deno.serve(async (req) => {
  try {
    const { base44, user } = await verifyAdminSession(req, 'can_access_invoices');

    const body = await req.json().catch(() => ({}));
    const { messageId, attachmentIndex } = body;

    if (!messageId) return Response.json({ error: 'messageId required' }, { status: 400 });

    const accessToken = await getAccessToken(base44);
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Fetch message to get attachment list
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: authHeader }
    );
    if (!msgRes.ok) return Response.json({ error: 'Failed to fetch message' }, { status: 500 });
    const message = await msgRes.json();

    const attachments = extractAttachmentMeta(message.payload);
    if (attachments.length === 0) return Response.json({ error: 'No attachments found' }, { status: 404 });

    const idx = attachmentIndex ?? 0;
    const att = attachments[idx];
    if (!att) return Response.json({ error: 'Attachment index out of range' }, { status: 404 });

    // Fetch attachment data
    const attRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${att.attachmentId}`,
      { headers: authHeader }
    );
    if (!attRes.ok) return Response.json({ error: 'Failed to fetch attachment' }, { status: 500 });
    const attData = await attRes.json();

    return Response.json({
      name: att.name,
      mimeType: att.mimeType,
      size: att.size,
      data: attData.data, // base64url encoded
      totalAttachments: attachments.length,
      attachmentList: attachments.map((a, i) => ({ index: i, name: a.name, mimeType: a.mimeType, size: a.size })),
    });

  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});