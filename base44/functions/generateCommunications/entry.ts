import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyAdminSession(req, permission, body) {
  const base44 = createClientFromRequest(req);
  const auth = req.headers.get('authorization') || '';
  const token = String(body?.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
  if (!token) throw new Error('Unauthorized');
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) throw new Error('Unauthorized');
  const secret = Deno.env.get('ADMIN_SESSION_SECRET');
  if (!secret || !(await verifySignature(`${header}.${payload}`, signature, secret).catch(() => false))) throw new Error('Unauthorized');
  const session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  if (Number(session.exp || 0) < Math.floor(Date.now() / 1000)) throw new Error('Session expired');
  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: String(session.email || '').toLowerCase() });
  const user = users[0];
  if (!user || user.active === false) throw new Error('Forbidden');
  if (permission && user.role !== 'admin' && !user[permission]) throw new Error('Forbidden');
  return { base44, user };
}

// ─── Default benchmark definitions ───────────────────────────────────────────
const DEFAULT_BENCHMARKS = [
  {
    key: "new_lead_acknowledged",
    name: "New Lead Acknowledged",
    description: "Reach out to a new lead within 1 hour of intake",
    active: true,
    trigger_type: "project_created",
    trigger_value: "",
    offset_hours: 1,
    channel_suggested: "phone",
    message_template: "Hi [Client Name], this is [Your Name] from Coen Construction. I just received your inquiry and wanted to reach out personally. I'd love to learn more about your project and schedule a time to discuss how we can help.",
    default_urgency: "high",
    escalate_to_high_after_hours: 1,
  },
  {
    key: "post_walkthrough_recap",
    name: "Post-Walkthrough Recap",
    description: "Send a recap summary 24h after walkthrough / draft starts",
    active: true,
    trigger_type: "project_status_change",
    trigger_value: "draft",
    offset_hours: 24,
    channel_suggested: "email",
    message_template: "Hi [Client Name], thank you for having us out yesterday. I'm currently preparing a detailed proposal based on what we discussed. I'll have it over to you shortly and am happy to answer any questions in the meantime.",
    default_urgency: "normal",
    escalate_to_high_after_hours: 48,
  },
  {
    key: "estimate_sent_nudge",
    name: "Estimate Sent – No Response Nudge",
    description: "Follow up if client hasn't responded to sent estimate after 3 days",
    active: true,
    trigger_type: "project_status_change",
    trigger_value: "pending_review",
    offset_hours: 72,
    channel_suggested: "phone",
    message_template: "Hi [Client Name], I wanted to check in and see if you had a chance to look over the proposal we sent. I'm happy to walk you through any line item or answer questions—just let me know what works best.",
    default_urgency: "normal",
    escalate_to_high_after_hours: 48,
  },
  {
    key: "contract_signed_kickoff",
    name: "Contract Signed – Kickoff Call",
    description: "Kickoff contact same day client signs the contract",
    active: true,
    trigger_type: "project_status_change",
    trigger_value: "approved",
    offset_hours: 0,
    channel_suggested: "phone",
    message_template: "Hi [Client Name], congratulations and thank you for choosing Coen Construction! I'd love to schedule a brief kickoff call to introduce the team, confirm the timeline, and answer any questions before we get started.",
    default_urgency: "high",
    escalate_to_high_after_hours: 8,
  },
  {
    key: "pre_start_confirmation",
    name: "Pre-Start Confirmation",
    description: "Confirm logistics 48h before scheduled start date",
    active: true,
    trigger_type: "pre_milestone",
    trigger_value: "start_date",
    offset_hours: -48,
    channel_suggested: "phone",
    message_template: "Hi [Client Name], we're getting ready to start on [Start Date]. I wanted to confirm access, any last-minute questions, and that everything is set on your end. Looking forward to getting started!",
    default_urgency: "high",
    escalate_to_high_after_hours: 12,
  },
  {
    key: "weekly_progress_update",
    name: "Weekly Progress Update",
    description: "Check in every 7 days while project is in progress",
    active: true,
    trigger_type: "time_interval",
    trigger_value: "in_progress",
    offset_hours: 168,
    channel_suggested: "email",
    message_template: "Hi [Client Name], here's a quick update on where things stand this week. [Progress summary]. Please don't hesitate to reach out if you have any questions—we're always happy to connect.",
    default_urgency: "normal",
    escalate_to_high_after_hours: 48,
  },
  {
    key: "go_quiet_guard",
    name: "Go-Quiet Guard",
    description: "Alert if no logged contact in 10+ days on an active project",
    active: true,
    trigger_type: "days_since_last_contact",
    trigger_value: "10",
    offset_hours: 0,
    channel_suggested: "phone",
    message_template: "Hi [Client Name], just checking in to see how everything is going and if you have any questions. We want to make sure you feel informed throughout the project.",
    default_urgency: "normal",
    escalate_to_high_after_hours: 24,
  },
  {
    key: "milestone_complete_update",
    name: "Milestone Complete – Client Update",
    description: "Notify client when a key milestone is marked done",
    active: true,
    trigger_type: "milestone_complete",
    trigger_value: "",
    offset_hours: 0,
    channel_suggested: "portal",
    message_template: "Hi [Client Name], we're excited to share that we've completed [Milestone Name]. Everything looks great and we're moving into the next phase. Please feel free to review and reach out with any feedback.",
    default_urgency: "normal",
    escalate_to_high_after_hours: 24,
  },
  {
    key: "post_completion_thank_you",
    name: "Post-Completion Thank You + Review Ask",
    description: "Thank you and review request 2 days after project completion",
    active: true,
    trigger_type: "project_status_change",
    trigger_value: "completed",
    offset_hours: 48,
    channel_suggested: "email",
    message_template: "Hi [Client Name], it has been a pleasure working with you on this project. We hope you're thrilled with the results! If you have a moment, we'd really appreciate a Google review—it means the world to our small business. [Google Review Link]",
    default_urgency: "normal",
    escalate_to_high_after_hours: 48,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addHours(dateStr, hours) {
  const d = new Date(dateStr);
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d.toISOString();
}

function hoursAgo(dateStr) {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
}

function daysSince(dateStr) {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
}

function urgencyForBenchmark(bm, dueAt) {
  if (bm.default_urgency === "high") return "high";
  if (dueAt && new Date(dueAt) < new Date()) {
    const hoursOverdue = (Date.now() - new Date(dueAt).getTime()) / (1000 * 60 * 60);
    if (hoursOverdue >= (bm.escalate_to_high_after_hours || 24)) return "high";
    return "normal";
  }
  return bm.default_urgency || "normal";
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
  const body = await req.json().catch(() => ({}));
  const { base44 } = await verifyAdminSession(req, 'can_access_estimates', body);
  const { seed_defaults } = body;

  // ── Seed defaults if requested ──
  if (seed_defaults) {
    const existing = await base44.asServiceRole.entities.CommunicationBenchmark.list();
    const existingKeys = new Set(existing.map(b => b.key));
    let seeded = 0;
    for (const bm of DEFAULT_BENCHMARKS) {
      if (!existingKeys.has(bm.key)) {
        await base44.asServiceRole.entities.CommunicationBenchmark.create(bm);
        seeded++;
      }
    }
    return Response.json({ ok: true, seeded });
  }

  // ── Load data ──
  const [benchmarks, projects, existingComms, estimates] = await Promise.all([
    base44.asServiceRole.entities.CommunicationBenchmark.filter({ active: true }),
    base44.asServiceRole.entities.ContractorProject.list("-created_date", 500),
    base44.asServiceRole.entities.ClientCommunication.filter({ status: "open" }),
    base44.asServiceRole.entities.Estimate.list("-created_date", 500),
  ]);

  // Build a map of open comms: "project_id:benchmark_key" → true (for dedup)
  const openSet = new Set(
    existingComms
      .filter(c => c.benchmark_key && c.project_id)
      .map(c => `${c.project_id}:${c.benchmark_key}`)
  );

  // Last logged contact per project
  const loggedComms = await base44.asServiceRole.entities.ClientCommunication.filter({ status: "logged" });
  const lastContact = {};
  for (const c of loggedComms) {
    if (c.project_id && c.contacted_at) {
      if (!lastContact[c.project_id] || c.contacted_at > lastContact[c.project_id]) {
        lastContact[c.project_id] = c.contacted_at;
      }
    }
  }

  const now = new Date();
  const created = [];
  const notifyItems = [];

  for (const project of projects) {
    const activeStatuses = ["walkthrough", "draft", "pending_review", "approved", "in_progress", "modify"];
    if (!activeStatuses.includes(project.status)) continue;

    for (const bm of benchmarks) {
      const dedupKey = `${project.id}:${bm.key}`;
      if (openSet.has(dedupKey)) continue; // already open

      let due_at = null;
      let shouldCreate = false;

      switch (bm.trigger_type) {
        case "project_created": {
          if (!project.created_date) break;
          due_at = addHours(project.created_date, bm.offset_hours || 1);
          // Only create if we're within 48h window of creation and not already logged
          if (daysSince(project.created_date) <= 2 && !loggedComms.some(c => c.project_id === project.id && c.benchmark_key === bm.key)) {
            shouldCreate = true;
          }
          break;
        }
        case "project_status_change": {
          const targetStatus = bm.trigger_value;
          if (!targetStatus || project.status !== targetStatus) break;
          const refDate = project.updated_date || project.created_date;
          if (!refDate) break;
          due_at = addHours(refDate, bm.offset_hours || 0);
          if (now >= new Date(due_at) && !loggedComms.some(c => c.project_id === project.id && c.benchmark_key === bm.key && daysSince(c.contacted_at) < 30)) {
            shouldCreate = true;
          }
          break;
        }
        case "time_interval": {
          // Only for in_progress projects — weekly
          if (project.status !== "in_progress") break;
          const intervalHours = bm.offset_hours || 168;
          const last = lastContact[project.id];
          const refDate = last || project.updated_date || project.created_date;
          if (!refDate) break;
          if (hoursAgo(refDate) >= intervalHours) {
            due_at = new Date().toISOString();
            shouldCreate = true;
          }
          break;
        }
        case "days_since_last_contact": {
          const days = parseFloat(bm.trigger_value || "10");
          const last = lastContact[project.id];
          if (!last) break;
          if (daysSince(last) >= days) {
            due_at = new Date().toISOString();
            shouldCreate = true;
          }
          break;
        }
        case "pre_milestone": {
          // Only for start_date for now
          const startDate = project.workflow_schedule?.start_date;
          if (!startDate) break;
          const dueDate = addHours(startDate + "T09:00:00Z", bm.offset_hours || -48);
          due_at = dueDate;
          const hoursUntilDue = (new Date(dueDate) - now) / (1000 * 60 * 60);
          if (hoursUntilDue <= 0 && hoursUntilDue >= -72) {
            if (!loggedComms.some(c => c.project_id === project.id && c.benchmark_key === bm.key && daysSince(c.contacted_at) < 7)) {
              shouldCreate = true;
            }
          }
          break;
        }
        default:
          break;
      }

      if (!shouldCreate) continue;

      const urgency = urgencyForBenchmark(bm, due_at);
      const promptDetail = `[${bm.name}] ${bm.description || ""} — Project: ${project.client_name}`;

      const newItem = {
        project_id: project.id,
        kind: "benchmark",
        direction: "outbound",
        status: "open",
        urgency,
        benchmark_key: bm.key,
        title: bm.name,
        prompt_detail: promptDetail,
        channel: bm.channel_suggested,
        due_at: due_at || now.toISOString(),
        triggered_at: now.toISOString(),
        assigned_to: project.assigned_to || null,
      };

      await base44.asServiceRole.entities.ClientCommunication.create(newItem);
      created.push(newItem);
      openSet.add(dedupKey);

      if (urgency === "high") {
        notifyItems.push({ project, bm, urgency });
      }
    }
  }

  // ── Escalate urgency on existing overdue items ──
  for (const item of existingComms) {
    if (item.urgency === "high" || !item.due_at || item.kind === "inbound") continue;
    if (!item.benchmark_key) continue;
    const bm = benchmarks.find(b => b.key === item.benchmark_key);
    if (!bm) continue;
    const hoursOverdue = (now - new Date(item.due_at)) / (1000 * 60 * 60);
    if (hoursOverdue >= (bm.escalate_to_high_after_hours || 24)) {
      await base44.asServiceRole.entities.ClientCommunication.update(item.id, { urgency: "high" });
      notifyItems.push({ project: { assigned_to: item.assigned_to, client_name: "Client" }, bm, urgency: "high" });
    }
  }

  // ── Fire PM notifications for high urgency items ──
  const resendKey = Deno.env.get("RESEND_API_KEY");
  for (const { project, bm } of notifyItems.slice(0, 10)) {
    const pmEmail = project.assigned_to;
    if (!pmEmail || !resendKey) continue;
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Coen Construction <noreply@coenconstruction.com>",
          to: pmEmail,
          subject: `⚠️ Urgent: ${bm.name} — ${project.client_name}`,
          html: `<p>A high-urgency client communication item requires your attention:</p>
                 <p><strong>${bm.name}</strong> for ${project.client_name}</p>
                 <p>Please log in to the Command Center to action this item.</p>`
        }),
      });
    } catch {
      // Non-fatal — don't block the response
    }
  }

  return Response.json({ ok: true, created: created.length, escalated: notifyItems.length });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});