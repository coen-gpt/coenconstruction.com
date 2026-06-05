/**
 * Triggered by entity automation when a ProjectTask is updated.
 * If ALL tasks for a given project stage are now "done" or "skipped",
 * this function:
 *   1. Marks every milestone in that stage as done in workflow_stages
 *   2. Sends a notification email to the project manager / assigned estimator
 *
 * The notification recipient is determined in this priority order:
 *   1. project.assigned_to  (the assigned estimator email on the project)
 *   2. company.lead_notification_email (fallback from CompanyProfile)
 *   3. "scott@coenconstruction.com" (hard fallback)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function buildEmailHtml(project, stageName, completedTasks) {
  const taskList = completedTasks.map(t => `<li style="margin-bottom:4px;">${t.title}</li>`).join("");
  return `
    <p>All subcontractor tasks for the <strong>${stageName}</strong> phase on the <strong>${project.project_type || "project"}</strong> for <strong>${project.client_name}</strong> have been completed.</p>
    <p>The phase has been automatically marked as complete in the workflow.</p>
    ${completedTasks.length > 0 ? `<p><strong>Completed tasks:</strong></p><ul>${taskList}</ul>` : ""}
    <p>You may want to review the project and advance to the next phase.</p>
    <br>
    <p>Warm regards,<br><strong>Coen Construction Project System</strong></p>
  `;
}

function brandedWrapper(company, recipientName, bodyContent) {
  const accentColor = company?.brand_color || "#E35235";
  const navyColor = "#1B2B3A";
  const companyName = company?.company_name || "Coen Construction";
  const companyPhone = company?.phone || "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:${navyColor};padding:24px 32px;border-radius:10px 10px 0 0;">
            <span style="color:white;font-size:22px;font-weight:800;">${companyName}</span><br>
            <span style="color:rgba(255,255,255,0.45);font-size:12px;">Project Management System</span>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:32px 36px;border:1px solid #e8e8e8;border-top:none;">
            <p style="font-size:16px;color:#1B2B3A;margin:0 0 20px 0;">Hi ${recipientName},</p>
            ${bodyContent}
          </td>
        </tr>
        <tr>
          <td style="background:${navyColor};padding:18px 32px;border-radius:0 0 10px 10px;">
            <span style="color:rgba(255,255,255,0.5);font-size:12px;">${companyName}</span>
            ${companyPhone ? `<span style="color:rgba(255,255,255,0.3);font-size:12px;"> · ${companyPhone}</span>` : ""}
            <br><span style="color:rgba(255,255,255,0.25);font-size:10px;">© ${new Date().getFullYear()} ${companyName}. Automated project update.</span>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data, old_data } = body;

    // Only process task updates
    if (event?.type !== "update") {
      return Response.json({ skipped: true, reason: "not an update" });
    }

    const task = data;
    const oldTask = old_data;

    // Only care about tasks becoming "done" or "skipped"
    const isNowFinished = ["done", "skipped"].includes(task?.status);
    const wasNotFinished = !["done", "skipped"].includes(oldTask?.status);
    if (!isNowFinished || !wasNotFinished) {
      return Response.json({ skipped: true, reason: "status did not become finished" });
    }

    if (!task?.project_id || !task?.stage_id) {
      return Response.json({ skipped: true, reason: "task missing project_id or stage_id" });
    }

    // Fetch all tasks for this project+stage
    const stageTasks = await base44.asServiceRole.entities.ProjectTask.filter({
      project_id: task.project_id,
      stage_id: task.stage_id,
    });

    if (stageTasks.length === 0) {
      return Response.json({ skipped: true, reason: "no tasks found for stage" });
    }

    // Check if ALL tasks are done/skipped
    const allFinished = stageTasks.every(t => ["done", "skipped"].includes(t.status));
    if (!allFinished) {
      return Response.json({ skipped: true, reason: "not all tasks finished yet" });
    }

    // Fetch the project
    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: task.project_id });
    const project = projects[0];
    if (!project) {
      return Response.json({ skipped: true, reason: "project not found" });
    }

    const stageName = task.stage_name || task.stage_id;

    // Mark all milestones in this stage as done in workflow_stages
    let stageMarked = false;
    const updatedStages = (project.workflow_stages || []).map(stage => {
      if (stage.id !== task.stage_id) return stage;
      stageMarked = true;
      return {
        ...stage,
        milestones: (stage.milestones || []).map(m => ({
          ...m,
          done: true,
          done_at: m.done_at || new Date().toISOString(),
        })),
      };
    });

    if (stageMarked) {
      await base44.asServiceRole.entities.ContractorProject.update(task.project_id, {
        workflow_stages: updatedStages,
        team_messages: [
          ...(project.team_messages || []),
          {
            id: `tm_${Date.now()}`,
            text: `[AUTO] Phase "${stageName}" marked complete — all sub-tasks finished.`,
            author: "System",
            author_email: "system",
            created_at: new Date().toISOString(),
          },
        ],
      });
    }

    // Determine notification recipient
    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const company = profiles[0] || {};

    // Priority: project.assigned_to → company phase_complete_notify_email → company.lead_notification_email → fallback
    const recipientEmail =
      project.assigned_to ||
      company.phase_complete_notify_email ||
      company.lead_notification_email ||
      "scott@coenconstruction.com";

    const recipientName = "Team";

    // Send notification email via Resend directly (no auth needed for internal automated email)
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return Response.json({ ok: true, stage_marked: stageMarked, email_skipped: "no RESEND_API_KEY" });
    }

    const bodyContent = buildEmailHtml(project, stageName, stageTasks.filter(t => t.status === "done"));
    const fullHtml = brandedWrapper(company, recipientName, bodyContent);

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${company.company_name || "Coen Construction"} <info@coenconstruction.com>`,
        reply_to: "ops@coenconstruction.com",
        to: recipientEmail,
        subject: `✅ Phase Complete: ${stageName} — ${project.client_name}`,
        html: fullHtml,
      }),
    });

    return Response.json({
      ok: true,
      stage: stageName,
      stage_marked: stageMarked,
      notified: recipientEmail,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});