import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Allows subcontractor portal to update their own document URLs on their Vendor record.
// Called from SubDocUpload page after a file has been uploaded.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { vendor_id, updates } = await req.json();

    if (!vendor_id || !updates) {
      return Response.json({ error: "vendor_id and updates are required" }, { status: 400 });
    }

    // Only allow specific safe fields to be updated
    const ALLOWED_FIELDS = [
      "workers_comp_url", "workers_comp_expiry",
      "liability_ins_url", "liability_ins_expiry",
      "w9_url",
    ];

    const safeUpdates = {};
    for (const field of ALLOWED_FIELDS) {
      if (updates[field] !== undefined) safeUpdates[field] = updates[field];
    }

    if (Object.keys(safeUpdates).length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Recompute insurance_status after update
    const vendor = await base44.asServiceRole.entities.Vendor.filter({ id: vendor_id });
    const v = { ...vendor[0], ...safeUpdates };
    const now = new Date();
    const soonThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const wcExp = v.workers_comp_expiry ? new Date(v.workers_comp_expiry) : null;
    const glExp = v.liability_ins_expiry ? new Date(v.liability_ins_expiry) : null;
    const hasAll = v.workers_comp_url && v.liability_ins_url && v.w9_url && ["completed", "approved"].includes(v.packet_status);

    let insurance_status = "pending";
    if (hasAll) {
      if ((wcExp && wcExp < now) || (glExp && glExp < now)) {
        insurance_status = "expired";
      } else if ((wcExp && wcExp < soonThreshold) || (glExp && glExp < soonThreshold)) {
        insurance_status = "expiring_soon";
      } else {
        insurance_status = "valid";
      }
    }

    safeUpdates.insurance_status = insurance_status;
    // Reset 30d notification flag when certs are renewed
    if (insurance_status === "valid" || insurance_status === "expiring_soon") {
      safeUpdates.insurance_30d_notified_at = null;
      safeUpdates.insurance_expiry_notified_at = null;
    }

    await base44.asServiceRole.entities.Vendor.update(vendor_id, safeUpdates);

    return Response.json({ success: true, insurance_status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});