import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── GLOBAL SMS KILL SWITCH ──────────────────────────────────────────────
    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const smsEnabled = profiles[0]?.sms_enabled;
    if (smsEnabled === false) {
      console.log('[SMS DISABLED] Global kill switch is ON — skipping subcontractor SMS assignment');
      return Response.json({ success: false, skipped: true, reason: 'sms_globally_disabled' });
    }
    // ───────────────────────────────────────────────────────────────────────

    const { milestone_id, subcontractor_phone, project_id, message } = await req.json();

    if (!milestone_id || !subcontractor_phone || !project_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch project and milestone data
    const project = await base44.entities.ContractorProject.get(project_id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Find the milestone
    const allMilestones = (project.workflow_stages || []).flatMap(s => s.milestones || []);
    const milestone = allMilestones.find(m => m.id === milestone_id);
    if (!milestone) {
      return Response.json({ error: 'Milestone not found' }, { status: 404 });
    }

    // Generate secure token
    const token = `sub_${milestone_id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Save assignment
    const assignment = {
      id: `assign_${Date.now()}`,
      milestone_id: milestone_id,
      subcontractor_email: '',
      subcontractor_phone,
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
    const updatedAssignments = [...existingAssignments, assignment];
    await base44.entities.ContractorProject.update(project_id, {
      subcontractor_assignments: updatedAssignments
    });

    // Generate portal link
    const portalUrl = `https://your-app.base44.app/subcontractor-portal?token=${token}&project=${project_id}`;

    // Send SMS via Twilio
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const smsBody = `${project.client_name} - Task: ${milestone.label}\n\nUpdate status here: ${portalUrl}\n\nReply STOP to opt out`;

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: twilioPhone,
        To: subcontractor_phone,
        Body: smsBody,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send SMS');
    }

    return Response.json({
      success: true,
      assignment_id: assignment.id,
      portal_url: portalUrl,
    });

  } catch (error) {
    console.error('Error sending SMS assignment:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});