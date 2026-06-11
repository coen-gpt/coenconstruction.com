import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const {
      token, vendor_id, form, wc_url, wc_expiry, gl_url, gl_expiry, w9_url, signature_data,
      signed_title, agreement_version, agreement_acknowledged, agreement_text,
    } = body;

    if (!token || !vendor_id) return Response.json({ error: "Invalid request" }, { status: 400 });

    const vendors = await base44.asServiceRole.entities.Vendor.filter({ id: vendor_id });
    const vendor = vendors[0];
    if (!vendor) return Response.json({ error: "Not found" }, { status: 404 });

    const storedToken = vendor.packet_form_data?.onboarding_token;
    const tokenExpires = vendor.packet_form_data?.onboarding_token_expires;

    if (!storedToken || storedToken !== token) {
      return Response.json({ error: "Invalid token" }, { status: 401 });
    }
    if (tokenExpires && new Date(tokenExpires) < new Date()) {
      return Response.json({ error: "Link expired" }, { status: 401 });
    }

    const now = new Date();
    const wcExp = wc_expiry ? new Date(wc_expiry) : null;
    const glExp = gl_expiry ? new Date(gl_expiry) : null;
    const soonThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let insurance_status = "pending";
    if ((wcExp && wcExp < now) || (glExp && glExp < now)) {
      insurance_status = "expired";
    } else if ((wcExp && wcExp < soonThreshold) || (glExp && glExp < soonThreshold)) {
      insurance_status = "expiring_soon";
    } else if (wcExp && glExp) {
      insurance_status = "valid";
    }

    const updates = {
      is_subcontractor: true,
      packet_status: "completed",
      packet_signed_name: form?.name || vendor.contact_name,
      packet_signed_at: now.toISOString(),
      packet_form_data: {
        ...form,
        signed_title: signed_title || form?.title || "",
        // Immutable record of exactly what was agreed to, for e-signature audit
        agreement_version: agreement_version || "",
        agreement_acknowledged: agreement_acknowledged === true,
        agreement_accepted_at: agreement_acknowledged ? now.toISOString() : "",
        agreement_text: agreement_text || "",
        onboarding_token: storedToken, // preserve token
        onboarding_token_expires: tokenExpires,
      },
      packet_signature_data: signature_data,
      insurance_status,
    };

    if (wc_url) { updates.workers_comp_url = wc_url; updates.workers_comp_expiry = wc_expiry || ""; }
    if (gl_url) { updates.liability_ins_url = gl_url; updates.liability_ins_expiry = gl_expiry || ""; }
    if (w9_url) { updates.w9_url = w9_url; }

    // Update vendor name/contact info from form if supplied
    if (form?.company) updates.company_name = form.company;
    if (form?.name) updates.contact_name = form.name;
    if (form?.phone) updates.phone = form.phone;
    if (form?.email) updates.email = form.email;
    if (form?.address) updates.address = form.address;

    await base44.asServiceRole.entities.Vendor.update(vendor_id, updates);

    // Emails (best-effort — the packet is already saved, never fail the request here)
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_KEY) {
      const sendEmail = (payload) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "Coen Construction <no-reply@coenconstruction.com>", ...payload }),
        }).catch((e) => console.error("Resend send error:", e.message));

      // 1. Notify the office
      await sendEmail({
        to: ["scott@coenconstruction.com"],
        subject: `✅ Subcontractor Packet Submitted — ${form?.company || vendor.company_name}`,
        text: `${form?.company || vendor.company_name} has completed their subcontractor onboarding packet.\n\nContact: ${form?.name}\nTitle: ${signed_title || form?.title || "—"}\nEmail: ${form?.email}\nPhone: ${form?.phone}\nTax ID: ${form?.tax_id || "—"}\nEntity Type: ${form?.entity_type || "—"}\nInsurance Status: ${insurance_status}\nAgreement: ${agreement_version ? `v${agreement_version} accepted ${now.toLocaleDateString()}` : "—"}\n\nLog in to review documents.`,
      });

      // 2. Send the subcontractor their signed copy for their records
      const subEmail = form?.email || vendor.email;
      if (subEmail) {
        const signedLine = `Signed by ${form?.name || vendor.contact_name}${signed_title ? `, ${signed_title}` : ""} of ${form?.company || vendor.company_name} on ${now.toLocaleString()}.`;
        const agreementHtml = (agreement_text || "")
          .split("\n")
          .map((line) => line.trim() === "" ? "<br/>" : `<p style="margin:0 0 8px;">${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`)
          .join("");
        await sendEmail({
          to: [subEmail],
          reply_to: "subs@coenconstruction.com",
          subject: "Your signed Coen Construction Subcontractor Agreement",
          html: `
            <div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#1B2B3A;">
              <div style="background:#1B2B3A;padding:24px;border-radius:8px 8px 0 0;">
                <h1 style="color:white;margin:0;font-size:20px;">Coen Construction</h1>
                <p style="color:#aaa;margin:4px 0 0;font-size:13px;">Subcontractor Agreement — Your Copy</p>
              </div>
              <div style="background:#f9f9f9;padding:24px;border:1px solid #eee;border-top:none;">
                <p>Hi ${form?.name || vendor.contact_name || "there"},</p>
                <p>Thank you for completing your subcontractor onboarding. For your records, below is the full agreement you signed${agreement_version ? ` (version ${agreement_version})` : ""}.</p>
                <p style="background:#fff;border:1px solid #e5e5e5;border-radius:6px;padding:12px;font-size:13px;"><strong>${signedLine}</strong></p>
                <p style="font-size:12px;color:#666;">You'll receive access to bids and payments once Coen Construction reviews your documents. Questions? Reply to this email or contact subs@coenconstruction.com · (617) 412-6046.</p>
                <hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0;"/>
                <div style="font-size:12px;line-height:1.6;color:#333;">${agreementHtml}</div>
              </div>
              <div style="background:#1B2B3A;padding:12px;border-radius:0 0 8px 8px;text-align:center;">
                <p style="color:#888;font-size:11px;margin:0;">Coen Construction LLC · 387 Page St, Suite 10B, Stoughton, MA 02072</p>
              </div>
            </div>`,
        });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});