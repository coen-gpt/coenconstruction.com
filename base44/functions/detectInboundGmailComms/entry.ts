/**
 * detectInboundGmailComms — scheduled daily.
 * Scans recent Gmail InvoiceRecord-scanned messages where the sender matches
 * a ContractorProject client_email, and creates ClientCommunication inbound items.
 * This reuses the already-scanned InvoiceRecord data; it does NOT call Gmail directly.
 * Dedupes via source_ref = "gmail-client:" + gmail_message_id.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const now = new Date();
  const cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // last 3 days

  // Load active projects with client emails
  const projects = await base44.asServiceRole.entities.ContractorProject.list("-created_date", 500);
  const activeProjects = projects.filter(p =>
    ["walkthrough", "draft", "pending_review", "approved", "in_progress", "modify"].includes(p.status)
    && p.client_email
  );
  // Map email → project (lowercase for matching)
  const emailToProject = {};
  for (const p of activeProjects) {
    emailToProject[p.client_email.toLowerCase()] = p;
  }

  if (Object.keys(emailToProject).length === 0) {
    return Response.json({ ok: true, checked: 0, created: 0 });
  }

  // Load existing inbound source_refs for dedupe
  const existingInbound = await base44.asServiceRole.entities.ClientCommunication.filter({ kind: "inbound" });
  const existingRefs = new Set(existingInbound.map(c => c.source_ref).filter(Boolean));

  // Load recent InvoiceRecords that came from a client (vendor_email matches a project client)
  // We look at records received in the last 3 days
  const recentInvoices = await base44.asServiceRole.entities.InvoiceRecord.list("-email_received_date", 200);
  const resendKey = Deno.env.get("RESEND_API_KEY");

  let created = 0;
  const notifyPMs = new Set();

  for (const inv of recentInvoices) {
    if (!inv.email_received_date) continue;
    if (new Date(inv.email_received_date) < cutoff) continue;

    const senderEmail = (inv.vendor_email || "").toLowerCase();
    const project = emailToProject[senderEmail];
    if (!project) continue; // sender is not a client

    const ref = `gmail-client:${inv.gmail_message_id}`;
    if (existingRefs.has(ref)) continue; // already processed

    const item = {
      project_id: project.id,
      kind: "inbound",
      direction: "inbound",
      channel: "email",
      status: "open",
      urgency: "high",
      title: `Email from client: ${inv.email_subject || "(no subject)"}`,
      prompt_detail: inv.email_snippet ? inv.email_snippet.slice(0, 300) : "Client sent an email",
      first_contact_at: inv.email_received_date,
      due_at: inv.email_received_date,
      triggered_at: now.toISOString(),
      assigned_to: project.assigned_to || null,
      source_ref: ref,
    };

    await base44.asServiceRole.entities.ClientCommunication.create(item);
    existingRefs.add(ref);
    created++;

    if (project.assigned_to) notifyPMs.add(JSON.stringify({ email: project.assigned_to, name: project.client_name, subject: inv.email_subject }));
  }

  // Notify PMs
  if (resendKey) {
    for (const raw of notifyPMs) {
      const { email, name, subject } = JSON.parse(raw);
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Coen Construction <noreply@coenconstruction.com>",
            to: email,
            subject: `📩 Inbound client email from ${name}`,
            html: `<p>${name} sent an email: <em>${subject || "(no subject)"}</em></p><p>Log in to the Command Center to respond.</p>`,
          }),
        });
      } catch {
        // non-fatal
      }
    }
  }

  return Response.json({ ok: true, checked: recentInvoices.length, created });
});