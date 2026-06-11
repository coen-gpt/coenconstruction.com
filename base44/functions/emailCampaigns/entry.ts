import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Admin email-campaign engine for the Jobber past-quotes re-engagement flow.
 *
 * Actions (POST { action, ... } — admin session required):
 *   create_campaign   { name, hero_image_url?, custom_note? }
 *   add_recipients    { campaign_id, recipients: [...] }   chunked from the frontend
 *   list_campaigns    {}
 *   get_campaign      { campaign_id }
 *   list_recipients   { campaign_id, limit? }
 *   preview           { campaign_id, recipient_id?, sample?, variant? }
 *   send              { campaign_id, limit? }               one batch; frontend loops
 *   nudge             { campaign_id, recipient_ids: [...] } reminder variant
 *   delete_campaign   { campaign_id }
 *
 * Engagement tracking lives in the public campaignTrack function; this one
 * embeds the tracking pixel + tokenized links when rendering each email.
 */

const SITE_URL = 'https://coenconstruction.com';
const TRACK_URL = `${SITE_URL}/api/functions/campaignTrack`;
const DEFAULT_HERO = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80';
const SEND_BATCH = 20;

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

// Status framing: how we open the email given where their quote landed.
function statusIntro(recipient, phrase) {
  const status = String(recipient.quote_status || '').toLowerCase();
  const where = recipient.city ? ` in ${escapeHtml(recipient.city)}` : '';
  if (status === 'approved') {
    return `Great news — your approved quote for <strong>${escapeHtml(phrase)}</strong>${where} is ready to go. Let's get your project on the schedule before the calendar fills up.`;
  }
  if (status === 'converted') {
    return `Thank you again for trusting us with <strong>${escapeHtml(phrase)}</strong>${where} — it meant a lot to have you as a client. A lot is new at Coen Construction, and if there's a next project on your list, we'd love to be your first call.`;
  }
  if (status === 'awaiting response' || status === 'changes requested') {
    return `We put together a detailed quote for <strong>${escapeHtml(phrase)}</strong>${where}, and it's still ready whenever you are. No pressure — but if questions came up or the scope changed, we're happy to walk through it together.`;
  }
  // Archived / anything else: re-engagement.
  return `A while back we quoted <strong>${escapeHtml(phrase)}</strong>${where} for you. Still thinking about it? Plans and budgets change — we'd be glad to take a fresh look, update the numbers, and answer anything that held you back. No obligation.`;
}

function subjectFor(recipient, variant) {
  const first = recipient.first_name || 'there';
  const item = shortItem(recipient.line_item_names);
  if (variant === 'nudge') return `Quick follow-up on your ${item} project, ${first}`;
  const status = String(recipient.quote_status || '').toLowerCase();
  if (status === 'approved') return `Let's get your ${item} project scheduled, ${first}`;
  if (status === 'converted') return `Thank you from Coen Construction — and a look at what's new`;
  if (status === 'awaiting response' || status === 'changes requested') return `Your ${item} quote is ready when you are, ${first}`;
  return `Still thinking about your ${item} project, ${first}?`;
}

function renderEmail({ recipient, campaign, company, token, variant }) {
  // brand_color is interpolated into style attributes — only accept hex.
  const rawBrand = String(company?.brand_color || '');
  const brandColor = /^#[0-9a-fA-F]{3,8}$/.test(rawBrand) ? rawBrand : '#E35235';
  const navy = '#1B2B3A';
  const companyName = company?.company_name || 'Coen Construction';
  const phone = company?.phone || '(617) 857-2636';
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
          <span style="color:#fff;font-size:21px;font-weight:800;letter-spacing:-0.5px;">${escapeHtml(companyName)}</span>
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

  return { subject: subjectFor(recipient, variant), html, unsubUrl };
}

