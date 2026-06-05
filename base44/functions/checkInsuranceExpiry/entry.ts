import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysSince(isoStr) {
  if (!isoStr) return 9999;
  return (Date.now() - new Date(isoStr).getTime()) / (1000 * 60 * 60 * 24);
}

// Escalating cadence for missing-docs sequence:
//   1st reminder  → send immediately (count 0)
//   2nd reminder  → 3 days later
//   3rd reminder  → 7 days after that
//   subsequent    → every 14 days
function missingDocsThresholdDays(notifyCount) {
  if (notifyCount === 0) return 0;
  if (notifyCount === 1) return 3;
  if (notifyCount === 2) return 7;
  return 14;
}

async function sendSms(sid, token, from, phone, body) {
  if (!sid || !token || !from || !phone) return;
  const digits = phone.replace(/\D/g, "");
  const to = digits.length === 10 ? `+1${digits}` : `+${digits}`;
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${sid}:${token}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }),
  });
}

// ─── HTML email builder ───────────────────────────────────────────────────────

function buildEmail({ name, company, type, missing = [], wcExp, glExp, portalUrl, soonThreshold }) {
  const brandRed = "#E35235";
  const brandNavy = "#1B2B3A";

  let headerBg, badge, headline, bodyHtml;

  if (type === "missing") {
    headerBg = "#FEF3C7"; badge = "⚠️ Action Required";
    headline = "Required Documents Missing";
    bodyHtml = `
      <p style="margin:0 0 16px;color:#374151;">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 16px;color:#374151;">Your subcontractor file with <strong>Coen Construction LLC</strong> is missing required documents. <strong>You will not be able to bid on projects or receive payments</strong> until the following are on file:</p>
      <ul style="margin:0 0 20px;padding-left:20px;color:#374151;">
        ${missing.map(m => `<li style="margin-bottom:6px;">${m}</li>`).join("")}
      </ul>
      <p style="margin:0 0 20px;color:#374151;">Please click the button below to complete your onboarding packet — it takes about 5–10 minutes and can be done on your phone.</p>
    `;
  } else if (type === "expired") {
    headerBg = "#FEE2E2"; badge = "🚨 Urgent";
    headline = "Insurance Certificate Expired";
    const expiredLines = [
      wcExp && wcExp < new Date() ? `Workers Compensation — expired ${wcExp.toLocaleDateString()}` : null,
      glExp && glExp < new Date() ? `General Liability — expired ${glExp.toLocaleDateString()}` : null,
    ].filter(Boolean);
    bodyHtml = `
      <p style="margin:0 0 16px;color:#374151;">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 16px;color:#374151;">Your insurance certificate(s) on file with <strong>Coen Construction LLC</strong> have <strong style="color:#DC2626;">expired</strong>. Payment processing is on hold until updated certificates are received.</p>
      <ul style="margin:0 0 20px;padding-left:20px;color:#374151;">
        ${expiredLines.map(l => `<li style="margin-bottom:6px;color:#DC2626;font-weight:600;">${l}</li>`).join("")}
      </ul>
      <p style="margin:0 0 20px;color:#374151;">Please contact your insurance provider to issue a current certificate and forward it to <a href="mailto:coenconstruction@gmail.com" style="color:${brandRed};">coenconstruction@gmail.com</a>. You can also upload directly via your portal.</p>
    `;
  } else {
    // expiring_soon
    const daysUntilWc = wcExp ? Math.ceil((wcExp - new Date()) / (1000 * 60 * 60 * 24)) : null;
    const daysUntilGl = glExp ? Math.ceil((glExp - new Date()) / (1000 * 60 * 60 * 24)) : null;
    const expiringLines = [
      wcExp && wcExp < soonThreshold ? `Workers Compensation — expires ${wcExp.toLocaleDateString()} (in ${daysUntilWc} days)` : null,
      glExp && glExp < soonThreshold ? `General Liability — expires ${glExp.toLocaleDateString()} (in ${daysUntilGl} days)` : null,
    ].filter(Boolean);
    headerBg = "#FEF9C3"; badge = "📅 Heads Up";
    headline = "Insurance Expiring Soon";
    bodyHtml = `
      <p style="margin:0 0 16px;color:#374151;">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 16px;color:#374151;">This is a friendly reminder that your insurance certificate(s) on file with <strong>Coen Construction LLC</strong> are expiring soon. Please renew before expiration to avoid any pause in work or payments.</p>
      <ul style="margin:0 0 20px;padding-left:20px;color:#374151;">
        ${expiringLines.map(l => `<li style="margin-bottom:6px;color:#B45309;font-weight:600;">${l}</li>`).join("")}
      </ul>
      <p style="margin:0 0 20px;color:#374151;">Once renewed, ask your insurance agent to send an updated certificate to <a href="mailto:coenconstruction@gmail.com" style="color:${brandRed};">coenconstruction@gmail.com</a>, or upload it directly via your portal below.</p>
    `;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:${brandNavy};padding:24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="background:${brandRed};display:inline-block;padding:8px 14px;border-radius:8px;margin-bottom:12px;">
                  <span style="color:white;font-weight:700;font-size:13px;letter-spacing:0.5px;">COEN CONSTRUCTION</span>
                </div>
                <h1 style="margin:0;color:white;font-size:22px;font-weight:700;">${headline}</h1>
              </td>
              <td align="right" style="vertical-align:top;">
                <div style="background:${headerBg};border-radius:20px;padding:6px 14px;font-size:12px;font-weight:700;white-space:nowrap;">${badge}</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          ${bodyHtml}

          ${portalUrl ? `
          <!-- CTA Button -->
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr>
              <td style="background:${brandRed};border-radius:10px;">
                <a href="${portalUrl}" style="display:block;padding:14px 28px;color:white;font-weight:700;font-size:15px;text-decoration:none;">
                  Open My Subcontractor Portal →
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 16px;color:#6B7280;font-size:13px;">Or copy this link: <a href="${portalUrl}" style="color:${brandRed};word-break:break-all;">${portalUrl}</a></p>
          ` : ""}

          <!-- Divider -->
          <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">

          <p style="margin:0;color:#6B7280;font-size:13px;">Questions? Reply to this email or contact us:</p>
          <p style="margin:4px 0 0;color:#374151;font-size:13px;">
            📧 <a href="mailto:coenconstruction@gmail.com" style="color:${brandRed};">coenconstruction@gmail.com</a> &nbsp;·&nbsp;
            📞 <a href="tel:+16174126046" style="color:${brandRed};">(617) 412-6046</a>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;">
          <p style="margin:0;color:#9CA3AF;font-size:11px;text-align:center;">
            Coen Construction LLC · 387 Page St, Suite 10B, Stoughton, MA 02072<br>
            This is an automated compliance reminder. To stop receiving these emails, contact us directly.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const vendors = await base44.asServiceRole.entities.Vendor.filter({ is_subcontractor: true });

    const now = new Date();
    const soonThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");
    const APP_BASE_URL = req.headers.get("origin") || "https://coenconstruction.com";

    let checked = 0, notified = 0, statusUpdates = 0;
    const log = [];

    for (const vendor of vendors) {
      if (vendor.compliance_sequence_paused) continue;
      checked++;

      const name = vendor.contact_name || vendor.company_name;
      const hasWc = !!vendor.workers_comp_url;
      const hasGl = !!vendor.liability_ins_url;
      const hasW9 = !!vendor.w9_url;
      const packetDone = vendor.packet_status === "completed";
      const wcExp = vendor.workers_comp_expiry ? new Date(vendor.workers_comp_expiry) : null;
      const glExp = vendor.liability_ins_expiry ? new Date(vendor.liability_ins_expiry) : null;

      // ── Determine insurance status ──────────────────────────────────────────
      let newInsStatus = vendor.insurance_status || "pending";
      if (!hasWc || !hasGl || !hasW9 || !packetDone) {
        newInsStatus = "pending";
      } else if ((wcExp && wcExp < now) || (glExp && glExp < now)) {
        newInsStatus = "expired";
      } else if ((wcExp && wcExp < soonThreshold) || (glExp && glExp < soonThreshold)) {
        newInsStatus = "expiring_soon";
      } else if (hasWc && hasGl && wcExp && glExp) {
        newInsStatus = "valid";
      }

      const statusChanged = newInsStatus !== vendor.insurance_status;

      // Build portal link (reuse existing onboarding token if present, else use vendor id as fallback key)
      const existingToken = vendor.packet_form_data?.onboarding_token;
      const portalUrl = existingToken
        ? `${APP_BASE_URL}/subcontractor-portal?token=${existingToken}`
        : `${APP_BASE_URL}/sub-onboarding?vendor=${vendor.id}`;

      // ── SEQUENCE 1: Missing documents ──────────────────────────────────────
      // Fires if packet not complete OR any doc missing.
      // Uses escalating cadence: immediate → 3d → 7d → 14d
      const missingItems = [
        !packetDone ? "Subcontractor Agreement (unsigned)" : null,
        !hasWc ? "Workers Compensation Certificate" : null,
        !hasGl ? "General Liability Certificate" : null,
        !hasW9 ? "W-9 Form" : null,
      ].filter(Boolean);

      if (missingItems.length > 0 && vendor.email) {
        const notifyCount = vendor.missing_docs_notify_count || 0;
        const threshold = missingDocsThresholdDays(notifyCount);
        const daysSinceNotified = daysSince(vendor.missing_docs_notified_at);

        if (daysSinceNotified >= threshold) {
          // Generate / reuse portal link for onboarding
          const onboardingUrl = existingToken
            ? `${APP_BASE_URL}/subcontractor-portal?token=${existingToken}`
            : `${APP_BASE_URL}/sub-onboarding?vendor=${vendor.id}`;

          const html = buildEmail({ name, company: vendor.company_name, type: "missing", missing: missingItems, portalUrl: onboardingUrl });
          const subject = notifyCount === 0
            ? `Action Required: Complete Your Subcontractor Packet — Coen Construction`
            : `Reminder ${notifyCount + 1}: Missing Documents — Coen Construction`;

          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: vendor.email,
              subject,
              body: html,
              content_type: "text/html",
            });

            // SMS only on first and third touch (not every reminder)
            if ((notifyCount === 0 || notifyCount === 2) && vendor.phone) {
              const smsText = `Coen Construction: You have ${missingItems.length} missing compliance document(s). Complete your packet to access bids & payments: ${onboardingUrl}`;
              await sendSms(TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, vendor.phone, smsText);
            }

            await base44.asServiceRole.entities.Vendor.update(vendor.id, {
              insurance_status: newInsStatus,
              missing_docs_notified_at: now.toISOString(),
              missing_docs_notify_count: notifyCount + 1,
            });
            notified++;
            log.push({ vendor: vendor.company_name, type: "missing_docs", touch: notifyCount + 1 });
          } catch (e) {
            log.push({ vendor: vendor.company_name, error: e.message });
          }
          continue; // skip expiry check for this sub since packet/docs are incomplete
        }
      }

      // ── SEQUENCE 2: Insurance expired ─────────────────────────────────────
      if (newInsStatus === "expired" && vendor.email) {
        const daysSince7 = daysSince(vendor.insurance_expiry_notified_at);
        if (daysSince7 >= 7) {
          const html = buildEmail({ name, company: vendor.company_name, type: "expired", wcExp, glExp, portalUrl });
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: vendor.email,
              subject: "🚨 Urgent: Insurance Expired — Coen Construction",
              body: html,
              content_type: "text/html",
            });
            if (vendor.phone) {
              await sendSms(TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, vendor.phone,
                `Coen Construction: Your insurance certificate has EXPIRED. Payments are on hold. Upload now: ${portalUrl}`);
            }
            await base44.asServiceRole.entities.Vendor.update(vendor.id, {
              insurance_status: newInsStatus,
              insurance_expiry_notified_at: now.toISOString(),
            });
            notified++;
            log.push({ vendor: vendor.company_name, type: "expired" });
          } catch (e) {
            log.push({ vendor: vendor.company_name, error: e.message });
          }
        } else if (statusChanged) {
          await base44.asServiceRole.entities.Vendor.update(vendor.id, { insurance_status: newInsStatus });
          statusUpdates++;
        }
        continue;
      }

      // ── SEQUENCE 3: Insurance expiring soon ───────────────────────────────
      if (newInsStatus === "expiring_soon" && vendor.email) {
        const daysSince14 = daysSince(vendor.insurance_expiry_notified_at);
        if (daysSince14 >= 14) {
          const html = buildEmail({ name, company: vendor.company_name, type: "expiring_soon", wcExp, glExp, portalUrl, soonThreshold });
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: vendor.email,
              subject: "📅 Insurance Expiring Soon — Coen Construction",
              body: html,
              content_type: "text/html",
            });
            if (vendor.phone) {
              await sendSms(TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, vendor.phone,
                `Coen Construction: Your insurance is expiring soon. Upload a renewal: ${portalUrl}`);
            }
            await base44.asServiceRole.entities.Vendor.update(vendor.id, {
              insurance_status: newInsStatus,
              insurance_expiry_notified_at: now.toISOString(),
            });
            notified++;
            log.push({ vendor: vendor.company_name, type: "expiring_soon" });
          } catch (e) {
            log.push({ vendor: vendor.company_name, error: e.message });
          }
        } else if (statusChanged) {
          await base44.asServiceRole.entities.Vendor.update(vendor.id, { insurance_status: newInsStatus });
          statusUpdates++;
        }
        continue;
      }

      // ── Status-only update (no notification needed) ───────────────────────
      if (statusChanged) {
        await base44.asServiceRole.entities.Vendor.update(vendor.id, { insurance_status: newInsStatus });
        statusUpdates++;
      }
    }

    return Response.json({ success: true, checked, notified, status_updates: statusUpdates, log });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});