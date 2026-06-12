import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Admin email-campaign engine for the Jobber past-quotes re-engagement flow.
 *
 * Actions (POST { action, ... } — admin session required):
 *   create_campaign   { name, hero_image_url?, custom_note? }
 *   add_recipients    { campaign_id, recipients: [...], dedupe_window_days?, allow_recontact? }
 *                     chunked from the frontend; auto-skips anyone already emailed
 *                     (or queued) in ANY prior campaign — matched by email, phone,
 *                     or household (street+zip) — plus active clients and open
 *                     leads. dedupe_window_days limits the look-back (0 = all
 *                     time); allow_recontact disables only the prior-campaign part.
 *                     Pass precleared:true (wizard fast path) when the audience
 *                     already went through check_audience — chunks then skip the
 *                     full suppression scan and only do idempotency/unsub checks.
 *   check_audience    { recipients: [...], dedupe_window_days?, allow_recontact? }
 *                     dry-run of the same suppression — returns a breakdown +
 *                     ok_emails (cleared list), writes nothing (wizard preview)
 *   create_retarget_campaign { source_campaign_id, name?, campaign_id? (resume) }
 *                     clones a campaign's warm audience (opened/clicked, never
 *                     booked) into a fresh draft; deadline-bounded, caller loops
 *   list_campaigns    {}
 *   get_campaign      { campaign_id }
 *   list_recipients   { campaign_id, limit? }
 *   preview           { campaign_id, recipient_id?, sample?, variant? }
 *   send              { campaign_id, limit? }               one time-budgeted batch; frontend loops
 *   nudge             { campaign_id, recipient_ids: [...] } reminder variant
 *   campaign_stats    { campaign_id }                       engagement aggregate for dashboards
 *   update_settings   { campaign_id, wave_size?, drip_enabled?, subject_a?, subject_b? }
 *                     wave_size 0 = unlimited
 *   delete_campaign   { campaign_id }
 *
 * Engagement tracking lives in the public campaignTrack function; this one
 * embeds the tracking pixel + tokenized links when rendering each email.
 * Bounce/complaint suppression arrives via the resendWebhook function, which
 * flags recipients unsubscribed so the suppression sets here pick them up.
 */

const SITE_URL = 'https://coenconstruction.com';
const TRACK_URL = `${SITE_URL}/api/functions/campaignTrack`;
const DEFAULT_HERO = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80';
const SEND_BATCH = 60; // recipients fetched per request; the deadline below decides how many actually go out
const SEND_CONCURRENCY = 5; // parallel Resend calls — retry-on-429 absorbs rate-limit pushback
const SEND_DEADLINE_MS = 20_000; // return before the platform kills the request; the frontend loop resumes
const SCAN_PAGE = 1000; // page size for paged suppression scans

// ── Admin session (inline — Base44 functions are self-contained) ──

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

function b64urlEncode(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
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

// ── Campaign tracking tokens (same HMAC scheme as magic links, "campaign:" context) ──

function getTrackingSecret() {
  return Deno.env.get('MAGIC_LINK_SECRET') || Deno.env.get('ADMIN_SESSION_SECRET');
}

async function signTrackingToken(recipientId, campaignId) {
  const secret = getTrackingSecret();
  const payload = b64urlEncode(new TextEncoder().encode(`${recipientId}|${campaignId}`));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`campaign:${payload}`));
  return `${payload}.${b64urlEncode(new Uint8Array(signature))}`;
}

// ── Segmentation: classify a customer by their quote line items ──

const SEGMENTS = [
  {
    key: 'addition',
    match: /addition|adu\b|dormer|suite|shell/i,
    projectType: 'Home Addition',
    hook: 'Adding space is the single biggest upgrade you can make to how your home lives — and we handle everything from foundation to finish under one roof.',
  },
  {
    key: 'kitchen',
    match: /kitchen/i,
    projectType: 'Kitchen Remodel',
    hook: 'The kitchen is the heart of the home, and a well-built remodel is one of the strongest returns on investment in the Greater Boston market.',
  },
  {
    key: 'bath',
    match: /bath/i,
    projectType: 'Bathroom Remodel',
    hook: 'A bathroom done right — proper waterproofing, clean tile work, quality fixtures — pays you back every single morning.',
  },
  {
    key: 'roofing',
    match: /roof/i,
    projectType: 'Roofing',
    hook: 'Your roof protects everything underneath it, and summer is the ideal window for roofing work in New England — dry days, fast turnarounds.',
  },
  {
    key: 'deck',
    match: /deck|porch|pergola|patio|paver|walkway|stair|railing/i,
    projectType: 'Deck / Porch / Pergola',
    hook: "It's prime outdoor season — the perfect time to get your outdoor space ready for cookouts, family time, and warm summer evenings.",
  },
  {
    key: 'siding',
    match: /siding|gutter|trim|fascia|soffit|exterior/i,
    projectType: 'Siding',
    hook: 'Fresh siding transforms curb appeal — and protects your home before the next New England winter rolls in.',
  },
  {
    key: 'renovation',
    match: /renovation|remodel|basement|flooring|painting|door|window/i,
    projectType: 'Full Home Renovation',
    hook: "A thoughtful renovation makes the home you have feel like the home you've always wanted — without the cost of moving.",
  },
  {
    key: 'repairs',
    match: /repair|damage|leak|rot|refinish/i,
    projectType: 'General Inquiry',
    hook: 'Small issues left alone have a way of becoming big projects — we can knock yours out quickly and do it properly.',
  },
];

const GENERAL_SEGMENT = {
  key: 'general',
  projectType: 'General Inquiry',
  hook: "Whatever's on your home's to-do list, we'd love to help you knock it out — designed, built, and warrantied by one team.",
};

function classifySegment(lineItemNames) {
  const text = (lineItemNames || []).join(' ');
  for (const seg of SEGMENTS) {
    if (seg.match.test(text)) return seg;
  }
  return GENERAL_SEGMENT;
}

function segmentByKey(key) {
  return SEGMENTS.find(s => s.key === key) || GENERAL_SEGMENT;
}

