import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Public engagement endpoint for customer quote emails.
 * GET /api/functions/estimateTrack?t=<token>&a=<action>
 *
 * Actions:
 *   o  open — tracking pixel; always returns a 1×1 GIF
 *   c  view — records the quote as viewed, 302 to the project's customer
 *      portal (destination is looked up server-side, never from caller input)
 *
 * Token = HMAC-SHA256("estimate:" + b64url(estimateId|projectId)) using
 * MAGIC_LINK_SECRET || ADMIN_SESSION_SECRET — same scheme as campaignTrack.
 */

const SITE_URL = 'https://coenconstruction.com';

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
    const ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(`estimate:${payload}`));
    if (!ok) return null;
    const [estimateId, projectId] = new TextDecoder().decode(b64urlDecode(payload)).split('|');
    if (!estimateId || !projectId) return null;
    return { estimateId, projectId };
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
    const rows = await db.Estimate.filter({ id: verified.estimateId });
    const estimate = rows[0];
    if (!estimate || estimate.project_id !== verified.projectId) return fallback();

    const now = new Date().toISOString();

    if (action === 'o') {
      await db.Estimate.update(estimate.id, {
        opened_at: estimate.opened_at || now,
        open_count: (estimate.open_count || 0) + 1,
      }).catch(() => {});
      return gif();
    }

    if (action === 'c') {
      await db.Estimate.update(estimate.id, {
        opened_at: estimate.opened_at || now,
        viewed_at: estimate.viewed_at || now,
        view_count: (estimate.view_count || 0) + 1,
      }).catch(() => {});
      // Destination is resolved server-side: the project's portal link.
      const portals = await db.CustomerPortal.filter({ project_id: estimate.project_id });
      const portal = portals[0];
      if (portal?.portal_token) {
        return redirect(`${SITE_URL}/customer-portal?token=${portal.portal_token}`);
      }
      return redirect(`${SITE_URL}/contact`);
    }

    return fallback();
  } catch (err) {
    console.error('estimateTrack error:', err);
    return fallback();
  }
});
