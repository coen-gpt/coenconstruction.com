import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Public, token-secured. Saves onboarding progress step-by-step and handles
// the final signed submission. 1099 contractors are synced into the Vendor
// entity so they appear under Vendors & Subs in the admin.

async function sendEmailViaResend({ to, subject, html, replyTo = "ops@coenconstruction.com" }) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Coen Construction <info@coenconstruction.com>",
      reply_to: replyTo,
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Email send failed (${res.status}): ${await res.text()}`);
}

async function syncContractorToVendor(base44, record) {
  const w9 = record.form_w9 || {};
  const personal = record.personal_info || {};
  const vendorFields = {
    company_name: w9.business_name || w9.name || record.full_name,
    contact_name: record.full_name,
    email: record.email,
    phone: record.phone || personal.phone || "",
    address: w9.address || personal.address || "",
    category: "Other",
    active: true,
    is_subcontractor: true,
    packet_status: "completed",
    packet_signed_name: record.signed_name || record.full_name,
    packet_signed_at: record.signed_at || new Date().toISOString(),
    packet_signature_data: record.signature_data || "",
    packet_form_data: {
      name: record.full_name,
      company: w9.business_name || "",
      email: record.email,
      phone: record.phone || "",
      address: w9.address || "",
      tax_id: w9.tin || "",
      entity_type: w9.tax_classification || "sole_prop",
      source: "employee_onboarding",
      onboarding_id: record.id,
    },
  };

  let vendorId = record.vendor_id;
  if (!vendorId) {
    // Dedupe by email among existing vendors
    const existing = await base44.asServiceRole.entities.Vendor.filter({ email: record.email });
    vendorId = existing[0]?.id || null;
  }

  if (vendorId) {
    const current = (await base44.asServiceRole.entities.Vendor.filter({ id: vendorId }))[0];
    if (current) {
      // Don't regress an already-approved packet
      if (current.packet_status === "approved") vendorFields.packet_status = "approved";
      vendorFields.packet_form_data = { ...(current.packet_form_data || {}), ...vendorFields.packet_form_data };
      await base44.asServiceRole.entities.Vendor.update(vendorId, vendorFields);
      return vendorId;
    }
  }
  const created = await base44.asServiceRole.entities.Vendor.create(vendorFields);
  return created.id;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token, step, data } = body;
    if (!token || !step) return Response.json({ error: "Invalid request" }, { status: 400 });

    const records = await base44.asServiceRole.entities.EmployeeOnboarding.filter({ onboarding_token: String(token).trim() });
    const record = records[0];
    if (!record) return Response.json({ error: "This onboarding link is invalid." }, { status: 404 });
    if (record.token_expires && new Date(record.token_expires) < new Date()) {
      return Response.json({ error: "This onboarding link has expired." }, { status: 410 });
    }
    if (record.status === "approved") {
      return Response.json({ error: "This packet has already been approved and can no longer be edited." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const updates = {};
    if (record.status === "sent") updates.status = "in_progress";

    if (step === "personal") {
      updates.personal_info = { ...(record.personal_info || {}), ...(data || {}) };
      if (data?.phone) updates.phone = data.phone;
    } else if (step === "tax_forms") {
      if (record.worker_type === "contractor") {
        updates.form_w9 = { ...(record.form_w9 || {}), ...(data?.form_w9 || {}) };
      } else {
        updates.form_w4 = { ...(record.form_w4 || {}), ...(data?.form_w4 || {}) };
        updates.form_m4 = { ...(record.form_m4 || {}), ...(data?.form_m4 || {}) };
      }
    } else if (step === "id") {
      if (data?.id_front_url) updates.id_front_url = data.id_front_url;
      if (data?.id_back_url) updates.id_back_url = data.id_back_url;
      if (data?.id_capture_method) updates.id_capture_method = data.id_capture_method;
    } else if (step === "handbook") {
      updates.handbook_acknowledged = !!data?.acknowledged;
      if (data?.acknowledged) updates.handbook_acknowledged_at = now;
    } else if (step === "submit") {
      if (!data?.signature_data || !data?.signed_name) {
        return Response.json({ error: "Signature is required to submit." }, { status: 400 });
      }
      updates.signature_data = data.signature_data;
      updates.signed_name = data.signed_name;
      updates.signed_at = now;
      updates.submitted_at = now;
      updates.status = "submitted";
    } else {
      return Response.json({ error: "Unknown step" }, { status: 400 });
    }

    await base44.asServiceRole.entities.EmployeeOnboarding.update(record.id, updates);
    const fresh = (await base44.asServiceRole.entities.EmployeeOnboarding.filter({ id: record.id }))[0];

    if (step === "submit") {
      // Sync 1099 contractors into Vendors & Subs
      if (fresh.worker_type === "contractor") {
        try {
          const vendorId = await syncContractorToVendor(base44, fresh);
          await base44.asServiceRole.entities.EmployeeOnboarding.update(record.id, { vendor_id: vendorId });
        } catch (e) {
          console.error("Vendor sync failed:", e.message);
        }
      }

      // Notify the office
      const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
      const notifyEmail = profiles?.[0]?.lead_notification_email || "scott@coenconstruction.com";
      const typeLabel = fresh.worker_type === "contractor" ? "1099 Contractor" : "W2 Employee";
      const rows = [
        ["Email", fresh.email],
        ["Phone", fresh.phone || "—"],
        ["Position", fresh.position || "—"],
        ["Start date", fresh.start_date || "—"],
        ["Photo ID", fresh.id_front_url ? "provided" : "MISSING"],
        fresh.worker_type === "w2"
          ? ["Handbook acknowledged", fresh.handbook_acknowledged ? "yes" : "NO"]
          : ["Vendors & Subs", "Synced"],
      ].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#888;">${k}</td><td style="padding:4px 0;color:#1B2B3A;font-weight:600;">${v}</td></tr>`).join("");
      await sendEmailViaResend({
        to: notifyEmail,
        subject: `Onboarding packet submitted — ${fresh.full_name} (${typeLabel})`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <p style="font-size:15px;color:#1B2B3A;"><strong>${fresh.full_name}</strong> has completed their ${typeLabel} onboarding packet.</p>
            <table style="font-size:14px;border-collapse:collapse;">${rows}</table>
            <p style="margin-top:16px;">Review and approve it in the admin under <strong>Employees → Onboarding Packets</strong>.</p>
          </div>`,
      }).catch((e) => console.error("Office notification email failed:", e.message));
    }

    return Response.json({ success: true, status: fresh.status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