// ── Email rendering ──

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function itemsPhrase(names) {
  const cleaned = (names || []).map(n => String(n).trim()).filter(Boolean);
  if (!cleaned.length) return 'home improvement';
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned[0]}, ${cleaned[1]}, and ${cleaned.length - 2} more item${cleaned.length > 3 ? 's' : ''}`;
}

function shortItem(names) {
  const first = String((names || [])[0] || 'home improvement').trim();
  return first.length > 42 ? `${first.slice(0, 39)}…` : first;
}

// Framing bucket: how we open the email given the recipient's history.
// "quote" recipients (Jobber) got a real quote; "inquiry" recipients
// (Angi / generic lead lists) only asked about a project — never claim we
// quoted them.
function framingBucket(recipient) {
  const status = String(recipient.quote_status || '').toLowerCase();
  if (recipient.origin === 'inquiry') {
    if (/won/.test(status) && !/did not win|didn't win/.test(status)) return 'converted';
    if (/did not win|didn't win|lost/.test(status)) return 'inquiry_lost';
    return 'inquiry_open';
  }
  if (status === 'approved') return 'approved';
  if (status === 'converted') return 'converted';
  if (status === 'awaiting response' || status === 'changes requested') return 'quote_open';
  return 'quote_archived';
}

function statusIntro(recipient, phrase) {
  const where = recipient.city ? ` in ${escapeHtml(recipient.city)}` : '';
  const item = `<strong>${escapeHtml(phrase)}</strong>`;
  switch (framingBucket(recipient)) {
    case 'approved':
      return `Great news — your approved quote for ${item}${where} is ready to go. Let's get your project on the schedule before the calendar fills up.`;
    case 'converted':
      return `Thank you again for trusting us with your ${item}${where} — it meant a lot to have you as a client. A lot is new at Coen Construction, and if there's a next project on your list, we'd love to be your first call.`;
    case 'quote_open':
      return `We put together a detailed quote for ${item}${where}, and it's still ready whenever you are. No pressure — but if questions came up or the scope changed, we're happy to walk through it together.`;
    case 'inquiry_open':
      return `You reached out to us a while back about a ${item}${where}, and we didn't want to leave you hanging. Whether you're comparing contractors or still gathering ideas, we'll give you straight answers, real options, and a clear price.`;
    case 'inquiry_lost':
      return `We connected a while back about your ${item}${where}, but the timing didn't work out. Projects have a way of coming back around — if it's still on your list, we'd love a fresh shot at earning your business.`;
    default: // quote_archived
      return `A while back we quoted ${item}${where} for you. Still thinking about it? Plans and budgets change — we'd be glad to take a fresh look, update the numbers, and answer anything that held you back. No obligation.`;
  }
}

function subjectFor(recipient, variant) {
  const first = recipient.first_name || 'there';
  const item = shortItem(recipient.line_item_names);
  if (variant === 'nudge') return `Quick follow-up on your ${item} project, ${first}`;
  switch (framingBucket(recipient)) {
    case 'approved': return `Let's get your ${item} project scheduled, ${first}`;
    case 'converted': return `Thank you from Coen Construction — and a look at what's new`;
    case 'quote_open': return `Your ${item} quote is ready when you are, ${first}`;
    case 'inquiry_open': return `Still planning your ${item}, ${first}? We can help`;
    case 'inquiry_lost': return `Second chances: your ${item}, ${first}`;
    default: return `Still thinking about your ${item} project, ${first}?`;
  }
}

// ── A/B subject lines ──
// A campaign may pin one or two subject templates ({first_name} and {project}
// tokens). With both set, the recipient id deterministically picks a variant,
// so resumed/retried sends never flip someone's assignment. Neither set =
// the smart per-recipient subjects from subjectFor.

function abVariantFor(campaign, recipient) {
  const a = String(campaign?.subject_a || '').trim();
  const b = String(campaign?.subject_b || '').trim();
  if (!a && !b) return null;
  if (a && b) {
    let h = 0;
    for (const ch of String(recipient.id || '')) h = (h + ch.charCodeAt(0)) % 2;
    return h === 0 ? { key: 'a', template: a } : { key: 'b', template: b };
  }
  return { key: a ? 'a' : 'b', template: a || b };
}

function fillSubjectTemplate(template, recipient) {
  return template
    .replace(/\{first_name\}/gi, recipient.first_name || 'there')
    .replace(/\{project\}/gi, shortItem(recipient.line_item_names));
}

