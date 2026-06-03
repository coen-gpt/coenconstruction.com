import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { token, action, notes, estimate_id, signature_data } = await req.json();

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

  const statusMap = { approve: 'approved', deny: 'denied', modify: 'modify' };
  const newStatus = statusMap[action];

  // If signature provided and estimate_id, update the estimate
  if (signature_data && estimate_id) {
    const estimates = await base44.asServiceRole.entities.Estimate.filter({ project_id: project.id });
    const estimate = estimates.find(e => e.id === estimate_id);
    
    if (estimate) {
      // Update estimate status and add signature
      await base44.asServiceRole.entities.Estimate.update(estimate.id, {
        status: 'approved',
        approved_date: new Date().toISOString().split('T')[0],
      });
      
      // Update project adjusted total
      const allEstimates = await base44.asServiceRole.entities.Estimate.filter({ project_id: project.id });
      const totalAmount = allEstimates.reduce((sum, est) => sum + (est.grand_total || 0), 0);
      
      await base44.asServiceRole.entities.ContractorProject.update(project.id, {
        adjusted_total: totalAmount,
        client_signed: true,
        signed_date: new Date().toISOString().split('T')[0],
        contract_signature_data: signature_data,
        contract_signed_at: new Date().toISOString(),
      });
    }
  }

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
    const signatureNote = signature_data ? '<p style="background:#d4edda;border-left:3px solid #28a745;padding:12px;margin:16px 0;"><strong>✓ Client Signature Received</strong><br>The change order has been digitally signed.</p>' : '';
    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
        <div style="background:#1B2B3A;padding:20px;text-align:center;">
          <h2 style="color:#E35235;margin:0;">Estimate ${actionLabels[action]}</h2>
        </div>
        <div style="padding:24px;">
          <p>The estimate for <strong>${project.client_name}</strong> has been <strong>${action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'flagged for modifications'}</strong> by the approver.</p>
          ${signatureNote}
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