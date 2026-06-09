import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyAdminSession(req, permission, body) {
  const base44 = createClientFromRequest(req);
  const auth = req.headers.get('authorization') || '';
  const token = String(body?.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
  if (!token) throw new Error('Unauthorized');
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) throw new Error('Unauthorized');
  const secret = Deno.env.get('ADMIN_SESSION_SECRET');
  if (!secret || !(await verifySignature(`${header}.${payload}`, signature, secret).catch(() => false))) throw new Error('Unauthorized');
  const session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  if (Number(session.exp || 0) < Math.floor(Date.now() / 1000)) throw new Error('Session expired');
  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: String(session.email || '').toLowerCase() });
  const user = users[0];
  if (!user || user.active === false) throw new Error('Forbidden');
  if (permission && user.role !== 'admin' && !user[permission]) throw new Error('Forbidden');
  return { base44, user };
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { base44, user } = await verifyAdminSession(req, 'can_access_estimates', body);

    const { project_id, channel = 'email', custom_message } = body;

    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

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
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (!RESEND_API_KEY) return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });

      const emailHtml = `
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
            <p style="font-size:12px;color:#888;">This link is personal to you and expires in 90 days.</p>
          </div>
          <div style="background:#1B2B3A;padding:12px;border-radius:0 0 8px 8px;text-align:center;">
            <p style="color:#888;font-size:11px;margin:0;">© ${new Date().getFullYear()} Coen Construction · coenconstruction.com</p>
          </div>
        </div>
      `;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Coen Construction <info@coenconstruction.com>',
          reply_to: 'ops@coenconstruction.com',
          to: project.client_email,
          subject: `Your Project Portal is Ready — ${project.project_type || 'Your Project'}`,
          html: emailHtml,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(`Resend error: ${res.status} — ${err.message || 'Unknown'}`);
      }
    }

    return Response.json({ success: true, portal_url: portalUrl, sent_to: project.client_email });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});