import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Public engagement endpoint for email campaigns.
 * GET /api/functions/campaignTrack?t=<token>&a=<action>[&d=<dest>]
 *
 * Actions:
 *   o  open  — tracking pixel; always returns a 1×1 GIF
 *   c  click — records the click, 302 to a whitelisted site destination (d=)
 *   w  walkthrough — records the request, idempotently creates a Lead
 *      (source "Email Campaign" — fires the standard lead automations), then
 *      302 to the live /book-walkthrough slot picker with the lead's token
 *   u  unsubscribe — marks the recipient unsubscribed, shows a confirmation
 *
 * Token = HMAC-SHA256("campaign:" + b64url(recipientId|campaignId)) using
 * MAGIC_LINK_SECRET || ADMIN_SESSION_SECRET — same scheme as magic links.
 */

const SITE_URL = 'https://coenconstruction.com';

// Click destinations are a fixed whitelist — never redirect to caller input.
const DESTINATIONS = {
  site: '/',
  services: '/services',
  gallery: '/gallery',
  financing: '/financing',
  contact: '/contact',
};

const PIXEL = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));

function gif() {
  return new Response(PIXEL, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, max-age=0' },
  });
}

function redirect(url) {
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } });
}

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifyTrackingToken(token) {
  try {
    const secret = Deno.env.get('MAGIC_LINK_SECRET') || Deno.env.get('ADMIN_SESSION_SECRET');
    if (!secret) return null;
    const [payload, signature] = String(token).split('.');
    if (!payload || !signature) return null;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(`campaign:${payload}`));
    if (!ok) return null;
    const [recipientId, campaignId] = new TextDecoder().decode(b64urlDecode(payload)).split('|');
    if (!recipientId || !campaignId) return null;
    return { recipientId, campaignId };
  } catch {
    return null;
  }
}

function bookingToken() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  const rand = new Uint8Array(32);
  crypto.getRandomValues(rand);
  for (let i = 0; i < 32; i++) result += chars[rand[i] % chars.length];
  return result;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get('a') || 'o';
  const isPixel = action === 'o';
  const fallback = () => (isPixel ? gif() : redirect(SITE_URL));

  try {
    const verified = await verifyTrackingToken(url.searchParams.get('t') || '');
    if (!verified) return fallback();

    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const rows = await db.CampaignRecipient.filter({ id: verified.recipientId });
    const recipient = rows[0];
    if (!recipient || recipient.campaign_id !== verified.campaignId) return fallback();

    const now = new Date().toISOString();

    if (action === 'o') {
      await db.CampaignRecipient.update(recipient.id, {
        opened_at: recipient.opened_at || now,
        open_count: (recipient.open_count || 0) + 1,
        last_engaged_at: now,
      }).catch(() => {});
      return gif();
    }

    if (action === 'c') {
      const dest = DESTINATIONS[url.searchParams.get('d') || 'site'] || '/';
      await db.CampaignRecipient.update(recipient.id, {
        opened_at: recipient.opened_at || now,
        clicked_at: recipient.clicked_at || now,
        click_count: (recipient.click_count || 0) + 1,
        last_engaged_at: now,
      }).catch(() => {});
      return redirect(`${SITE_URL}${dest}?utm_source=email&utm_medium=campaign&utm_campaign=${encodeURIComponent(verified.campaignId)}`);
    }

    if (action === 'w') {
      // Unsubscribed recipients are still allowed through here: clicking
      // "Schedule a Walkthrough" is an explicit request, not marketing —
      // unsubscribe only stops campaign/nudge sends.
      // Idempotent: one Lead per recipient, and keep reusing its booking link.
      // Double-click / lost-write race: also match by email+source before
      // creating, so a race loser reuses the winner's Lead instead of firing
      // the lead automations twice.
      let leadId = recipient.lead_id;
      let lead = null;
      if (leadId) {
        const leadRows = await db.Lead.filter({ id: leadId });
        lead = leadRows[0] || null;
      }
      if (!lead) {
        const existing = await db.Lead.filter({ email: recipient.email, source: 'Email Campaign' }, '-created_date', 1);
        lead = existing[0] || null;
        if (lead) leadId = lead.id;
      }
      if (!lead) {
        const campaignRows = await db.EmailCampaign.filter({ id: verified.campaignId });
        const campaignName = campaignRows[0]?.name || 'Email Campaign';
        const addressParts = [recipient.address, recipient.city, recipient.state, recipient.zip].filter(Boolean);
        // Creating the Lead fires the standard sendLeadNotification automation
        // (team alert + welcome + booking emails) — same as any inbound lead.
        lead = await db.Lead.create({
          full_name: recipient.client_name || recipient.email,
          email: recipient.email,
          phone: recipient.phone || 'Not provided',
          project_type: recipient.project_type || 'General Inquiry',
          source: 'Email Campaign',
          status: 'New',
          address: addressParts.join(', '),
          message: recipient.origin === 'inquiry'
            ? `Requested a walkthrough from the "${campaignName}" email campaign. Original inquiry #${recipient.quote_number || '—'} (${recipient.quote_status || 'unknown status'}): ${recipient.line_items || 'no project details'}.`
            : `Requested a walkthrough from the "${campaignName}" email campaign. Past quote #${recipient.quote_number || '—'} (${recipient.quote_status || 'unknown status'}): ${recipient.line_items || 'no line items'}.`,
          booking_token: bookingToken(),
        });
        leadId = lead.id;
      }
      await db.CampaignRecipient.update(recipient.id, {
        opened_at: recipient.opened_at || now,
        clicked_at: recipient.clicked_at || now,
        click_count: (recipient.click_count || 0) + 1,
        walkthrough_requested_at: recipient.walkthrough_requested_at || now,
        last_engaged_at: now,
        lead_id: leadId,
      }).catch(() => {});
      const token = lead.booking_token;
      if (!token) {
        // Shouldn't happen, but never strand the customer — send them to the contact page.
        return redirect(`${SITE_URL}/contact`);
      }
      return redirect(`${SITE_URL}/book-walkthrough?token=${token}`);
    }

    if (action === 'u') {
      await db.CampaignRecipient.update(recipient.id, {
        unsubscribed: true,
        unsubscribed_at: recipient.unsubscribed_at || now,
      }).catch(() => {});
      return new Response(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Unsubscribed</title></head>
<body style="margin:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:80px auto;background:#fff;border-radius:10px;padding:40px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <h1 style="margin:0 0 12px;font-size:22px;color:#1B2B3A;">You're unsubscribed</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">You won't receive any more campaign emails from Coen Construction. If you ever need us, we're at <a href="${SITE_URL}" style="color:#E35235;text-decoration:none;font-weight:600;">coenconstruction.com</a>.</p>
  </div>
</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return fallback();
  } catch (err) {
    console.error('campaignTrack error:', err);
    return fallback();
  }
});
