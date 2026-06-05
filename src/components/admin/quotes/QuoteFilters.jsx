import { Search, ListFilter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ESTIMATE_STATUSES,
  ESTIMATE_TYPES,
  QB_SYNC_STATUSES,
  getEstimateStatusMeta,
  getEstimateTypeMeta,
  getQbSyncMeta,
} from "@/lib/estimateStatus";

const ALL = "all";

/**
 * Filter + search bar for Customer Quotes. Fully controlled — every value comes
 * from props (URL-backed in the page) and changes are pushed up via onChange,
 * which receives a URL param key: status | type | from | to | estimator | source
 * | qb | q.
 */
export default function QuoteFilters({ filters, options = {}, onChange, onClear }) {
  const { statuses = [], type = "", from = "", to = "", estimator = "", source = "", qb = "", search = "" } = filters || {};
  const { estimators = [], sources = [] } = options;

  const hasActive =
    statuses.length || type || from || to || estimator || source || qb || search;

  const toggleStatus = (s, checked) => {
    const next = checked ? [...statuses, s] : statuses.filter((x) => x !== s);
    onChange("status", next);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search quotes by client, title, or address"
            placeholder="Search client, quote title, or address…"
            value={search}
            onChange={(e) => onChange("q", e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status (multi-select) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5" aria-label="Filter by status">
                <ListFilter className="w-3.5 h-3.5" aria-hidden="true" />
                Status
                {statuses.length > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center text-[10px] font-bold rounded-full bg-primary text-primary-foreground w-4 h-4">
                    {statuses.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ESTIMATE_STATUSES.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={statuses.includes(s)}
                  onCheckedChange={(checked) => toggleStatus(s, checked)}
                  onSelect={(e) => e.preventDefault()}
                >
                  <span className={`mr-2 w-2 h-2 rounded-full ${getEstimateStatusMeta(s).dot}`} aria-hidden="true" />
                  {getEstimateStatusMeta(s).label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Type */}
          <Select value={type || ALL} onValueChange={(v) => onChange("type", v === ALL ? "" : v)}>
            <SelectTrigger className="h-9 w-[140px]" aria-label="Filter by type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {ESTIMATE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {getEstimateTypeMeta(t).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Estimator */}
          <Select value={estimator || ALL} onValueChange={(v) => onChange("estimator", v === ALL ? "" : v)}>
            <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by estimator">
              <SelectValue placeholder="Estimator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All estimators</SelectItem>
              {estimators.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Lead source (optional enrichment — only when present) */}
          {sources.length > 0 && (
            <Select value={source || ALL} onValueChange={(v) => onChange("source", v === ALL ? "" : v)}>
              <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by lead source">
                <SelectValue placeholder="Lead source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All sources</SelectItem>
                {sources.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* QuickBooks sync status */}
          <Select value={qb || ALL} onValueChange={(v) => onChange("qb", v === ALL ? "" : v)}>
            <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by QuickBooks sync status">
              <SelectValue placeholder="QB sync" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All QB sync</SelectItem>
              {QB_SYNC_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {getQbSyncMeta(s).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date range (on created_date) */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="quote-from" className="sr-only">
              Created from
            </label>
            <Input
              id="quote-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => onChange("from", e.target.value)}
              className="h-9 w-[150px]"
            />
            <span className="text-gray-400 text-sm" aria-hidden="true">
              –
            </span>
            <label htmlFor="quote-to" className="sr-only">
              Created to
            </label>
            <Input
              id="quote-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => onChange("to", e.target.value)}
              className="h-9 w-[150px]"
            />
          </div>

          {hasActive ? (
            <Button variant="ghost" size="sm" className="h-9 gap-1 text-gray-500" onClick={onClear}>
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              Clear
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
