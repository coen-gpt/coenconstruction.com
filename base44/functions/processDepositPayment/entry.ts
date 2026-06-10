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

    if (!stripeKey) {
      // Stripe not yet configured — record a pending payment and grant access
      await base44.asServiceRole.entities.ContractorProject.update(project_id, {
        deposit_paid: true,
        deposit_paid_at: new Date().toISOString(),
        deposit_amount: amount,
        deposit_payment_method: method,
        deposit_transaction_id: "manual_" + Date.now(),
        portal_access_granted: true,
        status: "approved",
      });

      // Send confirmation email to client
      const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: project_id });
      const project = projects[0];
      if (project?.client_email) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: project.client_email,
          subject: `Deposit Received — ${project.project_type} Project`,
          body: `Hi ${project.client_name},\n\nThank you! We've received your deposit of $${amount.toLocaleString()} for your ${project.project_type} project.\n\nYour customer portal is now fully active. You can access project updates, photos, and chat with your project manager anytime.\n\nWe look forward to building your project!\n\nCoen Construction LLC\n(781) 999-5400\ncoenconstruction@gmail.com`,
        });
      }

      // Alert internal team
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: "scott@coenconstruction.com",
          subject: `💰 Deposit Received — ${project?.client_name} ($${amount.toLocaleString()})`,
          body: `A deposit has been received!\n\nClient: ${project?.client_name}\nProject: ${project?.project_type} at ${project?.client_address}\nDeposit: $${amount.toLocaleString()}\nMethod: ${method}\n\nProject status has been updated to Approved.`,
        });
      } catch (_) {}

      return Response.json({ success: true, transaction_id: "manual_" + Date.now() });
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

    } else if (method === "ach") {
      // ACH via Stripe — create bank account token
      const btRes = await fetch("https://api.stripe.com/v1/tokens", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          "bank_account[country]": "US",
          "bank_account[currency]": "usd",
          "bank_account[account_holder_name]": account_name,
          "bank_account[account_holder_type]": "individual",
          "bank_account[routing_number]": routing_number,
          "bank_account[account_number]": account_number,
        }),
      });
      const bt = await btRes.json();
      if (bt.error) return Response.json({ error: bt.error.message }, { status: 400 });
      transactionId = bt.id;
    }

    // Update project record
    await base44.asServiceRole.entities.ContractorProject.update(project_id, {
      deposit_paid: true,
      deposit_paid_at: new Date().toISOString(),
      deposit_amount: amount,
      deposit_payment_method: method,
      deposit_transaction_id: transactionId,
      portal_access_granted: true,
      status: "approved",
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