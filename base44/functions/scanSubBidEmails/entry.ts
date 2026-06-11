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

const BID_KEYWORDS = ['quote', 'quotation', 'bid', 'estimate', 'proposal', 'pricing', 'takeoff', 'take-off'];

const TRADES = [
  'Electrical', 'Plumbing', 'HVAC', 'Framing', 'Roofing', 'Siding',
  'Plastering/Drywall', 'Painting', 'Flooring', 'Masonry/Concrete',
  'Windows & Doors', 'Lumber & Materials', 'Glass & Shower', 'Sheet Metal',
  'Demolition', 'Landscaping', 'Other'
];

function hasBidKeyword(text) {
  const lower = (text || '').toLowerCase();
  return BID_KEYWORDS.some(kw => lower.includes(kw));
}

// Senders that can never be sub/vendor bids — skipping them here saves LLM calls.
const NOISE_RULES = [
  ({ fromEmail }) => /voice-noreply@google\.com$/i.test(fromEmail) || /@txt\.voice\.google\.com$/i.test(fromEmail),
  ({ fromEmail }) => /@(?:[\w.-]+\.)?(planhub|constructconnect|buildertrend|billtrust)\.com$/i.test(fromEmail),
  ({ fromEmail }) => /@(?:[\w.-]+\.)?(homedepot|lowes|menards)\.com$/i.test(fromEmail),
  ({ subject }) => /new (text message|voicemail) from/i.test(subject),
];

function isNoise(fromEmail, subject) {
  return NOISE_RULES.some(rule => rule({ fromEmail: fromEmail || '', subject: subject || '' }));
}

// --- Deterministic project matching (address / client name → ContractorProject) ---
// Trimmed copy of the matcher in scanGmailInvoices — cross-checks the LLM's pick.

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const STREET_SUFFIXES = new Set([
  'st', 'street', 'ave', 'avenue', 'rd', 'road', 'ln', 'lane', 'dr', 'drive',
  'ct', 'court', 'cir', 'circle', 'blvd', 'boulevard', 'way', 'pl', 'place',
  'ter', 'terrace', 'trl', 'trail', 'hwy', 'highway', 'n', 's', 'e', 'w',
  'north', 'south', 'east', 'west'
]);

// Address-only on purpose: surname matching mis-fired badly — "Coen" appears
// in nearly every email (it's the company name), and client Dean Coen
// collected unrelated quotes because of it.
function buildProjectMatchers(projects) {
  return projects
    .map(p => {
      const addr = normalizeText(p.client_address);
      const m = addr.match(/^(\d+)\s+(.+)$/);
      let streetNum = null, streetWords = [];
      if (m) {
        streetNum = m[1];
        streetWords = m[2].split(' ').filter(w => w.length >= 3 && !STREET_SUFFIXES.has(w));
      }
      return { project: p, streetNum, streetWords };
    })
    .filter(x => x.streetNum && x.streetWords.length > 0);
}

function matchProjectDeterministic(matchers, text) {
  const broad = ' ' + normalizeText(text) + ' ';
  for (const m of matchers) {
    if (m.streetWords.some(w => broad.includes(` ${m.streetNum} ${w} `))) {
      return { project: m.project, reason: `Address "${m.streetNum} ${m.streetWords[0]}…" found in email`, confidence: 85 };
    }
  }
  return null;
}

// --- Vendor directory auto-load ---
// Every imported bid upserts its vendor so the directory builds itself:
// match by email (then company name), backfill missing contact info, or
// create a fresh profile with the right trade category.

const SUPPLIER_TRADES = new Set(['Lumber & Materials']);

const TRADE_TO_VENDOR_CATEGORY = {
  'Electrical': 'Electrical',
  'Plumbing': 'Plumbing',
  'HVAC': 'HVAC',
  'Framing': 'Framing',
  'Roofing': 'Roofing',
  'Siding': 'Siding',
  'Plastering/Drywall': 'Plastering & Drywall',
  'Painting': 'Paint',
  'Flooring': 'Flooring',
  'Masonry/Concrete': 'Concrete & Masonry',
  'Windows & Doors': 'Other',
  'Lumber & Materials': 'Lumber & Building Materials',
  'Glass & Shower': 'Glass & Shower',
  'Sheet Metal': 'Sheet Metal',
  'Demolition': 'Other',
  'Landscaping': 'Landscaping',
};

