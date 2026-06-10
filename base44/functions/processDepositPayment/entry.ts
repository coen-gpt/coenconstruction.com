import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { token, amount, method, card_name, card_number, card_expiry, card_cvc, routing_number, account_number, account_name } = body;

    if (!token || !amount || !method) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate via portal token. The project is ALWAYS resolved from the
    // token — never trusted from the request body — so a portal token can
    // only ever pay the deposit on its own project.
    const portals = await base44.asServiceRole.entities.CustomerPortal.filter({ portal_token: token });
    const portal = portals[0];
    if (!portal) {
      return Response.json({ error: "Invalid portal token" }, { status: 403 });
    }
    if (portal.portal_token_expires && new Date(portal.portal_token_expires) < new Date()) {
      return Response.json({ error: "This portal link has expired" }, { status: 410 });
    }
    const project_id = portal.project_id;

    // "Mail a check" — record the intent and unlock the portal; deposit_paid
    // stays false until the check actually arrives.
    if (method === "check") {
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
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    // ACH is not supported: a Stripe bank-account token alone cannot be
    // charged without account verification, so the old path reported success
    // without ever moving money. Card or check only.
    if (method === "ach") {
      return Response.json({
        error: "Bank transfer isn't available online yet. Please pay by card, or choose 'Mail a Check' and we'll activate your portal on receipt.",
      }, { status: 400 });
    }

    if (!stripeKey) {
      // Never fake a successful charge. Tell the customer to use a check or
      // call the office, and alert the team that Stripe isn't configured.
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: "scott@coenconstruction.com",
          subject: "⚠️ Customer tried to pay a deposit but Stripe is not configured",
          body: `A customer attempted an online ${method} deposit of $${Number(amount).toLocaleString()} but STRIPE_SECRET_KEY is not set in the Base44 app, so no charge could be processed.\n\nAdd the Stripe secret key in Base44 → Settings → Environment Variables, or follow up with the customer to collect payment another way.`,
        });
      } catch (_) {}
      return Response.json({
        error: "Online card payment isn't available right now. Please choose 'Mail a Check', or call us at (781) 999-5400 and we'll take payment over the phone.",
      }, { status: 503 });
    }

    // === STRIPE PAYMENT PROCESSING ===
    let transactionId = null;

    if (method === "card") {
      // Create a payment method and charge it
      const pmRes = await fetch("https://api.stripe.com/v1/payment_methods", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          "type": "card",
          "card[number]": card_number,
          "card[exp_month]": card_expiry.split("/")[0],
          "card[exp_year]": "20" + card_expiry.split("/")[1],
          "card[cvc]": card_cvc,
          "billing_details[name]": card_name,
        }),
      });
      const pm = await pmRes.json();
      if (pm.error) return Response.json({ error: pm.error.message }, { status: 400 });

      const piRes = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          "amount": String(Math.round(amount * 100)),
          "currency": "usd",
          "payment_method": pm.id,
          "confirm": "true",
          "description": `Deposit — Project ${project_id}`,
          "metadata[project_id]": project_id,
        }),
      });
      const pi = await piRes.json();
      if (pi.error) return Response.json({ error: pi.error.message }, { status: 400 });
      transactionId = pi.id;
    } else {
      return Response.json({ error: "Unsupported payment method" }, { status: 400 });
    }

    // Update project record
    await base44.asServiceRole.entities.ContractorProject.update(project_id, {
      deposit_paid: true,
      deposit_paid_at: new Date().toISOString(),
      deposit_amount: amount,
      deposit_payment_method: method,
      deposit_transaction_id: transactionId,
      portal_access_granted: true,
      status: "in_progress",
    });

    // Send emails
    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: project_id });
    const project = projects[0];
    if (project?.client_email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: project.client_email,
        subject: `Deposit Received — ${project.project_type} Project`,
        body: `Hi ${project.client_name},\n\nThank you! We've received your deposit of $${amount.toLocaleString()} for your ${project.project_type} project.\n\nYour customer portal is now fully active. You can access project updates, photos, and chat with your project manager anytime.\n\nWe look forward to building your project!\n\nCoen Construction LLC\n(781) 999-5400`,
      });
    }
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: "scott@coenconstruction.com",
        subject: `💰 Deposit Received — ${project?.client_name} ($${amount.toLocaleString()})`,
        body: `Deposit received!\n\nClient: ${project?.client_name}\nProject: ${project?.project_type} at ${project?.client_address}\nDeposit: $${amount.toLocaleString()}\nMethod: ${method}\nTransaction ID: ${transactionId}`,
      });
    } catch (_) {}

    return Response.json({ success: true, transaction_id: transactionId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});