function renderEmail({ recipient, campaign, company, token, variant, subjectOverride }) {
  // brand_color is interpolated into style attributes — only accept hex.
  const rawBrand = String(company?.brand_color || '');
  const brandColor = /^#[0-9a-fA-F]{3,8}$/.test(rawBrand) ? rawBrand : '#E35235';
  const navy = '#1B2B3A';
  const companyName = company?.company_name || 'Coen Construction';
  const phone = company?.phone || '(617) 857-2636';
  const logoHtml = company?.logo_url
    ? `<img src="${company.logo_url}" alt="${escapeHtml(companyName)}" height="44" style="display:inline-block;height:44px;max-width:220px;width:auto;background:#ffffff;padding:8px 14px;border-radius:8px;" />`
    : `<span style="color:#fff;font-size:21px;font-weight:800;letter-spacing:-0.5px;">${escapeHtml(companyName)}</span>`;
  const hero = campaign?.hero_image_url || DEFAULT_HERO;
  const first = escapeHtml(recipient.first_name || 'there');
  const phrase = itemsPhrase(recipient.line_item_names);
  const seg = segmentByKey(recipient.segment);

  const walkthroughUrl = `${TRACK_URL}?t=${token}&a=w`;
  const siteUrl = `${TRACK_URL}?t=${token}&a=c&d=site`;
  const financingUrl = `${TRACK_URL}?t=${token}&a=c&d=financing`;
  const galleryUrl = `${TRACK_URL}?t=${token}&a=c&d=gallery`;
  const unsubUrl = `${TRACK_URL}?t=${token}&a=u`;
  const pixelUrl = `${TRACK_URL}?t=${token}&a=o`;

  const intro = statusIntro(recipient, phrase);

  const whatsNew = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #ececec;border-radius:8px;margin:28px 0;">
      <tr><td style="padding:24px 28px;">
        <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:${navy};text-transform:uppercase;letter-spacing:0.6px;">New at ${escapeHtml(companyName)}</p>
        <table cellpadding="0" cellspacing="0">
          <tr><td style="padding:5px 0;font-size:14px;color:#444;line-height:1.6;"><span style="color:${brandColor};font-weight:700;margin-right:8px;">✓</span> A live <strong>Customer Portal</strong> — track your project, photos, and schedule in real time</td></tr>
          <tr><td style="padding:5px 0;font-size:14px;color:#444;line-height:1.6;"><span style="color:${brandColor};font-weight:700;margin-right:8px;">✓</span> <strong>Online walkthrough booking</strong> — pick a time that works for you in two clicks</td></tr>
          <tr><td style="padding:5px 0;font-size:14px;color:#444;line-height:1.6;"><span style="color:${brandColor};font-weight:700;margin-right:8px;">✓</span> <strong>Virtual site walks</strong> — review your property and plans from anywhere</td></tr>
          <tr><td style="padding:5px 0;font-size:14px;color:#444;line-height:1.6;"><span style="color:${brandColor};font-weight:700;margin-right:8px;">✓</span> <a href="${financingUrl}" style="color:${brandColor};font-weight:600;text-decoration:none;">Flexible financing options</a> for projects of every size</td></tr>
        </table>
      </td></tr>
    </table>`;

  const customNote = campaign?.custom_note
    ? `<p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;font-style:italic;border-left:3px solid ${brandColor};padding-left:14px;">${escapeHtml(campaign.custom_note)}</p>`
    : '';

  const bodyCore = variant === 'nudge'
    ? `
      <p style="margin:0 0 18px;font-size:16px;color:#333;line-height:1.7;">Just circling back — we reached out recently about your <strong>${escapeHtml(phrase)}</strong> project and didn't want it to slip through the cracks.</p>
      <p style="margin:0 0 18px;font-size:16px;color:#333;line-height:1.7;">${escapeHtml(seg.hook)}</p>
      <p style="margin:0 0 28px;font-size:16px;color:#333;line-height:1.7;">If you're ready to take the next step, grab a free walkthrough time below — it takes about a minute. And if the timing isn't right, no worries at all.</p>`
    : `
      <p style="margin:0 0 18px;font-size:16px;color:#333;line-height:1.7;">${intro}</p>
      <p style="margin:0 0 18px;font-size:16px;color:#333;line-height:1.7;">${escapeHtml(seg.hook)}</p>
      ${whatsNew}
      <p style="margin:0 0 28px;font-size:16px;color:#333;line-height:1.7;">The easiest next step: a <strong>free, no-obligation walkthrough</strong>. We'll come out, look at the project together, and give you a clear, itemized picture of what it takes.</p>`;

  const secondaryCta = variant === 'nudge'
    ? ''
    : `
      <table cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
        <tr><td style="text-align:center;">
          <a href="${siteUrl}" style="display:inline-block;padding:12px 26px;color:${navy};font-size:14px;font-weight:700;text-decoration:none;border:2px solid ${navy};border-radius:8px;">Explore the New CoenConstruction.com</a>
        </td></tr>
      </table>
      <p style="margin:10px 0 0;font-size:13px;color:#888;text-align:center;">Browse our <a href="${galleryUrl}" style="color:${brandColor};text-decoration:none;font-weight:600;">recent project gallery</a> for ideas.</p>`;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <tr><td style="background:${navy};padding:22px 36px;">
          ${logoHtml}
          <br/><span style="color:rgba(255,255,255,0.5);font-size:12px;">Licensed General Contractor · Greater Boston, MA</span>
        </td></tr>

        <tr><td>
          <img src="${hero}" alt="${escapeHtml(companyName)} — recent work" width="600" style="display:block;width:100%;height:auto;"/>
        </td></tr>

        <tr><td style="padding:36px 36px 28px;">
          <p style="margin:0 0 18px;font-size:16px;color:#333;line-height:1.7;">Hi <strong>${first}</strong>,</p>
          ${bodyCore}
          ${customNote}

          <table cellpadding="0" cellspacing="0" style="margin:0 auto 18px;">
            <tr><td style="background:${brandColor};border-radius:8px;">
              <a href="${walkthroughUrl}" style="display:inline-block;padding:16px 36px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;">📅 Schedule a Free Walkthrough →</a>
            </td></tr>
          </table>
          ${secondaryCta}

          <p style="margin:28px 0 6px;font-size:15px;color:#333;">Prefer to talk it through?</p>
          <p style="margin:0 0 28px;font-size:15px;color:#333;">📞 <a href="tel:${String(phone).replace(/[^+\d]/g, '')}" style="color:${brandColor};text-decoration:none;font-weight:600;">${escapeHtml(phone)}</a></p>

          <p style="margin:0;font-size:15px;color:#333;">Looking forward to it,<br/><strong>The ${escapeHtml(companyName)} Team</strong></p>
        </td></tr>

        <tr><td style="background:${navy};padding:20px 36px;text-align:center;">
          <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.55);">${escapeHtml(companyName)} · Licensed &amp; Insured · ${escapeHtml(company?.address || 'Stoughton, MA')}</p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);">You're receiving this because you requested a quote from ${escapeHtml(companyName)}.
            <a href="${unsubUrl}" style="color:rgba(255,255,255,0.55);text-decoration:underline;">Unsubscribe</a></p>
        </td></tr>

      </table>
      <img src="${pixelUrl}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;"/>
    </td></tr>
  </table>
