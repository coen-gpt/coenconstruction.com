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

    const { milestone_id, subcontractor_email, project_id, message } = body;

    if (!milestone_id || !subcontractor_email || !project_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    const allMilestones = (project.workflow_stages || []).flatMap(s => s.milestones || []);
    const milestone = allMilestones.find(m => m.id === milestone_id);
    if (!milestone) return Response.json({ error: 'Milestone not found' }, { status: 404 });

    const token = `sub_${milestone_id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const assignment = {
      id: `assign_${Date.now()}`,
      milestone_id,
      subcontractor_email,
      subcontractor_name: '',
      token,
      token_expires: expiresAt,
      assigned_at: new Date().toISOString(),
      assigned_by: user.email,
      status: 'pending',
      started_at: null,
      completed_at: null,
      notes: '',
    };

    const existingAssignments = project.subcontractor_assignments || [];
    await base44.asServiceRole.entities.ContractorProject.update(project_id, {
      subcontractor_assignments: [...existingAssignments, assignment],
    });

    const companyProfiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const company = companyProfiles[0] || { company_name: 'Coen Construction', phone: '(617) 857-COEN', brand_color: '#E35235' };
    const companyName = company.company_name || 'Coen Construction';
    const brandColor = company.brand_color || '#E35235';
    const logoHtml = company?.logo_url
      ? `<img src="${company.logo_url}" alt="${companyName}" height="44" style="display:inline-block;height:44px;max-width:220px;width:auto;background:#ffffff;padding:8px 14px;border-radius:8px;" />`
      : `<span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">${companyName}</span>`;

    const portalUrl = `https://coenconstruction.com/subcontractor-portal?token=${token}&project=${project_id}`;

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${companyName} <noreply@coenconstruction.com>`,
        to: subcontractor_email,
        subject: `Task Assignment: ${milestone.label} - ${project.client_name}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#1B2B3A;padding:28px;border-radius:10px 10px 0 0;">
              ${logoHtml}
              <p style="color:#aaa;margin:10px 0 0;font-size:14px;">Task Assignment</p>
            </div>
            <div style="background:#f9f9f9;border:1px solid #e9ecef;border-top:none;padding:28px;border-radius:0 0 10px 10px;">
              <p style="color:#333;font-size:15px;">Hi there,</p>
              <p style="color:#333;font-size:15px;">You've been assigned to complete the following task:</p>
              <div style="background:#fff;padding:16px;border-radius:8px;border:1px solid #e9ecef;margin:16px 0;">
                <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Task</div>
                <div style="font-size:18px;font-weight:700;color:#1B2B3A;margin-top:4px;">${milestone.label}</div>
              </div>
              <div style="background:#fff;padding:16px;border-radius:8px;border:1px solid #e9ecef;margin:16px 0;">
                <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Project</div>
                <div style="font-size:16px;font-weight:700;color:#1B2B3A;margin-top:4px;">${project.client_name}</div>
                <div style="font-size:14px;color:#666;">${project.client_address || ''}${project.client_city ? ', ' + project.client_city : ''}</div>
              </div>
              ${message ? `<div style="background:#fff3cd;border-left:4px solid #ffc107;padding:14px;border-radius:6px;margin:16px 0;"><strong>Message from PM:</strong><br/>${message}</div>` : ''}
              <div style="text-align:center;margin:24px 0;">
                <a href="${portalUrl}" style="display:inline-block;background:${brandColor};color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">View &amp; Update Task →</a>
              </div>
              <p style="color:#888;font-size:13px;">Questions? Call us at ${company.phone || '(617) 857-COEN'}.</p>
            </div>
          </div>
        `,
      }),
    });

    return Response.json({ success: true, assignment_id: assignment.id, portal_url: portalUrl });
  } catch (error) {
    console.error('Error sending assignment:', error);
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});