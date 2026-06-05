import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * AI-draft + send a branded email to any audience type:
 * customer | subcontractor | vendor | team_member
 *
 * Body params:
 *   audience_type   "customer" | "subcontractor" | "vendor" | "team_member"
 *   to_email        recipient email
 *   to_name         recipient name
 *   subject         email subject
 *   body_html       pre-drafted HTML (if provided, skip AI draft)
 *   project_id      optional — for context
 *   comm_id         optional — ClientCommunication id to close after send
 *   draft_only      boolean — if true, return draft without sending
 *   context_hint    free-text context for AI drafting (benchmark title, intent, etc.)
 */

function brandedWrapper(company, recipientName, bodyContent, audienceType, portalUrl) {
  const accentColor = company?.brand_color || "#E35235";
  const navyColor = "#1B2B3A";
  const companyName = company?.company_name || "Coen Construction";
  const companyPhone = company?.phone || "";
  const companyWebsite = "https://coenconstruction.com";

  const ctaSection = audienceType === "customer" && portalUrl
    ? `<div style="margin:24px 0;text-align:center;">
        <a href="${portalUrl}" style="display:inline-block;background:${accentColor};color:white;padding:13px 30px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;">
          View Your Project Portal →
        </a>
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:${navyColor};padding:24px 32px;border-radius:10px 10px 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:white;font-size:22px;font-weight:800;letter-spacing:-0.5px;">${companyName}</span>
                  <br><span style="color:rgba(255,255,255,0.45);font-size:12px;font-weight:500;">Licensed General Contractor · Est. 1998</span>
                </td>
                <td align="right">
                  <div style="width:10px;height:10px;border-radius:50%;background:${accentColor};display:inline-block;"></div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:32px 36px;border:1px solid #e8e8e8;border-top:none;">
            <p style="font-size:16px;color:#1B2B3A;margin:0 0 20px 0;">Hi ${recipientName},</p>
            ${bodyContent}
            ${ctaSection}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:${navyColor};padding:18px 32px;border-radius:0 0 10px 10px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:rgba(255,255,255,0.5);font-size:12px;">${companyName}</span>
                  ${companyPhone ? `<span style="color:rgba(255,255,255,0.3);font-size:12px;"> · ${companyPhone}</span>` : ""}
                </td>
                <td align="right">
                  <a href="${companyWebsite}" style="color:rgba(255,255,255,0.4);font-size:11px;text-decoration:none;">${companyWebsite}</a>
                </td>
              </tr>
              <tr><td colspan="2" style="padding-top:8px;">
                <span style="color:rgba(255,255,255,0.25);font-size:10px;">© ${new Date().getFullYear()} ${companyName}. This message was sent from our project management system.</span>
              </td></tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    audience_type = "customer",
    to_email,
    to_name = "there",
    subject,
    body_html,
    project_id,
    comm_id,
    draft_only = false,
    context_hint = "",
  } = body;

  if (!to_email) return Response.json({ error: "to_email is required" }, { status: 400 });
  if (!subject) return Response.json({ error: "subject is required" }, { status: 400 });

  // Load company profile for branding
  const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
  const company = profiles[0] || {};

  // Load project context if provided
  let project = null;
  let portalUrl = null;
  if (project_id) {
    const projects = await base44.asServiceRole.entities.ContractorProject.filter({ id: project_id });
    project = projects[0] || null;

    // Get portal token if customer
    if (audience_type === "customer") {
      const portals = await base44.asServiceRole.entities.CustomerPortal.filter({ project_id });
      const portal = portals[0];
      if (portal?.portal_token) {
        portalUrl = `https://coenconstruction.com/customer-portal?token=${portal.portal_token}`;
      }
    }
  }

  // AI-draft the body if not provided
  let finalBodyHtml = body_html;

  if (!finalBodyHtml) {
    const systemPrompt = `You are a professional communications writer for ${company.company_name || "Coen Construction"}, 
a licensed general contractor. Write polished, warm, and professional emails on behalf of the company.

Audience context:
- customer: homeowner / project client — be warm, reassuring, clear
- subcontractor: a trade contractor working on a project — be direct, professional, concise
- vendor: a material supplier — be professional, concise, transactional  
- team_member: an internal staff member — be clear, direct, collegial

The email body MUST:
- Be in clean HTML (use <p> tags, <strong>, <ul>/<li> where needed — NO inline styles, NO wrapper divs)
- Open naturally (do NOT start with "Hi [Name]," — the wrapper handles the greeting)
- Be appropriately brief (2-4 paragraphs max unless context demands more)
- Sound like a real human wrote it — NOT a bot
- NOT mention "AI" or "automated"
- End with a warm closing signature: "Warm regards,<br><strong>${user.full_name || "The Coen Construction Team"}</strong><br>${company.company_name || "Coen Construction"}"`;

    const contextBlock = [
      project ? `Project: ${project.project_type || "Remodel"} for ${project.client_name} in ${project.client_city || ""}` : "",
      project ? `Project status: ${project.status}` : "",
      context_hint ? `Intent / context: ${context_hint}` : "",
      `Subject: ${subject}`,
      `Audience: ${audience_type}`,
      `Recipient: ${to_name}`,
    ].filter(Boolean).join("\n");

    const ai = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Draft the email body HTML for this communication:\n\n${contextBlock}`,
      system_prompt: systemPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          body_html: { type: "string", description: "Clean HTML body for the email (no wrapper, no greeting)" },
          suggested_subject: { type: "string", description: "Refined subject line if the provided one could be improved" },
        },
      },
    });

    finalBodyHtml = ai.body_html || `<p>${context_hint || "Please see the details below."}</p>`;
    if (!subject && ai.suggested_subject) {
      body.subject = ai.suggested_subject;
    }
  }

  const fullHtml = brandedWrapper(company, to_name, finalBodyHtml, audience_type, portalUrl);

  if (draft_only) {
    return Response.json({ ok: true, draft: { subject, body_html: finalBodyHtml, full_html: fullHtml, to_email, to_name } });
  }

  // Send via Resend
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return Response.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });

  const fromName = company.company_name || "Coen Construction";
  const fromEmail = "info@coenconstruction.com";

  // Use audience-appropriate reply-to alias
  const replyToMap = {
    customer: "ops@coenconstruction.com",
    subcontractor: "subs@coenconstruction.com",
    vendor: "vendors@coenconstruction.com",
    team_member: "ops@coenconstruction.com",
  };
  const replyTo = replyToMap[audience_type] || "info@coenconstruction.com";

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      reply_to: replyTo,
      to: to_email,
      subject,
      html: fullHtml,
    }),
  });

  if (!sendRes.ok) {
    const errText = await sendRes.text();
    return Response.json({ error: "Send failed: " + errText }, { status: 500 });
  }

  const now = new Date().toISOString();

  // Close the comm item if provided
  if (comm_id) {
    const dueRef = body.due_at;
    const responseMinutes = dueRef
      ? Math.max(0, Math.round((new Date(now) - new Date(dueRef)) / 60000))
      : null;
    await base44.asServiceRole.entities.ClientCommunication.update(comm_id, {
      status: "logged",
      channel: "email",
      contacted_at: now,
      handled_by: user.email,
      log_note: `Email sent: "${subject}"`,
      response_minutes: responseMinutes,
      urgency: "low",
    });
  }

  // If there's a project, write to team_messages
  if (project_id && project) {
    const existing = project.team_messages || [];
    await base44.asServiceRole.entities.ContractorProject.update(project_id, {
      team_messages: [
        ...existing,
        {
          id: `tm_${Date.now()}`,
          text: `[EMAIL → ${audience_type}] ${subject}`,
          author: user.full_name || user.email,
          author_email: user.email,
          created_at: now,
        },
      ],
    });
  }

  return Response.json({ ok: true, sent_to: to_email });
});