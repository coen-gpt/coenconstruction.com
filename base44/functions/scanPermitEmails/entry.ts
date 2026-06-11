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

// Statuses for which permit activity is still relevant.
const PERMIT_PROJECT_STATUSES = new Set([
  'walkthrough', 'draft', 'sent', 'pending_review', 'approved', 'modify',
  'in_progress', 'on_hold', 'imported'
]);

const PERMIT_KEYWORDS = [
  'permit', 'zoning', 'zba', 'variance', 'building inspector', 'inspection',
  'certificate of occupancy', 'isd '
];

function hasPermitKeyword(text) {
  const lower = ` ${(text || '').toLowerCase()} `;
  return PERMIT_KEYWORDS.some(kw => lower.includes(kw));
}

// Senders that never carry actionable permit data — saves LLM calls.
// Google Voice transcripts are handled by the voicemail intake instead.
const NOISE_RULES = [
  ({ fromEmail }) => /voice-noreply@google\.com$/i.test(fromEmail) || /@txt\.voice\.google\.com$/i.test(fromEmail),
  ({ fromEmail }) => /@(?:[\w.-]+\.)?(planhub|constructconnect|buildertrend|billtrust|homedepot|lowes|menards)\.com$/i.test(fromEmail),
  ({ subject }) => /new (text message|voicemail) from/i.test(subject),
];

function isNoise(fromEmail, subject) {
  return NOISE_RULES.some(rule => rule({ fromEmail: fromEmail || '', subject: subject || '' }));
}

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const STREET_SUFFIXES = new Set([
  'st', 'street', 'ave', 'avenue', 'rd', 'road', 'ln', 'lane', 'dr', 'drive',
  'ct', 'court', 'cir', 'circle', 'blvd', 'boulevard', 'way', 'pl', 'place',
  'ter', 'terrace', 'trl', 'trail', 'hwy', 'highway', 'n', 's', 'e', 'w',
  'north', 'south', 'east', 'west'
]);

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
      return { project: m.project, reason: `Address "${m.streetNum} ${m.streetWords[0]}…" found in email`, confidence: 90 };
    }
  }
  return null;
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

