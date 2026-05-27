import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { token, project_id, action, notes } = await req.json();

    if (!token || !project_id || !action) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch project
    const project = await base44.entities.ContractorProject.get(project_id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Find and update assignment
    const assignments = project.subcontractor_assignments || [];
    const assignmentIndex = assignments.findIndex(a => a.token === token);
    
    if (assignmentIndex === -1) {
      return Response.json({ error: 'Invalid token' }, { status: 403 });
    }

    const assignment = assignments[assignmentIndex];
    const now = new Date().toISOString();

    // Update assignment status
    if (action === 'start') {
      assignment.status = 'in_progress';
      assignment.started_at = now;
    } else if (action === 'complete') {
      assignment.status = 'complete';
      assignment.completed_at = now;
    }

    if (notes !== undefined) {
      assignment.notes = notes;
    }

    assignments[assignmentIndex] = assignment;

    // Update milestone status in workflow
    const updatedStages = (project.workflow_stages || []).map(stage => {
      const updatedMilestones = (stage.milestones || []).map(milestone => {
        if (milestone.id === assignment.milestone_id) {
          return {
            ...milestone,
            done: action === 'complete',
            done_at: action === 'complete' ? now : milestone.done_at,
          };
        }
        return milestone;
      });
      return { ...stage, milestones: updatedMilestones };
    });

    // Save updates
    await base44.entities.ContractorProject.update(project_id, {
      subcontractor_assignments: assignments,
      workflow_stages: updatedStages,
    });

    // Send notification to PM
    try {
      const companyProfiles = await base44.entities.CompanyProfile.list();
      const company = companyProfiles[0];
      
      const milestoneLabel = updatedStages
        .flatMap(s => s.milestones || [])
        .find(m => m.id === assignment.milestone_id)?.label || 'Task';

      const message = action === 'complete' 
        ? `✅ ${milestoneLabel} marked complete by subcontractor`
        : `🔨 ${milestoneLabel} started by subcontractor`;

      // Send SMS to PM if phone exists
      if (company?.phone && Deno.env.get('TWILIO_PHONE_NUMBER')) {
        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: twilioPhone,
            To: company.phone,
            Body: `${message}\nProject: ${project.client_name}`,
          }),
        });
      }
    } catch (notifyError) {
      console.error('Failed to send notification:', notifyError);
      // Continue anyway - notification failure shouldn't block status update
    }

    return Response.json({
      success: true,
      assignment,
      message: action === 'complete' ? 'Task marked complete!' : 'Task started!',
    });

  } catch (error) {
    console.error('Error updating subcontractor status:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});