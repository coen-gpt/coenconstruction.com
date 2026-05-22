import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, message } = await req.json();

    if (!token) return Response.json({ error: 'Token required' }, { status: 401 });

    // Validate portal token
    const portals = await base44.asServiceRole.entities.CustomerPortal.filter({ portal_token: token });
    const portal = portals[0];
    if (!portal) return Response.json({ error: 'Invalid or expired portal token' }, { status: 401 });
    if (portal.portal_token_expires && new Date(portal.portal_token_expires) < new Date()) {
      return Response.json({ error: 'Portal link has expired' }, { status: 401 });
    }

    // Fetch project data
    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: portal.project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    // Fetch estimates
    const estimates = await base44.asServiceRole.entities.Estimate.filter({ project_id: portal.project_id });
    const originalEst = estimates.find(e => e.type === 'original' && e.status !== 'superseded');
    const changeOrders = estimates.filter(e => e.type === 'change_order');

    // Build AI context from project data
    const statusLabels = {
      walkthrough: 'Walkthrough completed',
      draft: 'Estimate is being prepared',
      pending_review: 'Estimate sent — awaiting your approval',
      approved: 'Project approved and scheduled',
      modify: 'Modifications requested',
      denied: 'Estimate not approved',
      in_progress: 'Project is actively in progress',
      completed: 'Project completed',
      cancelled: 'Project cancelled',
      imported: 'Project on file',
    };

    const projectContext = `
Project: ${project.project_type || 'Renovation Project'}
Client: ${project.client_name}
Address: ${[project.client_address, project.client_city, project.client_zipcode].filter(Boolean).join(', ')}
Current Status: ${statusLabels[project.status] || project.status}
Signed: ${project.client_signed ? 'Yes, client has signed' : 'Not yet signed'}
${project.scope_of_work ? `Scope of Work: ${project.scope_of_work}` : ''}
${project.rooms?.length ? `Rooms/Areas: ${project.rooms.map(r => r.name || r.type).join(', ')}` : ''}
${project.walkthrough_date ? `Walkthrough Date: ${project.walkthrough_date}` : ''}
${project.photos?.length ? `Site photos on file: ${project.photos.length} photos` : ''}
${originalEst ? `
Estimate Total: $${(originalEst.grand_total || 0).toLocaleString()}
Estimate Status: ${originalEst.status}
${originalEst.valid_until ? `Valid Until: ${originalEst.valid_until}` : ''}
${originalEst.notes ? `Estimate Notes: ${originalEst.notes}` : ''}
` : 'No estimate on file yet.'}
${changeOrders.length > 0 ? `Change Orders: ${changeOrders.map(co => `${co.title} ($${(co.grand_total || 0).toLocaleString()} - ${co.status})`).join('; ')}` : ''}
${portal.customer_notes?.length > 0 ? `
Project Updates from your PM:
${portal.customer_notes.map(n => `- [${new Date(n.created_at).toLocaleDateString()}] ${n.note}`).join('\n')}
` : ''}
    `.trim();

    // Build conversation history
    const chatHistory = (portal.chat_messages || []).slice(-10).map(m => ({
      role: m.role,
      content: m.content
    }));

    const systemPrompt = `You are the virtual Project Manager assistant for Coen Construction. You are helping ${project.client_name} with their ${project.project_type || 'renovation'} project.

You have access to the following real-time project information:
${projectContext}

Your role is to:
1. Provide accurate, helpful status updates about this specific project
2. Answer questions about the estimate, timeline, scope of work, and next steps
3. Be professional, warm, and reassuring
4. If asked something you genuinely don't know (e.g. exact start date not in the data), say you'll have the team follow up
5. NEVER make up information not in the project data
6. Keep responses concise and easy to read — use bullet points when helpful
7. Sign off as "Your Coen Construction PM Team"

Do NOT discuss pricing from competitors, share internal notes, or make commitments beyond what the data shows.`;

    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${systemPrompt}\n\nConversation so far:\n${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nCustomer: ${message}`,
      model: 'claude_sonnet_4_6',
    });

    const reply = typeof aiResponse === 'string' ? aiResponse : aiResponse?.content || aiResponse?.text || String(aiResponse);

    // Save chat messages
    const updatedMessages = [
      ...(portal.chat_messages || []),
      { role: 'customer', content: message, created_at: new Date().toISOString() },
      { role: 'assistant', content: reply, created_at: new Date().toISOString() },
    ];

    await base44.asServiceRole.entities.CustomerPortal.update(portal.id, {
      chat_messages: updatedMessages,
      last_viewed_at: new Date().toISOString(),
    });

    return Response.json({ reply });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});