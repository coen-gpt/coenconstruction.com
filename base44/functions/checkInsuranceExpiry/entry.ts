import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Admin-only scheduled function
    const vendors = await base44.asServiceRole.entities.Vendor.filter({ is_subcontractor: true });
    const now = new Date();
    const soonThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    let updated = 0;
    let notified = 0;

    for (const vendor of vendors) {
      const wcExp = vendor.workers_comp_expiry ? new Date(vendor.workers_comp_expiry) : null;
      const glExp = vendor.liability_ins_expiry ? new Date(vendor.liability_ins_expiry) : null;

      let newStatus = vendor.insurance_status;
      let shouldNotify = false;

      if ((wcExp && wcExp < now) || (glExp && glExp < now)) {
        newStatus = "expired";
        shouldNotify = true;
      } else if ((wcExp && wcExp < soonThreshold) || (glExp && glExp < soonThreshold)) {
        newStatus = "expiring_soon";
        shouldNotify = true;
      } else if (wcExp && glExp) {
        newStatus = "valid";
      }

      const statusChanged = newStatus !== vendor.insurance_status;

      // Throttle notifications: only send if not notified in last 7 days
      const lastNotified = vendor.insurance_expiry_notified_at ? new Date(vendor.insurance_expiry_notified_at) : null;
      const daysSinceNotified = lastNotified ? (now - lastNotified) / (1000 * 60 * 60 * 24) : 999;

      if (shouldNotify && daysSinceNotified > 7 && vendor.email) {
        const isExpired = newStatus === "expired";
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: vendor.email,
            subject: isExpired
              ? `⚠️ ACTION REQUIRED: Insurance Expired — Coen Construction`
              : `📅 Insurance Expiring Soon — Coen Construction`,
            body: isExpired
              ? `Hi ${vendor.contact_name || vendor.company_name},\n\nYour insurance certificate(s) on file with Coen Construction have EXPIRED. You will not be able to submit bids until updated documents are received.\n\nPlease upload your current Workers Compensation and General Liability certificates as soon as possible.\n\nIf you have questions, contact us at coenconstruction@gmail.com or (617) 412-6046.\n\nCoen Construction LLC`
              : `Hi ${vendor.contact_name || vendor.company_name},\n\nYour insurance certificate(s) on file with Coen Construction will expire soon:\n\n${wcExp && wcExp < soonThreshold ? "• Workers Compensation expires: " + wcExp.toLocaleDateString() + "\n" : ""}${glExp && glExp < soonThreshold ? "• General Liability expires: " + glExp.toLocaleDateString() + "\n" : ""}\nPlease update your documents to avoid any interruption to your ability to bid on projects.\n\nCoen Construction LLC`,
          });
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