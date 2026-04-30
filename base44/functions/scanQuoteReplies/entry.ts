import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      if (!tokenData.access_token) return Response.json({ message: 'Gmail not configured — check secrets.' });
      accessToken = tokenData.access_token;
    } catch (_) {
      return Response.json({ message: 'Gmail not connected — check secrets.' });
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
    return Response.json({ error: error.message }, { status: 500 });
  }
});