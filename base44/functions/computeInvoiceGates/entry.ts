/**
 * Compute & persist payment gates for one or more InvoiceRecords.
 * Call with: { invoice_id } for a single record, or { all: true } to batch-recompute.
 * Also called after PM approval to flip ready_for_payment and sync SubPayable.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyAdminSession(req, permission, body) {
  const base44 = createClientFromRequest(req);
  const auth = req.headers.get('authorization') || '';
  const token = String(body?.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
  if (!token) throw new Error('Unauthorized');
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) throw new Error('Unauthorized');
  const secret = Deno.env.get('ADMIN_SESSION_SECRET');
  if (!secret || !(await verifySignature(`${header}.${payload}`, signature, secret).catch(() => false))) throw new Error('Unauthorized');
  const session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  if (Number(session.exp || 0) < Math.floor(Date.now() / 1000)) throw new Error('Session expired');
  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: String(session.email || '').toLowerCase() });
  const user = users[0];
  if (!user || user.active === false) throw new Error('Forbidden');
  if (permission && user.role !== 'admin' && !user[permission]) throw new Error('Forbidden');
  return { base44, user };
}

function computeGates(invoice, vendor) {
  const reasons = [];
  let gate1 = true;
  let gate2 = true;
  let gate3 = true;

  // GATE 1 — Packet & compliance (only for subs where requires_packet = true)
  if (invoice.requires_packet !== false) {
    if (!vendor) {
      reasons.push("Vendor record not linked — cannot verify packet or insurance");
      gate1 = false;
    } else {
      if (!["completed", "approved"].includes(vendor.packet_status)) {
        reasons.push("Sub onboarding packet not completed");
        gate1 = false;
      }
      if (vendor.insurance_status === "expired") {
        reasons.push("Insurance expired — hard blocked (update certificate on vendor record)");
        gate1 = false;
      } else if (vendor.insurance_status === "pending") {
        reasons.push("Insurance certificate not on file");
        gate1 = false;
      } else if (vendor.insurance_status === "expiring_soon") {
        // passes but flagged
        reasons.push("Insurance expiring soon — still payable, update certificate soon");
      }
    }
  }

  // GATE 2 — Invoice document submitted + amount > 0
  const hasDoc =
    (invoice.attachment_urls && invoice.attachment_urls.length > 0) ||
    (invoice.all_attachment_versions && invoice.all_attachment_versions.length > 0);
  if (!hasDoc) {
    reasons.push("No invoice document submitted — verbal or email requests do not qualify");
    gate2 = false;
  }
  if (!invoice.amount || invoice.amount <= 0) {
    reasons.push("Invoice amount is $0 or missing");
    gate2 = false;
  }

  // GATE 3 — PM approval
  if (invoice.pm_approval_status !== "approved") {
    reasons.push("Awaiting PM approval");
    gate3 = false;
  }

  // Insurance expired is a hard block on gate1 even if other parts pass
  const insuranceExpired = vendor?.insurance_status === "expired";
  const ready = gate1 && gate2 && gate3 && !insuranceExpired;

  return { ready, reasons, gate1, gate2, gate3 };
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { base44 } = await verifyAdminSession(req, 'can_access_invoices', body);
    const { invoice_id, all, pm_approve, pm_user_email, pm_signature } = body;

    // Load vendors map
    const vendors = await base44.asServiceRole.entities.Vendor.list();
    const vendorByEmail = Object.fromEntries(vendors.map(v => [v.email?.toLowerCase(), v]));
    const vendorById = Object.fromEntries(vendors.map(v => [v.id, v]));

    let invoicesToProcess = [];

    const resolveVendor = (inv) =>
      (inv.vendor_id && vendorById[inv.vendor_id]) ||
      (inv.vendor_email && vendorByEmail[inv.vendor_email?.toLowerCase()]) ||
      null;

    if (invoice_id) {
      const rows = await base44.asServiceRole.entities.InvoiceRecord.filter({ id: invoice_id });
      invoicesToProcess = rows;
    } else if (all) {
      invoicesToProcess = await base44.asServiceRole.entities.InvoiceRecord.list('-email_received_date', 500);
      // Only sub invoices are payment-gated: vendor flagged is_subcontractor,
      // or the invoice explicitly marked requires_packet. Supplier receipts
      // (e.g. Gmail-scanned Home Depot purchases) are skipped — gating them
      // made the batch run over the function time limit. Material receipts are
      // excluded even when requires_packet was set (the schema defaults it to
      // true) — mirrors src/lib/costClassification.js.
      const isMaterialReceipt = (inv) =>
        inv.document_type === 'receipt' ||
        /homedepot\.com/i.test(inv.vendor_email || '') ||
        /home depot/i.test(inv.vendor_name || '');
      invoicesToProcess = invoicesToProcess.filter(inv =>
        !["paid", "rejected"].includes(inv.status) &&
        !isMaterialReceipt(inv) &&
        (inv.requires_packet === true || resolveVendor(inv)?.is_subcontractor === true)
      );
    }

    let updated = 0;
    let approvedCount = 0;

    const processInvoice = async (inv) => {
      const vendor = resolveVendor(inv);

      // If this is a PM approval request, update approval fields first
      let invoiceData = { ...inv };
      if (pm_approve && invoice_id) {
        const { gate1, gate2 } = computeGates(inv, vendor);
        if (!gate1 || !gate2) {
          throw Object.assign(
            new Error("Cannot approve: Gate 1 or Gate 2 not satisfied. Check packet, insurance, and invoice document."),
            { httpStatus: 422 }
          );
        }
        invoiceData = {
          ...inv,
          pm_approval_status: "approved",
          pm_approved_by: pm_user_email || "admin",
          pm_approved_at: new Date().toISOString(),
          pm_approval_signature: pm_signature || null,
        };
      }

      const { ready, reasons } = computeGates(invoiceData, vendor);
      const resolvedVendorId = vendor?.id || inv.vendor_id || null;

      // Idempotent recompute: skip the write (and history spam) when nothing
      // changed since the last run.
      const unchanged =
        !pm_approve &&
        inv.ready_for_payment === ready &&
        (inv.vendor_id || null) === resolvedVendorId &&
        JSON.stringify(inv.gate_blocked_reasons || []) === JSON.stringify(reasons) &&
        !(ready && inv.status === "pending_review");
      if (unchanged) return false;

      const updates = {
        gate_blocked_reasons: reasons,
        ready_for_payment: ready,
      };
      if (resolvedVendorId) updates.vendor_id = resolvedVendorId;

      if (pm_approve && invoice_id) {
        updates.pm_approval_status = invoiceData.pm_approval_status;
        updates.pm_approved_by = invoiceData.pm_approved_by;
        updates.pm_approved_at = invoiceData.pm_approved_at;
        updates.pm_approval_signature = invoiceData.pm_approval_signature;
      }

      if (ready && inv.status === "pending_review") {
        updates.status = "approved";
        approvedCount++;
      }

      // Append history entry
      const historyEntry = {
        action: pm_approve ? "pm_approved" : "gates_recomputed",
        by: pm_user_email || "system",
        at: new Date().toISOString(),
        note: ready
          ? "All gates passed — ready for payment"
          : `Blocked: ${reasons.filter(r => !r.includes("expiring soon")).join("; ")}`,
      };
      updates.history = [...(inv.history || []), historyEntry];

      await base44.asServiceRole.entities.InvoiceRecord.update(inv.id, updates);

      // Sync SubPayable if PM-approved and ready
      if (pm_approve && ready && inv.project_id) {
        try {
          const payables = await base44.asServiceRole.entities.SubPayable.filter({ project_id: inv.project_id });
          for (const payable of payables) {
            if (
              payable.vendor_email?.toLowerCase() === inv.vendor_email?.toLowerCase() ||
              payable.vendor_company === inv.vendor_name
            ) {
              const invoiceEntries = payable.invoices || [];
              // Find a pending entry that matches the amount, or update the latest pending one
              const matchIdx = invoiceEntries.findIndex(
                e => e.status === "pending" && (!e.amount || Math.abs(e.amount - inv.amount) < 1)
              );
              if (matchIdx >= 0) {
                invoiceEntries[matchIdx] = {
                  ...invoiceEntries[matchIdx],
                  status: "approved",
                  approved_date: new Date().toISOString(),
                };
                await base44.asServiceRole.entities.SubPayable.update(payable.id, { invoices: invoiceEntries });
              }
            }
          }
        } catch (_) { /* SubPayable sync is best-effort */ }
      }

      return true;
    };

    // Update in small parallel chunks so a large backlog stays within the
    // function execution limit (the old one-at-a-time loop timed out → 500).
    // pm_approve always targets a single invoice_id, so approvals never run
    // in parallel.
    const CHUNK_SIZE = 10;
    for (let i = 0; i < invoicesToProcess.length; i += CHUNK_SIZE) {
      const chunk = invoicesToProcess.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(chunk.map(processInvoice));
      updated += results.filter(Boolean).length;
    }

    return Response.json({ success: true, updated, approvedCount, scanned: invoicesToProcess.length });
  } catch (error) {
    const status = error.httpStatus
      || (error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500);
    return Response.json({ error: error.message }, { status });
  }
});