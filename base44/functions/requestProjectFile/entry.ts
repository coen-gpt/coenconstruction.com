import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Customer requests a document from their PM (public, portal-token-secured).
 *
 * The portal's "Request File" button used to call sendCustomerNotification,
 * which requires an admin session (it always failed for customers) and emails
 * the customer rather than the team. This function is the working replacement:
 * it validates the portal token and emails the assigned PM.
 *
 * Payload: { token, file_type, description?, urgency? }
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

const URGENCY_LABELS = {
  low: 'When convenient',
  normal: 'This week',
  high: '🔴 Urgent',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, file_type, description, urgency } = await req.json();

    if (!token || !file_type || !String(file_type).trim()) {
      return Response.json({ error: 'token and file_type are required' }, { status: 400 });
    }

    const portals = await base44.asServiceRole.entities.CustomerPortal.filter({ portal_token: token });
    const portal = portals[0];
    if (!portal) return Response.json({ error: 'Invalid portal link' }, { status: 404 });
    if (portal.portal_token_expires && new Date(portal.portal_token_expires) < new Date()) {
      return Response.json({ error: 'This portal link has expired' }, { status: 410 });
    }

    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: portal.project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    const clientName = project.client_name || portal.client_name || 'A customer';
    const notifyTo = project.assigned_to || 'scott@coenconstruction.com';
    const urgencyLabel = URGENCY_LABELS[urgency] || URGENCY_LABELS.normal;

    const sent = await sendEmailSafe(base44, {
      to: notifyTo,
      subject: `📄 File Request from ${clientName}: ${String(file_type).slice(0, 80)}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:#1B2B3A;padding:20px 28px;border-radius:8px 8px 0 0;">
            <h2 style="color:#fff;margin:0;font-size:18px;">Customer File Request</h2>
          </div>
          <div style="border:1px solid #e5e5e5;border-top:none;padding:24px 28px;border-radius:0 0 8px 8px;">
            <table style="font-size:14px;color:#444;border-collapse:collapse;width:100%;">
              <tr><td style="padding:5px 0;font-weight:600;width:120px;">Client</td><td>${escapeHtml(clientName)}</td></tr>
              <tr><td style="padding:5px 0;font-weight:600;">Project</td><td>${escapeHtml(project.project_type || '—')}</td></tr>
              <tr><td style="padding:5px 0;font-weight:600;">Requested</td><td><strong>${escapeHtml(String(file_type).slice(0, 200))}</strong></td></tr>
              ${description ? `<tr><td style="padding:5px 0;font-weight:600;">Details</td><td>${escapeHtml(String(description).slice(0, 1000))}</td></tr>` : ''}
              <tr><td style="padding:5px 0;font-weight:600;">Urgency</td><td>${urgencyLabel}</td></tr>
            </table>
            <p style="font-size:14px;color:#444;margin-top:20px;">Upload the document to the project's portal files to fulfill this request.</p>
          </div>
        </div>`,
    });

    if (!sent) {
      return Response.json({ error: 'Could not deliver your request — please call us at (617) 857-COEN.' }, { status: 502 });
    }
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
