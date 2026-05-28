import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
  try { return atob(data.replace(/-/g, '+').replace(/_/g, '/')); } catch { return ''; }
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
  if (payload.body?.data) text += decodeBase64(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) text += decodeBase64(part.body.data);
      if (part.parts) {
        for (const subpart of part.parts) {
          if (subpart.mimeType === 'text/plain' && subpart.body?.data) text += decodeBase64(subpart.body.data);
        }
      }
    }
  }
  return text.slice(0, 2000);
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
          attachments.push({ name: part.filename, id: part.body?.attachmentId, mimeType: part.mimeType });
        }
      }
      if (part.parts) scan(part.parts);
    }
  }
  scan(payload.parts);
  return attachments;
}

function getMimeForFile(filename, mimeType) {
  if (mimeType && mimeType !== 'application/octet-stream') return mimeType;
  const ext = filename.toLowerCase();
  if (ext.endsWith('.pdf')) return 'application/pdf';
  if (ext.endsWith('.png')) return 'image/png';
  if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) return 'image/jpeg';
  if (ext.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (ext.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext.endsWith('.doc')) return 'application/msword';
  return 'application/octet-stream';
}

async function uploadAttachment(base44, authHeader, msgId, att) {
  if (!att.id) return null;
  try {
    const attRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${att.id}`,
      { headers: authHeader }
    );
    if (!attRes.ok) return null;
    const attData = await attRes.json();
    if (!attData.data) return null;
    const binary = atob(attData.data.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const mime = getMimeForFile(att.name, att.mimeType);
    const file = new File([bytes], att.name, { type: mime });
    const uploaded = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    return uploaded?.file_url || null;
  } catch (_) { return null; }
}

async function processMessage(base44, authHeader, msg, existingIds, existingRecords, gmailEmail) {
  if (existingIds.has(msg.id)) return null;

  const msgRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
    { headers: authHeader }
  );
  if (!msgRes.ok) return null;
  const message = await msgRes.json();

  const headers = message.payload?.headers || [];
  const subject = getHeader(headers, 'Subject');
  const fromRaw = getHeader(headers, 'From');
  const dateRaw = getHeader(headers, 'Date');
  const receivedDate = parseDate(dateRaw) || new Date(parseInt(message.internalDate)).toISOString();

  const attachments = getAttachments(message.payload);
  if (attachments.length === 0) return null;

  const bodyText = extractBodyText(message.payload);
  if (!hasInvoiceKeyword(`${subject} ${bodyText}`)) return null;

  const vendorEmail = extractEmailAddress(fromRaw);
  const vendorName = extractName(fromRaw);

  const attachmentFileUrls = (await Promise.all(
    attachments.slice(0, 3).map(att => uploadAttachment(base44, authHeader, msg.id, att))
  )).filter(Boolean);

  let aiData = {};
  try {
    const hasFiles = attachmentFileUrls.length > 0;
    aiData = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Extract invoice data from this ${hasFiles ? 'attachment' : 'email'} and classify the trade category. Return JSON only.
Email Subject: ${subject}
From: ${fromRaw}
${!hasFiles ? `Body: ${bodyText.slice(0, 1000)}` : ''}

Return:
{
  "invoice_number": string or null,
  "invoice_date": "YYYY-MM-DD" or null,
  "due_date": "YYYY-MM-DD" or null,
  "amount": number or null,
  "vendor_name": string or null,
  "document_type": "invoice"|"proposal"|"quote"|"bill"|"receipt"|"other",
  "ai_classified_category": string or null (e.g. Lumber & Building Materials, Electrical, Plumbing, HVAC, Roofing, Flooring, Hardware, Paint, Concrete & Masonry, General Supply, Carpentry, Labor, Other)
}`,
      response_json_schema: {
        type: "object",
        properties: {
          invoice_number: { type: "string" },
          invoice_date: { type: "string" },
          due_date: { type: "string" },
          amount: { type: "number" },
          vendor_name: { type: "string" },
          document_type: { type: "string" },
          ai_classified_category: { type: "string" }
        }
      },
      ...(hasFiles ? { file_urls: attachmentFileUrls } : {})
    });
  } catch (_) {}

  const finalVendorName = aiData?.vendor_name || vendorName;

  let vendorCategory = null;
  try {
    const vendors = await base44.asServiceRole.entities.Vendor.filter({ email: vendorEmail });
    if (vendors.length > 0) vendorCategory = vendors[0].category || null;
  } catch (_) {}

  const isDuplicate = aiData?.invoice_number
    ? existingRecords.some(r => r.invoice_number === aiData.invoice_number &&
        (r.vendor_name || r.vendor_email) === (aiData?.vendor_name || vendorName || vendorEmail))
    : false;

  return {
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
    ai_classified_category: aiData?.ai_classified_category || null,
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
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { maxResults = 20, filterEmail } = body;

    // Use Base44 Gmail connector (shared admin connection)
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: authHeader });
    const profile = await profileRes.json();
    const gmailEmail = profile.emailAddress;

    const toFilter = filterEmail ? ` to:${filterEmail}` : '';
    const query = `has:attachment (invoice OR proposal OR quote OR bill OR receipt OR "purchase order") -in:sent${toFilter}`;
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    const listRes = await fetch(listUrl, { headers: authHeader });
    const listData = await listRes.json();

    if (!listData.messages || listData.messages.length === 0) {
      return Response.json({ scanned: 0, found: 0, new: 0, gmailEmail });
    }

    const existing = await base44.asServiceRole.entities.InvoiceRecord.filter({ connected_user_email: gmailEmail });
    const existingIds = new Set(existing.map(r => r.gmail_message_id));
    const newMessages = listData.messages.filter(m => !existingIds.has(m.id));

    const BATCH_SIZE = 3;
    let found = 0;
    const results = [];

    for (let i = 0; i < newMessages.length; i += BATCH_SIZE) {
      const batch = newMessages.slice(i, i + BATCH_SIZE);
      const records = await Promise.all(
        batch.map(msg => processMessage(base44, authHeader, msg, existingIds, existing, gmailEmail))
      );
      for (const record of records) {
        if (!record) continue;
        await base44.asServiceRole.entities.InvoiceRecord.create(record);
        found++;
        results.push({ subject: record.email_subject, vendor: record.vendor_name });
      }
    }

    return Response.json({ scanned: newMessages.length, found, new: found, gmailEmail, results });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});