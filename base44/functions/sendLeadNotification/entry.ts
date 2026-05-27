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
      throw new Error('RESEND_API_KEY not configured');
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@coenconstruction.com',
        to: notifyEmail,
        subject: `New Lead: ${lead.full_name} - ${lead.project_type || 'General Inquiry'}`,
        html: emailBody.replace(/\n/g, '<br />'),
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      throw new Error(`Resend API error: ${emailResponse.status} - ${errorData.message || 'Unknown error'}`);
    }

    return Response.json({ success: true, leadId: event.entity_id });
  } catch (error) {
    console.error('Error sending lead notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});