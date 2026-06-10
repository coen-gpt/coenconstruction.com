import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data } = body;

    if (event?.type !== 'create') {
      return Response.json({ success: true });
    }

    // data may be null if payload_too_large; fall back to fetching by ID
    let lead = data;
    if (!lead && event.entity_id) {
      lead = await base44.asServiceRole.entities.Lead.get(event.entity_id);
    }
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });

    // Send personalized welcome email to the client (fire-and-forget, only if email present)
    if (lead.email) {
      const resendKey = Deno.env.get('RESEND_API_KEY');
      if (resendKey) {
        base44.asServiceRole.functions.invoke('sendLeadWelcomeEmail', {
          full_name: lead.full_name,
          email: lead.email,
          project_type: lead.project_type,
          source: lead.source,
        }).catch((e) => console.error('Welcome email failed:', e));
      }
    }

    // Auto-schedule walkthrough on Google Calendar (fire-and-forget)
    base44.asServiceRole.functions.invoke('scheduleLeadWalkthrough', {
      full_name: lead.full_name,
      email: lead.email || '',
      phone: lead.phone || '',
      project_type: lead.project_type,
      address: lead.address || '',
      source: lead.source || 'Website',
      contractor_project_id: lead.contractor_project_id || null,
      lead_id: lead.id,
    }).catch((e) => console.error('Calendar scheduling failed:', e));

    // Get notification email from company profile
    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const notifyEmail = profiles[0]?.lead_notification_email || 'scott@coenconstruction.com';

    // Build email body
    const emailBody = `
New Lead Received!

Name: ${lead.full_name}
Email: ${lead.email}
Phone: ${lead.phone}
Project Type: ${lead.project_type || 'Not specified'}
Message: ${lead.message || 'No message provided'}
Address: ${lead.address || 'Not provided'}
Source: ${lead.source || 'Unknown'}

Please follow up as soon as possible.
`;

    // Send email via Resend API
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured — lead alert not sent');
      return Response.json({ success: true, leadId: event.entity_id, alert_sent: false });
    }

    let emailResponse;
    try {
      emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Coen Construction <info@coenconstruction.com>',
        reply_to: 'ops@coenconstruction.com',
        to: notifyEmail,
        subject: `New Lead: ${lead.full_name} - ${lead.project_type || 'General Inquiry'}`,
        html: emailBody.replace(/\n/g, '<br />'),
      }),
      });
      if (!emailResponse.ok) {
        const errorData = await emailResponse.json().catch(() => ({}));
        console.error(`Resend API error: ${emailResponse.status} - ${errorData.message || 'Unknown error'}`);
      }
    } catch (e) {
      // Never bubble a failure once the lead exists — a non-200 makes the
      // platform retry the create-hook and the office gets duplicate alerts.
      console.error('Lead alert email failed:', e.message);
    }

    return Response.json({ success: true, leadId: event.entity_id });
  } catch (error) {
    console.error('Error sending lead notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});