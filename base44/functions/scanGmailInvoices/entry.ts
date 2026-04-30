import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GMAIL_CLIENT_ID'),
      client_secret: Deno.env.get('GMAIL_CLIENT_SECRET'),
      refresh_token: Deno.env.get('GMAIL_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || 'Failed to get Gmail access token');
  return data.access_token;
}

function getHeader(headers, name) {
  return headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

function collectParts(payload, result = []) {
  if (!payload) return result;
  if (payload.parts) {
    for (const p of payload.parts) collectParts(p, result);
  } else {
    result.push(payload);
  }
  return result;
}

function getBodyText(payload) {
  const parts = collectParts(payload);
  for (const p of parts) {
    if (p.mimeType === 'text/plain' && p.body?.data) {
      return atob(p.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
  }
  // fallback: html
  for (const p of parts) {
    if (p.mimeType === 'text/html' && p.body?.data) {
      const html = atob(p.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }
  return '';
}

function extractAttachmentMeta(payload, result = []) {
  if (!payload) return result;
  if (payload.filename && payload.filename.trim().length > 0 && payload.body?.attachmentId) {
    const lower = payload.filename.toLowerCase();
    if (lower.endsWith('.pdf') || lower.endsWith('.png') || lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') || lower.endsWith('.doc') || lower.endsWith('.docx') ||
        lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv')) {
      result.push({ name: payload.filename, attachmentId: payload.body.attachmentId, mimeType: payload.mimeType });
    }
  }
  if (payload.parts) {
    for (const p of payload.parts) extractAttachmentMeta(p, result);
  }
  return result;
}

function classifyDocument(subject, body) {
  const text = (subject + ' ' + body).toLowerCase();
  if (/\bquote\b|\bquotation\b/.test(text)) return 'quote';
  if (/\bproposal\b/.test(text)) return 'proposal';
  if (/\bestimate\b/.test(text)) return 'quote';
  if (/\breceipt\b/.test(text)) return 'receipt';
  if (/\bbill\b|\bbilling\b/.test(text)) return 'bill';
  return 'invoice';
}

function extractAmount(text) {
  const matches = text.match(/\$[\d,]+(?:\.\d{2})?/g);
  if (!matches) return null;
  const amounts = matches.map(m => parseFloat(m.replace(/[$,]/g, ''))).filter(n => n > 0);
  return amounts.length ? Math.max(...amounts) : null;
}

function extractInvoiceNumber(text) {
  const m = text.match(/(?:invoice|inv|#|no\.?)\s*[:# ]?\s*([A-Z0-9-]{3,20})/i);
  return m ? m[1] : null;
}

function extractDate(text) {
  const m = text.match(/(?:date|dated|issued)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+ \d{1,2},? \d{4})/i);
  if (m) {
    const d = new Date(m[1]);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  }
  return null;
}

function extractDueDate(text) {
  const m = text.match(/(?:due|payment due|due date)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+ \d{1,2},? \d{4})/i);
  if (m) {
    const d = new Date(m[1]);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const maxResults = body.maxResults || 50;

    const accessToken = await getAccessToken();
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Search for invoices, quotes, estimates in Gmail
    const searchQueries = [
      'subject:(invoice OR quote OR quotation OR estimate OR proposal OR bill OR receipt)',
      'has:attachment (invoice OR quote OR estimate OR receipt)',
    ];
    const query = searchQueries.join(' OR ');

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`,
      { headers: authHeader }
    );
    if (!listRes.ok) {
      const err = await listRes.text();
      return Response.json({ error: `Gmail API error: ${err}` }, { status: 500 });
    }
    const listData = await listRes.json();
    const messages = listData.messages || [];

    // Get existing message IDs to avoid re-processing
    const existing = await base44.asServiceRole.entities.InvoiceRecord.list('-email_received_date', 500);
    const existingIds = new Set(existing.map(r => r.gmail_message_id));

    let newCount = 0;
    let scanned = 0;
    let gmailEmail = 'cole@coenconstruction.com';

    for (const msg of messages) {
      scanned++;
      if (existingIds.has(msg.id)) continue;

      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: authHeader }
        );
        if (!msgRes.ok) continue;
        const message = await msgRes.json();
        const headers = message.payload?.headers || [];

        const subject = getHeader(headers, 'Subject');
        const fromRaw = getHeader(headers, 'From');
        const dateHeader = getHeader(headers, 'Date');

        // Extract sender info
        const emailMatch = fromRaw.match(/<([^>]+)>/);
        const vendorEmail = emailMatch ? emailMatch[1] : fromRaw.trim();
        const nameMatch = fromRaw.match(/^([^<]+)</);
        const vendorName = nameMatch ? nameMatch[1].trim().replace(/"/g, '') : vendorEmail.split('@')[0];

        // Get body text for extraction
        const bodyText = getBodyText(message.payload);
        const combinedText = subject + '\n' + bodyText;

        // Get attachment metadata
        const attachments = extractAttachmentMeta(message.payload);

        // Upload attachments and get URLs
        const attachmentNames = [];
        const attachmentUrls = [];

        for (const att of attachments.slice(0, 5)) {
          try {
            const attRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${att.attachmentId}`,
              { headers: authHeader }
            );
            if (!attRes.ok) continue;
            const attData = await attRes.json();
            if (!attData.data) continue;

            const base64 = attData.data.replace(/-/g, '+').replace(/_/g, '/');
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

            const mimeType = att.mimeType || 'application/octet-stream';
            const file = new File([bytes], att.name, { type: mimeType });
            const uploaded = await base44.asServiceRole.integrations.Core.UploadFile({ file });
            if (uploaded?.file_url) {
              attachmentUrls.push(uploaded.file_url);
              attachmentNames.push(att.name);
            }
          } catch (_) {
            // If upload fails, still track the name
            attachmentNames.push(att.name);
          }
        }

        const docType = classifyDocument(subject, bodyText);
        const receivedDate = dateHeader ? new Date(dateHeader).toISOString() : new Date(message.internalDate * 1).toISOString();

        const record = {
          gmail_message_id: msg.id,
          gmail_thread_id: message.threadId,
          connected_user_email: gmailEmail,
          vendor_name: vendorName,
          vendor_email: vendorEmail,
          document_type: docType,
          invoice_number: extractInvoiceNumber(combinedText),
          invoice_date: extractDate(bodyText),
          due_date: extractDueDate(bodyText),
          amount: extractAmount(combinedText),
          currency: 'USD',
          email_subject: subject,
          email_received_date: receivedDate,
          email_snippet: message.snippet || '',
          attachment_names: attachmentNames,
          attachment_urls: attachmentUrls,
          status: 'pending_review',
          ai_extracted: true,
        };

        await base44.asServiceRole.entities.InvoiceRecord.create(record);
        newCount++;
      } catch (_) {
        // Skip problematic messages
      }
    }

    return Response.json({
      scanned,
      new: newCount,
      total: messages.length,
      gmailEmail,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});