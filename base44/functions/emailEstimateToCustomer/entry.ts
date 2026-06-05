import { jsPDF } from 'npm:jspdf@4.0.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function verifyAdminSession(req, permission, body) {
  const ADMIN_SESSION_KEY_NAME = 'admin_session';
  const token = body?.admin_session_token ||
    req.headers.get('x-admin-session-token') ||
    req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized: no session token');

  const base44 = createClientFromRequest(req);
  // Inline JWT verify (no shared imports allowed)
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Unauthorized: invalid token');
  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Unauthorized: token expired');

  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: payload.email });
  const user = users[0];
  if (!user || user.active === false) throw new Error('Forbidden: account inactive');
  if (permission && user.role !== 'admin' && !user[permission]) throw new Error('Forbidden: missing permission');
  return { base44, user };
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { base44, user } = await verifyAdminSession(req, 'can_access_estimates', body);

    const { project_id, estimate_id, message, is_change_order } = body;

    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: project_id });
    const project = projects[0];
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
    if (!project.client_email) return Response.json({ error: 'No client email on file' }, { status: 400 });

    const estimates = await base44.asServiceRole.entities.Estimate.filter({ id: estimate_id });
    const estimate = estimates[0];
    if (!estimate) return Response.json({ error: 'Estimate not found' }, { status: 404 });

    // Build PDF
    const doc = new jsPDF();
    const brandColor = [227, 82, 53];
    const navyColor = [27, 43, 58];

    doc.setFillColor(...navyColor);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('COEN CONSTRUCTION', 14, 16);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Licensed & Insured General Contractor', 14, 23);

    doc.setTextColor(...navyColor);
    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    const title = is_change_order ? `Change Order #${estimate.change_order_number || ''}` : 'Project Estimate';
    doc.text(title, 14, 42);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Client: ${project.client_name}`, 14, 52);
    doc.text(`Address: ${[project.client_address, project.client_city, project.client_zipcode].filter(Boolean).join(', ')}`, 14, 58);
    doc.text(`Project Type: ${project.project_type || ''}`, 14, 64);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 70);
    if (estimate.valid_until) doc.text(`Valid Until: ${estimate.valid_until}`, 100, 70);

    doc.setDrawColor(...brandColor);
    doc.setLineWidth(0.8);
    doc.line(14, 75, 196, 75);

    let y = 85;
    const items = estimate.line_items || [];
    const groups = items.reduce((acc, item) => {
      const g = item.parent_group || 'General';
      if (!acc[g]) acc[g] = [];
      acc[g].push(item);
      return acc;
    }, {});

    for (const [group, groupItems] of Object.entries(groups)) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFillColor(...navyColor);
      doc.rect(14, y - 5, 182, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text(group, 16, y + 1);
      const groupTotal = groupItems.reduce((s, i) => s + (i.total || 0), 0);
      doc.text(`$${groupTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 186, y + 1, { align: 'right' });
      y += 12;

      for (const item of groupItems) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setTextColor(...navyColor);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(8);
        doc.text(item.title || '', 16, y);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(80, 80, 80);
        if (item.description) {
          const lines = doc.splitTextToSize(item.description.replace(/\*\*/g, '').replace(/\*/g, ''), 140);
          doc.text(lines, 16, y + 4);
          y += 4 + lines.length * 4;
        }
        doc.setTextColor(...brandColor);
        doc.setFont(undefined, 'bold');
        doc.text(`$${(item.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 186, y, { align: 'right' });
        doc.setTextColor(130, 130, 130);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(7);
        doc.text(`${item.quantity} ${item.unit} × $${item.unit_cost}`, 16, y + 4);
        y += 10;
      }
      y += 4;
    }

    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFillColor(...brandColor);
    doc.rect(100, y, 96, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL', 104, y + 9);
    doc.text(`$${(estimate.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 193, y + 9, { align: 'right' });

    if (estimate.notes) {
      y += 22;
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setTextColor(...navyColor);
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text('Notes & Terms', 14, y);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(80, 80, 80);
      const noteLines = doc.splitTextToSize(estimate.notes, 180);
      doc.text(noteLines, 14, y + 5);
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(...navyColor);
      doc.rect(0, 285, 210, 12, 'F');
      doc.setTextColor(180, 180, 180);
      doc.setFontSize(7);
      doc.text('Coen Construction  |  coenconstruction.com  |  Licensed & Insured', 105, 292, { align: 'center' });
    }

    // Build portal link
    const portals = await base44.asServiceRole.entities.CustomerPortal.filter({ project_id });
    let portal = portals[0];
    if (!portal) {
      const token = crypto.randomUUID().replace(/-/g, '');
      const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      portal = await base44.asServiceRole.entities.CustomerPortal.create({
        project_id,
        client_email: project.client_email,
        client_name: project.client_name,
        client_phone: project.client_phone || '',
        portal_token: token,
        portal_token_expires: expires,
        email_notifications: true,
        notify_on_estimate: true,
        notify_on_change_order: true,
        notify_on_status_change: true,
        notify_on_customer_note: true,
      });
    }

    const appUrl = 'https://coenconstruction.com';
    const portalUrl = `${appUrl}/customer-portal?token=${portal.portal_token}`;
    const customMsg = message ? `<p style="margin-bottom:16px;">${message}</p>` : '';
    const docTypeLabel = is_change_order ? `Change Order #${estimate.change_order_number}` : 'Estimate';

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');

    const estimateEmailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1B2B3A;padding:24px;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;">Coen Construction</h1>
          <p style="color:#aaa;margin:4px 0 0;font-size:13px;">Licensed & Insured General Contractor</p>
        </div>
        <div style="background:#f9f9f9;padding:24px;border:1px solid #eee;border-top:none;">
          <p style="font-size:16px;color:#1B2B3A;">Hi ${project.client_name},</p>
          ${customMsg}
          <p>Please find your ${docTypeLabel.toLowerCase()} attached. The total amount is <strong style="color:#E35235;">$${(estimate.grand_total || 0).toLocaleString()}</strong>.</p>
          <div style="margin:24px 0;text-align:center;">
            <a href="${portalUrl}" style="background:#E35235;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
              View Your Customer Portal →
            </a>
          </div>
          <p style="font-size:12px;color:#888;">In your portal you can review your ${docTypeLabel.toLowerCase()}, view project photos, and chat with your Project Manager for real-time updates.</p>
        </div>
        <div style="background:#1B2B3A;padding:12px;border-radius:0 0 8px 8px;text-align:center;">
          <p style="color:#888;font-size:11px;margin:0;">© ${new Date().getFullYear()} Coen Construction · coenconstruction.com</p>
        </div>
      </div>
    `;

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Coen Construction <info@coenconstruction.com>',
        reply_to: 'ops@coenconstruction.com',
        to: project.client_email,
        subject: `Your ${docTypeLabel} from Coen Construction`,
        html: estimateEmailHtml,
      }),
    });

    if (!sendRes.ok) {
      const err = await sendRes.json();
      throw new Error(`Resend error: ${sendRes.status} — ${err.message || 'Unknown'}`);
    }

    await base44.asServiceRole.entities.Estimate.update(estimate.id, { status: 'sent' });
    if (!is_change_order) {
      await base44.asServiceRole.entities.ContractorProject.update(project_id, { status: 'pending_review' });
    }

    return Response.json({ success: true, sent_to: project.client_email, portal_url: portalUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});