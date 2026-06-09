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

// Checks for projects with subcontractors whose critical docs have expired
// for more than 7 days and marks the project "on hold" + notifies the PM.

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { base44 } = await verifyAdminSession(req, 'can_access_team', body);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const APP_BASE_URL = req.headers.get("origin") || "https://coenconstruction.com";
    const now = new Date();
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    async function sendEmail(to, subject, html) {
      if (!RESEND_API_KEY) return;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Coen Construction <info@coenconstruction.com>",
          reply_to: "pm@coenconstruction.com",
          to,
          subject,
          html,
        }),
      });
    }

    // Load all active / in_progress projects and all subcontractors
    const [projects, vendors] = await Promise.all([
      base44.asServiceRole.entities.ContractorProject.filter({ status: "in_progress" }),
      base44.asServiceRole.entities.Vendor.filter({ is_subcontractor: true }),
    ]);

    const vendorByEmail = {};
    for (const v of vendors) {
      if (v.email) vendorByEmail[v.email.toLowerCase()] = v;
    }

    const results = [];

    for (const project of projects) {
      const assignments = project.subcontractor_assignments || [];
      if (assignments.length === 0) continue;

      // Find any assigned sub with expired critical docs (expired > 7 days ago)
      const offendingSubs = [];
      for (const a of assignments) {
        if (!a.subcontractor_email) continue;
        const vendor = vendorByEmail[a.subcontractor_email.toLowerCase()];
        if (!vendor) continue;

        const wcExp = vendor.workers_comp_expiry ? new Date(vendor.workers_comp_expiry) : null;
        const glExp = vendor.liability_ins_expiry ? new Date(vendor.liability_ins_expiry) : null;
        const wcExpiredDaysAgo = wcExp && wcExp < now ? Math.floor((now - wcExp) / (1000 * 60 * 60 * 24)) : 0;
        const glExpiredDaysAgo = glExp && glExp < now ? Math.floor((now - glExp) / (1000 * 60 * 60 * 24)) : 0;

        // Critical = expired AND has been expired for more than 7 days
        const criticalWc = wcExpiredDaysAgo >= 7;
        const criticalGl = glExpiredDaysAgo >= 7;

        if (criticalWc || criticalGl) {
          offendingSubs.push({
            name: a.subcontractor_name || vendor.company_name,
            email: a.subcontractor_email,
            wcExpiredDaysAgo: criticalWc ? wcExpiredDaysAgo : null,
            glExpiredDaysAgo: criticalGl ? glExpiredDaysAgo : null,
            portalUrl: `${APP_BASE_URL}/sub-doc-upload?vendor=${vendor.id}`,
          });
        }
      }

      if (offendingSubs.length === 0) continue;

      // Put project on hold
      await base44.asServiceRole.entities.ContractorProject.update(project.id, {
        status: "on_hold",
        internal_notes: (project.internal_notes ? project.internal_notes + "\n\n" : "") +
          `[AUTO ${now.toLocaleDateString()}] Project placed on hold — expired subcontractor insurance: ${offendingSubs.map(s => s.name).join(", ")}`,
      });

      // Notify PM
      const pmEmail = project.assigned_to || "pm@coenconstruction.com";
      const subList = offendingSubs.map(s => `
        <li style="margin-bottom:10px;">
          <strong>${s.name}</strong> (${s.email})<br>
          ${s.wcExpiredDaysAgo ? `<span style="color:#DC2626;">Workers Comp expired ${s.wcExpiredDaysAgo} days ago</span><br>` : ""}
          ${s.glExpiredDaysAgo ? `<span style="color:#DC2626;">General Liability expired ${s.glExpiredDaysAgo} days ago</span><br>` : ""}
          <a href="${s.portalUrl}" style="color:#E35235;font-size:12px;">→ Upload Portal</a>
        </li>
      `).join("");

      const projectUrl = `${APP_BASE_URL}/estimator/projects/${project.id}`;
      const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:#1B2B3A;padding:24px 32px;">
    <div style="background:#E35235;display:inline-block;padding:8px 14px;border-radius:8px;margin-bottom:12px;">
      <span style="color:white;font-weight:700;font-size:13px;">COEN CONSTRUCTION</span>
    </div>
    <h1 style="margin:0;color:white;font-size:20px;font-weight:700;">⚠️ Project Placed On Hold</h1>
  </td></tr>
  <tr><td style="padding:32px;">
    <p style="color:#374151;margin:0 0 16px;">Hi,</p>
    <p style="color:#374151;margin:0 0 16px;">
      The following project has been <strong style="color:#DC2626;">automatically placed on hold</strong> because one or more assigned subcontractors have critical insurance documents that expired more than 7 days ago:
    </p>
    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <div style="font-weight:700;color:#1B2B3A;font-size:16px;">${project.client_name}</div>
      <div style="color:#6B7280;font-size:13px;margin-top:4px;">${project.project_type || ""} · ${project.client_city || ""}</div>
    </div>
    <p style="color:#374151;font-weight:600;margin:0 0 10px;">Subcontractors with expired insurance:</p>
    <ul style="padding-left:20px;margin:0 0 24px;color:#374151;">
      ${subList}
    </ul>
    <p style="color:#374151;margin:0 0 20px;">
      <strong>Action required:</strong> Contact the subcontractor(s) to upload updated certificates. Once all compliance documents are current, you can manually change the project status back to "In Progress."
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background:#E35235;border-radius:10px;">
          <a href="${projectUrl}" style="display:block;padding:14px 28px;color:white;font-weight:700;font-size:15px;text-decoration:none;">
            View Project →
          </a>
        </td>
      </tr>
    </table>
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">
    <p style="color:#6B7280;font-size:12px;">This is an automated alert from the Coen Construction compliance system.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

      await sendEmail(pmEmail, `⚠️ Project On Hold: ${project.client_name} — Expired Sub Insurance`, html);

      results.push({
        project: project.client_name,
        project_id: project.id,
        put_on_hold: true,
        pm_notified: pmEmail,
        offending_subs: offendingSubs.map(s => s.name),
      });
    }

    return Response.json({
      success: true,
      projects_checked: projects.length,
      projects_put_on_hold: results.length,
      results,
    });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});