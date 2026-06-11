import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Customer approval endpoint (public, token-secured).
 *
 * Accepts either token type:
 *  - approval_token  (stored on ContractorProject — sent via sendApprovalEmail)
 *  - portal_token    (stored on CustomerPortal — the customer portal link)
 *
 * Actions:
 *  - view    → returns sanitized project + estimate data so the approval page
 *              can show the customer what they're approving. Read-only.
 *  - approve → estimate.status = approved (+ approved_date). Original
 *              estimates also flip project.status and store the signature /
 *              deposit when provided. Change orders only update the estimate
 *              and the project's adjusted_total — project status is untouched.
 *  - deny    → estimate.status = rejected; original estimates set
 *              project.status = denied.
 *  - modify  → original estimates set project.status = modify; the estimate
 *              stays "sent" while it's revised.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, action, notes, estimate_id, signature_data, deposit_amount } = await req.json();

    if (!token || !action) {
      return Response.json({ error: 'token and action are required' }, { status: 400 });
    }
    if (!['view', 'approve', 'deny', 'modify'].includes(action)) {
      return Response.json({ error: 'Invalid action. Must be view, approve, deny, or modify' }, { status: 400 });
    }

    // ── Resolve the project from either token type ───────────────────────────
    let project = null;
    let viaPortal = false;

    const tokenMatches = await base44.asServiceRole.entities.ContractorProject.filter({ approval_token: token });
    project = tokenMatches[0] || null;

    if (project) {
      if (project.approval_token_expires && new Date(project.approval_token_expires) < new Date()) {
        return Response.json({ error: 'This approval link has expired' }, { status: 410 });
      }
    } else {
      const portals = await base44.asServiceRole.entities.CustomerPortal.filter({ portal_token: token });
      const portal = portals[0];
      if (portal) {
        if (portal.portal_token_expires && new Date(portal.portal_token_expires) < new Date()) {
          return Response.json({ error: 'This approval link has expired' }, { status: 410 });
        }
        viaPortal = true;
        const rows = await base44.asServiceRole.entities.ContractorProject.filter({ id: portal.project_id });
        project = rows[0] || null;
      }
    }

    if (!project) return Response.json({ error: 'Invalid or expired link' }, { status: 404 });

    // ── Resolve the target estimate ──────────────────────────────────────────
    const estimates = await base44.asServiceRole.entities.Estimate.filter({ project_id: project.id });
    const estimate = estimate_id
      ? estimates.find(e => e.id === estimate_id)
      : estimates.find(e => e.type === 'original' && e.status !== 'superseded') || estimates[0];
    const isChangeOrder = estimate?.type === 'change_order';

    // A supplied estimate_id must belong to this project — and a decision must
    // act on a real estimate. Otherwise a tampered request could flip the
    // project's status without any estimate being approved.
    if (action !== 'view' && (!estimate || (estimate_id && estimate.id !== estimate_id))) {
      return Response.json({ error: 'Estimate not found for this project' }, { status: 404 });
    }

    // ── action: view — sanitized read for the approval page ──────────────────
    if (action === 'view') {
      // The customer is looking at their quote — record it so the estimator
      // can see "Viewed" on the Customer Quotes page. Token-gated, so this
      // only fires for the customer's own link. Never block the page on it.
      if (estimate && !['approved', 'rejected', 'superseded'].includes(estimate.status)) {
        const now = new Date().toISOString();
        await base44.asServiceRole.entities.Estimate.update(estimate.id, {
          viewed_at: estimate.viewed_at || now,
          view_count: (estimate.view_count || 0) + 1,
        }).catch(() => {});
      }
      return Response.json({
        client_name: project.client_name,
        project_type: project.project_type,
        client_address: [project.client_address, project.client_city, project.client_zipcode].filter(Boolean).join(', '),
        estimate: estimate
          ? {
              id: estimate.id,
              type: estimate.type,
              status: estimate.status,
              title: estimate.title,
              grand_total: estimate.grand_total,
              notes: estimate.notes,
              valid_until: estimate.valid_until,
              change_order_number: estimate.change_order_number,
              scope_change_description: estimate.scope_change_description,
              line_items: (estimate.line_items || []).map(item => ({
                parent_group: item.parent_group,
                title: item.title,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                total: item.total,
              })),
            }
          : null,
      });
    }

    // ── Apply the decision ────────────────────────────────────────────────────
    if (estimate) {
      if (action === 'approve') {
        await base44.asServiceRole.entities.Estimate.update(estimate.id, {
          status: 'approved',
          approved_date: new Date().toISOString().split('T')[0],
        });
      } else if (action === 'deny') {
        await base44.asServiceRole.entities.Estimate.update(estimate.id, { status: 'rejected' });
      }
      // modify: estimate stays "sent" while the estimator revises it
    }

    if (action === 'approve') {
      // Recompute adjusted_total = approved original + approved change orders
      const fresh = await base44.asServiceRole.entities.Estimate.filter({ project_id: project.id });
      const approvedTotal = fresh
        .filter(e => e.status === 'approved' && e.type !== 'revision')
        .reduce((sum, e) => sum + (e.grand_total || 0), 0);

      const projectUpdates = { adjusted_total: approvedTotal || project.adjusted_total };

      if (signature_data) {
        projectUpdates.client_signed = true;
        projectUpdates.signed_date = new Date().toISOString().split('T')[0];
        projectUpdates.contract_signed_at = new Date().toISOString();
        if (!isChangeOrder) projectUpdates.contract_signature_data = signature_data;
        if (deposit_amount) projectUpdates.deposit_amount = deposit_amount;
      }

      if (!isChangeOrder) {
        projectUpdates.status = 'approved';
        projectUpdates.approver_notes = notes || null;
        if (!viaPortal) {
          projectUpdates.approval_token = null;
          projectUpdates.approval_token_expires = null;
        }
      }

      await base44.asServiceRole.entities.ContractorProject.update(project.id, projectUpdates);
    } else if (!isChangeOrder) {
      // deny / modify on the original estimate
      const projectUpdates = {
        status: action === 'deny' ? 'denied' : 'modify',
        approver_notes: notes || null,
      };
      if (!viaPortal) {
        projectUpdates.approval_token = null;
        projectUpdates.approval_token_expires = null;
      }
      await base44.asServiceRole.entities.ContractorProject.update(project.id, projectUpdates);
    }

    // ── Notify the estimator ──────────────────────────────────────────────────
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const notifyTo = project.assigned_to || 'scott@coenconstruction.com';
    if (resendKey && notifyTo) {
      const docLabel = isChangeOrder ? `Change Order #${estimate?.change_order_number || ''}` : 'Estimate';
      const actionLabels = { approve: 'Approved ✅', deny: 'Denied ❌', modify: 'Modifications Requested 🔄' };
      const signatureNote = signature_data
        ? `<p style="background:#d4edda;border-left:3px solid #28a745;padding:12px;margin:16px 0;"><strong>✓ Client Signature Received</strong><br>The ${docLabel.toLowerCase()} has been digitally signed.</p>`
        : '';
      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
          <div style="background:#1B2B3A;padding:20px;text-align:center;">
            <h2 style="color:#E35235;margin:0;">${docLabel} ${actionLabels[action]}</h2>
          </div>
          <div style="padding:24px;">
            <p>The ${docLabel.toLowerCase()} for <strong>${project.client_name}</strong> ($${(estimate?.grand_total || 0).toLocaleString()}) has been <strong>${action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'flagged for modifications'}</strong> by the client.</p>
            ${signatureNote}
            ${notes ? `<div style="background:#fff3cd;border-left:3px solid #ffc107;padding:12px;margin:16px 0;"><strong>Client Notes:</strong><br>${notes}</div>` : ''}
            <p>Log in to the estimator dashboard to view the updated project.</p>
          </div>
        </div>
      `;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Coen Construction <noreply@coenconstruction.com>",
          to: notifyTo,
          subject: `${docLabel} ${actionLabels[action]}: ${project.client_name}`,
          html: emailHtml,
        }),
      }).catch(() => {});
    }

    const statusMap = { approve: 'approved', deny: 'denied', modify: 'modify' };
    return Response.json({ success: true, status: statusMap[action], client_name: project.client_name });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
