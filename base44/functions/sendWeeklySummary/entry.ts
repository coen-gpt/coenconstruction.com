import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all data needed
    const [projects, tasks, vendors] = await Promise.all([
      base44.asServiceRole.entities.ContractorProject.list('-updated_date', 500),
      base44.asServiceRole.entities.ProjectTask.list('-created_date', 1000),
      base44.asServiceRole.entities.Vendor.list(),
    ]);

    // Only consider active projects (in_progress or approved)
    const activeProjects = projects.filter(p =>
      ['in_progress', 'approved'].includes(p.status)
    );

    // Group projects by assigned_to (PM email)
    const byPm = {};
    for (const project of activeProjects) {
      const pm = project.assigned_to || 'unassigned';
      if (!byPm[pm]) byPm[pm] = [];
      byPm[pm].push(project);
    }

    // Subcontractors with missing/expiring docs
    const today = new Date();
    const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const subIssues = vendors.filter(v => {
      if (!v.is_subcontractor) return false;
      if (v.insurance_status === 'expired' || v.insurance_status === 'expiring_soon') return true;
      if (!v.workers_comp_url || !v.liability_ins_url || !v.w9_url) return true;
      return false;
    });

    const sentTo = [];

    for (const [pmEmail, pmProjects] of Object.entries(byPm)) {
      if (pmEmail === 'unassigned') continue;

      // Open / in-progress tasks for this PM's projects
      const projectIds = new Set(pmProjects.map(p => p.id));
      const pmTasks = tasks.filter(t =>
        projectIds.has(t.project_id) && ['open', 'in_progress'].includes(t.status)
      );

      const openTasks = pmTasks.filter(t => t.status === 'open');
      const inProgressTasks = pmTasks.filter(t => t.status === 'in_progress');
      const highPriorityTasks = pmTasks.filter(t => t.priority === 'high');

      // Sub compliance issues linked to these projects (via subcontractor_assignments)
      const assignedSubEmails = new Set(
        pmProjects.flatMap(p =>
          (p.subcontractor_assignments || []).map(a => a.subcontractor_email)
        )
      );
      const relevantSubIssues = subIssues.filter(v => assignedSubEmails.has(v.email));

      // Build email HTML
      const taskRows = pmTasks.slice(0, 20).map(task => {
        const proj = pmProjects.find(p => p.id === task.project_id);
        const priority = task.priority === 'high'
          ? '<span style="color:#E35235;font-weight:bold;">HIGH</span>'
          : task.priority === 'normal' ? 'Normal' : 'Low';
        return `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;">${task.title}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#555;">${proj?.client_name || '—'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${priority}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#555;">${task.status.replace('_', ' ')}</td>
          </tr>`;
      }).join('');

      const subRows = relevantSubIssues.map(v => {
        const issue = v.insurance_status === 'expired' ? '🔴 Insurance Expired'
          : v.insurance_status === 'expiring_soon' ? '🟡 Expiring Soon'
          : '⚠️ Missing Documents';
        return `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;">${v.company_name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${issue}</td>
          </tr>`;
      }).join('');

      const projectSummaryRows = pmProjects.map(p => {
        const pTasks = pmTasks.filter(t => t.project_id === p.id);
        return `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;">${p.client_name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#555;">${p.project_type || '—'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${p.status.replace('_', ' ')}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#555;">${pTasks.length} open tasks</td>
          </tr>`;
      }).join('');

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1B2B3A;padding:28px 32px;">
            <div style="color:#E35235;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Weekly Project Summary</div>
            <div style="color:#fff;font-size:22px;font-weight:700;">Your Projects This Week</div>
            <div style="color:rgba(255,255,255,0.4);font-size:13px;margin-top:4px;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </td>
        </tr>

        <!-- Stats bar -->
        <tr>
          <td style="padding:20px 32px;background:#fafafa;border-bottom:1px solid #eee;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px;">
                  <div style="font-size:28px;font-weight:700;color:#1B2B3A;">${pmProjects.length}</div>
                  <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Active Jobs</div>
                </td>
                <td align="center" style="padding:8px;border-left:1px solid #eee;">
                  <div style="font-size:28px;font-weight:700;color:#E35235;">${highPriorityTasks.length}</div>
                  <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">High Priority</div>
                </td>
                <td align="center" style="padding:8px;border-left:1px solid #eee;">
                  <div style="font-size:28px;font-weight:700;color:#f59e0b;">${openTasks.length}</div>
                  <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Open Tasks</div>
                </td>
                <td align="center" style="padding:8px;border-left:1px solid #eee;">
                  <div style="font-size:28px;font-weight:700;color:#6b7280;">${relevantSubIssues.length}</div>
                  <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Sub Issues</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr><td style="padding:28px 32px;">

          <!-- Active Projects -->
          <div style="font-size:15px;font-weight:700;color:#1B2B3A;margin-bottom:12px;">📋 Active Projects</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:28px;">
            <thead>
              <tr style="background:#f7f8fa;">
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Client</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Type</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Status</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Tasks</th>
              </tr>
            </thead>
            <tbody>${projectSummaryRows || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#aaa;font-size:13px;">No active projects</td></tr>'}</tbody>
          </table>

          ${pmTasks.length > 0 ? `
          <!-- Open Tasks -->
          <div style="font-size:15px;font-weight:700;color:#1B2B3A;margin-bottom:12px;">✅ Open Tasks</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:28px;">
            <thead>
              <tr style="background:#f7f8fa;">
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Task</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Project</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Priority</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Status</th>
              </tr>
            </thead>
            <tbody>${taskRows}</tbody>
          </table>
          ` : ''}

          ${relevantSubIssues.length > 0 ? `
          <!-- Sub Compliance -->
          <div style="font-size:15px;font-weight:700;color:#1B2B3A;margin-bottom:12px;">⚠️ Subcontractor Documents Needed</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fbbf24;border-radius:8px;overflow:hidden;background:#fffbeb;margin-bottom:28px;">
            <thead>
              <tr style="background:#fef3c7;">
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;">Subcontractor</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;">Issue</th>
              </tr>
            </thead>
            <tbody>${subRows}</tbody>
          </table>
          ` : '<div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin-bottom:28px;color:#065f46;font-size:13px;">✅ All subcontractor documents are in order.</div>'}

          <!-- CTA -->
          <div style="text-align:center;margin-top:8px;">
            <a href="${Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com'}/estimator/tasks" style="display:inline-block;background:#E35235;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">View All Tasks →</a>
          </div>

        </td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #eee;text-align:center;">
            <div style="font-size:11px;color:#aaa;">This is an automated weekly summary. Reply to this email or visit the estimator suite to manage your projects.</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: pmEmail,
        subject: `📋 Weekly Summary: ${pmProjects.length} active jobs, ${openTasks.length} open tasks`,
        html,
      });

      sentTo.push({ email: pmEmail, projects: pmProjects.length, tasks: pmTasks.length, subIssues: relevantSubIssues.length });
    }

    return Response.json({ ok: true, sent: sentTo.length, details: sentTo });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});