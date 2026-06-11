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
    const body = await req.json().catch(() => ({}));
    const { base44 } = await verifyAdminSession(req, 'can_access_estimates', body);
    
    // Service role for admin operations
    const serviceBase44 = base44.asServiceRole;
    
    // Get all active projects (in_progress status)
    const projects = await serviceBase44.entities.ContractorProject.filter({
      status: "in_progress"
    });

    // Get all open tasks
    const openTasks = await serviceBase44.entities.ProjectTask.filter({
      status: "open"
    });

    // Get all vendors/subcontractors with pending docs
    const vendors = await serviceBase44.entities.Vendor.filter({
      is_subcontractor: true
    });

    // Group projects by assigned PM (using assigned_to field or internal notes)
    const pmProjects = {};
    
    for (const project of projects) {
      // Try to find PM from assigned_to, or use client contact as fallback
      const pmKey = project.assigned_to || "unassigned";
      if (!pmProjects[pmKey]) {
        pmProjects[pmKey] = [];
      }
      pmProjects[pmKey].push(project);
    }

    // Send weekly summary to each PM
    const results = [];
    
    for (const [pmEmail, pmProjectList] of Object.entries(pmProjects)) {
      if (!pmEmail || pmEmail === "unassigned") continue;

      const summary = await generateWeeklySummary(pmEmail, pmProjectList, openTasks, vendors);
      
      if (summary.hasContent) {
        const sent = await sendEmailSafe(base44, {
          to: pmEmail,
          subject: `📋 Weekly Project Summary - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
          html: summary.html,
        });
        results.push({ pm: pmEmail, sent, projectCount: pmProjectList.length });
      } else {
        results.push({ pm: pmEmail, sent: false, reason: "no_content" });
      }
    }

    return Response.json({ 
      success: true, 
      summariesSent: results.filter(r => r.sent).length,
      results 
    });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});

async function generateWeeklySummary(pmEmail, projects, allOpenTasks, vendors) {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Filter tasks for this PM's projects
  const projectIds = projects.map(p => p.id);
  const pmTasks = allOpenTasks.filter(t => projectIds.includes(t.project_id));
  
  // Group tasks by status
  const openTasks = pmTasks.filter(t => t.status === "open");
  const inProgressTasks = pmTasks.filter(t => t.status === "in_progress");
  
  // Find subs with pending/invalid insurance
  const subsWithPendingDocs = vendors.filter(v => 
    v.is_subcontractor && 
    (!["completed", "approved"].includes(v.packet_status) || v.insurance_status === "pending" || v.insurance_status === "expired")
  );

  // Check if there's any content to send
  const hasContent = projects.length > 0 && (openTasks.length > 0 || inProgressTasks.length > 0);
  
  if (!hasContent && subsWithPendingDocs.length === 0) {
    return { hasContent: false, html: "" };
  }

  // Build project summaries
  const projectSections = projects.map(project => {
    const projectTasks = pmTasks.filter(t => t.project_id === project.id);
    const openCount = projectTasks.filter(t => t.status === "open").length;
    const inProgressCount = projectTasks.filter(t => t.status === "in_progress").length;
    const doneCount = projectTasks.filter(t => t.status === "done").length;
    
    // Get workflow stage
    const currentStage = project.workflow_stages?.find(s => 
      s.milestones?.some(m => !m.done)
    )?.name || "Active";
    
    return `
      <tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb;">
          <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">${project.client_name}</div>
          <div style="font-size: 13px; color: #6b7280;">${project.project_type || "Project"}</div>
          <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">${project.client_address || ""}</div>
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb;">
          <span style="display: inline-block; padding: 4px 10px; background: #dbeafe; color: #1e40af; border-radius: 12px; font-size: 12px; font-weight: 600;">
            ${currentStage}
          </span>
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <span style="font-weight: 600; color: #dc2626;">${openCount}</span>
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <span style="font-weight: 600; color: #f59e0b;">${inProgressCount}</span>
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <span style="font-weight: 600; color: #059669;">${doneCount}</span>
        </td>
      </tr>
    `;
  }).join("");

  // Build task list
  const taskList = openTasks.slice(0, 10).map(task => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
        <div style="font-size: 13px; color: #374151; margin-bottom: 2px;">${task.title}</div>
        <div style="font-size: 12px; color: #9ca3af;">
          ${task.assigned_role ? `<span style="background: #f3f4f6; padding: 2px 8px; border-radius: 10px; margin-right: 6px;">${task.assigned_role.replace('_', ' ')}</span>` : ""}
          ${task.due_date ? `Due: ${new Date(task.due_date).toLocaleDateString()}` : ""}
        </div>
      </td>
    </tr>
  `).join("");

  // Build subs with pending docs
  const subsList = subsWithPendingDocs.slice(0, 5).map(sub => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
        <div style="font-size: 13px; color: #374151; font-weight: 500;">${sub.company_name}</div>
        <div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">
          ${sub.insurance_status === "expired" ? "⚠️ Insurance expired" : 
            sub.insurance_status === "pending" ? "📄 Insurance pending" : 
            "📋 Packet incomplete"}
        </div>
      </td>
    </tr>
  `).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1B2B3A 0%, #2C3E50 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
        .stat-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
        .stat-number { font-size: 28px; font-weight: 700; color: #E35235; }
        .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th { text-align: left; padding: 10px 8px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; }
        .btn { display: inline-block; padding: 10px 20px; background: #E35235; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">📋 Weekly Project Summary</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        <!-- Stats Overview -->
        <table style="margin-bottom: 24px;">
          <tr>
            <td class="stat-box">
              <div class="stat-number">${projects.length}</div>
              <div class="stat-label">Active Projects</div>
            </td>
            <td class="stat-box">
              <div class="stat-number" style="color: #dc2626;">${openTasks.length}</div>
              <div class="stat-label">Open Tasks</div>
            </td>
            <td class="stat-box">
              <div class="stat-number" style="color: #f59e0b;">${inProgressTasks.length}</div>
              <div class="stat-label">In Progress</div>
            </td>
            <td class="stat-box">
              <div class="stat-number" style="color: #dc2626;">${subsWithPendingDocs.length}</div>
              <div class="stat-label">Subs w/ Pending Docs</div>
            </td>
          </tr>
        </table>

        <!-- Active Projects Table -->
        ${projects.length > 0 ? `
          <h2 style="font-size: 18px; margin: 24px 0 12px 0; color: #1f2937;">🏗️ Active Projects</h2>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Stage</th>
                <th style="text-align: center;">Open</th>
                <th style="text-align: center;">In Progress</th>
                <th style="text-align: center;">Done</th>
              </tr>
            </thead>
            <tbody>
              ${projectSections}
            </tbody>
          </table>
        ` : ""}

        <!-- Priority Tasks -->
        ${openTasks.length > 0 ? `
          <h2 style="font-size: 18px; margin: 24px 0 12px 0; color: #1f2937;">⚠️ Priority Open Tasks</h2>
          <table>
            <tbody>
              ${taskList}
            </tbody>
          </table>
          ${openTasks.length > 10 ? `<p style="font-size: 13px; color: #6b7280; text-align: center; margin-top: 12px;">+ ${openTasks.length - 10} more tasks in dashboard</p>` : ""}
        ` : ""}

        <!-- Subcontractors with Pending Docs -->
        ${subsWithPendingDocs.length > 0 ? `
          <h2 style="font-size: 18px; margin: 24px 0 12px 0; color: #1f2937;">📄 Subcontractors Needing Attention</h2>
          <table>
            <tbody>
              ${subsList}
            </tbody>
          </table>
          ${subsWithPendingDocs.length > 5 ? `<p style="font-size: 13px; color: #6b7280; text-align: center; margin-top: 12px;">+ ${subsWithPendingDocs.length - 5} more in vendor dashboard</p>` : ""}
        ` : ""}

        <!-- CTA Button -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="https://your-app.com/estimator" class="btn">Go to Dashboard</a>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 32px;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            This is an automated weekly summary from Coen Construction Project Management System.<br>
            Questions? Contact your system administrator.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { hasContent: true, html };
}