async function sendCampaignEmail({ recipient, campaign, company, variant }) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) throw new Error('RESEND_API_KEY not configured');
  const token = await signTrackingToken(recipient.id, campaign.id);
  const { subject, html, unsubUrl } = renderEmail({ recipient, campaign, company, token, variant });
  const companyName = company?.company_name || 'Coen Construction';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${companyName} <info@coenconstruction.com>`,
      reply_to: 'ops@coenconstruction.com',
      to: recipient.email,
      subject,
      html,
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

// ── Recipient import ──

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
    send_status: 'pending',
  };
}

// ── Handler ──

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { base44, user } = await verifyAdminSession(req, 'can_access_leads', body);
    const db = base44.asServiceRole.entities;
    const action = String(body.action || '');

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
      const recipients = await db.CampaignRecipient.filter(
        { campaign_id: body.campaign_id },
        '-created_date',
        Math.min(Number(body.limit) || 3000, 5000),
      );
      return Response.json({ recipients });
    }

    if (action === 'add_recipients') {
      const rows = Array.isArray(body.recipients) ? body.recipients : [];
      const campaignRows = await db.EmailCampaign.filter({ id: body.campaign_id });
      const campaign = campaignRows[0];
      if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
      if (campaign.status !== 'draft') return Response.json({ error: 'Campaign already sending' }, { status: 400 });

      // Global suppression: anyone who unsubscribed from a past campaign comes in skipped.
      const unsubbed = await db.CampaignRecipient.filter({ unsubscribed: true }, '-created_date', 10000);
      const suppressed = new Set(unsubbed.map(r => String(r.email).toLowerCase()));

      const prepared = rows.map(r => normalizeRecipient(body.campaign_id, r)).filter(Boolean);
      for (const rec of prepared) {
        if (suppressed.has(rec.email)) {
          rec.send_status = 'skipped';
          rec.unsubscribed = true;
        }
      }
      // Create in small parallel groups so 100-row chunks stay well under the
      // function time budget.
      let created = 0;
      for (let i = 0; i < prepared.length; i += 10) {
        const group = prepared.slice(i, i + 10);
        await Promise.all(group.map(rec => db.CampaignRecipient.create(rec)));
        created += group.length;
      }
      await db.EmailCampaign.update(campaign.id, {
        recipient_count: (campaign.recipient_count || 0) + created,
      });
      return Response.json({ created });
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
      const { subject, html } = renderEmail({ recipient, campaign, company, token, variant: body.variant === 'nudge' ? 'nudge' : 'initial' });
      return Response.json({ subject, html });
    }

    if (action === 'send') {
      const campaignRows = await db.EmailCampaign.filter({ id: body.campaign_id });
      const campaign = campaignRows[0];
      if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
      const profiles = await db.CompanyProfile.list();
      const company = profiles[0] || {};
      const limit = Math.min(Number(body.limit) || SEND_BATCH, 50);

      if (campaign.status === 'draft') {
        await db.EmailCampaign.update(campaign.id, { status: 'sending' });
      }

      const pending = await db.CampaignRecipient.filter(
        { campaign_id: campaign.id, send_status: 'pending' },
        'created_date',
        limit + 1,
      );
      const batch = pending.slice(0, limit);
      let sent = 0;
      let failed = 0;
      for (const recipient of batch) {
        if (recipient.unsubscribed) {
          await db.CampaignRecipient.update(recipient.id, { send_status: 'skipped' });
          continue;
        }
        try {
          await sendCampaignEmail({ recipient, campaign, company, variant: 'initial' });
          await db.CampaignRecipient.update(recipient.id, { send_status: 'sent', sent_at: new Date().toISOString() });
          sent++;
        } catch (err) {
          await db.CampaignRecipient.update(recipient.id, { send_status: 'failed', failed_reason: String(err.message || err).slice(0, 300) });
          failed++;
        }
      }

      // We fetched limit+1 rows — an extra row means more pending remain after this batch.
      const done = pending.length <= limit;
      // Re-read the campaign so concurrent batches don't clobber each other's
      // counter increments with the stale copy loaded at request start.
      const freshRows = await db.EmailCampaign.filter({ id: campaign.id });
      const fresh = freshRows[0] || campaign;
      await db.EmailCampaign.update(campaign.id, {
        sent_count: (fresh.sent_count || 0) + sent,
        failed_count: (fresh.failed_count || 0) + failed,
        ...(done ? { status: 'sent', sent_at: new Date().toISOString() } : {}),
      });
      return Response.json({ sent, failed, done });
    }

    if (action === 'nudge') {
      const campaignRows = await db.EmailCampaign.filter({ id: body.campaign_id });
      const campaign = campaignRows[0];
      if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
      const profiles = await db.CompanyProfile.list();
      const company = profiles[0] || {};
      const ids = (Array.isArray(body.recipient_ids) ? body.recipient_ids : []).slice(0, 50);
      let sent = 0;
      let failed = 0;
      for (const id of ids) {
        const recRows = await db.CampaignRecipient.filter({ id });
        const recipient = recRows[0];
        if (!recipient || recipient.campaign_id !== campaign.id) continue;
        if (recipient.unsubscribed || recipient.send_status !== 'sent') continue;
        try {
          await sendCampaignEmail({ recipient, campaign, company, variant: 'nudge' });
          await db.CampaignRecipient.update(recipient.id, {
            nudge_count: (recipient.nudge_count || 0) + 1,
            last_nudged_at: new Date().toISOString(),
          });
          sent++;
        } catch (err) {
          await db.CampaignRecipient.update(recipient.id, { failed_reason: String(err.message || err).slice(0, 300) });
          failed++;
        }
      }
      await db.EmailCampaign.update(campaign.id, { last_nudge_at: new Date().toISOString() });
      return Response.json({ sent, failed });
    }

    if (action === 'delete_campaign') {
      const campaignRows = await db.EmailCampaign.filter({ id: body.campaign_id });
      const campaign = campaignRows[0];
      if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
      if (campaign.status !== 'draft') return Response.json({ error: 'Only draft campaigns can be deleted' }, { status: 400 });
      const recipients = await db.CampaignRecipient.filter({ campaign_id: campaign.id }, 'created_date', 5000);
      for (const r of recipients) await db.CampaignRecipient.delete(r.id);
      await db.EmailCampaign.delete(campaign.id);
      return Response.json({ deleted: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    const message = error?.message || String(error);
    const status = message === 'Forbidden' ? 403 : message.includes('Unauthorized') || message.includes('expired') ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
});
