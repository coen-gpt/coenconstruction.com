import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Sends a personalized welcome email to a new lead.
 * Called by both the angiWebhook and the sendLeadNotification entity automation.
 *
 * Expected payload: { lead_id, full_name, email, phone, project_type, message, source, address }
 */

const PROJECT_TYPE_LABELS = {
  'Kitchen Remodel': 'kitchen remodel',
  'Bathroom Remodel': 'bathroom remodel',
  'Deck / Porch / Pergola': 'deck, porch, or pergola project',
  'Siding': 'siding project',
  'Home Addition': 'home addition',
  'Snow Removal': 'snow removal service',
  'Custom Carpentry': 'custom carpentry project',
  'Roofing': 'roofing project',
  'Full Home Renovation': 'full home renovation',
  'General Inquiry': 'project',
};

function buildWelcomeEmail({ full_name, project_type, source, company }) {
  const firstName = full_name?.split(' ')[0] || 'there';
  const projectLabel = PROJECT_TYPE_LABELS[project_type] || 'project';
  const isAngi = source === 'Angi';
  const companyName = company?.company_name || 'Coen Construction';
  const companyPhone = company?.phone || '(508) 555-0100';
  const companyEmail = company?.email || 'info@coenconstruction.com';
  const brandColor = company?.brand_color || '#E35235';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Thank You — ${companyName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:${brandColor};padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">${companyName}</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Licensed General Contractor · Greater Boston, MA</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 18px;font-size:16px;color:#333;line-height:1.6;">Hi <strong>${firstName}</strong>,</p>
              <p style="margin:0 0 18px;font-size:16px;color:#333;line-height:1.6;">
                Thank you for reaching out about your <strong>${projectLabel}</strong>! We've received your inquiry and a member of our team will be in touch with you <strong>within 24 hours</strong> to discuss your project.
              </p>
              <p style="margin:0 0 28px;font-size:16px;color:#333;line-height:1.6;">
                In the meantime, feel free to browse our recent work or learn more about our services on our website.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td style="background:${brandColor};border-radius:6px;padding:0;">
                    <a href="https://www.coenconstruction.com" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;">
                      View Our Work →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- What to Expect -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:8px;border:1px solid #efefef;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1B2B3A;text-transform:uppercase;letter-spacing:0.5px;">What Happens Next</p>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#444;line-height:1.6;">
                          <span style="color:${brandColor};font-weight:700;margin-right:8px;">1.</span> We'll review your project details
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#444;line-height:1.6;">
                          <span style="color:${brandColor};font-weight:700;margin-right:8px;">2.</span> A project coordinator will call you to schedule a free walkthrough
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#444;line-height:1.6;">
                          <span style="color:${brandColor};font-weight:700;margin-right:8px;">3.</span> We'll provide a detailed, itemized estimate at no cost
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:15px;color:#333;line-height:1.6;">Have a question in the meantime? Don't hesitate to reach out:</p>
              <p style="margin:0 0 32px;font-size:15px;color:#333;line-height:1.6;">
                📞 <a href="tel:${companyPhone}" style="color:${brandColor};text-decoration:none;font-weight:600;">${companyPhone}</a>&nbsp;&nbsp;
                ✉️ <a href="mailto:${companyEmail}" style="color:${brandColor};text-decoration:none;font-weight:600;">${companyEmail}</a>
              </p>

              <p style="margin:0;font-size:15px;color:#333;">Warm regards,<br/><strong>The ${companyName} Team</strong></p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#1B2B3A;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.5);line-height:1.8;">
                ${companyName} · Licensed &amp; Insured · Greater Boston, MA<br/>
                You're receiving this because you submitted an inquiry ${isAngi ? 'via Angi' : 'on our website'}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { full_name, email, project_type, source } = await req.json();

    if (!email) {
      return Response.json({ error: 'email is required' }, { status: 400 });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    // Fetch company profile for branding
    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const company = profiles[0] || {};

    const companyName = company.company_name || 'Coen Construction';
    const firstName = full_name?.split(' ')[0] || 'there';
    const projectLabel = PROJECT_TYPE_LABELS[project_type] || 'project';

    const html = buildWelcomeEmail({ full_name, project_type, source, company });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${companyName} <noreply@coenconstruction.com>`,
        to: email,
        subject: `Thanks for reaching out, ${firstName}! Here's what happens next.`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Resend error: ${res.status} — ${err.message || 'Unknown'}`);
    }

    const result = await res.json();
    console.log(`Welcome email sent to ${email} (${full_name}) — Resend ID: ${result.id}`);
    return Response.json({ success: true, resend_id: result.id });

  } catch (error) {
    console.error('sendLeadWelcomeEmail error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});