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

const EXPECTED_GMAIL_EMAIL = 'info@coenconstruction.com';

const INVOICE_KEYWORDS = [
  'invoice', 'proposal', 'quote', 'quotation', 'bill', 'receipt',
  'payment due', 'remittance', 'statement', 'purchase order', 'po #', 'inv #',
  'estimate', 'billing statement'
];

function hasInvoiceKeyword(text) {
  const lower = (text || '').toLowerCase();
  return INVOICE_KEYWORDS.some(kw => lower.includes(kw));
}

// Deterministic noise rules — these senders flood the inbox with automated
// emails that are technically receipts/notifications but rarely need review.
const NOISE_RULES = [
  {
    label: 'Material Receipt',
    match: ({ fromEmail, subject }) =>
      /@(?:[\w.-]+\.)?homedepot\.com$/i.test(fromEmail) || /home depot receipt/i.test(subject),
  },
  {
    label: 'Material Receipt',
    match: ({ fromEmail }) => /@(?:[\w.-]+\.)?(lowes|menards)\.com$/i.test(fromEmail),
  },
  {
    label: 'Phone Notification',
    match: ({ fromEmail, subject }) =>
      /voice-noreply@google\.com$/i.test(fromEmail) ||
      /@txt\.voice\.google\.com$/i.test(fromEmail) ||
      /new (text message|voicemail) from/i.test(subject),
  },
];

function classifyNoise(fromEmail, subject) {
  for (const rule of NOISE_RULES) {
    if (rule.match({ fromEmail: fromEmail || '', subject: subject || '' })) {
      return { priority: 'low', ai_label: rule.label };
    }
  }
  return null;
}

// --- Project auto-matching (PO / job name / delivery address → ContractorProject) ---
// NOTE: duplicated in matchInvoiceProjects/entry.ts — keep both in sync.

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const STREET_SUFFIXES = new Set([
  'st', 'street', 'ave', 'avenue', 'rd', 'road', 'ln', 'lane', 'dr', 'drive',
  'ct', 'court', 'cir', 'circle', 'blvd', 'boulevard', 'way', 'pl', 'place',
  'ter', 'terrace', 'trl', 'trail', 'hwy', 'highway', 'n', 's', 'e', 'w',
  'north', 'south', 'east', 'west'
]);

const ACTIVE_PROJECT_STATUSES = new Set([
  'walkthrough', 'draft', 'sent', 'pending_review', 'approved', 'modify',
  'in_progress', 'on_hold', 'completed', 'imported'
]);

function buildProjectMatchers(projects) {
  return projects
    .filter(p => !p.status || ACTIVE_PROJECT_STATUSES.has(p.status))
    .map(p => {
      const addr = normalizeText(p.client_address);
      const m = addr.match(/^(\d+)\s+(.+)$/);
      let streetNum = null, streetWords = [];
      if (m) {
        streetNum = m[1];
        streetWords = m[2].split(' ').filter(w => w.length >= 3 && !STREET_SUFFIXES.has(w));
      }
      const nameWords = normalizeText(p.client_name).split(' ').filter(w => w.length >= 4);
      const lastName = nameWords.length > 0 ? nameWords[nameWords.length - 1] : null;
      return { project: p, streetNum, streetWords, lastName };
    })
    .filter(x => (x.streetNum && x.streetWords.length > 0) || x.lastName);
}

// Address matching: in the short crew-entered PO/delivery fields the street
// number and street word may appear anywhere; in broad email text the number
// must be DIRECTLY followed by a street word (a real address phrase) — bare
// co-occurrence false-matches common-word street names like "Page" in prose.
// Client-name matches stay restricted to the PO/delivery fields.
function matchProject(matchers, { poText, broadText }) {
  const po = ' ' + normalizeText(poText) + ' ';
  const broad = ' ' + normalizeText(broadText) + ' ' + po;
  for (const m of matchers) {
    if (!m.streetNum || m.streetWords.length === 0) continue;
    const poHit = po.includes(` ${m.streetNum} `) && m.streetWords.some(w => po.includes(` ${w} `));
    const broadHit = m.streetWords.some(w => broad.includes(` ${m.streetNum} ${w} `));
    if (poHit || broadHit) {
      return {
        project: m.project,
        reason: `Address "${m.streetNum} ${m.streetWords[0]}…" matched ${m.project.client_name}'s project`
      };
    }
  }
  for (const m of matchers) {
    if (m.lastName && po.includes(` ${m.lastName} `)) {
      return {
        project: m.project,
        reason: `PO/job name contains "${m.lastName}" → ${m.project.client_name}'s project`
      };
    }
  }
  return null;
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
    throw new Error('Gmail is not connected. Go to Company Profile → Email Integration and click "Connect Gmail".');
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
      ? 'Gmail access was revoked or expired — reconnect from Company Profile → Email Integration.'
      : 'Gmail connection could not be refreshed. Check Gmail OAuth secrets.');
  }
  return tokenData.access_token;
}

