import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Customer submits their final punchlist (public, portal-token-secured).
 *
 * The portal previously wrote the Punchlist entity directly from the browser
 * with no token check — this function is the validated replacement. It scopes
 * the punchlist to the portal's project, sanitizes the submitted items, and
 * notifies the team.
 *
 * Payload: { token, punchlist_id, items: [{ id?, description, location?, photo_url? }] }
 */

// Best-effort email: Resend first (proven delivery path in this app), then the
// Base44 Core.SendEmail integration. Never throws.
async function sendEmailSafe(base44, { to, subject, html }) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Coen Construction <noreply@coenconstruction.com>",
          to,
          subject,
          html,
        }),
      });
      if (res.ok) return true;
      console.error("Resend send failed:", res.status, await res.text().catch(() => ""));
    } catch (e) {
      console.error("Resend send error:", e.message);
    }
  }
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, html });
    return true;
  } catch (e) {
    console.error("Core.SendEmail failed:", e.message);
    return false;
  }
}

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, punchlist_id, items } = await req.json();

    if (!token || !punchlist_id || !Array.isArray(items)) {
      return Response.json({ error: 'token, punchlist_id, and items are required' }, { status: 400 });
    }

    const portals = await base44.asServiceRole.entities.CustomerPortal.filter({ portal_token: token });
    const portal = portals[0];
    if (!portal) return Response.json({ error: 'Invalid portal link' }, { status: 404 });
    if (portal.portal_token_expires && new Date(portal.portal_token_expires) < new Date()) {
      return Response.json({ error: 'This portal link has expired' }, { status: 410 });
    }

    const punchlists = await base44.asServiceRole.entities.Punchlist.filter({ id: punchlist_id });
    const punchlist = punchlists[0];
    if (!punchlist || punchlist.project_id !== portal.project_id) {
      return Response.json({ error: 'Punchlist not found' }, { status: 404 });
    }
    if (punchlist.status === 'submitted' || punchlist.status === 'reviewed') {
      return Response.json({ success: true, already_submitted: true });
    }

    const cleanItems = items.slice(0, 100).map((i) => ({
      id: typeof i?.id === 'string' ? i.id : crypto.randomUUID(),
      description: String(i?.description || '').slice(0, 1000).trim(),
      location: String(i?.location || '').slice(0, 300).trim(),
      photo_url: typeof i?.photo_url === 'string' ? i.photo_url : '',
      resolved: false,
    })).filter((i) => i.description);
    if (cleanItems.length === 0) {
      return Response.json({ error: 'At least one punchlist item is required' }, { status: 400 });
    }

    await base44.asServiceRole.entities.Punchlist.update(punchlist.id, {
      items: cleanItems,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    });

    // Notify the team so submitted punchlists never sit unseen
    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: portal.project_id });
    const project = projects[0];
    const clientName = project?.client_name || punchlist.client_name || portal.client_name || 'A customer';
    const notifyTo = project?.assigned_to || 'scott@coenconstruction.com';
    const itemRows = cleanItems.map((i, idx) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top;">${idx + 1}.</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">
          ${escapeHtml(i.description)}
          ${i.location ? `<br><span style="color:#888;font-size:12px;">📍 ${escapeHtml(i.location)}</span>` : ''}
          ${i.photo_url ? `<br><a href="${escapeHtml(i.photo_url)}" style="color:#E35235;font-size:12px;">View photo</a>` : ''}
        </td>
      </tr>`).join('');
    await sendEmailSafe(base44, {
      to: notifyTo,
      subject: `📋 Punchlist Submitted: ${clientName} (${cleanItems.length} item${cleanItems.length !== 1 ? 's' : ''})`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:#1B2B3A;padding:20px 28px;border-radius:8px 8px 0 0;">
            <h2 style="color:#fff;margin:0;font-size:18px;">Final Punchlist Submitted</h2>
          </div>
          <div style="border:1px solid #e5e5e5;border-top:none;padding:24px 28px;border-radius:0 0 8px 8px;">
            <p style="font-size:14px;color:#444;"><strong>${escapeHtml(clientName)}</strong> submitted their final punchlist with ${cleanItems.length} item${cleanItems.length !== 1 ? 's' : ''}:</p>
            <table style="font-size:14px;color:#444;border-collapse:collapse;width:100%;">${itemRows}</table>
            <p style="font-size:14px;color:#444;margin-top:20px;">Review it in the estimator dashboard to schedule the work.</p>
          </div>
        </div>`,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
