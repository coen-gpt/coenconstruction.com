import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Public, token-secured. Saves onboarding progress step-by-step and handles
// the final signed submission. 1099 contractors are synced into the Vendor
// entity so they appear under Vendors & Subs in the admin.

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
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: notifyEmail,
        subject: `Onboarding packet submitted — ${fresh.full_name} (${typeLabel})`,
        body: `${fresh.full_name} has completed their ${typeLabel} onboarding packet.

Email: ${fresh.email}
Phone: ${fresh.phone || "—"}
Position: ${fresh.position || "—"}
Start date: ${fresh.start_date || "—"}
Photo ID: ${fresh.id_front_url ? "provided" : "MISSING"}
${fresh.worker_type === "w2" ? `Handbook acknowledged: ${fresh.handbook_acknowledged ? "yes" : "NO"}` : "Synced to Vendors & Subs."}

Review and approve it in the admin under Employees → Onboarding Packets.`,
      }).catch(() => {});
    }

    return Response.json({ success: true, status: fresh.status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
