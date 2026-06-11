import { base44 } from "@/api/base44Client";

/**
 * Admin-side data access for RLS-locked entities.
 *
 * Entities holding sensitive data (PII, secret tokens, financials) are
 * RLS-locked so the public/anonymous SDK can't read them. The admin backend
 * authenticates with custom AdminUser sessions (not Base44 users), so it
 * reaches these records through the `adminEntities` backend function, which
 * runs with the service role after verifying the admin session.
 *
 * The API mirrors the Base44 entities SDK exactly, so call sites only change
 * the object they call:
 *   base44.entities.Lead.list("-created_date", 100)
 *   adminEntities.Lead.list("-created_date", 100)
 */
const LOCKED_ENTITIES = [
  "Lead", "CustomerPortal", "ContractorProject", "Vendor",
  // Field-tool entities: all staff use AdminUser sessions, so the field admin
  // pages reach these through the session-verified proxy. "AdminUser" is
  // read-only and trimmed server-side (assignee dropdown only).
  "TimeEntry", "FieldTask", "FieldReceipt", "EquipmentItem", "EquipmentCheckout",
  "TimeOffRequest", "AdminUser",
  // Executed customer contracts — the legal archive. Read-only via the proxy:
  // what a customer signed is immutable from the office side.
  "SignedContract",
];

async function call(entity, op, payload) {
  const res = await base44.functions.invoke("adminEntities", { entity, op, ...payload });
  if (res?.data?.error) throw new Error(res.data.error);
  return res?.data?.result;
}

function makeRepo(entity) {
  return {
    list: (sort, limit) => call(entity, "list", { sort, limit }),
    filter: (query, sort, limit) => call(entity, "filter", { query, sort, limit }),
    create: (data) => call(entity, "create", { data }),
    update: (id, data) => call(entity, "update", { id, data }),
    delete: (id) => call(entity, "delete", { id }),
  };
}

const adminEntities = Object.fromEntries(
  LOCKED_ENTITIES.map((name) => [name, makeRepo(name)])
);

export default adminEntities;
