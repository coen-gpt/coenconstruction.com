import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { vendor_id } = await req.json();

    if (!vendor_id) return Response.json({ error: "vendor_id required" }, { status: 400 });

    const vendors = await base44.asServiceRole.entities.Vendor.filter({ id: vendor_id });
    const vendor = vendors[0];
    if (!vendor) return Response.json({ error: "Vendor not found" }, { status: 404 });

    const token = randomToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    await base44.asServiceRole.entities.Vendor.update(vendor_id, {
      is_subcontractor: true,
      packet_status: vendor.packet_status === "completed" ? "completed" : "in_progress",
      // Reuse reset_token pattern: store in packet_form_data
      packet_form_data: {
        ...(vendor.packet_form_data || {}),
        onboarding_token: token,
        onboarding_token_expires: expires,
      },
    });

    const appBaseUrl = req.headers.get("origin") || "https://app.base44.com";
    const portalUrl = `${appBaseUrl}/sub-onboarding?token=${token}&vendor=${vendor_id}`;

    const emailBody = `Hi ${vendor.contact_name || vendor.company_name},

Coen Construction LLC has invited you to complete your subcontractor onboarding packet. This must be completed before you can access bids or receive payments.

Click the link below to get started (link valid for 30 days):
${portalUrl}

You will need to complete:
1. Company Information
2. Insurance Certificates (Workers Comp + General Liability)
3. W-9 Form
4. Review & Sign the Subcontractor Agreement

Questions? Contact us at coenconstruction@gmail.com or (617) 412-6046.

Coen Construction LLC
387 Page St, Suite 10B, Stoughton, MA 02072`;

    // Send email
    if (vendor.email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: vendor.email,
        subject: "Action Required: Complete Your Subcontractor Onboarding — Coen Construction",
        body: emailBody,
      });
    }

    // Send SMS if phone available
    if (vendor.phone) {
      const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
      const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");
      if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
        const digits = (vendor.phone || "").replace(/\D/g, "");
        const toPhone = digits.length === 10 ? `+1${digits}` : `+${digits}`;
        const smsBody = `Coen Construction: Complete your subcontractor onboarding packet to access bids & payments: ${portalUrl}`;
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ From: TWILIO_FROM, To: toPhone, Body: smsBody }),
        });
      }
    }

    return Response.json({ success: true, portal_url: portalUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});