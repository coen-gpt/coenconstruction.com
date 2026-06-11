import { CHANGES_REQUESTED_META, getEstimateStatusMeta } from "@/lib/estimateStatus";

/**
 * Status pill for a customer quote. Reads label + colors from the single status
 * model in estimateStatus.js. ARIA-labeled so the status is announced.
 * `changesRequested` overrides a "sent" quote whose customer asked for changes.
 */
export default function QuoteStatusBadge({ status, changesRequested = false, className = "" }) {
  const meta = changesRequested ? CHANGES_REQUESTED_META : getEstimateStatusMeta(status);
  return (
    <span
      role="status"
      aria-label={`Status: ${meta.label}`}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${meta.badge} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
