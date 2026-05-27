import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { to, body, project_id } = await req.json();

    if (!to || !body) {
      return Response.json({ error: 'to and body are required' }, { status: 400 });
    }

    // Get project context if provided
    let projectContext = '';
    if (project_id) {
      const project = await base44.entities.ContractorProject.get(project_id);
      if (project) {
        projectContext = `\n\nProject: ${project.client_name}\nAddress: ${project.client_address || 'N/A'}`;
      }
    }

    const fullBody = body + projectContext;

    // Send SMS via Twilio
    const smsResult = await base44.functions.invoke('sendSmsNotification', {
      to: to,
      body: fullBody
    });

    return Response.json({ 
      success: true, 
      sms_result: smsResult.data 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});