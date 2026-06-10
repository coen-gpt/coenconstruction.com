import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Deposit payment intents that don't go through QuickBooks.
 *
 * Online card/ACH deposits are handled by createDepositInvoice (QuickBooks
 * Payments hosted page). This function only records the "Mail a Check"
 * choice: it unlocks the portal pending receipt and alerts the office.
 * deposit_paid stays false until the check actually arrives and is marked
 * paid in the office.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { token, amount, method } = body;

    if (!token || !amount || !method) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate via portal token. The project is ALWAYS resolved from the
    // token — never trusted from the request body.
    const portals = await base44.asServiceRole.entities.CustomerPortal.filter({ portal_token: token });
    const portal = portals[0];
    if (!portal) {
      return Response.json({ error: "Invalid portal token" }, { status: 403 });
    }
    if (portal.portal_token_expires && new Date(portal.portal_token_expires) < new Date()) {
      return Response.json({ error: "This portal link has expired" }, { status: 410 });
    }
    const project_id = portal.project_id;

    if (method !== "check") {
      return Response.json({
        error: "Online payments now run through our QuickBooks payment page — use the 'Pay Online' option, or choose 'Mail a Check'.",
      }, { status: 400 });
    }

    await base44.asServiceRole.entities.ContractorProject.update(project_id, {
      deposit_payment_method: "check",
      deposit_amount: amount,
      portal_access_granted: true,
    });
    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: project_id });
    const project = projects[0];
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: "scott@coenconstruction.com",
        subject: `📬 Check payment expected — ${project?.client_name} ($${Number(amount).toLocaleString()})`,
        body: `${project?.client_name} chose to mail a check for their deposit.\n\nProject: ${project?.project_type} at ${project?.client_address}\nDeposit: $${Number(amount).toLocaleString()}\n\nMark the deposit paid in the project once the check arrives.`,
      });
    } catch (_) {}
    return Response.json({ success: true, transaction_id: "check_pending" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