// Messages that were scanned but produced no record (no attachment, no
// keyword) are remembered here so they never consume sync budget again.
async function loadSkipState(base44) {
  try {
    const rows = await base44.asServiceRole.entities.SyncState.filter({ key: 'gmail_invoice_skips' });
    if (rows[0]) {
      let ids = [];
      try { ids = JSON.parse(rows[0].data || '[]'); } catch { /* corrupt — start fresh */ }
      return { recordId: rows[0].id, ids: new Set(Array.isArray(ids) ? ids : []) };
    }
  } catch { /* entity missing — start fresh */ }
  return { recordId: null, ids: new Set() };
}

async function saveSkipState(base44, skipState) {
  const arr = [...skipState.ids].slice(-1000);
  const payload = {
    key: 'gmail_invoice_skips',
    data: JSON.stringify(arr),
    last_synced_at: new Date().toISOString(),
  };
  try {
    if (skipState.recordId) {
      await base44.asServiceRole.entities.SyncState.update(skipState.recordId, payload);
    } else {
      await base44.asServiceRole.entities.SyncState.create(payload);
    }
  } catch { /* bookkeeping only — never fail the sync */ }
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

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBodyText(payload) {
  let plain = '';
  let html = '';
  function walk(part) {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) plain += decodeBase64(part.body.data);
    if (part.mimeType === 'text/html' && part.body?.data) html += decodeBase64(part.body.data);
    if (part.body?.data && !part.mimeType && !part.parts) plain += decodeBase64(part.body.data);
    (part.parts || []).forEach(walk);
  }
  if (payload.body?.data) plain += decodeBase64(payload.body.data);
  (payload.parts || []).forEach(walk);
  // Many vendor emails are HTML-only; fall back to stripped HTML so keyword
  // detection doesn't silently reject them.
  const text = plain.trim() || stripHtml(html);
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

// Returns { record } when a record should be created, { skip: true } when the
// message is permanently uninteresting, or null on transient fetch failure.
async function processMessage(base44, authHeader, msg, existingRecords, gmailEmail, projectMatchers) {
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
  if (attachments.length === 0) return { skip: true };

  const bodyText = extractBodyText(message.payload);
  if (!hasInvoiceKeyword(`${subject} ${bodyText}`)) return { skip: true };

  const vendorEmail = extractEmailAddress(fromRaw);
  const vendorName = extractName(fromRaw);
  const noise = classifyNoise(vendorEmail, subject);

  const attachmentFileUrls = (await Promise.all(
    attachments.slice(0, 3).map(att => uploadAttachment(base44, authHeader, msg.id, att))
  )).filter(Boolean);

  let aiData = {};
  try {
    const hasFiles = attachmentFileUrls.length > 0;
    aiData = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Extract invoice data from this ${hasFiles ? 'attachment' : 'email'}, classify the trade category, and rate its importance. Return JSON only.
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
  "ai_classified_category": string or null (e.g. Lumber & Building Materials, Electrical, Plumbing, HVAC, Roofing, Flooring, Hardware, Paint, Concrete & Masonry, General Supply, Carpentry, Labor, Other),
  "priority": "high"|"normal"|"low" (low = automated store receipts, phone/text notifications, marketing or system emails; high = invoice that is overdue or demands payment now; normal = regular vendor invoice, quote, or bill),
  "ai_label": short 2-3 word label like "Vendor Invoice", "Material Receipt", "Subcontractor Bill", "Vendor Quote", "Phone Notification",
  "po_name": string or null (the PO, "PO Name", "PO/Job Name", job name, or job reference printed on the receipt/invoice — Home Depot Pro receipts show this near the top; copy it exactly),
  "delivery_address": string or null (job-site or delivery address if one is shown — NOT the store or vendor address)
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
          ai_classified_category: { type: "string" },
          priority: { type: "string" },
          ai_label: { type: "string" },
          po_name: { type: "string" },
          delivery_address: { type: "string" }
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

  const priority = noise?.priority
    || (['high', 'normal', 'low'].includes(aiData?.priority) ? aiData.priority : 'normal');
  const aiLabel = noise?.ai_label || aiData?.ai_label || null;

  // Auto-assign to a project when the PO/job name or an address matches
  const poName = aiData?.po_name || null;
  const deliveryAddress = aiData?.delivery_address || null;
  const projectMatch = projectMatchers?.length > 0
    ? matchProject(projectMatchers, {
        poText: `${poName || ''} ${deliveryAddress || ''}`,
        broadText: `${subject} ${bodyText.slice(0, 1500)}`
      })
    : null;

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
    ai_classified_category: aiData?.ai_classified_category || null,
    priority,
    ai_label: aiLabel,
    po_name: poName,
    delivery_address: deliveryAddress,
    ...(projectMatch ? {
      project_id: projectMatch.project.id,
      project_match_status: 'suggested',
      project_match_reason: projectMatch.reason,
    } : {}),
    status: isDuplicate ? 'on_hold' : 'pending_review',
    pinned: false,
    ai_extracted: true,
    notes: isDuplicate ? '⚠️ Possible duplicate: same vendor + invoice number already on file.' : '',
    history: [
      {
        action: isDuplicate ? 'flagged_duplicate' : 'scanned',
        by: 'system',
        at: new Date().toISOString(),
        note: isDuplicate ? 'Duplicate invoice number detected' : `Scanned from ${gmailEmail}`
      },
      ...(projectMatch ? [{
        action: 'project_auto_matched',
        by: 'system',
        at: new Date().toISOString(),
        note: projectMatch.reason
      }] : [])
    ]
  };
  return { record };
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { base44 } = await verifyAdminSession(req, 'can_access_invoices', body);
    const { maxResults = 50, processLimit = 8, filterEmail } = body;

    const accessToken = await getGmailAccessToken(base44);
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: authHeader });
    const profile = await profileRes.json();
    const gmailEmail = profile.emailAddress;
    if (String(gmailEmail || '').toLowerCase() !== EXPECTED_GMAIL_EMAIL) {
      throw new Error(`Connected Gmail must be ${EXPECTED_GMAIL_EMAIL}. Current token is for ${gmailEmail || 'unknown account'}.`);
    }

    const toFilter = filterEmail ? ` to:${filterEmail}` : ` to:${EXPECTED_GMAIL_EMAIL}`;
    const query = `has:attachment (invoice OR proposal OR quote OR bill OR receipt OR "purchase order") -in:sent${toFilter}`;
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${Math.max(1, Math.min(Number(maxResults) || 50, 100))}`;
    const listRes = await fetch(listUrl, { headers: authHeader });
    const listData = await listRes.json();

    const skipState = await loadSkipState(base44);

    if (!listData.messages || listData.messages.length === 0) {
      return Response.json({ scanned: 0, found: 0, new: 0, remaining: 0, gmailEmail });
    }

    const existing = await base44.asServiceRole.entities.InvoiceRecord.filter({ connected_user_email: gmailEmail });
    const existingIds = new Set(existing.map(r => r.gmail_message_id));

    let projectMatchers = [];
    try {
      const projects = await base44.asServiceRole.entities.ContractorProject.list('-created_date', 200);
      projectMatchers = buildProjectMatchers(projects);
    } catch { /* matching is best-effort */ }
    const allNewMessages = listData.messages.filter(m => !existingIds.has(m.id) && !skipState.ids.has(m.id));
    const safeProcessLimit = Math.max(1, Math.min(Number(processLimit) || 8, 10));
    const newMessages = allNewMessages.slice(0, safeProcessLimit);

    const startedAt = Date.now();
    const MAX_RUNTIME_MS = 45000;
    let found = 0;
    let skipped = 0;
    let processed = 0;
    const results = [];

    for (const msg of newMessages) {
      if (Date.now() - startedAt > MAX_RUNTIME_MS) break;
      const outcome = await processMessage(base44, authHeader, msg, existing, gmailEmail, projectMatchers);
      processed++;
      if (!outcome) continue; // transient failure — retry on a future sync
      if (outcome.skip) {
        skipState.ids.add(msg.id);
        skipped++;
        continue;
      }
      await base44.asServiceRole.entities.InvoiceRecord.create(outcome.record);
      found++;
      results.push({ subject: outcome.record.email_subject, vendor: outcome.record.vendor_name, priority: outcome.record.priority });
    }

    await saveSkipState(base44, skipState);

    return Response.json({
      scanned: processed,
      found,
      new: found,
      skipped,
      remaining: Math.max(0, allNewMessages.length - processed),
      gmailEmail,
      lastSyncedAt: new Date().toISOString(),
      results
    });

  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});
