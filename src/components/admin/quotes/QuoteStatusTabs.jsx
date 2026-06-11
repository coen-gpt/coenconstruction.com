import { QUOTE_TABS } from "@/lib/estimateStatus";

/**
 * Jobber-style pipeline tabs for Customer Quotes: All / Draft / Awaiting
 * Response / Changes Requested / Approved / Archived. Fully controlled —
 * the active key and per-tab counts come from props, clicks push the new
 * key up via onChange (URL-backed in the page).
 */
export default function QuoteStatusTabs({ active = "all", counts = {}, onChange }) {
  return (
    <div
      className="flex gap-1 border-b border-gray-200 overflow-x-auto scrollbar-hide bg-white rounded-t-xl px-2 pt-1 shadow-sm"
      role="tablist"
      aria-label="Filter quotes by status"
    >
      {QUOTE_TABS.map((t) => {
        const isActive = (active || "all") === t.key;
        const count = counts[t.key] ?? 0;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              isActive ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{t.label}</span>
            <span
              className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold ${
                isActive ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
