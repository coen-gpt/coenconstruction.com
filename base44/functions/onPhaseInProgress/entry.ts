/**
 * Triggered by entity automation whenever a ContractorProject workflow_stages changes.
 * Detects when a stage becomes active (has in-progress milestones) and creates
 * role-specific task checklists for the relevant team member.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Role-based task templates keyed by stage id
const STAGE_TASK_TEMPLATES = {
  pre_construction: {
    assigned_role: "estimator",
    tasks: [
      {
        title: "Confirm permits are submitted",
        priority: "high",
        checklist: [
          { id: "c1", label: "Submit building permit application", done: false },
          { id: "c2", label: "Confirm permit fees paid", done: false },
          { id: "c3", label: "Set up permit tracking reminder", done: false },
        ]
      },
      {
        title: "Order materials for project start",
        priority: "high",
        checklist: [
          { id: "c1", label: "Review material take-off with client", done: false },
          { id: "c2", label: "Place orders with supply houses", done: false },
          { id: "c3", label: "Confirm delivery dates", done: false },
        ]
      },
      {
        title: "Schedule subcontractors",
        priority: "normal",
        checklist: [
          { id: "c1", label: "Confirm sub availability", done: false },
          { id: "c2", label: "Send scope of work to each sub", done: false },
          { id: "c3", label: "Add subs to project calendar", done: false },
        ]
      }
    ]
  },
  demo_framing: {
    assigned_role: "field_lead",
    tasks: [
      {
        title: "Demo & Framing kickoff checklist",
        priority: "high",
        checklist: [
          { id: "c1", label: "Site protection / dust barriers in place", done: false },
          { id: "c2", label: "Demo waste disposal arranged", done: false },
          { id: "c3", label: "Framing lumber on site", done: false },
          { id: "c4", label: "Structural engineer sign-off (if needed)", done: false },
        ]
      }
    ]
  },
  rough_ins: {
    assigned_role: "project_manager",
    tasks: [
      {
        title: "Coordinate rough-in inspections",
        priority: "high",
        checklist: [
          { id: "c1", label: "Schedule electrical rough inspection", done: false },
          { id: "c2", label: "Schedule plumbing rough inspection", done: false },
          { id: "c3", label: "Schedule HVAC rough inspection", done: false },
          { id: "c4", label: "Insulation complete before inspection", done: false },
        ]
      }
    ]
  },
  finishes: {
    assigned_role: "project_manager",
    tasks: [
      {
        title: "Finishes stage quality walkthrough",
        priority: "normal",
        checklist: [
          { id: "c1", label: "Drywall tape & mud inspection", done: false },
          { id: "c2", label: "Paint color approval from client", done: false },
          { id: "c3", label: "Flooring installation scheduled", done: false },
          { id: "c4", label: "Cabinet delivery confirmed", done: false },
        ]
      },
      {
        title: "Client mid-point check-in",
        priority: "normal",
        checklist: [
          { id: "c1", label: "Send progress update email to client", done: false },
          { id: "c2", label: "Address any open client questions", done: false },
          { id: "c3", label: "Document any scope change requests", done: false },
        ]
      }
    ]
  },
  final: {
    assigned_role: "estimator",
    tasks: [
      {
        title: "Final close-out checklist",
        priority: "high",
        checklist: [
          { id: "c1", label: "Schedule final inspection with municipality", done: false },
          { id: "c2", label: "Complete punch list walkthrough with client", done: false },
          { id: "c3", label: "Invoice final payment", done: false },
          { id: "c4", label: "Collect client sign-off", done: false },
          { id: "c5", label: "Deliver warranty documentation", done: false },
          { id: "c6", label: "Request Google review from client", done: false },
        ]
      }
    ]
  }
};

function detectNewlyActiveStage(oldStages, newStages) {
  if (!oldStages || !newStages) return null;

  for (const newStage of newStages) {
    const oldStage = oldStages.find(s => s.id === newStage.id);
    if (!oldStage) continue;

    const oldDone = (oldStage.milestones || []).filter(m => m.done).length;
    const newDone = (newStage.milestones || []).filter(m => m.done).length;
    const total = (newStage.milestones || []).length;

    // Stage just became active: went from 0 done to at least 1 done (and not fully complete)
    if (oldDone === 0 && newDone > 0 && newDone < total) {
      return newStage;
    }
    // Also catch: first milestone marked done while none were done
    if (oldDone === 0 && newDone === 1) {
      return newStage;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data, old_data } = body;

    if (event?.type !== "update") {
      return Response.json({ skipped: true, reason: "not an update event" });
    }

    const project = data;
    const oldProject = old_data;

    // Detect project moving into Pre-Construction (in_progress) status
    const movedToPreCon = oldProject?.status !== "in_progress" && project?.status === "in_progress";
    if (movedToPreCon) {
      // Notify all field crew users
      const adminUsers = await base44.asServiceRole.entities.AdminUser.list();
      const fieldCrew = adminUsers.filter(u => u.role === "field_crew" && u.active !== false);

      if (fieldCrew.length > 0) {
        const projectName = `${project.client_name}${project.client_city ? ` — ${project.client_city}` : ""}`;
        const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  <div style="background:#1B2B3A;padding:24px 28px;">
    <h1 style="color:white;margin:0;font-size:18px;">🏗️ New Project Moving to Pre-Construction</h1>
  </div>
  <div style="padding:24px 28px;">
    <p style="color:#333;font-size:15px;margin:0 0 16px;">A project has entered the <strong>Pre-Construction</strong> phase and is being prepared for active work.</p>
    <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:20px;">
      <div style="font-size:13px;color:#666;margin-bottom:4px;">Project</div>
      <div style="font-size:17px;font-weight:700;color:#1B2B3A;">${projectName}</div>
      ${project.project_type ? `<div style="font-size:13px;color:#888;margin-top:4px;">${project.project_type}</div>` : ""}
      ${project.client_address ? `<div style="font-size:13px;color:#888;margin-top:4px;">📍 ${project.client_address}${project.client_city ? ", " + project.client_city : ""}</div>` : ""}
    </div>
    <p style="color:#555;font-size:14px;">Materials are being ordered and subcontractors are being scheduled. Watch for your assignment in the Field Crew app.</p>
  </div>
</div></body></html>`;

        await Promise.all(fieldCrew.map(crew =>
          base44.asServiceRole.integrations.Core.SendEmail({
            to: crew.email,
            subject: `🏗️ Pre-Construction Started: ${projectName}`,
            html,
          })
        ));
      }
    }

    if (!project?.workflow_stages || !oldProject?.workflow_stages) {
      return Response.json({ skipped: true, reason: "no workflow stages", precon_notified: movedToPreCon });
    }

    const activeStage = detectNewlyActiveStage(oldProject.workflow_stages, project.workflow_stages);

    if (!activeStage) {
      return Response.json({ skipped: true, reason: "no newly active stage detected" });
    }

    const templates = STAGE_TASK_TEMPLATES[activeStage.id];
    if (!templates) {
      return Response.json({ skipped: true, reason: `no templates for stage: ${activeStage.id}` });
    }

    // Check if tasks already exist for this project + stage to avoid duplication
    const existingTasks = await base44.asServiceRole.entities.ProjectTask.filter({
      project_id: project.id,
      stage_id: activeStage.id,
    });

    if (existingTasks.length > 0) {
      return Response.json({ skipped: true, reason: "tasks already exist for this stage" });
    }

    // Determine assigned_to from the project (use assigned estimator or leave blank)
    const assignedTo = project.assigned_to || null;

    const tasksToCreate = templates.tasks.map(t => ({
      project_id: project.id,
      stage_id: activeStage.id,
      stage_name: activeStage.name,
      title: t.title,
      assigned_role: templates.assigned_role,
      assigned_to: assignedTo,
      priority: t.priority,
      status: "open",
      checklist: t.checklist,
      trigger_source: "phase_in_progress",
    }));

    const created = await Promise.all(
      tasksToCreate.map(task => base44.asServiceRole.entities.ProjectTask.create(task))
    );

    return Response.json({
      success: true,
      stage: activeStage.name,
      tasks_created: created.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});