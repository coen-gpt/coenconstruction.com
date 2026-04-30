import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { projectId, userEmail, userName, userPhone, userAddress, projectType, aiDesigns, budgetRange } = body;

    if (!userEmail) {
      return Response.json({ error: 'Email required' }, { status: 400 });
    }

    // Get company profile
    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const companyName = profiles[0]?.company_name || 'Coen Construction';

    // Check if lead already exists for this email
    const existingLeads = await base44.asServiceRole.entities.Lead.filter({ email: userEmail.toLowerCase() });
    let lead = existingLeads[0];

    const leadData = {
      full_name: userName,
      email: userEmail.toLowerCase(),
      phone: userPhone,
      address: userAddress,
      project_type: projectType,
      source: 'Design Preview',
    };

    if (lead) {
      // Update existing lead with design info
      await base44.asServiceRole.entities.Lead.update(lead.id, {
        ...leadData,
        status: 'Contacted', // Mark as contacted since they're engaging with designs
      });
      lead.id = lead.id; // preserve ID
    } else {
      // Create new lead
      lead = await base44.asServiceRole.entities.Lead.create({
        ...leadData,
        status: 'New',
      });
    }

    // Build notification email
    const emailBody = `
New Design Interest from ${userName}!

Name: ${userName}
Email: ${userEmail}
Phone: ${userPhone}
Project Type: ${projectType || 'Not specified'}
Address: ${userAddress || 'Not provided'}
Budget Range: ${budgetRange || 'Not specified'}
Source: Design Preview
${aiDesigns?.length ? `Number of Designs: ${aiDesigns.length}` : ''}

They are interested in the AI-generated design concepts.
Lead ID: ${lead.id}

Please follow up as soon as possible.
`;

    // Send notification email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const notifyEmail = profiles[0]?.lead_notification_email || 'scott@coenconstruction.com';

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@coenconstruction.com',
        to: notifyEmail,
        subject: `Design Interest: ${userName} - ${projectType || 'General Inquiry'}`,
        html: emailBody.replace(/\n/g, '<br />'),
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      throw new Error(`Resend API error: ${emailResponse.status} - ${errorData.message || 'Unknown error'}`);
    }

    return Response.json({
      success: true,
      leadId: lead.id,
      isUpdate: existingLeads.length > 0,
      companyName,
    });
  } catch (error) {
    console.error('Error sending design to admin:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});