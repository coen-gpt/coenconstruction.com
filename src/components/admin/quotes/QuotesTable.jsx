import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import QuoteStatusBadge from "@/components/admin/quotes/QuoteStatusBadge";
import { getEstimateTypeMeta, getQbSyncMeta } from "@/lib/estimateStatus";

const money = (n) =>
  `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy");
};

function TypeBadge({ type }) {
  if (!type || type === "original") return null;
  const meta = getEstimateTypeMeta(type);
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${meta.badge}`}>
      {meta.label}
    </span>
  );
}

function QbBadge({ status }) {
  const meta = getQbSyncMeta(status);
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${meta.badge}`}
      aria-label={`QuickBooks: ${meta.label}`}
    >
      {meta.label}
    </span>
  );
}

/** Keyboard-operable sortable column header with aria-sort on the <th>. */
function SortableHeader({ label, columnKey, sortKey, dir, onSort, align = "left" }) {
  const active = sortKey === columnKey;
  const ariaSort = active ? (dir === "asc" ? "ascending" : "descending") : "none";
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`px-3 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={`inline-flex items-center gap-1 hover:text-secondary transition-colors ${align === "right" ? "flex-row-reverse" : ""} ${active ? "text-secondary" : ""}`}
      >
        {label}
        <Icon className="w-3 h-3" aria-hidden="true" />
      </button>
    </th>
  );
}

function QuoteRow({ row, selected, onToggle, onRowClick, href, onDelete }) {
  return (
    <tr
      className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => onRowClick(row)}
    >
      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle(row.id)}
          aria-label={`Select quote for ${row.clientName || "unknown client"}`}
        />
      </td>
      <td className="px-3 py-3">
        {href ? (
          <Link
            to={href}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-secondary text-sm hover:text-primary hover:underline"
          >
            {row.clientName || "—"}
          </Link>
        ) : (
          <span className="font-semibold text-secondary text-sm">{row.clientName || "—"}</span>
        )}
        {row.address ? <div className="text-xs text-gray-400 truncate max-w-[220px]">{row.address}</div> : null}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-700">{row.title || "Estimate"}</span>
          <span className="text-xs text-gray-400">v{row.version ?? 1}</span>
          <TypeBadge type={row.type} />
        </div>
      </td>
      <td className="px-3 py-3 text-sm text-gray-600">{row.projectType || "—"}</td>
      <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDate(row.created_date)}</td>
      <td className="px-3 py-3">
        <QuoteStatusBadge status={row.status} />
      </td>
      <td className="px-3 py-3">
        <QbBadge status={row.quickbooks_sync_status} />
      </td>
      <td className="px-3 py-3 text-right font-semibold text-secondary whitespace-nowrap tabular-nums">
        {money(row.grandTotal)}
      </td>
      {onDelete ? (
        <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onDelete(row)}
            className="text-gray-300 hover:text-red-500 transition-colors p-1"
            aria-label={`Delete quote for ${row.clientName || "unknown client"}`}
            title="Delete quote"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </td>
      ) : null}
    </tr>
  );
}

function QuoteCard({ row, selected, onToggle, onRowClick, href, onDelete }) {
  return (
    <div className="p-4 flex gap-3 cursor-pointer" onClick={() => onRowClick(row)}>
      {/* Mouse-convenience click target; the client-name Link below is the accessible action. */}
      <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle(row.id)}
          aria-label={`Select quote for ${row.clientName || "unknown client"}`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {href ? (
              <Link
                to={href}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-secondary text-sm hover:underline"
              >
                {row.clientName || "—"}
              </Link>
            ) : (
              <span className="font-semibold text-secondary text-sm">{row.clientName || "—"}</span>
            )}
            <div className="text-xs text-gray-400 truncate">{row.address || row.projectType || ""}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="font-semibold text-secondary text-sm tabular-nums">{money(row.grandTotal)}</span>
            {onDelete ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(row);
                }}
                className="text-gray-300 hover:text-red-500 transition-colors p-1"
                aria-label={`Delete quote for ${row.clientName || "unknown client"}`}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-2 text-xs">
          <span className="text-gray-600">{row.title || "Estimate"}</span>
          <span className="text-gray-400">v{row.version ?? 1}</span>
          <TypeBadge type={row.type} />
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-2">
          <QuoteStatusBadge status={row.status} />
          <QbBadge status={row.quickbooks_sync_status} />
          <span className="text-xs text-gray-400 ml-auto">{fmtDate(row.created_date)}</span>
        </div>
      </div>
    </div>
  );
}

export default function QuotesTable({
  rows = [],
  loading = false,
  sortKey,
  dir,
  onSort,
  selectedIds,
  onToggleRow,
  headerState = false,
  onToggleAll,
  onRowClick,
  rowHref,
  onDelete,
  page = 1,
  pageCount = 1,
  total = 0,
  pageSize = 25,
  onPageChange,
}) {
  const isSelected = (id) => selectedIds?.has(id);
  const goTo = (p) => {
    const next = Math.min(Math.max(1, p), pageCount);
    if (next !== page) onPageChange?.(next);
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-100">
          {Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32 hidden sm:block" />
              <Skeleton className="h-4 w-24 hidden md:block" />
              <Skeleton className="h-5 w-20 rounded-full ml-auto" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl py-16 text-center text-gray-400">
        <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" aria-hidden="true" />
        <p className="font-medium text-gray-500">No quotes found</p>
        <p className="text-sm mt-1">Try adjusting your filters or search.</p>
      </div>
    );
  }

  const startIdx = (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Mobile cards */}
      <div className="sm:hidden divide-y divide-gray-100">
        {rows.map((row) => (
          <QuoteCard
            key={row.id}
            row={row}
            selected={isSelected(row.id)}
            onToggle={onToggleRow}
            onRowClick={onRowClick}
            href={rowHref(row)}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-secondary/5 border-b border-gray-200">
            <tr>
              <th scope="col" className="px-3 py-3 w-10">
                <Checkbox
                  checked={headerState}
                  onCheckedChange={onToggleAll}
                  aria-label="Select all quotes on this page"
                />
              </th>
              <SortableHeader label="Client" columnKey="client" sortKey={sortKey} dir={dir} onSort={onSort} />
              <th scope="col" className="px-3 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                Quote
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                Project type
              </th>
              <SortableHeader label="Created" columnKey="created" sortKey={sortKey} dir={dir} onSort={onSort} />
              <SortableHeader label="Status" columnKey="status" sortKey={sortKey} dir={dir} onSort={onSort} />
              <th scope="col" className="px-3 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                QB sync
              </th>
              <SortableHeader label="Grand total" columnKey="grand_total" sortKey={sortKey} dir={dir} onSort={onSort} align="right" />
              {onDelete ? <th scope="col" className="px-3 py-3 w-10"><span className="sr-only">Actions</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <QuoteRow
                key={row.id}
                row={row}
                selected={isSelected(row.id)}
                onToggle={onToggleRow}
                onRowClick={onRowClick}
                href={rowHref(row)}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-500" aria-live="polite">
          {total === 0 ? "0 results" : `Showing ${startIdx}–${endIdx} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Prev</span>
          </Button>
          <span className="text-xs text-gray-500 tabular-nums px-1">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={() => goTo(page + 1)}
            disabled={page >= pageCount}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
