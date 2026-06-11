import { useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { useCompanyBrand } from "@/hooks/useCompanyBrand";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Download, X, Trash2 } from "lucide-react";
import QuoteMetricCards from "@/components/admin/quotes/QuoteMetricCards";
import QuoteFilters from "@/components/admin/quotes/QuoteFilters";
import QuotesTable from "@/components/admin/quotes/QuotesTable";
import {
  buildQuoteRows,
  computeQuoteMetrics,
  filterQuotes,
  sortQuotes,
  quotesToCsv,
  downloadCsv,
} from "@/lib/quoteMetrics";

const PAGE_SIZE = 25;

// Existing create flow: estimates are built inside a project that starts from a
// walkthrough. Reuse that route rather than rebuilding a quote builder.
const NEW_QUOTE_ROUTE = "/estimator/walkthrough";

/**
 * Customer Quotes — the "what have we quoted our customers" screen.
 *
 * Scope is strictly customer/lead quotes: Estimate records joined to
 * ContractorProject (client) and Lead (origin). No vendor/sub data (SubBid,
 * InvoiceRecord, vendor_quotes/sub_quotes) is read or shown here.
 *
 * Lives at /admin/estimates (gated by AdminUser.can_access_estimates via AdminHub).
 */
export default function CustomerQuotes() {
  const { adminUser } = useOutletContext() || {};
  const isViewer = adminUser?.role === "viewer";
  const { brandColor } = useCompanyBrand();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Data — customer Estimate records + their projects, plus leads for source
  // enrichment. Query keys are shared with CustomerHistory / AdminLeads so the
  // React Query cache is reused.
  const { data: estimates = [], isLoading: loadingEstimates } = useQuery({
    queryKey: ["all-estimates"],
    queryFn: () => base44.entities.Estimate.list("-created_date", 500),
  });
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["all-contractor-projects"],
    queryFn: () => adminEntities.ContractorProject.list("-created_date", 500),
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => adminEntities.Lead.list("-created_date", 200),
  });

  // The project list is capped at the most-recent 500, but some quoted projects
  // are older than that. Fetch any referenced projects that aren't already loaded
  // so every estimate resolves to its client profile (no "—" in the Client column).
  const loadedProjectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);
  const missingProjectIds = useMemo(
    () =>
      Array.from(
        new Set(
          estimates
            .map((e) => e.project_id)
            .filter((id) => id && !loadedProjectIds.has(id))
        )
      ),
    [estimates, loadedProjectIds]
  );
  const { data: extraProjects = [] } = useQuery({
    queryKey: ["quote-extra-projects", missingProjectIds],
    enabled: missingProjectIds.length > 0,
    queryFn: () =>
      Promise.all(
        missingProjectIds.map((id) =>
          adminEntities.ContractorProject.filter({ id }).then((r) => r[0]).catch(() => null)
        )
      ).then((list) => list.filter(Boolean)),
  });

  const allProjects = useMemo(() => [...projects, ...extraProjects], [projects, extraProjects]);

  const loading = loadingEstimates || loadingProjects;

  const rows = useMemo(() => buildQuoteRows(estimates, allProjects, leads), [estimates, allProjects, leads]);
  const metrics = useMemo(() => computeQuoteMetrics(rows, new Date()), [rows]);

  const estimators = useMemo(
    () => Array.from(new Set(rows.map((r) => r.estimator).filter(Boolean))).sort(),
    [rows]
  );
  const sources = useMemo(
    () => Array.from(new Set(rows.map((r) => r.leadSource).filter(Boolean))).sort(),
    [rows]
  );

  // Filter / sort / page state — persisted in URL query params.
   const filters = useMemo(
     () => ({
       statuses: (searchParams.get("status") || "").split(",").filter(Boolean),
       type: searchParams.get("type") || "",
       from: searchParams.get("from") || "",
       to: searchParams.get("to") || "",
       estimator: searchParams.get("estimator") || "",
       source: searchParams.get("source") || "",
       qb: searchParams.get("qb") || "",
       search: searchParams.get("q") || "",
     }),
     [searchParams]
   );
  const sortKey = searchParams.get("sort") || "created";
  const dir = searchParams.get("dir") || "desc";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  const filtered = useMemo(() => filterQuotes(rows, filters), [rows, filters]);
  const sorted = useMemo(() => sortQuotes(filtered, sortKey, dir), [filtered, sortKey, dir]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sorted, currentPage]
  );

  const updateParams = (updates, { resetPage = true } = {}) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) next.delete(k);
      else next.set(k, Array.isArray(v) ? v.join(",") : String(v));
    });
    if (resetPage && !("page" in updates)) next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const handleFilterChange = (key, value) => updateParams({ [key]: value });

  const handleClear = () => {
    const next = new URLSearchParams();
    if (sortKey !== "created") next.set("sort", sortKey);
    if (dir !== "desc") next.set("dir", dir);
    setSearchParams(next, { replace: true });
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      updateParams({ dir: dir === "asc" ? "desc" : "asc" });
    } else {
      updateParams({ sort: key, dir: key === "client" ? "asc" : "desc" });
    }
  };

  const handlePageChange = (p) => updateParams({ page: p }, { resetPage: false });

  // Selection (by id, survives paging/filtering).
  const visibleIds = paged.map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));
  const headerState = allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false;

  const toggleRow = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });

  const clearSelection = () => setSelectedIds(new Set());

  const selectedRows = useMemo(
    () => sorted.filter((r) => selectedIds.has(r.id)),
    [sorted, selectedIds]
  );

  const rowHref = (row) => (row.projectId ? `/estimator/projects/${row.projectId}` : null);
  const onRowClick = (row) => {
    const href = rowHref(row);
    if (href) navigate(href);
  };

  // "Create Similar Quote" — opens the New Quote form pre-filled with the
  // source quote's line items and terms (client/title/number start fresh).
  const handleCreateSimilar = (row) =>
    navigate(`/estimator/quotes/new?copy_from_quote_id=${row.id}`);

  const today = new Date().toISOString().slice(0, 10);
  const exportRows = (rowsToExport) => {
    if (!rowsToExport.length) {
      toast({ title: "Nothing to export", description: "No quotes match the current view." });
      return;
    }
    downloadCsv(`customer-quotes-${today}.csv`, quotesToCsv(rowsToExport));
    toast({ title: `Exported ${rowsToExport.length} quote${rowsToExport.length !== 1 ? "s" : ""} to CSV` });
  };

  // Delete quotes (Estimate records). Used for cleaning up test/duplicate quotes.
  const deleteMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => base44.entities.Estimate.delete(id))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-estimates"] }),
  });

  const handleDelete = (rowsToDelete) => {
    const ids = rowsToDelete.map((r) => r.id).filter(Boolean);
    if (!ids.length) return;
    const label =
      ids.length === 1
        ? `this quote${rowsToDelete[0].clientName ? ` for ${rowsToDelete[0].clientName}` : ""}`
        : `${ids.length} quotes`;
    if (!window.confirm(`Delete ${label}? This permanently removes the estimate record and cannot be undone.`)) return;
    deleteMutation.mutate(ids, {
      onSuccess: () => {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        toast({ title: `Deleted ${ids.length} quote${ids.length !== 1 ? "s" : ""}` });
      },
      onError: (err) =>
        toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-secondary">Customer Quotes</h1>
          <p className="text-sm text-gray-500 mt-0.5">All quotes ({total} result{total !== 1 ? "s" : ""})</p>
        </div>
        <div className="flex items-center gap-2">
          {!isViewer && (
            <Link to={NEW_QUOTE_ROUTE}>
              <Button className="gap-2 text-white font-semibold" style={{ background: brandColor }}>
                <Plus className="w-4 h-4" aria-hidden="true" /> New Quote
              </Button>
            </Link>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-1.5" aria-label="More actions">
                <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">More Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => exportRows(sorted)}>
                <Download className="w-4 h-4" aria-hidden="true" /> Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary metric cards */}
      <QuoteMetricCards metrics={metrics} brandColor={brandColor} />

      {/* Filters */}
      <QuoteFilters
        filters={filters}
        options={{ estimators, sources }}
        onChange={handleFilterChange}
        onClear={handleClear}
      />

      {/* Bulk-action toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5">
          <span className="text-sm font-semibold text-secondary">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => exportRows(selectedRows)}>
              <Download className="w-3.5 h-3.5" aria-hidden="true" /> Export selected
            </Button>
            {!isViewer && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => handleDelete(selectedRows)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete selected
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 gap-1 text-gray-500" onClick={clearSelection}>
              <X className="w-3.5 h-3.5" aria-hidden="true" /> Clear
            </Button>
          </div>
        </div>
      )}

      {/* Quotes table */}
      <QuotesTable
        rows={paged}
        loading={loading}
        sortKey={sortKey}
        dir={dir}
        onSort={handleSort}
        selectedIds={selectedIds}
        onToggleRow={toggleRow}
        headerState={headerState}
        onToggleAll={toggleAll}
        onRowClick={onRowClick}
        rowHref={rowHref}
        onDelete={isViewer ? undefined : (row) => handleDelete([row])}
        onCreateSimilar={isViewer ? undefined : handleCreateSimilar}
        page={currentPage}
        pageCount={pageCount}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
      />
    </div>
  );
}