async function loadSkipState(base44) {
  try {
    const rows = await base44.asServiceRole.entities.SyncState.filter({ key: 'gmail_permit_skips' });
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
    key: 'gmail_permit_skips',
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
  return text.slice(0, 3000);
}

// Merge an extracted permit into the project's permits array: update the
// entry with the same permit number (status changes arrive as new emails),
// otherwise append a new entry.
function mergePermit(existing, found) {
  const permits = Array.isArray(existing) ? [...existing] : [];
  const num = normalizeText(found.permit_number);
  const idx = num
    ? permits.findIndex(p => normalizeText(p.permit_number) === num)
    : -1;
  if (idx >= 0) {
    const cur = permits[idx];
    permits[idx] = {
      ...cur,
      permit_type: cur.permit_type || found.permit_type,
      municipality: cur.municipality || found.municipality,
      status: found.status || cur.status,
      applied_date: cur.applied_date || found.applied_date,
      issued_date: cur.issued_date || found.issued_date,
      cost: cur.cost ?? found.cost,
      source_link: found.source_link || cur.source_link,
      notes: found.notes && !String(cur.notes || '').includes(found.notes)
        ? `${cur.notes ? cur.notes + '\n' : ''}${found.notes}`
        : cur.notes,
    };
    return { permits, action: 'updated' };
  }
  permits.push({ id: crypto.randomUUID(), ...found });
  return { permits, action: 'added' };
}

// Returns { matched } when permit info was written to a project,
// { skip: true } when permanently uninteresting, or null on transient failure.
async function processMessage(base44, authHeader, msg, ctx) {
  const { projects, matchers } = ctx;

  const msgRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
    { headers: authHeader }
  );
  if (!msgRes.ok) return null;
  const message = await msgRes.json();

  const headers = message.payload?.headers || [];
  const subject = getHeader(headers, 'Subject');
  const fromRaw = getHeader(headers, 'From');
  const fromEmail = extractEmailAddress(fromRaw);
  if (isNoise(fromEmail, subject)) return { skip: true };

  const bodyText = extractBodyText(message.payload);
  if (!hasPermitKeyword(`${subject} ${bodyText}`)) return { skip: true };

  const projectList = projects
    .map(p => `${p.id} | ${p.client_name || '?'} | ${p.client_address || '?'}`)
    .join('\n');

  let ai = null;
  try {
    ai = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are reviewing an email received by Coen Construction (a general contractor in MA) to decide whether it contains BUILDING PERMIT information for one of their projects — permit numbers (e.g. ALT1741248, SF1843686, R-25-0430, App #63961), permit status changes, zoning/ZBA decisions, permit fees, or municipal inspection scheduling.

NOT permit info: marketing, sub/vendor quotes, customer chatter, Coen's own estimates, generic city newsletters.

PROJECT MATCHING RULES:
- Only set project_id when the email references that job's STREET ADDRESS or a permit number already tied to it.
- NEVER match because the word "Coen" appears — that is the contractor's own company/staff name. The client "Dean Coen" matches ONLY if 15 Martin Street is referenced.
- If the referenced address is NOT in the project list, set project_id to null. Do not guess.

Email Subject: ${subject}
From: ${fromRaw}
Body (truncated): ${bodyText.slice(0, 2000)}

Projects (id | client | address):
${projectList}

Return JSON only:
{
  "is_permit_info": boolean,
  "permit_number": string or null (exactly as written, e.g. "ALT1741248", "R-25-0430"),
  "permit_type": string or null (e.g. "Long Form Building", "Short Form Building", "Electrical", "Plumbing"),
  "municipality": string or null (e.g. "City of Boston (ISD)", "Town of Mansfield"),
  "status": string or null (applied | in_review | info_requested | issued | denied | closed),
  "applied_date": "YYYY-MM-DD" or null,
  "issued_date": "YYYY-MM-DD" or null,
  "cost": number or null (permit fee if stated),
  "summary": string (1-2 sentences of what happened),
  "project_id": string or null (id from the list, only if the email clearly names that job's address),
  "match_confidence": number 0-100,
  "match_reason": string
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          is_permit_info: { type: 'boolean' },
          permit_number: { type: 'string' },
          permit_type: { type: 'string' },
          municipality: { type: 'string' },
          status: { type: 'string' },
          applied_date: { type: 'string' },
          issued_date: { type: 'string' },
          cost: { type: 'number' },
          summary: { type: 'string' },
          project_id: { type: 'string' },
          match_confidence: { type: 'number' },
          match_reason: { type: 'string' }
        }
      }
    });
  } catch (_) {
    return null; // transient LLM failure — retry on a future scan
  }

  if (!ai?.is_permit_info) return { skip: true };

  // Cross-check the LLM's pick against the deterministic address matcher.
  const detMatch = matchProjectDeterministic(matchers, `${subject} ${bodyText.slice(0, 2000)}`);
  const llmProject = ai.project_id ? projects.find(p => p.id === ai.project_id) : null;
  let project = null;
  if (llmProject && detMatch && detMatch.project.id === llmProject.id) project = llmProject;
  else if (detMatch && !llmProject) project = detMatch.project;
  else if (llmProject && (Number(ai.match_confidence) || 0) >= 70 && !detMatch) project = llmProject;
  else if (llmProject && detMatch) project = detMatch.project; // address evidence wins

  if (!project) return { skip: true };

  const dateRaw = getHeader(headers, 'Date');
  const receivedDate = (() => {
    try { const d = new Date(dateRaw); if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10); } catch { /* noop */ }
    return new Date(parseInt(message.internalDate)).toISOString().slice(0, 10);
  })();

  const found = {
    permit_number: ai.permit_number || '',
    permit_type: ai.permit_type || '',
    municipality: ai.municipality || '',
    status: ai.status || '',
    applied_date: ai.applied_date || '',
    issued_date: ai.issued_date || '',
    cost: typeof ai.cost === 'number' ? ai.cost : undefined,
    source_link: `https://mail.google.com/mail/u/0/#all/${msg.id}`,
    notes: `${receivedDate}: ${ai.summary || subject}`,
  };

  // Re-read the project for the freshest permits array before merging.
  const fresh = await base44.asServiceRole.entities.ContractorProject.filter({ id: project.id });
  const current = fresh[0];
  if (!current) return { skip: true };
  const { permits, action } = mergePermit(current.permits, found);
  await base44.asServiceRole.entities.ContractorProject.update(project.id, { permits });

  return {
    matched: {
      project: current.client_name,
      address: current.client_address,
      permit_number: found.permit_number || '(no number)',
      status: found.status,
      action,
    }
  };
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { base44 } = await verifyAdminSession(req, 'can_access_estimates', body);
    const { maxResults = 50, processLimit = 3 } = body;

    const accessToken = await getGmailAccessToken(base44);
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: authHeader });
    const profile = await profileRes.json();
    const gmailEmail = profile.emailAddress;
    if (String(gmailEmail || '').toLowerCase() !== EXPECTED_GMAIL_EMAIL) {
      throw new Error(`Connected Gmail must be ${EXPECTED_GMAIL_EMAIL}. Current token is for ${gmailEmail || 'unknown account'}.`);
    }

    const query = `(permit OR zoning OR ZBA OR "building inspector" OR "certificate of occupancy") -in:sent`;
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${Math.max(1, Math.min(Number(maxResults) || 50, 100))}`;
    const listRes = await fetch(listUrl, { headers: authHeader });
    const listData = await listRes.json();

    const skipState = await loadSkipState(base44);

    if (!listData.messages || listData.messages.length === 0) {
      return Response.json({ scanned: 0, matched: 0, skipped: 0, remaining: 0, gmailEmail });
    }

    const projects = (await base44.asServiceRole.entities.ContractorProject.list('-created_date', 200))
      .filter(p => !p.status || PERMIT_PROJECT_STATUSES.has(p.status));
    const matchers = buildProjectMatchers(projects);

    const allNewMessages = listData.messages.filter(m => !skipState.ids.has(m.id));
    const safeProcessLimit = Math.max(1, Math.min(Number(processLimit) || 3, 6));
    const newMessages = allNewMessages.slice(0, safeProcessLimit);

    const startedAt = Date.now();
    // Stay well under the platform gateway timeout — better to return early
    // with remaining > 0 (the UI runs chained rounds) than to 504.
    const MAX_RUNTIME_MS = 20000;
    let matched = 0;
    let skipped = 0;
    let processed = 0;
    const results = [];
    const ctx = { projects, matchers };

    for (const msg of newMessages) {
      if (Date.now() - startedAt > MAX_RUNTIME_MS) break;
      const outcome = await processMessage(base44, authHeader, msg, ctx);
      processed++;
      if (!outcome) continue; // transient failure — retry on a future scan
      skipState.ids.add(msg.id); // processed (matched or not) — never re-bill the LLM for it
      if (outcome.skip) { skipped++; continue; }
      matched++;
      results.push(outcome.matched);
    }

    await saveSkipState(base44, skipState);

    return Response.json({
      scanned: processed,
      matched,
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