async function upsertVendor(base44, { email, company, contactName, phone, trade }) {
  try {
    let vendor = null;
    if (email) {
      const matches = await base44.asServiceRole.entities.Vendor.filter({ email });
      vendor = matches[0] || null;
    }
    if (!vendor && company) {
      const all = await base44.asServiceRole.entities.Vendor.list('-created_date', 500);
      vendor = all.find(v => normalizeText(v.company_name) === normalizeText(company)) || null;
    }
    if (vendor) {
      const patch = {};
      if (!vendor.phone && phone) patch.phone = phone;
      if (!vendor.contact_name && contactName) patch.contact_name = contactName;
      if (!vendor.email && email) patch.email = email;
      if (Object.keys(patch).length) {
        await base44.asServiceRole.entities.Vendor.update(vendor.id, patch);
      }
      return vendor.id;
    }
    if (!company) return undefined;
    const created = await base44.asServiceRole.entities.Vendor.create({
      company_name: company,
      contact_name: contactName || '',
      email: email || '',
      phone: phone || '',
      category: TRADE_TO_VENDOR_CATEGORY[trade] || 'Other',
      is_subcontractor: !SUPPLIER_TRADES.has(trade),
      notes: 'Auto-created by the sub bid email scanner.',
    });
    return created?.id;
  } catch (_) { return undefined; /* directory upkeep is best-effort */ }
}

