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

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { base44 } = await verifyAdminSession(req, 'can_access_invoices', body);

    const { id, updates, action_note, gmail_message_id, user_email } = body;
    if (!id) return Response.json({ error: 'id required' }, { status: 400 });

    // Fetch current record to append history
    const records = await base44.asServiceRole.entities.InvoiceRecord.filter({ id });
    if (!records.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const current = records[0];

    const historyEntry = {
      action: updates.status ? `status_changed_to_${updates.status}` : (updates.pinned !== undefined ? (updates.pinned ? 'pinned' : 'unpinned') : 'updated'),
      by: user_email || 'admin',
      at: new Date().toISOString(),
      note: action_note || ''
    };

    const newHistory = [...(current.history || []), historyEntry];

    await base44.asServiceRole.entities.InvoiceRecord.update(id, {
      ...updates,
      history: newHistory
    });

    // Sync Gmail label when status is paid or approved
    if ((updates.status === 'paid' || updates.status === 'approved') && gmail_message_id) {
      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: Deno.env.get('GMAIL_CLIENT_ID'),
            client_secret: Deno.env.get('GMAIL_CLIENT_SECRET'),
            refresh_token: Deno.env.get('GMAIL_REFRESH_TOKEN'),
            grant_type: 'refresh_token',
          }),
        });
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;
        const labelName = updates.status === 'paid' ? 'Processed/Paid' : 'Approved';
        // Get or create label
        const labelsRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const labelsData = await labelsRes.json();
        let label = (labelsData.labels || []).find(l => l.name === labelName);
        if (!label) {
          const createRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: labelName, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
          });
          label = await createRes.json();
        }
        if (label?.id) {
          await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmail_message_id}/modify`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ addLabelIds: [label.id], removeLabelIds: ['UNREAD'] })
          });
        }
      } catch (_) { /* label sync failed silently */ }
    }

    return Response.json({ success: true });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});