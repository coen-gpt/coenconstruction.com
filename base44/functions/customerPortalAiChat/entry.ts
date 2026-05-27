import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, message } = await req.json();

    if (!token || !message) {
      return Response.json({ error: "Missing token or message" }, { status: 400 });
    }

    // Load portal and project data
    const portals = await base44.asServiceRole.entities.CustomerPortal.filter({ portal_token: token });
    if (!portals.length) {
      return Response.json({ error: "Invalid token" }, { status: 404 });
    }
    const portal = portals[0];

    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: portal.project_id });
    const project = projects[0];

    const estimates = await base44.asServiceRole.entities.Estimate.filter({ project_id: portal.project_id });
    const currentEstimate = estimates.find(e => e.type === "original" && e.status !== "superseded");

    // Build context for AI
    const projectContext = `
You are "Ask PM" — the AI Project Manager for Coen Construction, helping ${portal.client_name || 'the client'} with their ${project?.project_type || 'construction'} project.

PROJECT DETAILS:
- Client: ${project?.client_name}
- Address: ${[project?.client_address, project?.client_city, project?.client_zipcode].filter(Boolean).join(', ')}
- Project Type: ${project?.project_type}
- Status: ${project?.status}
- Scope of Work: ${project?.scope_of_work || 'Not yet defined'}
- Estimate Total: ${currentEstimate?.grand_total ? '$' + currentEstimate.grand_total.toLocaleString() : 'Not yet available'}
- Client Signed: ${project?.client_signed ? 'Yes, on ' + project.signed_date : 'Not yet signed'}
- Deposit Paid: ${project?.deposit_paid ? 'Yes — $' + project.deposit_amount?.toLocaleString() : 'Not yet paid'}
- Contract Signed: ${project?.contract_signed_at ? 'Yes, on ' + new Date(project.contract_signed_at).toLocaleDateString() : 'Not yet signed'}

RECENT UPDATES: ${(portal.customer_notes || []).slice(-3).map(n => n.note).join(' | ') || 'No recent updates'}

INSTRUCTIONS:
- Answer questions specifically about this project using the context above.
- Be friendly, professional, and clear. Keep responses concise (2-4 sentences max).
- If asked about timeline, scheduling, or specific technical questions you cannot answer from the context, tell the client you'll add a note for the project manager to follow up.
- Do NOT make up numbers or dates not in the context.
- If you cannot answer satisfactorily, say: "That's a great question for your project manager. I'll add a note so they can follow up with you directly."
`;

    const chatHistory = (portal.chat_messages || []).slice(-10).map(m => ({
      role: m.role === "customer" ? "user" : "assistant",
      content: m.content
    }));

    const prompt = `${projectContext}\n\nChat history:\n${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nCustomer: ${message}`;

    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });

    const needsEscalation = aiResponse.includes("great question for your project manager") ||
      aiResponse.includes("I'll add a note") ||
      aiResponse.includes("cannot answer");

    // If AI can't answer, add an internal note to the project
    if (needsEscalation && project) {
      const existingMessages = project.team_messages || [];
      const newNote = {
        id: crypto.randomUUID(),
        text: `📱 Customer Portal Question (Ask PM): "${message}" — AI could not answer. Please follow up with ${portal.client_name}.`,
        author: "Ask PM Bot",
        author_email: "system@coenconstruction.com",
        created_at: new Date().toISOString(),
      };
      await base44.asServiceRole.entities.ContractorProject.update(project.id, {
        team_messages: [...existingMessages, newNote],
      });

      // Send alert email to the team
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: "scott@coenconstruction.com",
          subject: `Ask PM: Customer question needs follow-up — ${project.client_name}`,
          body: `Hi Scott,\n\nA customer has a question that Ask PM couldn't answer and needs your follow-up.\n\nClient: ${portal.client_name}\nProject: ${project.project_type} at ${project.client_address}\n\nQuestion: "${message}"\n\nPlease log in and respond to them at your earliest convenience.\n\nCoen Construction System`,
        });
      } catch (_) { /* email failure is non-critical */ }
    }

    // Save message + reply to portal chat history
    const updatedMessages = [
      ...(portal.chat_messages || []),
      { role: "customer", content: message, created_at: new Date().toISOString() },
      { role: "assistant", content: aiResponse, created_at: new Date().toISOString() },
    ];
    await base44.asServiceRole.entities.CustomerPortal.update(portal.id, {
      chat_messages: updatedMessages.slice(-50), // keep last 50 messages
    });

    return Response.json({ reply: aiResponse, escalated: needsEscalation });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});