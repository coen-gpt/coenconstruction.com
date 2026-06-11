/**
 * scanGmailVoicemails — scans the connected info@coenconstruction.com Gmail
 * inbox for Google Voice voicemail notifications, transcribes/summarizes them
 * with AI, suggests action items, auto-matches the caller to an active
 * ContractorProject (phone number first, then name/address in the transcript),
 * and creates a ClientCommunication inbound item (channel=phone, urgency=high)
 * so the voicemail surfaces in the Command Center queue, the Comms Hub, and
 * the matched project's comms log. Notifies the project's assigned PM plus all
 * active project managers / assistant project managers.
 * Dedupes via source_ref = "gmail-voicemail:" + gmail_message_id and a
 * SyncState skip-list (key "gmail_voicemail_skips") for non-voicemail noise.
 */
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

// --- Gmail auth (same pattern as scanGmailInvoices) ---

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

// --- Skip-list (messages that are not voicemails, e.g. GV text notifications) ---

async function loadSkipState(base44) {
  try {
    const rows = await base44.asServiceRole.entities.SyncState.filter({ key: 'gmail_voicemail_skips' });
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
    key: 'gmail_voicemail_skips',
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

// --- Message parsing helpers (same patterns as scanGmailInvoices) ---

function getHeader(headers, name) {
  const h = headers?.find(h => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

function decodeBase64(data) {
  try { return atob(data.replace(/-/g, '+').replace(/_/g, '/')); } catch { return ''; }
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
  const text = plain.trim() || stripHtml(html);
  return text.slice(0, 3000);
}

// --- Caller phone normalization + matching ---

function normalizePhone(s) {
  const digits = String(s || '').replace(/\D+/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10); // compare on the last 10 digits (drop country code)
}

function extractPhone(text) {
  const m = String(text || '').match(/\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  return m ? normalizePhone(m[0]) : null;
}

function formatPhone(digits) {
  if (!digits || digits.length !== 10) return digits || '';
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// --- Project text matching (PO/name/address → ContractorProject) ---
// NOTE: duplicated from matchInvoiceProjects/entry.ts — keep in sync.

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
      const firstName = nameWords.length > 1 ? nameWords[0] : null;
      return { project: p, streetNum, streetWords, lastName, firstName, phone: normalizePhone(p.client_phone) };
    })
    .filter(x => x.phone || (x.streetNum && x.streetWords.length > 0) || x.lastName);
}

const COMMON_WORD_SURNAMES = new Set([
  'wood', 'woods', 'stone', 'stones', 'hall', 'park', 'parks', 'brown',
  'green', 'greene', 'white', 'black', 'gray', 'grey', 'field', 'fields',
  'hill', 'hills', 'lake', 'lakes', 'rivers', 'brooks', 'snow', 'frost',
  'gold', 'silver', 'mason', 'carpenter', 'painter', 'glass', 'steel',
  'steele', 'wells', 'banks', 'bridge', 'bridges', 'street', 'lane',
  'rose', 'berry', 'marsh', 'bush', 'forest', 'forrest', 'knight', 'day',
  'summer', 'winter', 'rain', 'sand', 'sands', 'clay', 'flint', 'stack',
  'walls', 'post', 'gates', 'nail', 'board', 'beam', 'deck'
]);

// Words from the company's own name ("Coen", "Construction") appear in every
// Google Voice notification email and in many voicemails — they must never
// count as match evidence, or a project whose client shares the company
// surname (e.g. the owner's own project) swallows every voicemail.
const COMPANY_NAME_WORDS = new Set(['coen', 'construction']);

// Caller-ID phone match is near-certain; a self-stated name or address is
// strong; a bare surname is moderate (weak for material words). Surnames are
// matched ONLY against the AI-extracted caller/mentioned names — the raw email
// body and transcript contain boilerplate (account name, greetings, footer)
// that false-matches.
function matchVoicemailProject(matchers, { callerPhone, statedText, transcript }) {
  const stated = ' ' + normalizeText(statedText) + ' ';
  const broad = ' ' + normalizeText(transcript) + ' ' + stated;
  let best = null;
  const consider = (project, reason, confidence) => {
    if (!best || confidence > best.confidence) best = { project, reason, confidence };
  };
  for (const m of matchers) {
    if (callerPhone && m.phone && m.phone === callerPhone) {
      consider(m.project, `Caller ID ${formatPhone(callerPhone)} matches ${m.project.client_name}'s phone`, 95);
    }
    if (m.streetNum && m.streetWords.length > 0) {
      if (m.streetWords.some(w => broad.includes(` ${m.streetNum} ${w} `))) {
        consider(m.project, `Address "${m.streetNum} ${m.streetWords[0]}…" mentioned in voicemail → ${m.project.client_name}`, 80);
      }
    }
    if (m.lastName && !COMPANY_NAME_WORDS.has(m.lastName) && stated.includes(` ${m.lastName} `)) {
      const fullName = m.firstName && stated.includes(` ${m.firstName} ${m.lastName} `);
      const isCommonWord = COMMON_WORD_SURNAMES.has(m.lastName);
      const confidence = fullName ? 85 : isCommonWord ? 30 : 50;
      consider(
        m.project,
        fullName
          ? `Caller mentioned "${m.project.client_name}"`
          : `Caller mentioned "${m.lastName}" → ${m.project.client_name}'s project${isCommonWord ? ' (common word — verify)' : ''}`,
        confidence
      );
    }
  }
  return best;
}

// --- Notifications (Resend first, Core.SendEmail fallback, never throws) ---

async function sendEmailSafe(base44, { to, subject, html, text }) {
  try {
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Coen Construction <noreply@coenconstruction.com>',
          to, subject, html,
        }),
      });
      if (res.ok) return true;
    }
  } catch { /* fall through */ }
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: text });
    return true;
  } catch { return false; }
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function notifyManagers(base44, { project, comm, callerLabel }) {
  const recipients = new Set();
  try {
    const admins = await base44.asServiceRole.entities.AdminUser.list();
    for (const u of admins) {
      if (u.active === false || !u.email) continue;
      if (u.role === 'project_manager' || u.role === 'assistant_project_manager') {
        recipients.add(u.email.toLowerCase());
      }
    }
  } catch { /* best-effort */ }
  if (project?.assigned_to) recipients.add(String(project.assigned_to).toLowerCase());
  if (recipients.size === 0) return 0;

  const projectLine = project
    ? `${project.client_name || 'Unknown client'}${project.project_type ? ` — ${project.project_type}` : ''} (match confidence ${comm.project_match_confidence}%)`
    : 'No project match — needs review';
  const actions = (comm.suggested_actions || []);
  const subject = `📞 New voicemail from ${callerLabel}${project?.client_name ? ` — ${project.client_name}` : ''}`;
  const html = `
    <p><strong>New voicemail</strong> received on the company line (via ${EXPECTED_GMAIL_EMAIL}).</p>
    <p><strong>Caller:</strong> ${escapeHtml(callerLabel)}<br/>
    <strong>Received:</strong> ${escapeHtml(comm.first_contact_at || '')}<br/>
    <strong>Project:</strong> ${escapeHtml(projectLine)}</p>
    ${comm.voicemail_transcript ? `<p><strong>Transcript:</strong></p><blockquote style="border-left:3px solid #ccc;margin:0;padding:4px 12px;color:#444;">${escapeHtml(comm.voicemail_transcript)}</blockquote>` : ''}
    ${actions.length ? `<p><strong>Suggested action items:</strong></p><ul>${actions.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>` : ''}
    <p>Open the Comms Hub in the Command Center to respond and log the contact.</p>`;
  const text = [
    `New voicemail from ${callerLabel}`,
    `Project: ${projectLine}`,
    comm.voicemail_transcript ? `Transcript: ${comm.voicemail_transcript}` : null,
    actions.length ? `Suggested actions:\n- ${actions.join('\n- ')}` : null,
    'Open the Comms Hub in the Command Center to respond.',
  ].filter(Boolean).join('\n\n');

  let sent = 0;
  for (const to of recipients) {
    if (await sendEmailSafe(base44, { to, subject, html, text })) sent++;
  }
  return sent;
}

// --- Per-message processing ---
// Returns { comm, project } when an inbound item should be created,
// { skip: true } when the message is permanently uninteresting, or null on
// transient fetch failure.
async function processMessage(base44, authHeader, msg, projectMatchers) {
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

  const isGoogleVoice = /voice-noreply@google\.com/i.test(fromRaw) || /@txt\.voice\.google\.com/i.test(fromRaw);
  const isVoicemail = /new voicemail from/i.test(subject);
  if (!isGoogleVoice || !isVoicemail) return { skip: true };

  // Subject format: "New voicemail from (555) 123-4567 at 2:13 PM" or
  // "New voicemail from John Smith at 2:13 PM" when the caller is a contact.
  const subjectCaller = (subject.match(/new voicemail from\s+(.+?)(?:\s+at\s+[\d:]+\s*[ap]m)?$/i)?.[1] || '').trim();
  const bodyText = extractBodyText(message.payload);
  const callerPhone = extractPhone(subjectCaller) || extractPhone(bodyText);

  let aiData = {};
  try {
    aiData = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `This is a Google Voice voicemail notification email received by a residential construction company (Coen Construction). Clean up the machine transcript and extract what the team needs. Return JSON only.

Email Subject: ${subject}
From: ${fromRaw}
Body (contains Google's machine transcript):
${bodyText.slice(0, 2500)}

Return:
{
  "caller_name": string or null (caller's name from caller ID or as self-stated in the message),
  "caller_phone": string or null (callback number — caller ID or a number stated in the message),
  "transcript": string or null (the voicemail transcript, lightly cleaned for readability; keep the caller's words, fix obvious transcription garbage; null if no transcript present),
  "summary": string (1-2 sentence summary of why they called),
  "suggested_actions": array of 0-4 short imperative action items the team should take (e.g. "Call back about deck permit timeline"); only include genuinely actionable items,
  "mentioned_name": string or null (any customer/homeowner name mentioned in the message),
  "mentioned_address": string or null (any street address or job-site mentioned in the message)
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          caller_name: { type: 'string' },
          caller_phone: { type: 'string' },
          transcript: { type: 'string' },
          summary: { type: 'string' },
          suggested_actions: { type: 'array', items: { type: 'string' } },
          mentioned_name: { type: 'string' },
          mentioned_address: { type: 'string' },
        },
      },
    });
  } catch { /* fall back to raw subject/body below */ }

  const phone = normalizePhone(aiData?.caller_phone) || callerPhone;
  const callerName = aiData?.caller_name || (extractPhone(subjectCaller) ? null : subjectCaller) || null;
  const callerLabel = [callerName, phone ? formatPhone(phone) : null].filter(Boolean).join(' ') || 'Unknown caller';
  const transcript = (aiData?.transcript || '').trim() || null;
  const summary = (aiData?.summary || '').trim() || (transcript ? transcript.slice(0, 200) : 'Voicemail received — no transcript available.');
  const suggestedActions = Array.isArray(aiData?.suggested_actions)
    ? aiData.suggested_actions.filter(a => typeof a === 'string' && a.trim()).slice(0, 4)
    : [];

  const projectMatch = matchVoicemailProject(projectMatchers, {
    callerPhone: phone,
    statedText: `${callerName || ''} ${aiData?.mentioned_name || ''} ${aiData?.mentioned_address || ''}`,
    transcript: `${transcript || ''} ${bodyText.slice(0, 1500)}`,
  });
  const project = projectMatch?.project || null;

  const comm = {
    kind: 'inbound',
    direction: 'inbound',
    channel: 'phone',
    status: 'open',
    urgency: 'high',
    title: `Voicemail from ${callerLabel}`,
    prompt_detail: summary,
    voicemail_transcript: transcript,
    caller_phone: phone ? formatPhone(phone) : null,
    suggested_actions: suggestedActions,
    first_contact_at: receivedDate,
    due_at: receivedDate,
    triggered_at: new Date().toISOString(),
    source_ref: `gmail-voicemail:${msg.id}`,
    ...(project ? {
      project_id: project.id,
      assigned_to: project.assigned_to || null,
      project_match_reason: projectMatch.reason,
      project_match_confidence: projectMatch.confidence,
      project_match_status: 'suggested',
    } : {}),
  };
  return { comm, project, callerLabel };
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { base44 } = await verifyAdminSession(req, 'can_access_estimates', body);
    const { maxResults = 50, processLimit = 6, notify = true } = body;

    const accessToken = await getGmailAccessToken(base44);
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: authHeader });
    const profile = await profileRes.json();
    const gmailEmail = profile.emailAddress;
    if (String(gmailEmail || '').toLowerCase() !== EXPECTED_GMAIL_EMAIL) {
      throw new Error(`Connected Gmail must be ${EXPECTED_GMAIL_EMAIL}. Current token is for ${gmailEmail || 'unknown account'}.`);
    }

    const query = `from:(voice-noreply@google.com) subject:voicemail -in:sent`;
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${Math.max(1, Math.min(Number(maxResults) || 50, 100))}`;
    const listRes = await fetch(listUrl, { headers: authHeader });
    const listData = await listRes.json();

    const skipState = await loadSkipState(base44);

    if (!listData.messages || listData.messages.length === 0) {
      return Response.json({ scanned: 0, created: 0, remaining: 0, gmailEmail });
    }

    // Dedupe against already-created voicemail comms
    const existingInbound = await base44.asServiceRole.entities.ClientCommunication.filter({ kind: 'inbound' });
    const existingRefs = new Set(existingInbound.map(c => c.source_ref).filter(Boolean));

    let projectMatchers = [];
    try {
      const projects = await base44.asServiceRole.entities.ContractorProject.list('-created_date', 300);
      projectMatchers = buildProjectMatchers(projects);
    } catch { /* matching is best-effort */ }

    const allNewMessages = listData.messages.filter(m =>
      !skipState.ids.has(m.id) && !existingRefs.has(`gmail-voicemail:${m.id}`));
    const safeProcessLimit = Math.max(1, Math.min(Number(processLimit) || 6, 10));
    const newMessages = allNewMessages.slice(0, safeProcessLimit);

    const startedAt = Date.now();
    const MAX_RUNTIME_MS = 45000;
    let processed = 0;
    let created = 0;
    let skipped = 0;
    let notified = 0;
    const results = [];

    for (const msg of newMessages) {
      if (Date.now() - startedAt > MAX_RUNTIME_MS) break;
      const outcome = await processMessage(base44, authHeader, msg, projectMatchers);
      processed++;
      if (!outcome) continue; // transient failure — retry on a future sync
      if (outcome.skip) {
        skipState.ids.add(msg.id);
        skipped++;
        continue;
      }
      await base44.asServiceRole.entities.ClientCommunication.create(outcome.comm);
      skipState.ids.add(msg.id); // never re-fetch this message
      created++;
      if (notify !== false) {
        notified += await notifyManagers(base44, {
          project: outcome.project,
          comm: outcome.comm,
          callerLabel: outcome.callerLabel,
        });
      }
      results.push({
        caller: outcome.callerLabel,
        project: outcome.project?.client_name || null,
        confidence: outcome.comm.project_match_confidence || null,
      });
    }

    await saveSkipState(base44, skipState);

    return Response.json({
      scanned: processed,
      created,
      skipped,
      notified,
      remaining: Math.max(0, allNewMessages.length - processed),
      gmailEmail,
      lastSyncedAt: new Date().toISOString(),
      results,
    });

  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});
