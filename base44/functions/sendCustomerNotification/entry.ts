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

    const { project_id, type, note_text, note_id } = body;

    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    const portals = await base44.asServiceRole.entities.CustomerPortal.filter({ project_id });
    const portal = portals[0];
    if (!portal) return Response.json({ skipped: true, reason: 'No portal record' });

    const portalUrl = `https://coenconstruction.com/customer-portal?token=${portal.portal_token}`;

    const shouldNotify = {
      status_change: portal.notify_on_status_change,
      customer_note: portal.notify_on_customer_note,
      estimate_sent: portal.notify_on_estimate,
      change_order: portal.notify_on_change_order,
    };

    if (!shouldNotify[type] || !portal.email_notifications) {
      return Response.json({ skipped: true, reason: 'Notifications disabled by customer preference' });
    }

    const statusLabels = {
      in_progress: 'In Progress 🚧',
      approved: 'Approved ✅',
      completed: 'Completed 🎉',
      modify: 'Modification Requested',
      denied: 'Not Approved',
      walkthrough: 'Walkthrough Scheduled',
      draft: 'Estimate Being Prepared',
      pending_review: 'Awaiting Your Review',
    };

    let subject, bodyContent;

    switch (type) {
      case 'status_change':
        subject = `Project Update: ${statusLabels[project.status] || project.status} — Coen Construction`;
        bodyContent = `
          <p>We have an update on your <strong>${project.project_type || 'project'}</strong>!</p>
          <div style="background:#f0f9f4;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
            <p style="font-size:18px;font-weight:bold;color:#1B2B3A;margin:0;">
              Status: ${statusLabels[project.status] || project.status}
            </p>
          </div>
        `;
        break;
      case 'customer_note':
        subject = `New Update on Your Project — Coen Construction`;
        bodyContent = `
          <p>Your Project Manager has posted a new update:</p>
          <div style="background:#fff7ed;border-left:4px solid #E35235;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
            <p style="color:#1B2B3A;margin:0;font-size:15px;">${note_text}</p>
          </div>
        `;
        break;
      case 'estimate_sent':
        subject = `Your Estimate is Ready — Coen Construction`;
        bodyContent = `<p>Your estimate for <strong>${project.project_type}</strong> is ready for review in your portal.</p>`;
        break;
      case 'change_order':
        subject = `Change Order Update — Coen Construction`;
        bodyContent = `<p>A change order has been issued for your project. Please review it in your portal.</p>`;
        break;
      default:
        subject = `Project Update — Coen Construction`;
        bodyContent = `<p>There is a new update on your project. Please check your portal.</p>`;
    }

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1B2B3A;padding:20px;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:20px;">Coen Construction</h1>
        </div>
        <div style="background:#f9f9f9;padding:24px;border:1px solid #eee;border-top:none;">
          <p style="font-size:16px;color:#1B2B3A;">Hi ${portal.client_name},</p>
          ${bodyContent}
          <div style="margin:24px 0;text-align:center;">
            <a href="${portalUrl}" style="background:#E35235;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">
              View Your Project Portal →
            </a>
          </div>
        </div>
        <div style="background:#1B2B3A;padding:12px;border-radius:0 0 8px 8px;text-align:center;">
          <p style="color:#888;font-size:11px;margin:0;">© ${new Date().getFullYear()} Coen Construction · coenconstruction.com</p>
        </div>
      </div>
    `;

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Coen Construction <info@coenconstruction.com>',
        reply_to: 'ops@coenconstruction.com',
        to: portal.client_email,
        subject,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Resend error: ${res.status} — ${err.message || 'Unknown'}`);
    }

    return Response.json({ success: true, sent_to: portal.client_email });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});