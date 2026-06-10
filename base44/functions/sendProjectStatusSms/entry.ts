import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Support both automation payload (event.entity_id) and direct call (entity_id)
    const entityId = body.event?.entity_id || body.entity_id;
    const data = body.data;
    const changedFields = body.changed_fields;

    if (!changedFields || !changedFields.includes('status')) {
      return Response.json({ status: 'skipped', reason: 'status not changed' });
    }

    if (!entityId) {
      return Response.json({ error: 'No entity_id provided' }, { status: 400 });
    }

    // ── GLOBAL SMS KILL SWITCH ──────────────────────────────────────────────
    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const smsEnabled = profiles[0]?.sms_enabled;
    if (smsEnabled === false) {
      console.log('[SMS DISABLED] Global kill switch is ON — skipping project status SMS');
      return Response.json({ status: 'skipped', reason: 'sms_globally_disabled' });
    }
    // ───────────────────────────────────────────────────────────────────────

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

    const clientPhone = project.client_phone || portal?.client_phone;
    if (!clientPhone) {
      return Response.json({ status: 'skipped', reason: 'no client phone' });
    }

    const normalizedPhone = clientPhone.replace(/[\s().-]/g, '').trim();
    const consentRecords = await base44.asServiceRole.entities.SmsConsent.filter({ phone_number: normalizedPhone });
    if (!consentRecords?.[0]?.sms_opt_in_status) {
      await base44.asServiceRole.entities.SmsMessageLog.create({
        phone_number: normalizedPhone,
        direction: 'outbound',
        trigger_type: 'project_update',
        body: 'Project status update blocked because SMS opt-in is not active',
        status: 'blocked_opt_out',
        error_message: 'SMS opt-in required',
        sent_at: new Date().toISOString()
      });
      return Response.json({ status: 'skipped', reason: 'sms_opt_in_required' });
    }

    const STATUS_MESSAGES = {
      walkthrough: "Hi {name}! Your walkthrough is complete. We're preparing your estimate and will be in touch soon. – Coen Construction",
      draft: "Hi {name}! Your estimate is being prepared. Our team is working on a detailed proposal. – Coen Construction",
      sent: "Hi {name}! Great news — your estimate is ready! Check your email or client portal to review. Questions? Call (781) 999-5400. – Coen Construction",
      pending_review: "Hi {name}! Your estimate is in final review — you'll have it shortly. – Coen Construction",
      approved: "Hi {name}! Your project has been approved! 🎉 We'll be in touch shortly to schedule your start date. – Coen Construction",
      modify: "Hi {name}! We're updating your estimate based on your feedback. A revised version is coming soon! – Coen Construction",
      denied: "Hi {name}! We received your decision. Please call (781) 999-5400 if you'd like to discuss alternatives. – Coen Construction",
      in_progress: "Hi {name}! Work has begun on your project! 🏗️ Check your client portal for updates and the full timeline. – Coen Construction",
      completed: "Hi {name}! Your project is complete! 🎊 Thank you for trusting Coen Construction — we hope you love it! – Coen Construction",
      cancelled: "Hi {name}! Your project has been cancelled. Please contact us at (781) 999-5400 with any questions. – Coen Construction",
    };

    const newStatus = data?.status || project.status;
    const messageTemplate = STATUS_MESSAGES[newStatus];
    if (!messageTemplate) {
      return Response.json({ status: 'skipped', reason: `no message template for status: ${newStatus}` });
    }

    const firstName = project.client_name?.split(' ')[0] || 'there';
    const message = `${messageTemplate.replace('{name}', firstName)} Reply STOP to opt out.`;

    // Send SMS via Twilio directly
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
        body: new URLSearchParams({ To: normalizedPhone, From: twilioFrom, Body: message }),
      }
    );
    const smsData = await smsResp.json();
    if (!smsResp.ok) {
      await base44.asServiceRole.entities.SmsMessageLog.create({
        phone_number: normalizedPhone,
        direction: 'outbound',
        trigger_type: 'project_update',
        body: message,
        status: 'failed',
        error_message: smsData.message || 'Twilio delivery failed',
        sent_at: new Date().toISOString()
      });
      return Response.json({ error: smsData.message || 'Twilio delivery failed' }, { status: smsResp.status });
    }

    await base44.asServiceRole.entities.SmsMessageLog.create({
      phone_number: normalizedPhone,
      direction: 'outbound',
      trigger_type: 'project_update',
      body: message,
      twilio_sid: smsData.sid,
      status: smsData.status || 'queued',
      sent_at: new Date().toISOString()
    });

    // Log in CustomerPortal
    if (portal) {
      const notes = portal.customer_notes || [];
      notes.push({
        id: `sms_status_${Date.now()}`,
        note: `📱 SMS sent: Project status changed to "${newStatus}"`,
        author: 'System',
        created_at: new Date().toISOString(),
        notify_customer: false
      });
      await base44.asServiceRole.entities.CustomerPortal.update(portal.id, { customer_notes: notes });
    }

    return Response.json({
      success: true,
      status: newStatus,
      sms_sid: smsData.sid,
      sms_status: smsData.status
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});