async function resolveGmailRefreshToken(base44) {
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

// Messages that were scanned but produced no bid are remembered here so they
// never consume sync budget again.
async function loadSkipState(base44) {
  try {
    const rows = await base44.asServiceRole.entities.SyncState.filter({ key: 'gmail_subbid_skips' });
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
    key: 'gmail_subbid_skips',
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
  } catch { /* fall through */ }
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

// Returns { record } when a bid should be created, { skip: true, why } when the
// message is permanently uninteresting, or null on transient fetch failure.
async function processMessage(base44, authHeader, msg, ctx) {
  const { existingBids, projects, matchers, minConfidence } = ctx;

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

  const fromEmail = extractEmailAddress(fromRaw);
  if (isNoise(fromEmail, subject)) return { skip: true, why: 'noise sender' };

  const attachments = getAttachments(message.payload);
  if (attachments.length === 0) return { skip: true, why: 'no attachment' };

  const bodyText = extractBodyText(message.payload);
  if (!hasBidKeyword(`${subject} ${bodyText}`)) return { skip: true, why: 'no bid keyword' };

  const attachmentFileUrls = [];
  const attachmentFileNames = [];
  // Cap at 2 — each upload + LLM file-read adds seconds, and the request
  // must finish well inside the platform gateway timeout (504s otherwise).
  for (const att of attachments.slice(0, 2)) {
    const url = await uploadAttachment(base44, authHeader, msg.id, att);
    if (url) { attachmentFileUrls.push(url); attachmentFileNames.push(att.name); }
  }

  const projectList = projects
    .map(p => `${p.id} | ${p.client_name || '?'} | ${p.client_address || '?'}`)
    .join('\n');

  let ai = null;
  try {
    ai = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are reviewing an email received by Coen Construction (a general contractor) to decide whether it contains an ORIGINAL QUOTE / BID / ESTIMATE / PROPOSAL sent TO Coen by a subcontractor or material supplier, and which active project it belongs to.

NOT a sub bid: Coen's own estimates to its customers, customer replies about Coen's quotes, payment requests/invoices for completed or in-progress work (including AWO / additional-work-order billing), store receipts, scheduling chatter, marketing.
IS a sub bid: a sub or supplier quoting a price for labor and/or materials on a job (including quotes forwarded internally by Coen staff — judge the ORIGINAL quoted document).

PROJECT MATCHING RULES:
- Only set project_id when the email or document references that job's STREET ADDRESS (or the homeowner client's full name appearing as the job reference in the document itself).
- NEVER match because the word "Coen" appears — that is the contractor's own company/staff name, not job evidence. The client "Dean Coen" matches ONLY if 15 Martin Street is referenced.
- If the document names an address that is NOT in the project list, set project_id to null. Do not guess.

Email Subject: ${subject}
From: ${fromRaw}
Body (truncated): ${bodyText.slice(0, 1200)}
${attachmentFileUrls.length ? 'The attached document(s) are provided — read them for the amount and scope.' : ''}

Active projects (id | client | address):
${projectList}

Return JSON only:
{
  "is_sub_bid": boolean,
  "vendor_company": string or null (the sub/supplier company, NOT Coen Construction),
  "vendor_contact_name": string or null,
  "vendor_email": string or null (the sub/supplier's email if visible, e.g. original sender of a forwarded quote),
  "vendor_phone": string or null (the sub/supplier's phone from the email signature or document),
  "trade": one of ${JSON.stringify(TRADES)},
  "bid_amount": number or null (total quoted price; null if not stated),
  "summary": string (1-2 sentences: what is quoted, for which scope),
  "payment_terms": array or null (payment schedule IF the quote states one. Each entry: {"label": e.g. "Deposit"|"2nd Payment"|"Final"|milestone name, "amount": number or null, "percent": number or null (0-100, when stated as % of contract), "due_on": string or null (milestone/date as written), "notes": string or null}. Null when no schedule is stated — NEVER invent one),
  "project_id": string or null (id from the list above, only if the email/document clearly refers to that job's address or client),
  "match_confidence": number 0-100,
  "match_reason": string (cite the address/name evidence)
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          is_sub_bid: { type: 'boolean' },
          vendor_company: { type: 'string' },
          vendor_contact_name: { type: 'string' },
          vendor_email: { type: 'string' },
          vendor_phone: { type: 'string' },
          trade: { type: 'string' },
          bid_amount: { type: 'number' },
          summary: { type: 'string' },
          payment_terms: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                amount: { type: 'number' },
                percent: { type: 'number' },
                due_on: { type: 'string' },
                notes: { type: 'string' }
              }
            }
          },
          project_id: { type: 'string' },
          match_confidence: { type: 'number' },
          match_reason: { type: 'string' }
        }
      },
      ...(attachmentFileUrls.length ? { file_urls: attachmentFileUrls } : {})
    });
  } catch (_) {
    return null; // transient LLM failure — retry on a future scan
  }

  if (!ai?.is_sub_bid) return { skip: true, why: 'not a sub bid' };

  // Cross-check the LLM's project pick against the deterministic address matcher.
  const detMatch = matchProjectDeterministic(matchers, `${subject} ${bodyText.slice(0, 1500)}`);
  const llmProject = ai.project_id ? projects.find(p => p.id === ai.project_id) : null;
  let projectId = null, confidence = 0, reason = '';
  if (llmProject && detMatch && detMatch.project.id === llmProject.id) {
    projectId = llmProject.id;
    confidence = Math.max(Number(ai.match_confidence) || 0, detMatch.confidence, 85);
    reason = ai.match_reason || detMatch.reason;
  } else if (llmProject && !detMatch) {
    projectId = llmProject.id;
    confidence = Math.min(Number(ai.match_confidence) || 0, 80);
    reason = ai.match_reason || 'AI match';
  } else if (detMatch && !llmProject) {
    projectId = detMatch.project.id;
    confidence = detMatch.confidence;
    reason = detMatch.reason;
  } else if (llmProject && detMatch) {
    // Disagreement — address evidence in the email beats the LLM's pick
    // (models can transpose adjacent project ids).
    projectId = detMatch.project.id;
    confidence = Math.max(detMatch.confidence - 10, 0);
    reason = `${detMatch.reason} (AI suggested a different project — verify)`;
  }

  // AI-only picks (no address corroboration in the email text) need a higher bar.
  if (!projectId || confidence < minConfidence || (!detMatch && confidence < 60)) return { skip: true, why: 'no project match' };

  const vendorEmail = ai.vendor_email || fromEmail;
  const vendorCompany = ai.vendor_company || extractName(fromRaw);

  // Dedupe: same message already imported, or same bid reached us via
  // another mailbox / a forward.
  if (existingBids.some(b => b.gmail_message_id === msg.id)) return { skip: true, why: 'duplicate' };
  const amount = typeof ai.bid_amount === 'number' ? ai.bid_amount : null;
  const isDup = existingBids.some(b =>
    b.project_id === projectId &&
    (String(b.vendor_email || '').toLowerCase() === String(vendorEmail || '').toLowerCase() ||
      normalizeText(b.vendor_company) === normalizeText(vendorCompany)) &&
    ((b.bid_amount || null) === amount || (amount !== null && Math.abs((b.bid_amount || 0) - amount) < 0.01))
  );
  if (isDup) return { skip: true, why: 'duplicate' };

  const trade = TRADES.includes(ai.trade) ? ai.trade : 'Other';
  const vendorPhone = ai.vendor_phone || null;
  const vendorId = await upsertVendor(base44, {
    email: vendorEmail,
    company: vendorCompany,
    contactName: ai.vendor_contact_name || null,
    phone: vendorPhone,
    trade,
  });

  const paymentTerms = Array.isArray(ai.payment_terms)
    ? ai.payment_terms
        .filter(t => t && (t.label || t.amount || t.percent))
        .map(t => ({
          label: t.label || 'Payment',
          amount: typeof t.amount === 'number' ? t.amount : undefined,
          percent: typeof t.percent === 'number' ? t.percent : undefined,
          due_on: t.due_on || undefined,
          notes: t.notes || undefined,
        }))
    : [];

  const record = {
    project_id: projectId,
    vendor_id: vendorId || undefined,
    vendor_name: ai.vendor_contact_name || extractName(fromRaw),
    vendor_email: vendorEmail,
    vendor_company: vendorCompany,
    vendor_phone: vendorPhone || undefined,
    trade,
    status: 'submitted',
    bid_amount: amount ?? undefined,
    payment_terms: paymentTerms.length ? paymentTerms : undefined,
    submitted_at: receivedDate,
    source: 'gmail_import',
    gmail_message_id: msg.id,
    gmail_thread_id: message.threadId,
    gmail_link: `https://mail.google.com/mail/u/0/#all/${msg.id}`,
    email_subject: subject,
    email_from: fromRaw,
    email_received_date: receivedDate,
    ai_summary: ai.summary || '',
    ai_match_confidence: confidence,
    ai_match_reason: reason,
    attachment_urls: attachmentFileUrls,
    attachment_names: attachmentFileNames,
    quote_pdf_url: attachmentFileUrls[0] || undefined,
  };
  return { record };
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { base44 } = await verifyAdminSession(req, 'can_access_estimates', body);
    const { maxResults = 50, processLimit = 3, minConfidence = 40, extraQuery = '' } = body;

    const accessToken = await getGmailAccessToken(base44);
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: authHeader });
    const profile = await profileRes.json();
    const gmailEmail = profile.emailAddress;
    if (String(gmailEmail || '').toLowerCase() !== EXPECTED_GMAIL_EMAIL) {
      throw new Error(`Connected Gmail must be ${EXPECTED_GMAIL_EMAIL}. Current token is for ${gmailEmail || 'unknown account'}.`);
    }

    const query = `has:attachment (quote OR quotation OR bid OR estimate OR proposal) -in:sent ${extraQuery}`.trim();
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${Math.max(1, Math.min(Number(maxResults) || 50, 100))}`;
    const listRes = await fetch(listUrl, { headers: authHeader });
    const listData = await listRes.json();

    const skipState = await loadSkipState(base44);

    if (!listData.messages || listData.messages.length === 0) {
      return Response.json({ scanned: 0, imported: 0, skipped: 0, remaining: 0, gmailEmail });
    }

    const existingBids = await base44.asServiceRole.entities.SubBid.list('-created_date', 500);
    const importedIds = new Set(existingBids.map(b => b.gmail_message_id).filter(Boolean));

    const projects = (await base44.asServiceRole.entities.ContractorProject.filter({ status: 'in_progress' }))
      .slice(0, 200);
    const matchers = buildProjectMatchers(projects);

    const allNewMessages = listData.messages.filter(m => !importedIds.has(m.id) && !skipState.ids.has(m.id));
    const safeProcessLimit = Math.max(1, Math.min(Number(processLimit) || 3, 6));
    const newMessages = allNewMessages.slice(0, safeProcessLimit);

    const startedAt = Date.now();
    // Stay well under the platform gateway timeout — better to return early
    // with remaining > 0 (the UI runs chained rounds) than to 504.
    const MAX_RUNTIME_MS = 20000;
    let imported = 0;
    let skipped = 0;
    let processed = 0;
    const results = [];
    const ctx = { existingBids, projects, matchers, minConfidence: Number(minConfidence) || 40 };

    for (const msg of newMessages) {
      if (Date.now() - startedAt > MAX_RUNTIME_MS) break;
      const outcome = await processMessage(base44, authHeader, msg, ctx);
      processed++;
      if (!outcome) continue; // transient failure — retry on a future scan
      if (outcome.skip) {
        skipState.ids.add(msg.id);
        skipped++;
        continue;
      }
      const created = await base44.asServiceRole.entities.SubBid.create(outcome.record);
      existingBids.push(created); // dedupe within this run too
      imported++;
      results.push({
        subject: outcome.record.email_subject,
        vendor: outcome.record.vendor_company,
        trade: outcome.record.trade,
        amount: outcome.record.bid_amount ?? null,
        confidence: outcome.record.ai_match_confidence,
      });
    }

    await saveSkipState(base44, skipState);

    return Response.json({
      scanned: processed,
      imported,
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
