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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let accessToken;
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
      if (!tokenData.access_token) {
        console.error('Gmail token refresh failed:', tokenData.error || 'unknown_error', tokenData.error_description || 'No details');
        return Response.json({
          processed: 0,
          total_found: 0,
          message: tokenData.error === 'invalid_grant'
            ? 'Gmail refresh token was rejected by Google and needs to be renewed.'
            : 'Gmail connection could not be refreshed. Check Gmail OAuth secrets.'
        });
      }
      accessToken = tokenData.access_token;
    } catch (error) {
      console.error('Gmail token refresh request failed:', error.message);
      return Response.json({ processed: 0, total_found: 0, message: 'Gmail connection could not be refreshed.' });
    }

    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Fetch reply email aliases from company profile
    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const mtoEmail = profiles[0]?.mto_reply_email || '';
    const sowEmail = profiles[0]?.sow_reply_email || '';
    // Build query: emails sent to either alias that have the ref tags
    const toFilter = (mtoEmail || sowEmail)
      ? ` (${[mtoEmail, sowEmail].filter(Boolean).map(e => `to:${e}`).join(' OR ')})`
      : '';
    const query = encodeURIComponent(`(subject:"MTO-REF:" OR subject:"SOW-REF:") is:unread newer_than:30d${toFilter}`);
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`,
      { headers: authHeader }
    );

    if (!searchRes.ok) return Response.json({ message: 'Gmail search failed' });

    const searchData = await searchRes.json();
    const messages = searchData.messages || [];
    let processed = 0;

    for (const msg of messages) {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: authHeader }
        );
        if (!msgRes.ok) continue;
        const message = await msgRes.json();

        const headers = message.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const fromHeader = headers.find(h => h.name === 'From')?.value || '';
        const dateHeader = headers.find(h => h.name === 'Date')?.value || '';

        const mtoMatch = subject.match(/\[MTO-REF:([^\]]+)\]/);
        const sowMatch = subject.match(/\[SOW-REF:([^\]]+)\]/);
        if (!mtoMatch && !sowMatch) continue;

        const refId = (mtoMatch || sowMatch)[1].trim();
        const refType = mtoMatch ? 'mto' : 'sow';

        let body = '';
        const extractBody = (part) => {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            try { body += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/')); } catch (_) {}
          }
          if (part.parts) part.parts.forEach(extractBody);
        };
        extractBody(message.payload);

        const emailMatchArr = fromHeader.match(/<(.+?)>/);
        const senderEmail = emailMatchArr ? emailMatchArr[1] : (fromHeader.match(/\S+@\S+/)?.[0] || fromHeader);
        const senderName = fromHeader.replace(/<.*>/, '').trim().replace(/"/g, '') || senderEmail;

        let amount = null;
        let notes = '';
        let quoteType = 'quick_quote';
        try {
          const ai = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `Extract quote info from this vendor/sub reply email.\n\nEmail:\n${body.slice(0, 3000)}\n\nExtract:\n- amount: total dollar amount as number (null if none)\n- quote_type: "quick_quote" if rough estimate, "official_quote" if formal proposal\n- notes: 1-2 sentence summary`,
            response_json_schema: {
              type: "object",
              properties: {
                amount: { type: "number" },
                quote_type: { type: "string" },
                notes: { type: "string" }
              }
            }
          });
          amount = ai.amount || null;
          notes = ai.notes || '';
          quoteType = ai.quote_type || 'quick_quote';
        } catch (_) {}

        const quoteRecord = {
          message_id: msg.id,
          vendor_name: senderName,
          vendor_email: senderEmail,
          sub_name: senderName,
          sub_email: senderEmail,
          amount,
          quote_type: quoteType,
          notes,
          body_snippet: body.slice(0, 500),
          received_date: dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString(),
          attachment_urls: [],
        };

        if (refType === 'mto') {
          const records = await base44.asServiceRole.entities.SavedMTO.filter({ id: refId });
          if (records.length > 0) {
            const existing = records[0].vendor_quotes || [];
            if (!existing.find(q => q.message_id === msg.id)) {
              await base44.asServiceRole.entities.SavedMTO.update(refId, { vendor_quotes: [...existing, quoteRecord] });
              processed++;
            }
          }
        } else {
          const records = await base44.asServiceRole.entities.SavedSoW.filter({ id: refId });
          if (records.length > 0) {
            const existing = records[0].sub_quotes || [];
            if (!existing.find(q => q.message_id === msg.id)) {
              await base44.asServiceRole.entities.SavedSoW.update(refId, { sub_quotes: [...existing, quoteRecord] });
              processed++;
            }
          }
        }

        await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/modify`,
          {
            method: 'POST',
            headers: { ...authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
          }
        );
      } catch (_) {}
    }

    return Response.json({ processed, total_found: messages.length });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});