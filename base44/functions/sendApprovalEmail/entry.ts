import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SITE_URL = "https://www.coenconstruction.com";

function generateToken() {
  const arr = new Uint8Array(32);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { project_id, approver_email } = await req.json();
  if (!project_id || !approver_email) {
    return Response.json({ error: 'project_id and approver_email are required' }, { status: 400 });
  }

  // Fetch project
  const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: project_id });
  const project = projects[0];
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

  // Fetch estimate for total
  const estimates = await base44.asServiceRole.entities.Estimate.filter({ project_id });
  const estimate = estimates.find(e => e.type === 'original' && e.status !== 'superseded') || estimates[0];
  const total = estimate?.grand_total || project.original_estimate_total || 0;

  // Generate secure token (expires 7 days)
  const token = generateToken();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await base44.asServiceRole.entities.ContractorProject.update(project_id, {
    status: 'pending_review',
    approval_token: token,
    approval_token_expires: expires,
    approver_email: approver_email,
    approval_sent_at: new Date().toISOString(),
  });

  const approvalUrl = `${SITE_URL}/estimate-approval?token=${token}`;

  // Build estimate line items summary
  const lineItemsSummary = estimate?.line_items?.length > 0
    ? estimate.line_items.slice(0, 10).map(i =>
        `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${i.parent_group || 'General'} - ${i.title}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">$${(i.total || 0).toLocaleString()}</td></tr>`
      ).join('')
    : '<tr><td colspan="2" style="padding:8px;color:#888;">No line items</td></tr>';

  const emailHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
      <div style="background:#1B2B3A;padding:24px;text-align:center;">
        <h1 style="color:#E35235;margin:0;font-size:22px;">Coen Construction</h1>
        <p style="color:#fff;margin:4px 0 0;font-size:14px;">Estimate for Review</p>
      </div>
      <div style="padding:32px 24px;">
        <p>Hello,</p>
        <p>An estimate has been submitted for your review and approval.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:6px 8px;background:#f4f4f4;font-weight:bold;">Client</td><td style="padding:6px 8px;">${project.client_name}</td></tr>
          <tr><td style="padding:6px 8px;background:#f4f4f4;font-weight:bold;">Address</td><td style="padding:6px 8px;">${project.client_address || '—'}${project.client_city ? ', ' + project.client_city : ''}</td></tr>
          <tr><td style="padding:6px 8px;background:#f4f4f4;font-weight:bold;">Project Type</td><td style="padding:6px 8px;">${project.project_type || '—'}</td></tr>
          <tr><td style="padding:6px 8px;background:#f4f4f4;font-weight:bold;">Estimate Total</td><td style="padding:6px 8px;color:#E35235;font-weight:bold;font-size:18px;">$${total.toLocaleString()}</td></tr>
        </table>
        ${project.scope_of_work ? `<p style="background:#f9f9f9;padding:12px;border-left:3px solid #E35235;font-size:14px;"><strong>Scope of Work:</strong><br>${project.scope_of_work}</p>` : ''}
        <h3 style="margin-top:24px;">Estimate Summary</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${lineItemsSummary}
          <tr style="background:#1B2B3A;color:#fff;"><td style="padding:8px;font-weight:bold;">TOTAL</td><td style="padding:8px;text-align:right;font-weight:bold;color:#E35235;">$${total.toLocaleString()}</td></tr>
        </table>
        <div style="text-align:center;margin:32px 0;">
          <a href="${approvalUrl}" style="display:inline-block;background:#E35235;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px;">Review &amp; Respond to Estimate</a>
        </div>
        <p style="font-size:12px;color:#999;">This link expires in 7 days. You can approve, deny, or request modifications from the review page.</p>
      </div>
    </div>
  `;

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return Response.json({ error: 'RESEND_API_KEY not set' }, { status: 500 });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Coen Construction <info@coenconstruction.com>",
      reply_to: "ops@coenconstruction.com",
      to: approver_email,
      subject: `Estimate Review: ${project.client_name} — $${total.toLocaleString()}`,
      html: emailHtml,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: `Email failed: ${err}` }, { status: 500 });
  }

  return Response.json({ success: true, approvalUrl });
});