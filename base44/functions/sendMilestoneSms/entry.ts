import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { entity_name, entity_id, data, old_data, changed_fields } = await req.json();

    // Check if a milestone was just marked as complete
    if (!changed_fields) {
      return Response.json({ status: 'skipped', reason: 'no changed fields' });
    }

    const project = await base44.entities.ContractorProject.get(entity_id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get client phone
    let clientPhone = project.client_phone;
    if (!clientPhone) {
      const portal = await base44.entities.CustomerPortal.filter({ project_id: entity_id }).first();
      if (portal) {
        clientPhone = portal.client_phone;
      }
    }

    if (!clientPhone) {
      return Response.json({ status: 'skipped', reason: 'no client phone' });
    }

    // Find which milestone was completed
    const workflowStages = project.workflow_stages || [];
    let completedMilestone = null;

    for (const stage of workflowStages) {
      for (const milestone of (stage.milestones || [])) {
        // Check if this milestone was just marked done
        const oldMilestone = old_data?.workflow_stages
          ?.flatMap(s => s.milestones || [])
          .find(m => m.id === milestone.id);
        
        if (milestone.done && (!oldMilestone || !oldMilestone.done)) {
          completedMilestone = milestone;
          break;
        }
      }
      if (completedMilestone) break;
    }

    if (!completedMilestone) {
      return Response.json({ status: 'skipped', reason: 'no new milestone completed' });
    }

    const firstName = project.client_name?.split(' ')[0] || 'there';
    const message = `Hi ${firstName}! Progress update: ${completedMilestone.label} is complete! 🎉 Check your client portal for the full timeline. - Coen Construction`;

    // Send SMS
    const smsResult = await base44.functions.invoke('sendSmsNotification', {
      to: clientPhone,
      body: message
    });

    // Log in CustomerPortal
    const portal = await base44.entities.CustomerPortal.filter({ project_id: entity_id }).first();
    if (portal) {
      const notes = portal.customer_notes || [];
      notes.push({
        id: `sms_milestone_${Date.now()}`,
        note: `SMS notification sent: Milestone "${completedMilestone.label}" completed`,
        author: 'System',
        created_at: new Date().toISOString(),
        notify_customer: false
      });
      await base44.entities.CustomerPortal.update(portal.id, { customer_notes: notes });
    }

    return Response.json({ 
      success: true, 
      sms_result: smsResult.data,
      milestone: completedMilestone.label 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});