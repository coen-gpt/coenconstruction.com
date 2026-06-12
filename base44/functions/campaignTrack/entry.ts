import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Public engagement endpoint for email campaigns.
 * GET /api/functions/campaignTrack?t=<token>&a=<action>[&d=<dest>]
 *
 * Actions:
 *   o  open  — tracking pixel; always returns a 1×1 GIF
 *   c  click — records the click, 302 to a whitelisted site destination (d=)
 *   w  walkthrough — records the click, 302 to the live /book-walkthrough
 *      slot picker carrying this campaign token (ct=). NO Lead is created
 *      here: email security scanners (Proofpoint, SafeLinks — standard on
 *      corporate/.edu mailboxes) GET every link in delivered mail, so any
 *      side effect on a bare GET fires for bots. confirmBooking creates the
 *      Lead only when a visitor actually confirms a slot.
 *   u  unsubscribe — same scanner problem: a bare GET shows a confirm page
 *      instead of unsubscribing. The actual unsubscribe requires a POST
 *      (RFC 8058 one-click header flow) or the confirm page's form submit.
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
      // Record the click only. The Lead (and its automations) is created by
      // confirmBooking once the visitor confirms a slot — a JS-driven POST
      // that email security scanners never perform.
      await db.CampaignRecipient.update(recipient.id, {
        opened_at: recipient.opened_at || now,
        clicked_at: recipient.clicked_at || now,
        click_count: (recipient.click_count || 0) + 1,
        last_engaged_at: now,
      }).catch(() => {});
      return redirect(`${SITE_URL}/book-walkthrough?ct=${encodeURIComponent(url.searchParams.get('t') || '')}`);
    }

    if (action === 'u') {
      // Only a POST (mail clients' RFC 8058 one-click flow) or the confirm
      // form below actually unsubscribes — scanner GETs just see the page.
      const confirmed = req.method === 'POST' || url.searchParams.get('confirm') === '1';
      if (!confirmed) {
        const confirmUrl = `${url.pathname}?t=${encodeURIComponent(url.searchParams.get('t') || '')}&a=u&confirm=1`;
        return new Response(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Unsubscribe</title></head>
<body style="margin:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:80px auto;background:#fff;border-radius:10px;padding:40px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <h1 style="margin:0 0 12px;font-size:22px;color:#1B2B3A;">Unsubscribe from our emails?</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">You'll stop receiving campaign emails from Coen Construction.</p>
    <form method="POST" action="${confirmUrl}" style="margin:0;">
      <button type="submit" style="background:#E35235;color:#fff;border:none;border-radius:8px;padding:12px 28px;font-size:15px;font-weight:600;cursor:pointer;">Unsubscribe</button>
    </form>
  </div>
</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
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
