import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const vendors = await base44.asServiceRole.entities.Vendor.filter({ is_subcontractor: true });
    const now = new Date();
    const soonThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let updated = 0, notified = 0;

    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");

    const sendSms = async (phone, body) => {
      if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM || !phone) return;
      const digits = phone.replace(/\D/g, "");
      const to = digits.length === 10 ? `+1${digits}` : `+${digits}`;
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body }),
      });
    };

    for (const vendor of vendors) {
      const wcExp = vendor.workers_comp_expiry ? new Date(vendor.workers_comp_expiry) : null;
      const glExp = vendor.liability_ins_expiry ? new Date(vendor.liability_ins_expiry) : null;
      const hasWc = !!vendor.workers_comp_url;
      const hasGl = !!vendor.liability_ins_url;
      const hasW9 = !!vendor.w9_url;
      const packetDone = vendor.packet_status === "completed";

      let newStatus = vendor.insurance_status;
      let shouldNotify = false;
      let notifyType = "";

      // Check for missing docs (not yet submitted)
      if (!hasWc || !hasGl || !hasW9 || !packetDone) {
        if (newStatus !== "pending") { newStatus = "pending"; shouldNotify = true; notifyType = "missing"; }
      } else if ((wcExp && wcExp < now) || (glExp && glExp < now)) {
        newStatus = "expired";
        shouldNotify = true;
        notifyType = "expired";
      } else if ((wcExp && wcExp < soonThreshold) || (glExp && glExp < soonThreshold)) {
        newStatus = "expiring_soon";
        shouldNotify = true;
        notifyType = "expiring_soon";
      } else if (wcExp && glExp) {
        newStatus = "valid";
      }

      const statusChanged = newStatus !== vendor.insurance_status;
      const lastNotified = vendor.insurance_expiry_notified_at ? new Date(vendor.insurance_expiry_notified_at) : null;
      const daysSinceNotified = lastNotified ? (now - lastNotified) / (1000 * 60 * 60 * 24) : 999;

      if (shouldNotify && daysSinceNotified > 7 && vendor.email) {
        const name = vendor.contact_name || vendor.company_name;

        let subject, emailBody, smsText;

        if (notifyType === "missing") {
          const missing = [
            !hasWc && "Workers Compensation Certificate",
            !hasGl && "General Liability Certificate",
            !hasW9 && "W-9 Form",
            !packetDone && "Subcontractor Agreement (unsigned)",
          ].filter(Boolean);

          subject = `⚠️ ACTION REQUIRED: Missing Documents — Coen Construction`;
          emailBody = `Hi ${name},\n\nYou are missing required documents to work with Coen Construction. You will not be able to bid on projects or receive payments until the following are submitted:\n\n${missing.map(m => `• ${m}`).join("\n")}\n\nPlease complete your onboarding packet or contact us for a new link.\n\ncoenconstruction@gmail.com | (617) 412-6046\n\nCoen Construction LLC`;
          smsText = `Coen Construction: You are missing required documents (${missing.join(", ")}). No bids or payments until submitted. Reply for a new link or visit coenconstruction@gmail.com`;
        } else if (notifyType === "expired") {
          subject = `⚠️ ACTION REQUIRED: Insurance Expired — Coen Construction`;
          emailBody = `Hi ${name},\n\nYour insurance certificate(s) on file with Coen Construction have EXPIRED. You will not be able to receive payments until updated documents are received.\n\n${wcExp && wcExp < now ? `• Workers Compensation expired: ${wcExp.toLocaleDateString()}\n` : ""}${glExp && glExp < now ? `• General Liability expired: ${glExp.toLocaleDateString()}\n` : ""}\nPlease contact your insurance company to forward a current certificate to coenconstruction@gmail.com.\n\nCoen Construction LLC`;
          smsText = `Coen Construction: Your insurance has EXPIRED. No payments until updated certificates received. Email: coenconstruction@gmail.com`;
        } else {
          subject = `📅 Insurance Expiring Soon — Coen Construction`;
          emailBody = `Hi ${name},\n\nYour insurance certificate(s) are expiring soon:\n\n${wcExp && wcExp < soonThreshold ? `• Workers Compensation expires: ${wcExp.toLocaleDateString()}\n` : ""}${glExp && glExp < soonThreshold ? `• General Liability expires: ${glExp.toLocaleDateString()}\n` : ""}\nPlease update your documents to avoid any interruption.\n\ncoenconstruction@gmail.com\n\nCoen Construction LLC`;
          smsText = `Coen Construction: Your insurance is expiring soon. Please update your certificates: coenconstruction@gmail.com`;
        }

        try {
          await base44.asServiceRole.integrations.Core.SendEmail({ to: vendor.email, subject, body: emailBody });
          if (vendor.phone) await sendSms(vendor.phone, smsText);
          notified++;
          await base44.asServiceRole.entities.Vendor.update(vendor.id, {
            insurance_status: newStatus,
            insurance_expiry_notified_at: now.toISOString(),
          });
        } catch (_) {}
      } else if (statusChanged) {
        await base44.asServiceRole.entities.Vendor.update(vendor.id, { insurance_status: newStatus });
        updated++;
      }
    }

    return Response.json({ success: true, vendors_checked: vendors.length, updated, notified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});