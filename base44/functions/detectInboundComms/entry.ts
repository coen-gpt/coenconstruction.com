/**
 * detectInboundComms — called by entity automation when CustomerPortal is updated.
 * Creates a ClientCommunication (kind=inbound) when a client posts a chat message
 * or a customer note authored by someone other than a staff member.
 * Dedupes via source_ref.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));

  const { event, data, old_data } = body;
  if (!data) return Response.json({ ok: true, skipped: "no_data" });

  const portalRecord = data;
  const projectId = portalRecord.project_id;
  if (!projectId) return Response.json({ ok: true, skipped: "no_project_id" });

  // Load project to get assigned_to and client_email
  const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: projectId });
  const project = projects[0];
  if (!project) return Response.json({ ok: true, skipped: "project_not_found" });

  const now = new Date().toISOString();
  const created = [];
  const resendKey = Deno.env.get("RESEND_API_KEY");

  // ── 1. New client chat messages ──────────────────────────────────────────────
  const newMessages = portalRecord.chat_messages || [];
  const oldMessages = old_data?.chat_messages || [];
  const oldIds = new Set(oldMessages.map(m => m.role + ":" + m.created_at));

  for (const msg of newMessages) {
    // Only client messages (not "assistant" or staff)
    if (msg.role !== "user") continue;
    const ref = `portal-chat:${projectId}:${msg.created_at || msg.role + newMessages.indexOf(msg)}`;
    if (oldIds.has(msg.role + ":" + msg.created_at)) continue; // not new

    // Dedupe
    const existing = await base44.asServiceRole.entities.ClientCommunication.filter({ source_ref: ref });
    if (existing.length > 0) continue;

    const item = {
      project_id: projectId,
      kind: "inbound",
      direction: "inbound",
      channel: "portal",
      status: "open",
      urgency: "high",
      title: "Client message in portal",
      prompt_detail: msg.content ? msg.content.slice(0, 200) : "Client posted in the project portal",
      first_contact_at: msg.created_at || now,
      due_at: msg.created_at || now,
      triggered_at: now,
      assigned_to: project.assigned_to || null,
      source_ref: ref,
    };

    await base44.asServiceRole.entities.ClientCommunication.create(item);
    created.push(item);
  }

  // ── 2. New customer notes posted by the client ───────────────────────────────
  const newNotes = portalRecord.customer_notes || [];
  const oldNotes = old_data?.customer_notes || [];
  const oldNoteIds = new Set(oldNotes.map(n => n.id).filter(Boolean));

  for (const note of newNotes) {
    if (!note.id || oldNoteIds.has(note.id)) continue;
    // Skip notes authored by staff (heuristic: if author email matches assigned_to or doesn't look like client)
    const isStaff = project.assigned_to && note.author && note.author.toLowerCase().includes(project.assigned_to.split("@")[0]);
    if (isStaff) continue;

    const ref = `portal-note:${note.id}`;
    const existing = await base44.asServiceRole.entities.ClientCommunication.filter({ source_ref: ref });
    if (existing.length > 0) continue;

    const item = {
      project_id: projectId,
      kind: "inbound",
      direction: "inbound",
      channel: "portal",
      status: "open",
      urgency: "high",
      title: "Client note in portal",
      prompt_detail: note.note ? note.note.slice(0, 200) : "Client left a note in the project portal",
      first_contact_at: note.created_at || now,
      due_at: note.created_at || now,
      triggered_at: now,
      assigned_to: project.assigned_to || null,
      source_ref: ref,
    };

    await base44.asServiceRole.entities.ClientCommunication.create(item);
    created.push(item);
  }

  // ── 3. Notify the assigned PM for each new inbound item ──────────────────────
  if (created.length > 0 && resendKey) {
    const pmEmail = project.assigned_to;
    if (pmEmail) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Coen Construction <noreply@coenconstruction.com>",
            to: pmEmail,
            subject: `📩 Client message from ${project.client_name}`,
            html: `<p>${project.client_name} has sent a message through the project portal.</p>
                   <p>Please log in to the Command Center to respond.</p>`,
          }),
        });
      } catch {
        // non-fatal
      }
    }
  }

  return Response.json({ ok: true, created: created.length });
});