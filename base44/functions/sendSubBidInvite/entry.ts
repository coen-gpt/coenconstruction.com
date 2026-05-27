import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Generates a unique invite token for a SubBid, saves it, and emails the sub
 * with a branded HTML email containing a direct link to their bid portal.
 * If the SubBid has sow_trade_items, they are included in the email.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sub_bid_id } = await req.json();
    if (!sub_bid_id) return Response.json({ error: 'sub_bid_id required' }, { status: 400 });

    const subBids = await base44.asServiceRole.entities.SubBid.filter({ id: sub_bid_id });
    const subBid = subBids[0];
    if (!subBid) return Response.json({ error: 'SubBid not found' }, { status: 404 });

    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: subBid.project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    // Generate a secure token
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

    // Save token to sub bid
    await base44.asServiceRole.entities.SubBid.update(sub_bid_id, {
      invite_token: token,
      invite_sent_at: new Date().toISOString(),
      status: 'invited',
    });

    // Get company profile for branding
    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const company = profiles[0] || {};
    const companyName = company.company_name || 'Coen Construction';
    const brandColor = company.brand_color || '#E35235';
    const companyEmail = company.email || 'info@coenconstruction.com';
    const companyPhone = company.phone || '';

    const origin = req.headers.get('origin') || 'https://coenconstruction.base44.app';
    const portalUrl = `${origin}/sub-bid-portal?token=${token}`;

    const projectAddress = [project.client_address, project.client_city].filter(Boolean).join(', ');

    // Build SoW items table if available
    const sowItems = subBid.sow_trade_items || [];
    const sowSection = sowItems.length > 0 ? `
      <div style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1B2B3A;text-transform:uppercase;letter-spacing:0.5px;">📋 Scope of Work — ${subBid.trade}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:2px solid #e0e0e0;">
              <th style="text-align:left;padding:6px 8px;color:#666;font-weight:600;">Item</th>
              <th style="text-align:left;padding:6px 8px;color:#666;font-weight:600;">Description</th>
              <th style="text-align:center;padding:6px 8px;color:#666;font-weight:600;">Qty / Unit</th>
            </tr>
          </thead>
          <tbody>
            ${sowItems.map((it, i) => `
              <tr style="border-bottom:1px solid #f0f0f0;background:${i % 2 === 0 ? '#fff' : '#fafafa'};">
                <td style="padding:7px 8px;color:#333;font-weight:600;vertical-align:top;">${it.item || ''}</td>
                <td style="padding:7px 8px;color:#555;vertical-align:top;">${it.description || it.notes || ''}</td>
                <td style="padding:7px 8px;color:#555;text-align:center;vertical-align:top;">${it.quantity ? `${it.quantity} ${it.unit || ''}`.trim() : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>` : project.scope_of_work ? `
      <div style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1B2B3A;text-transform:uppercase;letter-spacing:0.5px;">📋 Scope of Work</p>
        <p style="margin:0;font-size:13px;color:#555;white-space:pre-wrap;line-height:1.6;">${project.scope_of_work}</p>
      </div>` : '';

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });

    const recipientName = subBid.vendor_name || subBid.vendor_company || 'there';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:${brandColor};padding:28px 40px;">
          <table width="100%">
            <tr>
              <td>
                <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${companyName}</h1>
                <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Subcontractor Bid Request</p>
              </td>
              <td align="right">
                <div style="background:rgba(255,255,255,0.15);border-radius:6px;padding:8px 14px;display:inline-block;">
                  <span style="color:#fff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${subBid.trade}</span>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 20px;font-size:16px;color:#333;line-height:1.6;">
            Hi <strong>${recipientName}</strong>,
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
            You've been invited to submit a bid for the <strong>${subBid.trade}</strong> scope on the project below. Please review the scope of work and submit your bid by clicking the button below.
          </p>

          <!-- Project Card -->
          <div style="background:#1B2B3A;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
            <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#fff;">${project.client_name || 'Project'}</p>
            <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.65);">${project.project_type || ''}${projectAddress ? ' · ' + projectAddress : ''}</p>
            <table style="width:100%;font-size:13px;margin-top:12px;">
              ${project.walkthrough_date ? `<tr><td style="color:rgba(255,255,255,0.6);padding:3px 0;width:110px;">Walkthrough</td><td style="color:#fff;font-weight:600;">${new Date(project.walkthrough_date).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</td></tr>` : ''}
            </table>
          </div>

          <!-- SoW Section -->
          ${sowSection}

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
            <tr>
              <td style="background:${brandColor};border-radius:8px;">
                <a href="${portalUrl}" style="display:inline-block;padding:16px 40px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">
                  📋 View Full Scope &amp; Submit Bid →
                </a>
              </td>
            </tr>
          </table>

          <!-- What to expect -->
          <div style="background:#f9f9f9;border-radius:8px;border:1px solid #efefef;padding:20px 24px;margin-bottom:28px;">
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1B2B3A;text-transform:uppercase;letter-spacing:0.5px;">What Happens Next</p>
            <table cellpadding="0" cellspacing="0">
              <tr><td style="padding:5px 0;font-size:13px;color:#555;line-height:1.6;"><span style="color:${brandColor};font-weight:700;margin-right:8px;">1.</span> Click the button above to access your secure bid portal</td></tr>
              <tr><td style="padding:5px 0;font-size:13px;color:#555;line-height:1.6;"><span style="color:${brandColor};font-weight:700;margin-right:8px;">2.</span> Complete the subcontractor packet (first-time only) — takes ~3 minutes</td></tr>
              <tr><td style="padding:5px 0;font-size:13px;color:#555;line-height:1.6;"><span style="color:${brandColor};font-weight:700;margin-right:8px;">3.</span> Upload your quote and submit your bid amount</td></tr>
              <tr><td style="padding:5px 0;font-size:13px;color:#555;line-height:1.6;"><span style="color:${brandColor};font-weight:700;margin-right:8px;">4.</span> You'll be notified of our decision once bids are reviewed</td></tr>
            </table>
          </div>

          <p style="margin:0 0 6px;font-size:14px;color:#333;">Questions? Contact us directly:</p>
          <p style="margin:0;font-size:14px;color:#333;">
            ${companyPhone ? `📞 <a href="tel:${companyPhone}" style="color:${brandColor};text-decoration:none;font-weight:600;">${companyPhone}</a>  &nbsp;` : ''}
            ✉️ <a href="mailto:${companyEmail}" style="color:${brandColor};text-decoration:none;font-weight:600;">${companyEmail}</a>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#1B2B3A;padding:18px 40px;text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.45);line-height:1.8;">
            ${companyName} · Licensed &amp; Insured · Greater Boston, MA<br/>
            This link is unique to you — do not forward or share it.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${companyName} <noreply@coenconstruction.com>`,
        to: subBid.vendor_email,
        subject: `Bid Request — ${project.client_name || 'Project'} · ${subBid.trade} · ${companyName}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      throw new Error(`Resend error: ${emailRes.status} — ${err.message || 'Unknown'}`);
    }

    const emailResult = await emailRes.json();
    console.log(`Sub bid invite sent to ${subBid.vendor_email} — Resend ID: ${emailResult.id}`);

    return Response.json({ success: true, portal_url: portalUrl, resend_id: emailResult.id });
  } catch (error) {
    console.error('sendSubBidInvite error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});