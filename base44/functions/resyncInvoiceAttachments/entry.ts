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

function getAttachments(payload) {
  const attachments = [];
  function scan(parts) {
    if (!parts) return;
    for (const part of parts) {
      if (part.filename && part.filename.length > 0) {
        const ext = part.filename.toLowerCase();
        if (ext.endsWith('.pdf') || ext.endsWith('.doc') || ext.endsWith('.docx') ||
            ext.endsWith('.xls') || ext.endsWith('.xlsx') || ext.endsWith('.png') ||
            ext.endsWith('.jpg') || ext.endsWith('.jpeg')) {
          attachments.push({ name: part.filename, id: part.body?.attachmentId });
        }
      }
      if (part.parts) scan(part.parts);
    }
  }
  scan(payload?.parts);
  return attachments;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

async function gmailFetch(url, authHeader, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { headers: authHeader });
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
      await sleep(retryAfter * 1000);
      continue;
    }
    return res;
  }
  throw new Error('Too many 429 rate limit errors');
}

Deno.serve(async (req) => {
  try {
    const { base44, user } = await verifyAdminSession(req, 'can_access_invoices');

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 20;

    const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
    const threshold = new Date(Date.now() - SIX_DAYS_MS).toISOString();

    const allRecords = await base44.asServiceRole.entities.InvoiceRecord.list('-email_received_date', 500);
    const candidates = allRecords.filter(r => {
      if (r.attachment_unrecoverable) return false;
      if (!r.attachment_names?.length) return false;
      if (!r.last_url_refresh_at) return true;
      return r.last_url_refresh_at < threshold;
    }).slice(0, batchSize);

    if (candidates.length === 0) {
      return Response.json({ total: 0, updated: 0, unrecoverable: 0, skipped: 0 });
    }

    const accessToken = await getGmailAccessToken(base44);
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    let updated = 0;
    let unrecoverable = 0;

    for (const record of candidates) {
      if (!record.gmail_message_id) continue;

      try {
        const msgRes = await gmailFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${record.gmail_message_id}?format=full`,
          authHeader
        );

        if (msgRes.status === 404) {
          await base44.asServiceRole.entities.InvoiceRecord.update(record.id, {
            attachment_unrecoverable: true,
          });
          unrecoverable++;
          continue;
        }

        if (!msgRes.ok) continue;
        const message = await msgRes.json();

        const attachments = getAttachments(message.payload);
        if (attachments.length === 0) continue;

        const attachmentFileUrls = [];
        for (const att of attachments.slice(0, 3)) {
          if (!att.id) continue;
          try {
            const attRes = await gmailFetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${record.gmail_message_id}/attachments/${att.id}`,
              authHeader
            );
            if (!attRes.ok) continue;
            const attData = await attRes.json();
            if (!attData.data) continue;
            const binary = atob(attData.data.replace(/-/g, '+').replace(/_/g, '/'));
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const ext = att.name.toLowerCase();
            const mime = ext.endsWith('.pdf') ? 'application/pdf' : ext.endsWith('.png') ? 'image/png' : 'image/jpeg';
            const file = new File([bytes], att.name, { type: mime });
            const uploaded = await base44.asServiceRole.integrations.Core.UploadFile({ file });
            if (uploaded?.file_url) attachmentFileUrls.push(uploaded.file_url);
          } catch (_) {}
        }

        if (attachmentFileUrls.length > 0) {
          await base44.asServiceRole.entities.InvoiceRecord.update(record.id, {
            attachment_urls: attachmentFileUrls,
            attachment_names: attachments.slice(0, 3).map(a => a.name),
            last_url_refresh_at: new Date().toISOString(),
            attachment_unrecoverable: false,
          });
          updated++;
        }
      } catch (_) {
        // Non-fatal: skip this record
      }
    }

    return Response.json({
      total: candidates.length,
      updated,
      unrecoverable,
      skipped: candidates.length - updated - unrecoverable,
    });

  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});