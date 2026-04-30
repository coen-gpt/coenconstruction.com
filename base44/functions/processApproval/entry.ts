import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { token, action, notes } = await req.json();

  if (!token || !action) {
    return Response.json({ error: 'token and action are required' }, { status: 400 });
  }

  if (!['approve', 'deny', 'modify'].includes(action)) {
    return Response.json({ error: 'Invalid action. Must be approve, deny, or modify' }, { status: 400 });
  }

  // Find project by token
  const allProjects = await base44.asServiceRole.entities.ContractorProject.list('-created_date', 500);
  const project = allProjects.find(p => p.approval_token === token);

  if (!project) return Response.json({ error: 'Invalid or expired link' }, { status: 404 });

  if (project.approval_token_expires && new Date(project.approval_token_expires) < new Date()) {
    return Response.json({ error: 'This approval link has expired' }, { status: 410 });
  }

  const statusMap = { approve: 'completed', deny: 'denied', modify: 'modify' };
  const newStatus = statusMap[action];

  await base44.asServiceRole.entities.ContractorProject.update(project.id, {
    status: newStatus,
    approver_notes: notes || null,
    approval_token: null,
    approval_token_expires: null,
  });

  // Optionally notify the estimator by email
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey && project.assigned_to) {
    const actionLabels = { approve: 'Approved ✅', deny: 'Denied ❌', modify: 'Modifications Requested 🔄' };
    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
        <div style="background:#1B2B3A;padding:20px;text-align:center;">
          <h2 style="color:#E35235;margin:0;">Estimate ${actionLabels[action]}</h2>
        </div>
        <div style="padding:24px;">
          <p>The estimate for <strong>${project.client_name}</strong> has been <strong>${action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'flagged for modifications'}</strong> by the approver.</p>
          ${notes ? `<div style="background:#fff3cd;border-left:3px solid #ffc107;padding:12px;margin:16px 0;"><strong>Approver Notes:</strong><br>${notes}</div>` : ''}
          <p>Log in to the estimator dashboard to view the updated project.</p>
        </div>
      </div>
    `;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Coen Construction <noreply@coenconstruction.com>",
        to: project.assigned_to,
        subject: `Estimate ${actionLabels[action]}: ${project.client_name}`,
        html: emailHtml,
      }),
    }).catch(() => {});
  }

  return Response.json({ success: true, status: newStatus, client_name: project.client_name });
});