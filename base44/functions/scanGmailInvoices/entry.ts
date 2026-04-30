import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function getGmailAccessToken() {
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

// Keywords that suggest an email contains invoice/proposal/quote content
const INVOICE_KEYWORDS = [
  'invoice', 'proposal', 'quote', 'quotation', 'bill', 'receipt',
  'payment due', 'remittance', 'statement', 'purchase order', 'po #', 'inv #',
  'estimate', 'billing statement'
];

function hasInvoiceKeyword(text) {
  const lower = (text || '').toLowerCase();
  return INVOICE_KEYWORDS.some(kw => lower.includes(kw));
}

function getHeader(headers, name) {
  const h = headers?.find(h => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

function decodeBase64(data) {
  try {
    return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  } catch { return ''; }
}

function extractEmailAddress(str) {
  const match = str.match(/<([^>]+)>/);
  return match ? match[1] : str.trim();
}

function extractName(str) {
  const match = str.match(/^([^<]+)</);
  if (match) return match[1].trim().replace(/"/g, '');
  return str.replace(/<[^>]+>/, '').trim() || str;
}

function parseDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {}
  return null;
}

function extractBodyText(payload) {
  let text = '';
  if (payload.body?.data) {
    text += decodeBase64(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text += decodeBase64(part.body.data);
      }
      if (part.parts) {
        for (const subpart of part.parts) {
          if (subpart.mimeType === 'text/plain' && subpart.body?.data) {
            text += decodeBase64(subpart.body.data);
          }
        }
      }
    }
  }
  return text.slice(0, 3000);
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
  scan(payload.parts);
  return attachments;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { maxResults = 50, filterEmail } = body;

    // Require authenticated user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get access token via refresh token
    const accessToken = await getGmailAccessToken();

    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Get Gmail profile to identify user
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: authHeader });
    const profile = await profileRes.json();
    const gmailEmail = profile.emailAddress;

    // Search for emails with attachments and invoice-related subjects, filtered to alias if provided
    const toFilter = filterEmail ? ` to:${filterEmail}` : '';
    const query = `has:attachment (invoice OR proposal OR quote OR bill OR receipt OR "purchase order") -in:sent${toFilter}`;
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    const listRes = await fetch(listUrl, { headers: authHeader });
    const listData = await listRes.json();

    if (!listData.messages || listData.messages.length === 0) {
      return Response.json({ scanned: 0, found: 0, new: 0, gmailEmail });
    }

    // Get existing message IDs to avoid duplicates
    const existing = await base44.asServiceRole.entities.InvoiceRecord.filter({ connected_user_email: gmailEmail });
    const existingIds = new Set(existing.map(r => r.gmail_message_id));

    const newMessages = listData.messages.filter(m => !existingIds.has(m.id));

    let found = 0;
    const results = [];

    for (const msg of newMessages) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: authHeader }
      );
      if (!msgRes.ok) continue;
      const message = await msgRes.json();

      const headers = message.payload?.headers || [];
      const subject = getHeader(headers, 'Subject');
      const fromRaw = getHeader(headers, 'From');
      const dateRaw = getHeader(headers, 'Date');
      const receivedDate = parseDate(dateRaw) || new Date(parseInt(message.internalDate)).toISOString();

      const attachments = getAttachments(message.payload);
      if (attachments.length === 0) continue;

      const bodyText = extractBodyText(message.payload);
      const combinedText = `${subject} ${bodyText}`;

      if (!hasInvoiceKeyword(combinedText)) continue;

      const vendorEmail = extractEmailAddress(fromRaw);
      const vendorName = extractName(fromRaw);

      // OCR: try to upload & extract from PDF/image attachments first
      let attachmentFileUrls = [];
      for (const att of attachments.slice(0, 3)) {
        if (!att.id) continue;
        try {
          const attRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${att.id}`,
            { headers: authHeader }
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

      // Use AI to extract structured data — prefer attachments (OCR), fall back to body text
      let aiData = {};
      try {
        const hasFiles = attachmentFileUrls.length > 0;
        aiData = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Extract invoice/proposal/quote data from this ${hasFiles ? 'attachment' : 'email'}. Return JSON only.
Email Subject: ${subject}
From: ${fromRaw}
${!hasFiles ? `Body excerpt: ${bodyText.slice(0, 1500)}` : ''}

Return this JSON schema (use null for unknown fields):
{
  "invoice_number": string or null,
  "invoice_date": "YYYY-MM-DD" or null,
  "due_date": "YYYY-MM-DD" or null,
  "amount": number or null,
  "vendor_name": string or null,
  "document_type": "invoice" | "proposal" | "quote" | "bill" | "receipt" | "other"
}`,
          response_json_schema: {
            type: "object",
            properties: {
              invoice_number: { type: "string" },
              invoice_date: { type: "string" },
              due_date: { type: "string" },
              amount: { type: "number" },
              vendor_name: { type: "string" },
              document_type: { type: "string" }
            }
          },
          ...(hasFiles ? { file_urls: attachmentFileUrls } : {})
        });
      } catch (_) { /* ai failed, use defaults */ }

      // Duplicate detection: flag if same vendor + invoice number already exists
      const isDuplicate = aiData?.invoice_number
        ? existing.some(r => r.invoice_number === aiData.invoice_number && (r.vendor_name || r.vendor_email) === (aiData?.vendor_name || vendorName || vendorEmail))
        : false;

      // Lookup vendor category from Vendor entity
      const finalVendorName = aiData?.vendor_name || vendorName;
      let vendorCategory = null;
      try {
        const vendors = await base44.asServiceRole.entities.Vendor.filter({ email: vendorEmail });
        if (vendors.length > 0) {
          vendorCategory = vendors[0].category || null;
        }
      } catch (_) {}

      // AI classify the category from invoice content
      let aiClassifiedCategory = null;
      if (bodyText && bodyText.trim().length > 0) {
        try {
          const classifyData = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `Based on this invoice/quote/proposal, identify the primary trade or service category. Return a valid JSON object with a 'category' field.
Email Subject: ${subject}
Vendor: ${finalVendorName}
Body excerpt: ${bodyText.slice(0, 1500)}

Possible categories: Lumber & Building Materials, Electrical, Plumbing, HVAC, Roofing, Flooring, Hardware, Paint, Concrete & Masonry, General Supply, Carpentry, Labor, Other`,
            response_json_schema: {
              type: "object",
              properties: {
                category: { type: "string" }
              }
            }
          });
          if (classifyData && typeof classifyData === 'object' && classifyData.category) {
            aiClassifiedCategory = classifyData.category;
          }
        } catch (_) {
          // AI classification failed, continue without it
        }
      }

      const record = {
        gmail_message_id: msg.id,
        gmail_thread_id: message.threadId,
        connected_user_email: gmailEmail,
        vendor_name: finalVendorName,
        vendor_email: vendorEmail,
        document_type: aiData?.document_type || 'invoice',
        invoice_number: aiData?.invoice_number || null,
        invoice_date: aiData?.invoice_date || null,
        due_date: aiData?.due_date || null,
        amount: aiData?.amount || null,
        email_subject: subject,
        email_received_date: receivedDate,
        email_snippet: message.snippet || '',
        attachment_names: attachments.map(a => a.name),
        attachment_urls: attachmentFileUrls,
        vendor_category: vendorCategory,
        ai_classified_category: aiClassifiedCategory,
        status: isDuplicate ? 'on_hold' : 'pending_review',
        pinned: false,
        ai_extracted: true,
        notes: isDuplicate ? '⚠️ Possible duplicate: same vendor + invoice number already on file.' : '',
        history: [{
          action: isDuplicate ? 'flagged_duplicate' : 'scanned',
          by: 'system',
          at: new Date().toISOString(),
          note: isDuplicate ? 'Duplicate invoice number detected' : `Scanned from ${gmailEmail}`
        }]
      };

      await base44.asServiceRole.entities.InvoiceRecord.create(record);
      found++;
      results.push({ subject, vendor: record.vendor_name });
    }

    return Response.json({
      scanned: newMessages.length,
      found,
      new: found,
      gmailEmail,
      results
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});