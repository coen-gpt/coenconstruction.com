import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Emails the requester when their time-off request is approved or denied.
 * Accepts only a request_id and emails only the address ON that request with
 * its CURRENT status — no caller-controlled content, so it's safe to expose.
 */

// Best-effort email: Resend first (proven delivery path in this app), then the
// Base44 Core.SendEmail integration. Never throws.
async function sendEmailSafe(base44, { to, subject, text, html }) {
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
          ...(html ? { html } : { text }),
        }),
      });
      if (res.ok) return true;
      console.error("Resend send failed:", res.status, await res.text().catch(() => ""));
    } catch (e) {
      console.error("Resend send error:", e.message);
    }
  }
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, ...(html ? { html } : { body: text }) });
    return true;
  } catch (e) {
    console.error("Core.SendEmail failed:", e.message);
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { request_id } = await req.json();
    if (!request_id) return Response.json({ error: 'request_id required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.TimeOffRequest.filter({ id: request_id });
    const request = rows[0];
    if (!request) return Response.json({ error: 'Request not found' }, { status: 404 });
    if (!request.user_email || !['approved', 'denied'].includes(request.status)) {
      return Response.json({ skipped: true });
    }

    const approved = request.status === 'approved';
    const range = request.start_date === request.end_date
      ? request.start_date
      : `${request.start_date} – ${request.end_date}`;

    const emailSent = await sendEmailSafe(base44, {
      to: request.user_email,
      subject: approved
        ? `✅ Time off approved: ${range}`
        : `Time off request update: ${range}`,
      text: [
        `Hi ${request.user_name || 'there'},`,
        '',
        approved
          ? `Your time-off request for ${range} has been APPROVED. Enjoy!`
          : `Your time-off request for ${range} was not approved.`,
        request.admin_notes ? `\nNote from the office: ${request.admin_notes}` : '',
        '',
        'Questions? Reply to this email or call the office.',
        '',
        'Coen Construction LLC',
      ].join('\n'),
    });

    return Response.json({ success: true, email_sent: emailSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
