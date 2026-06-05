import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PORTAL_URL = "https://www.coenconstruction.com/customer-portal";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { project_id, change_order_id } = await req.json();

    if (!project_id || !change_order_id) {
      return Response.json({ error: "project_id and change_order_id are required" }, { status: 400 });
    }

    const serviceRole = base44.asServiceRole;

    // Fetch project and portal
    const [projects, portals, estimates] = await Promise.all([
      serviceRole.entities.ContractorProject.filter({ id: project_id }),
      serviceRole.entities.CustomerPortal.filter({ project_id }),
      serviceRole.entities.Estimate.filter({ project_id }),
    ]);

    const project = projects[0];
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

    const portal = portals[0];
    const co = estimates.find(e => e.id === change_order_id);
    if (!co) return Response.json({ error: "Change order not found" }, { status: 404 });

    const clientEmail = portal?.client_email || project.client_email;
    const clientName  = portal?.client_name  || project.client_name;

    if (!clientEmail) {
      return Response.json({ error: "No client email found on project" }, { status: 400 });
    }

    // Ensure the CO is marked as sent
    await serviceRole.entities.Estimate.update(change_order_id, { status: "sent" });

    // Build portal link (use existing portal token if available)
    const portalLink = portal?.portal_token
      ? `${PORTAL_URL}?token=${portal.portal_token}`
      : `${PORTAL_URL}?project_id=${project_id}`;

    const coNumber = co.change_order_number || "—";
    const coTotal  = (co.grand_total || 0).toLocaleString();
    const scopeDesc = co.scope_change_description || "Scope adjustment to your project";

    // Build line items summary
    const lineRows = (co.line_items || []).slice(0, 15).map(item => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:14px;">${item.title || "—"}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#666;">${item.description || ""}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;font-size:14px;">$${(item.total || 0).toLocaleString()}</td>
      </tr>
    `).join("");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f4f5f7;">
        <div style="max-width:600px;margin:0 auto;padding:20px;">

          <!-- Header -->
          <div style="background:#1B2B3A;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:#E35235;letter-spacing:-0.5px;">COEN CONSTRUCTION</div>
            <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px;">Change Order — Action Required</div>
          </div>

          <!-- Body -->
          <div style="background:#fff;padding:32px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
            <p style="font-size:16px;color:#1f2937;margin:0 0 12px;">Hi ${clientName},</p>
            <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:0 0 24px;">
              We've prepared <strong>Change Order #${coNumber}</strong> for your project. 
              This change order outlines an adjustment to your project scope and/or budget that requires your approval before we proceed.
            </p>

            <!-- CO Summary Box -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:24px;">
              <div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Change Order Summary</div>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:6px 0;color:#6b7280;">Change Order #</td><td style="padding:6px 0;font-weight:600;text-align:right;">#${coNumber}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Project</td><td style="padding:6px 0;font-weight:600;text-align:right;">${project.project_type || "Your Project"}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Address</td><td style="padding:6px 0;font-weight:600;text-align:right;">${project.client_address || "—"}</td></tr>
                <tr style="border-top:2px solid #e2e8f0;">
                  <td style="padding:10px 0;font-weight:700;font-size:16px;">Change Order Total</td>
                  <td style="padding:10px 0;font-weight:800;font-size:20px;color:#E35235;text-align:right;">+$${coTotal}</td>
                </tr>
              </table>
            </div>

            <!-- Scope Description -->
            <div style="background:#fff7ed;border-left:4px solid #E35235;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
              <div style="font-size:12px;font-weight:700;color:#9a3412;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Scope of Change</div>
              <p style="font-size:14px;color:#431407;line-height:1.6;margin:0;">${scopeDesc}</p>
            </div>

            <!-- Line Items -->
            ${lineRows ? `
              <div style="margin-bottom:24px;">
                <div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Line Items</div>
                <table style="width:100%;border-collapse:collapse;">
                  <thead>
                    <tr style="background:#f1f5f9;">
                      <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;">Item</th>
                      <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;">Description</th>
                      <th style="padding:8px 10px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>${lineRows}</tbody>
                  <tfoot>
                    <tr style="background:#1B2B3A;">
                      <td colspan="2" style="padding:10px 10px;color:#fff;font-weight:700;">Total</td>
                      <td style="padding:10px 10px;text-align:right;color:#E35235;font-weight:800;font-size:16px;">$${coTotal}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ` : ""}

            ${co.notes ? `
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:24px;">
                <div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Terms & Notes</div>
                <p style="font-size:13px;color:#4b5563;margin:0;line-height:1.6;">${co.notes}</p>
              </div>
            ` : ""}

            <!-- CTA -->
            <div style="text-align:center;margin:28px 0;">
              <a href="${portalLink}" style="display:inline-block;background:#E35235;color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.2px;">
                Review &amp; Sign Change Order →
              </a>
              <p style="font-size:12px;color:#9ca3af;margin-top:10px;">Opens your secure client portal · E-signature required</p>
            </div>

            <p style="font-size:13px;color:#4b5563;line-height:1.7;">
              If you have any questions about this change order before signing, please don't hesitate to call us at 
              <a href="tel:+17819995400" style="color:#E35235;font-weight:600;">(781) 999-5400</a> or reply to this email.
            </p>
          </div>

          <!-- Footer -->
          <div style="background:#f1f5f9;border-radius:0 0 12px 12px;border:1px solid #e0e0e0;border-top:none;padding:20px 32px;text-align:center;">
            <p style="font-size:12px;color:#9ca3af;margin:0;">
              Coen Construction · (781) 999-5400 · info@coenconstruction.com<br>
              <span style="color:#d1d5db;">This is an automated message. Please use the portal link above to respond.</span>
            </p>
          </div>

        </div>
      </body>
      </html>
    `;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return Response.json({ error: "RESEND_API_KEY not set" }, { status: 500 });

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Coen Construction <info@coenconstruction.com>",
        reply_to: "ops@coenconstruction.com",
        to: clientEmail,
        subject: `Action Required: Change Order #${coNumber} — $${coTotal} | ${project.client_name}`,
        html: emailHtml,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      return Response.json({ error: `Email send failed: ${err}` }, { status: 500 });
    }

    return Response.json({ success: true, sent_to: clientEmail });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});