import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Detects inbound client messages from:
//   1. CustomerPortal chat_messages authored by the client (role="user" or not "assistant")
//   2. Gmail inbound emails where sender matches a ContractorProject client_email
// Dedupes via source_ref to prevent double-creation.
// Fires PM email notifications for new items found.

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const [projects, portals, existingInbound] = await Promise.all([
    base44.asServiceRole.entities.ContractorProject.list("-created_date", 500),
    base44.asServiceRole.entities.CustomerPortal.list("-updated_date", 500),
    base44.asServiceRole.entities.ClientCommunication.filter({ kind: "inbound" }),
  ]);

  // Build dedup set of source_refs already recorded
  const existingRefs = new Set(existingInbound.map(c => c.source_ref).filter(Boolean));

  // Index projects by id and by client_email (lowercase)
  const projectById = Object.fromEntries(projects.map(p => [p.id, p]));
  const projectByEmail = {};
  for (const p of projects) {
    if (p.client_email) {
      projectByEmail[p.client_email.toLowerCase()] = p;
    }
  }

  const activeStatuses = ["walkthrough", "draft", "pending_review", "approved", "in_progress", "modify"];
  const newItems = [];

  // ── 1. CustomerPortal chat & notes ──────────────────────────────────────────
  for (const portal of portals) {
    const project = projectById[portal.project_id];
    if (!project || !activeStatuses.includes(project.status)) continue;

    // chat_messages authored by the client (role = "user")
    for (const msg of (portal.chat_messages || [])) {
      if (msg.role !== "user") continue;
      const ref = `portal_chat_${portal.id}_${msg.created_at || msg.role + Math.random()}`;
      // Use a stable ref: portal_id + created_at
      const stableRef = `portal_chat_${portal.id}_${(msg.created_at || "").replace(/\D/g, "").slice(0, 16)}`;
      if (existingRefs.has(stableRef)) continue;
      existingRefs.add(stableRef);

      const now = new Date().toISOString();
      const contactedAt = msg.created_at || now;

      const item = {
        project_id: project.id,
        kind: "inbound",
        direction: "inbound",
        channel: "portal",
        status: "open",
        urgency: "high",
        title: "Client replied in Client Portal",
        prompt_detail: msg.content ? msg.content.slice(0, 300) : "Client sent a message in the portal.",
        due_at: contactedAt,
        first_contact_at: contactedAt,
        triggered_at: now,
        assigned_to: project.assigned_to || null,
        source_ref: stableRef,
      };
      await base44.asServiceRole.entities.ClientCommunication.create(item);
      newItems.push({ item, project });
    }

    // customer_notes authored by the client (not by staff — no author_email or author_email matches client)
    for (const note of (portal.customer_notes || [])) {
      const authorEmail = (note.author_email || "").toLowerCase();
      const clientEmail = (project.client_email || "").toLowerCase();
      // Only treat as inbound if authored by client (author_email matches client_email, or no author_email set by PM)
      if (authorEmail && authorEmail !== clientEmail) continue;
      const stableRef = `portal_note_${portal.id}_${(note.id || note.created_at || "").replace(/\D/g, "").slice(0, 16)}`;
      if (existingRefs.has(stableRef)) continue;
      existingRefs.add(stableRef);

      const now = new Date().toISOString();
      const contactedAt = note.created_at || now;

      const item = {
        project_id: project.id,
        kind: "inbound",
        direction: "inbound",
        channel: "portal",
        status: "open",
        urgency: "high",
        title: "Client posted a note in Client Portal",
        prompt_detail: note.note ? note.note.slice(0, 300) : "Client posted a note.",
        due_at: contactedAt,
        first_contact_at: contactedAt,
        triggered_at: now,
        assigned_to: project.assigned_to || null,
        source_ref: stableRef,
      };
      await base44.asServiceRole.entities.ClientCommunication.create(item);
      newItems.push({ item, project });
    }
  }

  // ── 2. Gmail inbound detection ────────────────────────────────────────────
  // We scan InvoiceRecord emails for sender match, but for inbound CLIENT emails
  // we need to check GmailConnections via the Gmail API.
  // Lightweight approach: scan InvoiceRecord emails isn't right for client emails.
  // Instead, we query recent emails from Gmail using each connected team member's token.
  const gmailConnections = await base44.asServiceRole.entities.GmailConnection.filter({ active: true });
  const resendKey = Deno.env.get("RESEND_API_KEY");

  for (const conn of gmailConnections) {
    // Get app-user OAuth token for this connection
    let accessToken = null;
    try {
      const connResult = await base44.asServiceRole.connectors.getCurrentAppUserConnection(conn.connector_id);
      accessToken = connResult?.accessToken;
    } catch {
      continue; // skip if not connected
    }
    if (!accessToken) continue;

    // Fetch recent messages from Gmail (last 50, from the past 7 days)
    const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const queryStr = `after:${sevenDaysAgo}`;
    let msgList;
    try {
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(queryStr)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const listData = await listRes.json();
      msgList = listData.messages || [];
    } catch {
      continue;
    }

    for (const msgRef of msgList.slice(0, 30)) {
      const stableRef = `gmail_inbound_${msgRef.id}`;
      if (existingRefs.has(stableRef)) continue;

      // Fetch message headers
      let msgData;
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgRef.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        msgData = await msgRes.json();
      } catch {
        continue;
      }

      const headers = msgData.payload?.headers || [];
      const fromHeader = headers.find(h => h.name === "From")?.value || "";
      const subject = headers.find(h => h.name === "Subject")?.value || "(no subject)";
      const dateHeader = headers.find(h => h.name === "Date")?.value;

      // Extract sender email
      const fromEmailMatch = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s]+@[^\s]+)/);
      const fromEmail = fromEmailMatch ? fromEmailMatch[1].toLowerCase() : "";
      if (!fromEmail) continue;

      // Check if sender matches any active project's client_email
      const project = projectByEmail[fromEmail];
      if (!project || !activeStatuses.includes(project.status)) continue;

      existingRefs.add(stableRef);

      const now = new Date().toISOString();
      const contactedAt = dateHeader ? new Date(dateHeader).toISOString() : now;

      const item = {
        project_id: project.id,
        kind: "inbound",
        direction: "inbound",
        channel: "email",
        status: "open",
        urgency: "high",
        title: `Client emailed: ${subject.slice(0, 80)}`,
        prompt_detail: `Inbound email from ${project.client_name} (${fromEmail}). Subject: "${subject}". Respond promptly.`,
        due_at: contactedAt,
        first_contact_at: contactedAt,
        triggered_at: now,
        assigned_to: project.assigned_to || null,
        source_ref: stableRef,
      };
      await base44.asServiceRole.entities.ClientCommunication.create(item);
      newItems.push({ item, project });
    }
  }

  // ── Fire PM email notifications ──────────────────────────────────────────
  for (const { item, project } of newItems.slice(0, 20)) {
    const pmEmail = item.assigned_to;
    if (!pmEmail || !resendKey) continue;
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Coen Construction <noreply@coenconstruction.com>",
          to: pmEmail,
          subject: `📥 Inbound: ${item.title} — ${project.client_name}`,
          html: `<p><strong>${project.client_name}</strong> reached out and requires a response.</p>
                 <p><strong>Type:</strong> ${item.title}</p>
                 <p><strong>Message:</strong> ${item.prompt_detail}</p>
                 <p>Log in to the <a href="https://coenconstruction.com/estimator">Command Center</a> to respond.</p>`,
        }),
      });
    } catch {
      // Non-fatal
    }
  }

  return Response.json({ ok: true, detected: newItems.length });
});