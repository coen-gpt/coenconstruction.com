import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { entity_name, entity_id, data, old_data, changed_fields } = await req.json();

    // Only trigger on update events
    if (!changed_fields || !changed_fields.includes('status')) {
      return Response.json({ status: 'skipped', reason: 'status not changed' });
    }

    const project = await base44.entities.ContractorProject.get(entity_id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get client phone from CustomerPortal or Lead
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

    // Status change messages
    const STATUS_MESSAGES = {
      walkthrough: "Hi {name}! Your walkthrough is complete. We're preparing your estimate and will be in touch soon. - Coen Construction",
      draft: "Hi {name}! Your estimate is being prepared. Our team is working on a detailed proposal for your project. - Coen Construction",
      pending_review: "Hi {name}! Great news - your estimate is ready! Check your email or visit your client portal to review. Questions? Call (781) 999-5400. - Coen Construction",
      approved: "Hi {name}! Your project has been approved! 🎉 We're excited to start building. We'll contact you soon to schedule the start date. - Coen Construction",
      modify: "Hi {name}! We're updating your estimate based on your feedback. Revised version coming soon! - Coen Construction",
      denied: "Hi {name}! We received your decision. Please call us at (781) 999-5400 if you'd like to discuss alternatives. - Coen Construction",
      in_progress: "Hi {name}! Work has begun on your project! 🏗️ Check your client portal for updates and timeline. - Coen Construction",
      completed: "Hi {name}! Your project is complete! 🎊 Thank you for trusting Coen Construction. We hope you love it! Please consider leaving us a review. - Coen Construction",
      cancelled: "Hi {name}! Your project has been cancelled. Please contact us at (781) 999-5400 with any questions. - Coen Construction",
    };

    const newStatus = data.status;
    const messageTemplate = STATUS_MESSAGES[newStatus];

    if (!messageTemplate) {
      return Response.json({ status: 'skipped', reason: 'no message for status' });
    }

    const firstName = project.client_name?.split(' ')[0] || 'there';
    const message = messageTemplate.replace('{name}', firstName);

    // Send SMS
    const smsResult = await base44.functions.invoke('sendSmsNotification', {
      to: clientPhone,
      body: message
    });

    // Log the notification in CustomerPortal
    const portal = await base44.entities.CustomerPortal.filter({ project_id: entity_id }).first();
    if (portal) {
      const notes = portal.customer_notes || [];
      notes.push({
        id: `sms_${Date.now()}`,
        note: `SMS notification sent: Status changed to ${newStatus}`,
        author: 'System',
        created_at: new Date().toISOString(),
        notify_customer: false
      });
      await base44.entities.CustomerPortal.update(portal.id, { customer_notes: notes });
    }

    return Response.json({ 
      success: true, 
      sms_result: smsResult.data,
      status: newStatus 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});