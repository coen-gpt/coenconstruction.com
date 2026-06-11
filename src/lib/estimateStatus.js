/**
 * Single source of truth for the customer-quote (Estimate) status model.
 *
 * Consumed by the Customer Quotes overview cards, the status filter, and the
 * table badges so label + color stay consistent everywhere. Scope is strictly
 * customer-facing Estimate records — no vendor/sub bid or invoice statuses live
 * here.
 */

// Recent-activity window used by the metric cards (e.g. "Sent in the past 30 days").
// Kept as one constant so every card reads the same window.
export const RECENT_WINDOW_DAYS = 30;

// Estimate.status enum, in pipeline order.
export const ESTIMATE_STATUSES = ["draft", "sent", "approved", "rejected", "superseded"];

// status -> { label, dot (small status dot), badge (pill classes) }
export const ESTIMATE_STATUS_META = {
  draft:      { label: "Draft",      dot: "bg-gray-400",  badge: "bg-gray-100 text-gray-700 border border-gray-200" },
  sent:       { label: "Sent",       dot: "bg-amber-500", badge: "bg-amber-100 text-amber-800 border border-amber-200" },
  approved:   { label: "Approved",   dot: "bg-green-500", badge: "bg-green-100 text-green-800 border border-green-200" },
  rejected:   { label: "Rejected",   dot: "bg-red-500",   badge: "bg-red-100 text-red-700 border border-red-200" },
  superseded: { label: "Superseded", dot: "bg-gray-300",  badge: "bg-gray-100 text-gray-400 border border-gray-200" },
};

// Derived display state (not an Estimate.status value): the customer asked for
// modifications, so the quote is "sent" with project.status === "modify".
export const CHANGES_REQUESTED_META = {
  label: "Changes Requested",
  dot: "bg-yellow-500",
  badge: "bg-yellow-100 text-yellow-800 border border-yellow-200",
};

export function getEstimateStatusMeta(status) {
  return (
    ESTIMATE_STATUS_META[status] || {
      label: status || "Unknown",
      dot: "bg-gray-300",
      badge: "bg-gray-100 text-gray-600 border border-gray-200",
    }
  );
}

// Jobber-style pipeline tabs for the Customer Quotes list. Each tab is a view
// over existing data — no schema changes. "Changes Requested" is derived from
// processApproval's modify action, which leaves the estimate "sent" but sets
// the project's status to "modify" (see rows' changesRequested flag).
export const QUOTE_TABS = [
  { key: "all",               label: "All",               match: () => true },
  { key: "draft",             label: "Draft",             match: (r) => r.status === "draft" },
  { key: "awaiting_response", label: "Awaiting Response", match: (r) => r.status === "sent" && !r.changesRequested },
  { key: "changes_requested", label: "Changes Requested", match: (r) => r.changesRequested },
  { key: "approved",          label: "Approved",          match: (r) => r.status === "approved" },
  { key: "archived",          label: "Archived",          match: (r) => r.status === "rejected" || r.status === "superseded" },
];

// Estimate.type enum.
export const ESTIMATE_TYPES = ["original", "change_order", "revision"];

// type -> { label, badge }. "original" has no badge (it's the default, shown plain).
export const ESTIMATE_TYPE_META = {
  original:     { label: "Original",     badge: "" },
  change_order: { label: "Change Order", badge: "bg-purple-100 text-purple-700 border border-purple-200" },
  revision:     { label: "Revision",     badge: "bg-blue-100 text-blue-700 border border-blue-200" },
};

export function getEstimateTypeMeta(type) {
  return ESTIMATE_TYPE_META[type] || ESTIMATE_TYPE_META.original;
}

// Estimate.quickbooks_sync_status enum.
export const QB_SYNC_STATUSES = ["not_synced", "synced", "error", "pending"];

export const QB_SYNC_META = {
  not_synced: { label: "Not synced", badge: "bg-gray-100 text-gray-500 border border-gray-200" },
  synced:     { label: "Synced",     badge: "bg-green-100 text-green-700 border border-green-200" },
  error:      { label: "Error",      badge: "bg-red-100 text-red-700 border border-red-200" },
  pending:    { label: "Pending",    badge: "bg-amber-100 text-amber-800 border border-amber-200" },
};

export function getQbSyncMeta(status) {
  return QB_SYNC_META[status] || QB_SYNC_META.not_synced;
}
