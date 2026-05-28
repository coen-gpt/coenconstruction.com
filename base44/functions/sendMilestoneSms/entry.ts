import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Support both automation payload (event.entity_id) and direct call (entity_id)
    const entityId = body.event?.entity_id || body.entity_id;
    const data = body.data;
    const oldData = body.old_data;
    const changedFields = body.changed_fields;

    if (!changedFields || !changedFields.includes('workflow_stages')) {
      return Response.json({ status: 'skipped', reason: 'workflow_stages not changed' });
    }

    if (!entityId) {
      return Response.json({ error: 'No entity_id provided' }, { status: 400 });
    }

    // Use data from payload if available (avoids extra fetch)
    const project = data || await base44.asServiceRole.entities.ContractorProject.get(entityId);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if SMS notifications are enabled via CustomerPortal
    const portals = await base44.asServiceRole.entities.CustomerPortal.filter({ project_id: entityId });
    const portal = portals?.[0] || null;

    if (portal && portal.sms_notifications === false) {
      return Response.json({ status: 'skipped', reason: 'SMS notifications disabled for this client' });
    }

    // Get client phone
    const clientPhone = project.client_phone || portal?.client_phone;
    if (!clientPhone) {
      return Response.json({ status: 'skipped', reason: 'no client phone' });
    }

    // Find which milestone was just marked done by comparing with old_data
    const newStages = project.workflow_stages || data?.workflow_stages || [];
    const oldStages = oldData?.workflow_stages || [];

    let completedMilestone = null;

    for (const stage of newStages) {
      for (const milestone of (stage.milestones || [])) {
        if (!milestone.done) continue;
        const oldStage = oldStages.find(s => s.id === stage.id);
        const oldMilestone = oldStage?.milestones?.find(m => m.id === milestone.id);
        if (!oldMilestone || !oldMilestone.done) {
          completedMilestone = { ...milestone, stageName: stage.name };
          break;
        }
      }
      if (completedMilestone) break;
    }

    if (!completedMilestone) {
      return Response.json({ status: 'skipped', reason: 'no new milestone completed' });
    }

    const firstName = project.client_name?.split(' ')[0] || 'there';
    const message = `Hi ${firstName}! 🏗️ Progress update on your project: "${completedMilestone.label}" is complete! Log in to your client portal for the full timeline. – Coen Construction`;

    // Send SMS via Twilio
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioFrom = Deno.env.get('TWILIO_PHONE_NUMBER');

    const smsResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: clientPhone, From: twilioFrom, Body: message }),
      }
    );
    const smsData = await smsResp.json();

    // Log in CustomerPortal
    if (portal) {
      const notes = portal.customer_notes || [];
      notes.push({
        id: `sms_milestone_${Date.now()}`,
        note: `📱 SMS sent: Milestone "${completedMilestone.label}" (${completedMilestone.stageName}) completed`,
        author: 'System',
        created_at: new Date().toISOString(),
        notify_customer: false
      });
      await base44.asServiceRole.entities.CustomerPortal.update(portal.id, { customer_notes: notes });
    }

    return Response.json({
      success: true,
      milestone: completedMilestone.label,
      sms_sid: smsData.sid,
      sms_status: smsData.status
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});