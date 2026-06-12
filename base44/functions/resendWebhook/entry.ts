import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Resend webhook receiver — permanent suppression on hard delivery failures.
 *
 * Setup (one-time, in the Resend dashboard):
 *   Webhooks → Add endpoint → https://coenconstruction.com/api/functions/resendWebhook
 *   Events: email.bounced + email.complained
 *   Put the endpoint's signing secret (whsec_…) in the RESEND_WEBHOOK_SECRET env var.
 *
 * On a bounce or spam complaint, every CampaignRecipient row for that address
 * (across all campaigns) is marked unsubscribed with a suppression_reason, and
 * still-pending rows are skipped. The emailCampaigns import suppression treats
 * unsubscribed as a global block, so future imports auto-skip these addresses
 * and repeat bounces can't keep damaging domain reputation.
 *
 * Requests are Svix-signed (Resend's webhook transport): HMAC-SHA256 over
 * `${svix-id}.${svix-timestamp}.${body}` with the base64-decoded secret,
 * compared against each signature in the svix-signature header. Without a
 * valid signature (or with no secret configured) nothing is processed.
 */

function b64Decode(value) {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}

async function verifySvix(req, rawBody) {
  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET') || '';
  if (!secret) return false;
  const id = req.headers.get('svix-id') || '';
  const timestamp = req.headers.get('svix-timestamp') || '';
  const signatures = req.headers.get('svix-signature') || '';
  if (!id || !timestamp || !signatures) return false;
  // Reject replays outside ±5 minutes.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    b64Decode(secret.replace(/^whsec_/, '')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  // Header carries space-separated "v1,<base64>" entries.
  return signatures.split(' ').some(part => part.split(',')[1] === expected);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });
    const rawBody = await req.text();
    if (!(await verifySvix(req, rawBody))) return Response.json({ error: 'Invalid signature' }, { status: 401 });

    const event = JSON.parse(rawBody);
    const type = String(event?.type || '');
    const reason = type === 'email.bounced' ? 'bounced' : type === 'email.complained' ? 'complained' : null;
    if (!reason) return Response.json({ ok: true, ignored: type });

    const addresses = (Array.isArray(event?.data?.to) ? event.data.to : [event?.data?.to])
      .map(a => String(a || '').trim().toLowerCase())
      .filter(a => a.includes('@'));

    const db = createClientFromRequest(req).asServiceRole.entities;
    let suppressed = 0;
    for (const email of addresses) {
      // Recipient emails are stored lowercased at import, so exact match works.
      const rows = await db.CampaignRecipient.filter({ email }, '-created_date', 500);
      for (const r of rows) {
        await db.CampaignRecipient.update(r.id, {
          unsubscribed: true,
          unsubscribed_at: r.unsubscribed_at || new Date().toISOString(),
          suppression_reason: reason,
          ...(r.send_status === 'pending' ? { send_status: 'skipped' } : {}),
        }).catch(() => {});
        suppressed++;
      }
    }
    return Response.json({ ok: true, reason, suppressed });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
