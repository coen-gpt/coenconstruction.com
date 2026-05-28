import { verifyAdminSession } from '../_shared/adminSession.ts';

Deno.serve(async (req) => {
  try {
    const { base44, user } = await verifyAdminSession(req, 'can_access_estimates');

    const { project_id, channel = 'email', custom_message } = await req.json();

    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    // Create or refresh portal record
    let portals = await base44.asServiceRole.entities.CustomerPortal.filter({ project_id });
    let portal = portals[0];
    const token = crypto.randomUUID().replace(/-/g, '');
    const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    if (!portal) {
      portal = await base44.asServiceRole.entities.CustomerPortal.create({
        project_id,
        client_email: project.client_email,
        client_name: project.client_name,
        client_phone: project.client_phone || '',
        portal_token: token,
        portal_token_expires: expires,
        portal_sent_at: new Date().toISOString(),
        email_notifications: true,
        notify_on_estimate: true,
        notify_on_change_order: true,
        notify_on_status_change: true,
        notify_on_customer_note: true,
      });
    } else {
      await base44.asServiceRole.entities.CustomerPortal.update(portal.id, {
        portal_token: token,
        portal_token_expires: expires,
        portal_sent_at: new Date().toISOString(),
        client_email: project.client_email,
        client_name: project.client_name,
      });
      portal = { ...portal, portal_token: token };
    }

    const appUrl = 'https://coenconstruction.com';
    const portalUrl = `${appUrl}/customer-portal?token=${token}`;
    const customMsg = custom_message ? `<p style="margin-bottom:16px;">${custom_message}</p>` : '';

    if (channel === 'email' && project.client_email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: project.client_email,
        from_name: 'Coen Construction',
        subject: `Your Project Portal is Ready — ${project.project_type || 'Your Project'}`,
        body: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#1B2B3A;padding:24px;border-radius:8px 8px 0 0;">
              <h1 style="color:white;margin:0;font-size:22px;">Coen Construction</h1>
              <p style="color:#aaa;margin:4px 0 0;font-size:13px;">Your Personal Project Portal</p>
            </div>
            <div style="background:#f9f9f9;padding:24px;border:1px solid #eee;border-top:none;">
              <p style="font-size:16px;color:#1B2B3A;">Hi ${project.client_name},</p>
              ${customMsg}
              <p>We've set up a personal project portal for your <strong>${project.project_type || 'project'}</strong> at ${project.client_address || project.client_city || 'your property'}.</p>
              <p>In your portal you can:</p>
              <ul style="color:#444;line-height:1.8;">
                <li>📋 View your estimate and project details</li>
                <li>📸 See site photos from your walkthrough</li>
                <li>💬 Chat with your AI Project Manager for real-time updates</li>
                <li>🔔 Receive notifications on project milestones</li>
              </ul>
              <div style="margin:28px 0;text-align:center;">
                <a href="${portalUrl}" style="background:#E35235;color:white;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px;">
                  Open Your Project Portal →
                </a>
              </div>
              <p style="font-size:12px;color:#888;">This link is personal to you and expires in 90 days. If you have any questions, reply to this email or use the chat in your portal.</p>
            </div>
            <div style="background:#1B2B3A;padding:12px;border-radius:0 0 8px 8px;text-align:center;">
              <p style="color:#888;font-size:11px;margin:0;">© ${new Date().getFullYear()} Coen Construction · coenconstruction.com</p>
            </div>
          </div>
        `,
      });
    }

    return Response.json({ success: true, portal_url: portalUrl, sent_to: project.client_email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