</body></html>`;

  return { subject: subjectOverride || subjectFor(recipient, variant), html, unsubUrl };
}

// Returns the A/B variant key recorded on the recipient ('a' | 'b' | null).
async function sendCampaignEmail({ recipient, campaign, company, variant }) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) throw new Error('RESEND_API_KEY not configured');
  const token = await signTrackingToken(recipient.id, campaign.id);
  const ab = variant === 'initial' ? abVariantFor(campaign, recipient) : null;
  const { subject, html, unsubUrl } = renderEmail({
    recipient, campaign, company, token, variant,
    subjectOverride: ab ? fillSubjectTemplate(ab.template, recipient) : undefined,
  });
  const companyName = company?.company_name || 'Coen Construction';

  const payload = JSON.stringify({
    from: `${companyName} <info@coenconstruction.com>`,
    reply_to: 'ops@coenconstruction.com',
    to: recipient.email,
    subject,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });

  // Concurrent sends can hit Resend's per-second rate limit — a 429 (or a
  // transient 5xx) is backpressure, not a dead recipient, so retry with
  // backoff instead of marking the send failed.
  let lastError = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: payload,
    });
    if (res.ok) return ab?.key || null;
    const text = (await res.text().catch(() => '')).slice(0, 300);
    lastError = `Resend ${res.status}: ${text}`;
    if (res.status !== 429 && res.status < 500) throw new Error(lastError);
    const retryAfter = Number(res.headers.get('retry-after')) || 0;
    await new Promise(r => setTimeout(r, Math.min(retryAfter * 1000 || (attempt + 1) * 750, 4000)));
  }
  throw new Error(lastError || 'Resend: retries exhausted');
}

// ── Recipient import ──

// Last-10-digits comparison so "(617) 555-1234", "617-555-1234", and
// "+16175551234" all collide. Anything under 7 digits is too ambiguous to match.
function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 7) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
}

// Household key: street line + 5-digit zip, normalized so "12 Oak St." and
// "12 Oak Street" collide. Requires BOTH a zip and a numbered street line —
// address alone is far too collision-prone across towns.
const STREET_ABBREV = {
  street: 'st', avenue: 'ave', road: 'rd', drive: 'dr', lane: 'ln', court: 'ct',
  circle: 'cir', place: 'pl', boulevard: 'blvd', terrace: 'ter', parkway: 'pkwy',
  highway: 'hwy', square: 'sq', north: 'n', south: 's', east: 'e', west: 'w',
};

function normalizeAddress(address, zip) {
  const zip5 = String(zip || '').replace(/\D/g, '').slice(0, 5);
  const street = String(address || '').toLowerCase()
    .split(/[,\n]/)[0]
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter(Boolean)
    .map(w => STREET_ABBREV[w] || w)
    .join(' ');
  if (zip5.length < 5 || !/^\d/.test(street)) return '';
  return `${zip5}|${street}`;
}

// Paged fetch so suppression scans keep working past a single call's row cap.
// The fields projection keeps pages small; maxRows is a runaway backstop.
async function fetchAll(entity, query, fields, maxRows = 50000) {
  const rows = [];
  for (let skip = 0; skip < maxRows; skip += SCAN_PAGE) {
    const page = fields
      ? await entity.filter(query, '-created_date', SCAN_PAGE, skip, fields)
      : await entity.filter(query, '-created_date', SCAN_PAGE, skip);
    rows.push(...page);
    if (page.length < SCAN_PAGE) break;
  }
  return rows;
}

// ── Cross-campaign / cross-system suppression ──
//
// Built once per import (or audience dry-run) from three live sources:
//  - CampaignRecipient (every campaign): unsubscribes incl. webhook bounces
//    (always suppress), rows already in the target campaign (idempotent chunk
//    retries), and prior contacts — pending counts as queued and always
//    suppresses; sent suppresses inside the cooldown window; failed/skipped
//    never received anything so they stay reachable.
//  - Lead: open pipeline — already being worked, don't cold-pitch them.
//  - ContractorProject: live jobs — never re-pitch an active client.

const ACTIVE_PROJECT_STATUSES = ['walkthrough', 'draft', 'sent', 'pending_review', 'approved', 'modify', 'in_progress', 'on_hold'];
const OPEN_LEAD_STATUSES = ['New', 'Contacted'];

async function buildSuppression(db, campaignId, { windowDays = 0, allowRecontact = false } = {}) {
  const cutoff = windowDays > 0 ? new Date(Date.now() - windowDays * 86400000).toISOString() : null;
  const sets = {
    unsubscribed: new Set(),
    existingEmails: new Set(),
    priorEmails: new Set(), priorPhones: new Set(), priorHouseholds: new Set(),
    clientEmails: new Set(), clientPhones: new Set(),
    leadEmails: new Set(), leadPhones: new Set(),
  };
  const [recipients, projects, leads] = await Promise.all([
    fetchAll(db.CampaignRecipient, {}, ['campaign_id', 'email', 'phone', 'address', 'zip', 'send_status', 'unsubscribed', 'sent_at', 'created_date']),
    fetchAll(db.ContractorProject, { status: ACTIVE_PROJECT_STATUSES }, ['client_email', 'client_phone']),
    fetchAll(db.Lead, { status: OPEN_LEAD_STATUSES }, ['email', 'phone']),
  ]);
  for (const r of recipients) {
    const email = String(r.email || '').toLowerCase();
    if (r.unsubscribed) sets.unsubscribed.add(email);
    if (campaignId && r.campaign_id === campaignId) {
      sets.existingEmails.add(email);
      continue;
    }
    if (allowRecontact) continue;
    const contacted =
      r.send_status === 'pending' ||
      (r.send_status === 'sent' && (!cutoff || String(r.sent_at || r.created_date || '') >= cutoff));
    if (!contacted) continue;
    sets.priorEmails.add(email);
    const phone = normalizePhone(r.phone);
    if (phone) sets.priorPhones.add(phone);
    const household = normalizeAddress(r.address, r.zip);
    if (household) sets.priorHouseholds.add(household);
  }
  for (const p of projects) {
    const email = String(p.client_email || '').trim().toLowerCase();
    if (email.includes('@')) sets.clientEmails.add(email);
    const phone = normalizePhone(p.client_phone);
    if (phone) sets.clientPhones.add(phone);
  }
  for (const l of leads) {
    const email = String(l.email || '').trim().toLowerCase();
    if (email.includes('@')) sets.leadEmails.add(email);
    const phone = normalizePhone(l.phone);
    if (phone) sets.leadPhones.add(phone);
  }
  return sets;
}

// Why a normalized recipient must not be imported (null = ok). Active clients
// and open leads always win — they suppress even when allow_recontact is on.
function skipReasonFor(rec, sets) {
  const phone = normalizePhone(rec.phone);
  if (sets.clientEmails.has(rec.email) || (phone && sets.clientPhones.has(phone))) return 'active_client';
  if (sets.leadEmails.has(rec.email) || (phone && sets.leadPhones.has(phone))) return 'open_lead';
  if (sets.priorEmails.has(rec.email) || (phone && sets.priorPhones.has(phone))) return 'duplicate';
  const household = normalizeAddress(rec.address, rec.zip);
  if (household && sets.priorHouseholds.has(household)) return 'household';
  return null;
}

function normalizeRecipient(campaignId, row) {
  const email = String(row.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const name = String(row.client_name || '').replace(/\s+/g, ' ').trim();
  const lineItemNames = Array.isArray(row.line_item_names) ? row.line_item_names.map(String).filter(Boolean) : [];
  const seg = classifySegment(lineItemNames);
  return {
    campaign_id: campaignId,
    client_name: name || email,
    first_name: (name.split(' ')[0] || 'there').replace(/[^A-Za-z'\-]/g, '') || 'there',
    email,
    phone: String(row.phone || '').trim(),
    address: String(row.address || '').trim(),
    city: String(row.city || '').trim(),
    state: String(row.state || '').trim(),
    zip: String(row.zip || '').trim(),
    quote_number: String(row.quote_number || ''),
    quote_status: String(row.quote_status || ''),
    quote_total: Number(row.quote_total) || 0,
    quote_count: Number(row.quote_count) || 1,
    line_items: String(row.line_items || '').slice(0, 2000),
    line_item_names: lineItemNames.slice(0, 12),
    segment: seg.key,
    project_type: seg.projectType,
    origin: row.origin === 'inquiry' ? 'inquiry' : 'quote',
    send_status: 'pending',
  };
}

// ── Wave / drip helpers ──

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function sentTodayOf(campaign) {
  return campaign.drip_day === utcDay() ? (campaign.drip_sent_today || 0) : 0;
}

// wave_size = 0 means "no daily cap" — send everything in one run.
function waveSizeOf(campaign) {
  const raw = Number(campaign.wave_size);
  if (raw === 0) return Infinity;
  return raw > 0 ? raw : 200;
}

// Sends one batch of pending recipients and updates campaign counters
// (including the daily drip counter). Shared by the admin `send` action and
// the scheduler-driven `drip_tick`. Sends run SEND_CONCURRENCY at a time and
// the loop stops at SEND_DEADLINE_MS — a single request can never run long
// enough to hit the platform timeout; the caller loops until done.
async function sendPendingBatch(db, campaign, company, limit) {
  const startedAt = Date.now();
  const pending = await db.CampaignRecipient.filter(
    { campaign_id: campaign.id, send_status: 'pending' },
    'created_date',
    limit + 1,
  );
  const batch = pending.slice(0, limit);
  let sent = 0;
  let failed = 0;
  let processed = 0;
  for (let i = 0; i < batch.length; i += SEND_CONCURRENCY) {
    if (Date.now() - startedAt > SEND_DEADLINE_MS) break;
    const group = batch.slice(i, i + SEND_CONCURRENCY);
    await Promise.all(group.map(async (recipient) => {
      if (recipient.unsubscribed) {
        await db.CampaignRecipient.update(recipient.id, { send_status: 'skipped' }).catch(() => {});
        return;
      }
      if (recipient.opened_at || recipient.clicked_at || recipient.walkthrough_requested_at) {
        // Engagement on a "pending" row proves an earlier send reached them
        // but the status write was lost mid-wave — repair the row instead of
        // emailing them a duplicate.
        await db.CampaignRecipient.update(recipient.id, {
          send_status: 'sent',
          sent_at: recipient.sent_at || recipient.opened_at || recipient.clicked_at || new Date().toISOString(),
        }).catch(() => {});
        return;
      }
      try {
        const variantKey = await sendCampaignEmail({ recipient, campaign, company, variant: 'initial' });
        await db.CampaignRecipient.update(recipient.id, {
          send_status: 'sent',
          sent_at: new Date().toISOString(),
          ...(variantKey ? { subject_variant: variantKey } : {}),
        });
        sent++;
      } catch (err) {
        await db.CampaignRecipient.update(recipient.id, { send_status: 'failed', failed_reason: String(err.message || err).slice(0, 300) }).catch(() => {});
        failed++;
      }
    }));
    processed += group.length;
  }

  // Done only when the fetch had no extra row AND the deadline didn't cut the
  // batch short — otherwise the caller's loop picks up the remainder.
  const done = pending.length <= limit && processed >= batch.length;
  // Re-read the campaign so concurrent batches don't clobber each other's
  // counter increments with the stale copy loaded at request start.
  const freshRows = await db.EmailCampaign.filter({ id: campaign.id });
  const fresh = freshRows[0] || campaign;
  await db.EmailCampaign.update(campaign.id, {
    sent_count: (fresh.sent_count || 0) + sent,
    failed_count: (fresh.failed_count || 0) + failed,
    drip_day: utcDay(),
    drip_sent_today: sentTodayOf(fresh) + sent,
    last_wave_at: new Date().toISOString(),
    ...(done ? { status: 'sent', sent_at: new Date().toISOString() } : {}),
  });
  return { sent, failed, done };
}

// Scheduler entry point: advance every drip-enabled campaign by one small
// sub-batch, bounded by the campaign's daily wave_size. Unauthenticated by
// design — it can only act on campaigns an admin already put in drip mode,
// the daily cap bounds throughput (extra calls send nothing), and it returns
// only counts.
async function dripTick(db) {
  const campaigns = await db.EmailCampaign.filter({ drip_enabled: true, status: 'sending' }, '-created_date', 20);
  const profiles = await db.CompanyProfile.list();
  const company = profiles[0] || {};
  const results = [];
  for (const campaign of campaigns) {
    const waveSize = waveSizeOf(campaign);
    const remainingToday = waveSize - sentTodayOf(campaign);
    if (remainingToday <= 0) {
      results.push({ campaign_id: campaign.id, name: campaign.name, sent: 0, capped: true });
      continue;
    }
    const res = await sendPendingBatch(db, campaign, company, Math.min(SEND_BATCH, remainingToday));
    results.push({ campaign_id: campaign.id, name: campaign.name, ...res, capped: res.sent >= remainingToday && !res.done });
  }
  return Response.json({ ok: true, results });
}

// Self-heal: any New lead with an email but no booking_sent_at never received
// its walkthrough booking link (the create-hook fires scheduleLeadWalkthrough
// once, fire-and-forget, so a transient failure strands the lead). Retry those
// here on the daily tick. scheduleLeadWalkthrough is idempotent — it reuses
// the existing token, skips already-emailed leads, and bails if a slot is
// already booked.
async function resendMissingBookingLinks(base44) {
  const stranded = (await base44.asServiceRole.entities.Lead.filter({ status: 'New' }, '-created_date', 200))
    .filter(l => l.email && l.booking_token && !l.booking_sent_at && !l.booking_event_id)
    // Leave brand-new leads to the create-hook; only sweep ones it missed.
    .filter(l => Date.now() - new Date(l.created_date).getTime() > 15 * 60 * 1000);
  let resent = 0;
  for (const lead of stranded.slice(0, 25)) {
    try {
      await base44.asServiceRole.functions.invoke('scheduleLeadWalkthrough', {
        full_name: lead.full_name,
        email: lead.email,
        phone: lead.phone || '',
        project_type: lead.project_type,
        address: lead.address || '',
        source: lead.source || 'Website',
        contractor_project_id: lead.contractor_project_id || null,
        lead_id: lead.id,
      });
      resent++;
    } catch (e) {
      console.error(`Booking-link resend failed for lead ${lead.id}:`, e?.message || e);
    }
  }
  return resent;
}

// ── Handler ──

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || new URL(req.url).searchParams.get('action') || '');

    if (action === 'drip_tick') {
      const base44 = createClientFromRequest(req);
      const resentLinks = await resendMissingBookingLinks(base44).catch((e) => {
        console.error('Booking-link sweep failed:', e?.message || e);
        return 0;
      });
      const res = await dripTick(base44.asServiceRole.entities);
      if (resentLinks > 0) console.log(`Booking-link sweep resent ${resentLinks} link(s)`);
      return res;
    }

    const { base44, user } = await verifyAdminSession(req, 'can_access_leads', body);
    const db = base44.asServiceRole.entities;

    if (action === 'create_campaign') {
      if (!body.name) return Response.json({ error: 'name is required' }, { status: 400 });
      // Default the hero to the live website hero (CMS home_hero), then the stock fallback.
      let hero = String(body.hero_image_url || '').trim();
      if (!hero) {
        try {
          const settings = await db.AppSettings.filter({ key: 'home_hero' });
          hero = JSON.parse(settings[0]?.value || '{}')?.bg_image || '';
        } catch { hero = ''; }
      }
      const campaign = await db.EmailCampaign.create({
        name: String(body.name).slice(0, 120),
        status: 'draft',
        hero_image_url: hero || DEFAULT_HERO,
        custom_note: String(body.custom_note || '').slice(0, 1500),
        created_by: user.email,
        recipient_count: 0,
        sent_count: 0,
        failed_count: 0,
        wave_size: 200,
        drip_enabled: false,
        subject_a: String(body.subject_a || '').slice(0, 150),
        subject_b: String(body.subject_b || '').slice(0, 150),
        dedupe_window_days: Math.max(0, Math.min(3650, Number(body.dedupe_window_days) || 0)),
        allow_recontact: Boolean(body.allow_recontact),
      });
      return Response.json({ campaign });
    }

    if (action === 'list_campaigns') {
      const campaigns = await db.EmailCampaign.list('-created_date', 100);
      return Response.json({ campaigns });
    }

    if (action === 'get_campaign') {
      const rows = await db.EmailCampaign.filter({ id: body.campaign_id });
      if (!rows[0]) return Response.json({ error: 'Campaign not found' }, { status: 404 });
      return Response.json({ campaign: rows[0] });
    }

    if (action === 'list_recipients') {
      // skip lets the detail page fetch the FULL list in pages — a single
      // capped call hid every sent/opened row on 3000+ recipient campaigns
      // (sends go oldest-first, this sort is newest-first), zeroing the
      // engagement stats the page computes from these rows.
      const recipients = await db.CampaignRecipient.filter(
        { campaign_id: body.campaign_id },
        '-created_date',
        Math.min(Number(body.limit) || 3000, 5000),
        Math.max(0, Number(body.skip) || 0),
      );
      return Response.json({ recipients });
    }

    if (action === 'add_recipients') {
      const rows = Array.isArray(body.recipients) ? body.recipients : [];
      const campaignRows = await db.EmailCampaign.filter({ id: body.campaign_id });
      const campaign = campaignRows[0];
      if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
      if (campaign.status !== 'draft') return Response.json({ error: 'Campaign already sending' }, { status: 400 });

      const skips = { duplicate: 0, active_client: 0, open_lead: 0, household: 0 };
      let prepared = rows.map(r => normalizeRecipient(body.campaign_id, r)).filter(Boolean);
      let existingCount = null;

      if (body.precleared) {
        // Fast path for the wizard: it already ran the whole audience through
        // check_audience (one suppression scan) and imports only the cleared
        // recipients, so each chunk needs just two queries scoped to the
        // chunk's emails — idempotency + an unsubscribe race guard. Without
        // this, the full multi-entity scan ran on EVERY chunk and big imports
        // (~5k) timed the function out with 500s as the table grew.
        const emails = prepared.map(rec => rec.email);
        const [existingRows, unsubRows] = await Promise.all([
          db.CampaignRecipient.filter({ campaign_id: campaign.id, email: emails }, '-created_date', emails.length + 10, 0, ['email'])
            .catch(() => fetchAll(db.CampaignRecipient, { campaign_id: campaign.id }, ['email'])),
          db.CampaignRecipient.filter({ unsubscribed: true, email: emails }, '-created_date', emails.length + 10, 0, ['email'])
            .catch(() => []),
        ]);
        const existingEmails = new Set(existingRows.map(r => String(r.email).toLowerCase()));
        const unsubscribed = new Set(unsubRows.map(r => String(r.email).toLowerCase()));
        prepared = prepared.filter(rec => !existingEmails.has(rec.email));
        for (const rec of prepared) {
          if (unsubscribed.has(rec.email)) {
            rec.send_status = 'skipped';
            rec.unsubscribed = true;
          }
        }
      } else {
        // Full server-side suppression (API callers / older clients). The
        // wizard passes the dedupe options per chunk; the values saved on the
        // campaign at create time act as the fallback so resumed imports
        // behave identically.
        const windowDays = Math.max(0, Number(body.dedupe_window_days ?? campaign.dedupe_window_days) || 0);
        const allowRecontact = Boolean(body.allow_recontact ?? campaign.allow_recontact);
        const sets = await buildSuppression(db, campaign.id, { windowDays, allowRecontact });
        existingCount = sets.existingEmails.size;
        prepared = prepared
          .filter(rec => !sets.existingEmails.has(rec.email))
          .filter(rec => {
            const reason = skipReasonFor(rec, sets);
            if (reason) skips[reason]++;
            return !reason;
          });
        for (const rec of prepared) {
          if (sets.unsubscribed.has(rec.email)) {
            rec.send_status = 'skipped';
            rec.unsubscribed = true;
          }
        }
      }
      // Create in small groups with one retry per record. Partial failure
      // doesn't abort the chunk — we report what happened and the wizard
      // retries the remainder (idempotently).
      let created = 0;
      let failed = 0;
      for (let i = 0; i < prepared.length; i += 5) {
        const group = prepared.slice(i, i + 5);
        const results = await Promise.all(group.map(async rec => {
          try {
            await db.CampaignRecipient.create(rec);
            return true;
          } catch {
            try {
              await new Promise(r => setTimeout(r, 400));
              await db.CampaignRecipient.create(rec);
              return true;
            } catch {
              return false;
            }
          }
        }));
        for (const ok of results) ok ? created++ : failed++;
      }
      // Full-scan path recomputes from known totals (self-heals after partial
      // imports); the precleared path increments a fresh read instead — its
      // `created` only counts rows that genuinely didn't exist, so retried
      // chunks never double-count.
      if (existingCount !== null) {
        await db.EmailCampaign.update(campaign.id, { recipient_count: existingCount + created });
      } else {
        const freshRows = await db.EmailCampaign.filter({ id: campaign.id });
        const fresh = freshRows[0] || campaign;
        await db.EmailCampaign.update(campaign.id, { recipient_count: (fresh.recipient_count || 0) + created });
      }
      const skippedTotal = skips.duplicate + skips.active_client + skips.open_lead + skips.household;
      return Response.json({
        created,
        skipped_existing: rows.length - prepared.length - skippedTotal,
        skipped_duplicates: skips.duplicate,
        skipped_active_clients: skips.active_client,
        skipped_open_leads: skips.open_lead,
        skipped_household: skips.household,
        failed,
      });
    }

    if (action === 'check_audience') {
      // Dry-run for the wizard: identical suppression logic to add_recipients,
      // but nothing is written — just a breakdown of who would be skipped.
      const rows = Array.isArray(body.recipients) ? body.recipients.slice(0, 20000) : [];
      const windowDays = Math.max(0, Number(body.dedupe_window_days) || 0);
      const allowRecontact = Boolean(body.allow_recontact);
      const sets = await buildSuppression(db, body.campaign_id || null, { windowDays, allowRecontact });
      const breakdown = {
        total: rows.length, ok: 0, invalid: 0, already_imported: 0,
        duplicate: 0, active_client: 0, open_lead: 0, household: 0, unsubscribed: 0,
      };
      // Cleared emails go back to the wizard so the import itself can run
      // precleared chunks (no per-chunk suppression scan).
      const okEmails = [];
      for (const row of rows) {
        const rec = normalizeRecipient('dry-run', row);
        if (!rec) { breakdown.invalid++; continue; }
        if (sets.existingEmails.has(rec.email)) { breakdown.already_imported++; continue; }
        const reason = skipReasonFor(rec, sets);
        if (reason) { breakdown[reason]++; continue; }
        if (sets.unsubscribed.has(rec.email)) { breakdown.unsubscribed++; continue; }
        breakdown.ok++;
        okEmails.push(rec.email);
      }
      return Response.json({ breakdown, ok_emails: okEmails });
    }

    if (action === 'create_retarget_campaign') {
      // Clones a campaign's warm audience — opened or clicked, never booked,
      // not unsubscribed — into a fresh draft. Deliberately bypasses the
      // cross-campaign dedupe (this IS an intentional re-contact). Deadline-
      // bounded like send: the response carries the target campaign id and
      // done:false when cut short, and the caller loops to finish.
      const srcRows = await db.EmailCampaign.filter({ id: body.source_campaign_id });
      const source = srcRows[0];
      if (!source) return Response.json({ error: 'Source campaign not found' }, { status: 404 });

      let target;
      if (body.campaign_id) {
        const tRows = await db.EmailCampaign.filter({ id: body.campaign_id });
        target = tRows[0];
        if (!target || target.retarget_of !== source.id) return Response.json({ error: 'Resume campaign not found' }, { status: 404 });
      } else {
        target = await db.EmailCampaign.create({
          name: String(body.name || `${source.name} — Re-target`).slice(0, 120),
          status: 'draft',
          hero_image_url: source.hero_image_url || DEFAULT_HERO,
          custom_note: String(body.custom_note ?? source.custom_note ?? '').slice(0, 1500),
          created_by: user.email,
          retarget_of: source.id,
          recipient_count: 0,
          sent_count: 0,
          failed_count: 0,
          wave_size: source.wave_size ?? 200,
          drip_enabled: false,
          allow_recontact: true,
        });
      }

      const startedAt = Date.now();
      const sourceRecipients = await fetchAll(db.CampaignRecipient, { campaign_id: source.id });
      const warm = sourceRecipients.filter(r =>
        r.send_status === 'sent' && !r.unsubscribed && !r.walkthrough_requested_at &&
        (r.opened_at || r.clicked_at));
      const existing = new Set(
        (await fetchAll(db.CampaignRecipient, { campaign_id: target.id }, ['email']))
          .map(r => String(r.email).toLowerCase()),
      );
      const todo = warm.filter(r => !existing.has(String(r.email).toLowerCase()));
      let created = 0;
      let deadlineHit = false;
      for (let i = 0; i < todo.length; i += 5) {
        if (Date.now() - startedAt > SEND_DEADLINE_MS) { deadlineHit = true; break; }
        await Promise.all(todo.slice(i, i + 5).map(async (r) => {
          try {
            await db.CampaignRecipient.create({
              campaign_id: target.id,
              client_name: r.client_name,
              first_name: r.first_name,
              email: r.email,
              phone: r.phone || '',
              address: r.address || '',
              city: r.city || '',
              state: r.state || '',
              zip: r.zip || '',
              quote_number: r.quote_number || '',
              quote_status: r.quote_status || '',
              quote_total: r.quote_total || 0,
              quote_count: r.quote_count || 1,
              line_items: r.line_items || '',
              line_item_names: r.line_item_names || [],
              segment: r.segment || 'general',
              project_type: r.project_type || '',
              origin: r.origin || 'quote',
              send_status: 'pending',
            });
            created++;
          } catch { /* picked up by the resume loop */ }
        }));
      }
      await db.EmailCampaign.update(target.id, { recipient_count: existing.size + created });
      return Response.json({ campaign: target, created, eligible: warm.length, done: !deadlineHit });
    }

    if (action === 'preview') {
      const campaignRows = await db.EmailCampaign.filter({ id: body.campaign_id });
      const campaign = campaignRows[0];
      if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
      const profiles = await db.CompanyProfile.list();
      const company = profiles[0] || {};
      let recipient;
      if (body.recipient_id) {
        const recRows = await db.CampaignRecipient.filter({ id: body.recipient_id });
        recipient = recRows[0];
        if (!recipient) return Response.json({ error: 'Recipient not found' }, { status: 404 });
      } else {
        recipient = { id: 'sample', ...normalizeRecipient(campaign.id, body.sample || {
          client_name: 'Sam Homeowner', email: 'sample@example.com', city: 'Quincy',
          quote_status: 'Awaiting response', line_item_names: ['Rear Deck Rebuild'], line_items: 'Rear Deck Rebuild (1, $29975.00)',
        }) };
      }
      const token = await signTrackingToken(recipient.id, campaign.id);
      const previewVariant = body.variant === 'nudge' ? 'nudge' : 'initial';
      const ab = previewVariant === 'initial' ? abVariantFor(campaign, recipient) : null;
      const { subject, html } = renderEmail({
        recipient, campaign, company, token, variant: previewVariant,
        subjectOverride: ab ? fillSubjectTemplate(ab.template, recipient) : undefined,
      });
      return Response.json({ subject, html, subject_variant: ab?.key || null });
    }

    if (action === 'send') {
      const campaignRows = await db.EmailCampaign.filter({ id: body.campaign_id });
      const campaign = campaignRows[0];
      if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
      const profiles = await db.CompanyProfile.list();
      const company = profiles[0] || {};

      // Daily wave cap: protects domain reputation. The frontend loops this
      // action; once the day's wave is spent we answer capped instead of
      // sending, and the loop stops. wave_size 0 = unlimited (no cap).
      const waveSize = waveSizeOf(campaign);
      const remainingToday = waveSize - sentTodayOf(campaign);
      if (remainingToday <= 0) {
        return Response.json({ sent: 0, failed: 0, done: false, capped: true, wave_size: campaign.wave_size });
      }
      const limit = Math.min(Number(body.limit) || SEND_BATCH, 100, remainingToday);

      if (campaign.status === 'draft') {
        await db.EmailCampaign.update(campaign.id, { status: 'sending' });
        campaign.status = 'sending';
      }

      const res = await sendPendingBatch(db, campaign, company, limit);
      return Response.json({ ...res, capped: !res.done && res.sent >= remainingToday });
    }

    if (action === 'update_settings') {
      const campaignRows = await db.EmailCampaign.filter({ id: body.campaign_id });
      const campaign = campaignRows[0];
      if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
      const patch = {};
      if (body.wave_size !== undefined) {
        // 0 = unlimited; otherwise clamp to a sane daily range.
        const n = Number(body.wave_size);
        patch.wave_size = n === 0 ? 0 : Math.max(10, Math.min(10000, n || 200));
      }
      if (body.drip_enabled !== undefined) {
        patch.drip_enabled = Boolean(body.drip_enabled);
        // Drip only advances "sending" campaigns — arm a draft when enabling.
        if (patch.drip_enabled && campaign.status === 'draft') patch.status = 'sending';
      }
      if (body.subject_a !== undefined) patch.subject_a = String(body.subject_a || '').slice(0, 150);
      if (body.subject_b !== undefined) patch.subject_b = String(body.subject_b || '').slice(0, 150);
      await db.EmailCampaign.update(campaign.id, patch);
      return Response.json({ campaign: { ...campaign, ...patch } });
    }

    if (action === 'nudge') {
      const campaignRows = await db.EmailCampaign.filter({ id: body.campaign_id });
      const campaign = campaignRows[0];
      if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
      const profiles = await db.CompanyProfile.list();
      const company = profiles[0] || {};
      const ids = (Array.isArray(body.recipient_ids) ? body.recipient_ids : []).slice(0, 50);
      const startedAt = Date.now();
      let sent = 0;
      let failed = 0;
      let processed = 0;
      for (let i = 0; i < ids.length; i += SEND_CONCURRENCY) {
        if (Date.now() - startedAt > SEND_DEADLINE_MS) break;
        const group = ids.slice(i, i + SEND_CONCURRENCY);
        await Promise.all(group.map(async (id) => {
          const recRows = await db.CampaignRecipient.filter({ id });
          const recipient = recRows[0];
          if (!recipient || recipient.campaign_id !== campaign.id) return;
          if (recipient.unsubscribed || recipient.send_status !== 'sent') return;
          try {
            await sendCampaignEmail({ recipient, campaign, company, variant: 'nudge' });
            await db.CampaignRecipient.update(recipient.id, {
              nudge_count: (recipient.nudge_count || 0) + 1,
              last_nudged_at: new Date().toISOString(),
            });
            sent++;
          } catch (err) {
            await db.CampaignRecipient.update(recipient.id, { failed_reason: String(err.message || err).slice(0, 300) }).catch(() => {});
            failed++;
          }
        }));
        processed += group.length;
      }
      await db.EmailCampaign.update(campaign.id, { last_nudge_at: new Date().toISOString() });
      // processed < ids.length means the deadline cut us short — the caller
      // should resubmit the unprocessed tail.
      return Response.json({ sent, failed, processed });
    }

    if (action === 'campaign_stats') {
      // Server-side aggregate so the All Campaigns screen can show engagement
      // without shipping thousands of recipient rows to the browser.
      const recipients = await fetchAll(db.CampaignRecipient, { campaign_id: body.campaign_id });
      const stats = {
        recipients: recipients.length,
        pending: 0, sent: 0, failed: 0, skipped: 0,
        opened: 0, clicked: 0, walkthroughs: 0, leads: 0, unsubscribed: 0, nudged: 0,
        last_engaged_at: null,
        variants: { a: { sent: 0, opened: 0, clicked: 0 }, b: { sent: 0, opened: 0, clicked: 0 } },
      };
      for (const r of recipients) {
        const v = stats.variants[r.subject_variant];
        if (v) {
          if (r.send_status === 'sent') v.sent++;
          if (r.opened_at) v.opened++;
          if (r.clicked_at) v.clicked++;
        }
        if (r.send_status === 'pending') stats.pending++;
        else if (r.send_status === 'sent') stats.sent++;
        else if (r.send_status === 'failed') stats.failed++;
        else if (r.send_status === 'skipped') stats.skipped++;
        if (r.opened_at) stats.opened++;
        if (r.clicked_at) stats.clicked++;
        if (r.walkthrough_requested_at) stats.walkthroughs++;
        if (r.lead_id) stats.leads++;
        if (r.unsubscribed) stats.unsubscribed++;
        if (r.nudge_count) stats.nudged++;
        if (r.last_engaged_at && (!stats.last_engaged_at || r.last_engaged_at > stats.last_engaged_at)) {
          stats.last_engaged_at = r.last_engaged_at;
        }
      }
      return Response.json({ campaign_id: body.campaign_id, stats });
    }

    if (action === 'delete_campaign') {
      const campaignRows = await db.EmailCampaign.filter({ id: body.campaign_id });
      const campaign = campaignRows[0];
      if (!campaign) return Response.json({ deleted: true, already_gone: true });
      if (campaign.status !== 'draft') return Response.json({ error: 'Only draft campaigns can be deleted' }, { status: 400 });
      // Delete in bounded chunks so big drafts (1,500+ recipients) can't time
      // out the request — the frontend loops until deleted:true.
      const recipients = await db.CampaignRecipient.filter({ campaign_id: campaign.id }, 'created_date', 200);
      for (let i = 0; i < recipients.length; i += 10) {
        await Promise.all(recipients.slice(i, i + 10).map(r => db.CampaignRecipient.delete(r.id)));
      }
      if (recipients.length === 200) {
        // More may remain — report progress and let the caller loop.
        return Response.json({ deleted: false, removed: recipients.length });
      }
      await db.EmailCampaign.delete(campaign.id);
      return Response.json({ deleted: true, removed: recipients.length });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    const message = error?.message || String(error);
    const status = message === 'Forbidden' ? 403 : message.includes('Unauthorized') || message.includes('expired') ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
});
