import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Twilio needs E.164; CompanyProfile stores a display number that may contain
// vanity letters — "(617) 857-COEN" → +16178572636.
const LETTER_MAP: Record<string, string> = { A:'2',B:'2',C:'2',D:'3',E:'3',F:'3',G:'4',H:'4',I:'4',J:'5',K:'5',L:'5',M:'6',N:'6',O:'6',P:'7',Q:'7',R:'7',S:'7',T:'8',U:'8',V:'8',W:'9',X:'9',Y:'9',Z:'9' };
function toE164(display) {
  const digits = String(display || '').toUpperCase().split('').map(c => LETTER_MAP[c] || c).join('').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

const ALLOWED_ACTIONS = ['start', 'complete'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { token, project_id, action, notes } = await req.json();

    if (!token || !project_id || !action) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    // An unknown action used to fall through the status update but still
    // rewrite the milestone with done:false — reverting completed work.
    if (!ALLOWED_ACTIONS.includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Fetch project
    const project = await base44.asServiceRole.entities.ContractorProject.get(project_id);
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
    // Same expiry rule as getSubcontractorPortal — an expired invitation link
    // must not keep mutating project state.
    if (assignment.token_expires && new Date(assignment.token_expires) < new Date()) {
      return Response.json({ error: 'This link has expired — please ask the office for a new one.' }, { status: 403 });
    }
    if (action === 'start' && assignment.status === 'complete') {
      return Response.json({ error: 'This task is already complete' }, { status: 409 });
    }
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
    await base44.asServiceRole.entities.ContractorProject.update(project_id, {
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

      // Send SMS to PM if phone exists (normalized — Twilio rejects display
      // strings like "(617) 857-COEN")
      const pmPhone = toE164(company?.phone);
      if (pmPhone && Deno.env.get('TWILIO_PHONE_NUMBER')) {
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
            To: pmPhone,
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