import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Generates a unique booking token, saves it to the Lead record,
 * and sends the client a personalized email with a link to self-schedule
 * their walkthrough at a time that fits the company's business hours.
 *
 * Called by: angiWebhook and sendLeadNotification after lead creation.
 * Payload: { full_name, email, phone, project_type, address, source, contractor_project_id, lead_id }
 */

const PROJECT_LABELS = {
  'Kitchen Remodel': 'Kitchen Remodel',
  'Bathroom Remodel': 'Bathroom Remodel',
  'Deck / Porch / Pergola': 'Deck / Porch / Pergola',
  'Siding': 'Siding',
  'Home Addition': 'Home Addition',
  'Snow Removal': 'Snow Removal',
  'Custom Carpentry': 'Custom Carpentry',
  'Roofing': 'Roofing',
  'Full Home Renovation': 'Full Home Renovation',
  'General Inquiry': 'General Inquiry',
};

function generateToken() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { full_name, email, phone, project_type, address, source, contractor_project_id, lead_id, skip_email } = await req.json();

    if (!full_name || !lead_id) {
      return Response.json({ error: 'full_name and lead_id are required' }, { status: 400 });
    }

    // Get company profile
    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const company = profiles[0] || {};
    const companyName = company.company_name || 'Coen Construction';
    const teamEmail = company.lead_notification_email || 'scott@coenconstruction.com';
    const brandColor = company.brand_color || '#E35235';
    const logoHtml = company?.logo_url
      ? `<img src="${company.logo_url}" alt="${companyName}" height="44" style="display:inline-block;height:44px;max-width:220px;width:auto;background:#ffffff;padding:8px 14px;border-radius:8px;" />`
      : `<span style="color:#ffffff;font-size:26px;font-weight:700;">${companyName}</span>`;

    const projectLabel = PROJECT_LABELS[project_type] || project_type || 'General Inquiry';
    const firstName = full_name?.split(' ')[0] || 'there';

    // Idempotent: reuse the lead's existing booking token so the link in any
    // already-sent email keeps working, and never email again once a slot is
    // actually booked.
    const leadRows = await base44.asServiceRole.entities.Lead.filter({ id: lead_id });
    const leadRecord = leadRows[0];
    if (!leadRecord) return Response.json({ error: 'Lead not found' }, { status: 404 });
    if (leadRecord.booking_event_id) {
      return Response.json({ success: true, already_booked: true });
    }
    const bookingToken = leadRecord.booking_token || generateToken();
    const alreadyEmailed = !!leadRecord.booking_sent_at;
    if (!leadRecord.booking_token) {
      await base44.asServiceRole.entities.Lead.update(lead_id, { booking_token: bookingToken });
    }

    const bookingUrl = `https://coenconstruction.com/book-walkthrough?token=${bookingToken}`;
    const appUrl = contractor_project_id
      ? `https://coenconstruction.com/estimator/projects/${contractor_project_id}`
      : 'https://coenconstruction.com/estimator/projects';

    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    // Send scheduling email to client. booking_sent_at is only stamped after
    // Resend accepts the message — a lead left without the stamp shows up as
    // "Booking link not sent" in the New Leads panel and gets retried by the
    // daily drip-tick sweep, instead of silently never receiving the link.
    if (resendApiKey && email && !skip_email && !alreadyEmailed) {
      const sendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${companyName} <noreply@coenconstruction.com>`,
          to: email,
          subject: `📅 Schedule Your Free Walkthrough — ${companyName}`,
          html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="background:${brandColor};padding:32px 40px;text-align:center;">
          ${logoHtml}
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Licensed General Contractor · Greater Boston, MA</p>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <p style="margin:0 0 18px;font-size:16px;color:#333;line-height:1.6;">Hi <strong>${firstName}</strong>,</p>
          <p style="margin:0 0 18px;font-size:16px;color:#333;line-height:1.6;">
            Great news — we'd love to come out and take a look at your <strong>${projectLabel}</strong> project in person. Your free walkthrough &amp; estimate is just a few clicks away.
          </p>
          <p style="margin:0 0 28px;font-size:16px;color:#333;line-height:1.6;">
            Simply click the button below to see our available times and pick a slot that works best for you:
          </p>

          <!-- CTA Button -->
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
            <tr>
              <td style="background:${brandColor};border-radius:8px;">
                <a href="${bookingUrl}" style="display:inline-block;padding:16px 36px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;">
                  📅 Pick My Walkthrough Time →
                </a>
              </td>
            </tr>
          </table>

          <!-- What to Expect -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:8px;border:1px solid #efefef;margin-bottom:32px;">
            <tr><td style="padding:24px 28px;">
              <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1B2B3A;text-transform:uppercase;letter-spacing:0.5px;">What to Expect</p>
              <table cellpadding="0" cellspacing="0">
                <tr><td style="padding:6px 0;font-size:14px;color:#444;line-height:1.6;"><span style="color:${brandColor};font-weight:700;margin-right:8px;">1.</span> Pick a date &amp; time that fits your schedule</td></tr>
                <tr><td style="padding:6px 0;font-size:14px;color:#444;line-height:1.6;"><span style="color:${brandColor};font-weight:700;margin-right:8px;">2.</span> We'll come to your property for a free on-site walkthrough</td></tr>
                <tr><td style="padding:6px 0;font-size:14px;color:#444;line-height:1.6;"><span style="color:${brandColor};font-weight:700;margin-right:8px;">3.</span> Receive a detailed, itemized estimate — no pressure, no obligation</td></tr>
              </table>
            </td></tr>
          </table>

          <p style="margin:0 0 6px;font-size:15px;color:#333;">Prefer to call instead?</p>
          <p style="margin:0 0 32px;font-size:15px;color:#333;">
            📞 <a href="tel:${company.phone || ''}" style="color:${brandColor};text-decoration:none;font-weight:600;">${company.phone || ''}</a>
          </p>

          <p style="margin:0;font-size:15px;color:#333;">Looking forward to connecting,<br/><strong>The ${companyName} Team</strong></p>
        </td></tr>
        <tr><td style="background:#1B2B3A;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.5);">${companyName} · Licensed &amp; Insured · Greater Boston, MA</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
        }),
      });
      if (sendRes.ok) {
        await base44.asServiceRole.entities.Lead.update(lead_id, { booking_sent_at: new Date().toISOString() });
        console.log(`Booking link sent to ${email} — token: ${bookingToken}`);
      } else {
        const errBody = await sendRes.text().catch(() => '');
        console.error(`Booking link email failed for ${email}: ${sendRes.status} ${errBody}`);
        return Response.json({ success: false, error: 'Booking link email failed to send', booking_token: bookingToken }, { status: 502 });
      }
    }

    // (No separate "booking link sent" team email — the new-lead alert already
    // covers it; the office hears again only when the client actually books.)

    return Response.json({ success: true, booking_token: bookingToken, booking_url: bookingUrl });

  } catch (error) {
    console.error('scheduleLeadWalkthrough error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});