import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
    const companyName = company.company_name || 'Your General Contractor';

    const portalUrl = `${req.headers.get('origin') || 'https://app.base44.com'}/sub-bid-portal?token=${token}`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: subBid.vendor_email,
      from_name: companyName,
      subject: `Subcontractor Bid Request — ${project.client_name || 'Project'} (${subBid.trade})`,
      body: `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#1B2B3A;margin-bottom:8px;">${companyName}</h2>
  <p style="color:#555;margin-bottom:24px;">You've been invited to submit a bid for the following project:</p>

  <div style="background:#f4f4f4;border-radius:8px;padding:16px;margin-bottom:24px;">
    <div style="font-weight:600;color:#1B2B3A;font-size:15px;">${project.client_name || 'Project'}</div>
    <div style="color:#666;font-size:13px;margin-top:4px;">${project.project_type || ''} • ${project.client_address || project.client_city || ''}</div>
    <div style="margin-top:8px;padding:6px 12px;background:#E35235;color:#fff;border-radius:4px;display:inline-block;font-size:12px;font-weight:700;">${subBid.trade}</div>
  </div>

  <a href="${portalUrl}"
     style="display:block;background:#E35235;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:8px;font-weight:700;font-size:15px;margin-bottom:16px;">
    View Scope & Submit Your Bid →
  </a>

  <p style="color:#888;font-size:12px;margin-top:16px;">This link is unique to you. Do not share it. If you have questions, reply to this email.</p>
</div>
      `.trim(),
    });

    return Response.json({ success: true, portal_url: portalUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});