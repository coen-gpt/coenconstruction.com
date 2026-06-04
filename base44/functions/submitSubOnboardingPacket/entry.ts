import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { token, vendor_id, form, wc_url, wc_expiry, gl_url, gl_expiry, w9_url, signature_data } = body;

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

    // Notify admin
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Coen Construction <no-reply@coenconstruction.com>",
          to: ["scott@coenconstruction.com"],
          subject: `✅ Subcontractor Packet Submitted — ${form?.company || vendor.company_name}`,
          text: `${form?.company || vendor.company_name} has completed their subcontractor onboarding packet.\n\nContact: ${form?.name}\nEmail: ${form?.email}\nPhone: ${form?.phone}\nTax ID: ${form?.tax_id || "—"}\nEntity Type: ${form?.entity_type || "—"}\nInsurance Status: ${insurance_status}\n\nLog in to review documents.`,
        }),
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});