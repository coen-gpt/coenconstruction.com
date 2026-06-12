import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import adminEntities from "@/api/adminEntities";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  Search,
  HardHat,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  RefreshCw,
  Tag,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";
import { format } from "date-fns";
import { toast } from "sonner";

const PAGE_SIZE = 25;

const JOB_TYPES = [
  "Home Addition",
  "Kitchen Remodel",
  "Bathroom Remodel",
  "Deck / Porch / Pergola",
  "Siding",
  "Custom Carpentry",
  "Snow Removal",
  "Full Home Renovation",
  "Roofing",
  "Flooring",
  "Other",
];

// Jobber-style status pills. Eligible jobs only ever surface these states.
const JOB_STATUS_META = {
  in_progress: { label: "Active", badge: "bg-green-100 text-green-800", dot: "bg-green-500" },
  on_hold: { label: "On Hold", badge: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  completed: { label: "Completed", badge: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
};

const TABS = [
  { key: "all", label: "All Jobs" },
  { key: "active", label: "Active" },
  { key: "on_hold", label: "On Hold" },
  { key: "completed", label: "Completed" },
];

// Bulk status options stay within the job lifecycle (plus cancel as an exit).
const BULK_STATUSES = [
  { value: "in_progress", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * A project is a Job once the customer has signed the contract AND paid the
 * initial deposit. New-flow projects get flipped to in_progress by
 * createDepositInvoice at the moment of deposit payment, so in_progress /
 * on_hold / completed statuses imply signed+paid. Imported history (Jobber /
 * BuilderTrend) predates the e-sign flow and carries those statuses without
 * the flags, which is why status alone also qualifies.
 */
const isJob = (p) =>
  ["in_progress", "on_hold", "completed"].includes(p.status) ||
  (p.client_signed && p.deposit_paid);

// Signed+paid projects that haven't been flipped yet behave as Active.
const jobTabKey = (p) => {
  if (p.status === "on_hold") return "on_hold";
  if (p.status === "completed") return "completed";
  return "active";
};

const jobValue = (p) => p.adjusted_total || p.original_estimate_total || 0;

const money = (n) => `$${Math.round(n || 0).toLocaleString()}`;

const fmtDate = (d) => {
  if (!d) return null;
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? null : format(date, "MMM d, yyyy");
};

// Jobber's Schedule column: the most meaningful date for where the job is.
const scheduleInfo = (p) => {
  if (p.status === "completed") {
    return { label: "Completed", date: fmtDate(p.signed_date) || fmtDate(p.created_date) };
  }
  const start = fmtDate(p.workflow_schedule?.start_date);
  if (start) return { label: "Starts", date: start };
  return { label: "Created", date: fmtDate(p.created_date) };
};

// The date used for schedule sorting — mirrors what the column displays.
const scheduleSortDate = (p) =>
  new Date(p.workflow_schedule?.start_date || p.signed_date || p.created_date || 0).getTime();

function StatusBadge({ project }) {
  const meta = JOB_STATUS_META[project.status] || JOB_STATUS_META.in_progress;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
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

/** Jobber-style "Overview" card — status counts with colored dots. */
function OverviewCards({ jobs, brandColor }) {
  const active = jobs.filter((j) => jobTabKey(j) === "active");
  const onHold = jobs.filter((j) => jobTabKey(j) === "on_hold");
  const completed = jobs.filter((j) => jobTabKey(j) === "completed");
  const thisYear = new Date().getFullYear();
  const completedThisYear = completed.filter(
    (j) => new Date(j.signed_date || j.created_date).getFullYear() === thisYear
  );
  const sum = (list) => list.reduce((t, j) => t + jobValue(j), 0);

  const rows = [
    { label: "Active", count: active.length, dot: "bg-green-500" },
    { label: "On Hold", count: onHold.length, dot: "bg-amber-500" },
    { label: "Completed", count: completed.length, dot: "bg-gray-400" },
  ];

  const cards = [
    { label: "Active jobs", count: active.length, total: sum(active) },
    { label: `Completed in ${thisYear}`, count: completedThisYear.length, total: sum(completedThisYear) },
    { label: "Total job value", count: jobs.length, total: sum(jobs) },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
        <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide font-semibold">Overview</span>
        <ul className="space-y-1.5 mt-3">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${r.dot}`} aria-hidden="true" />
              <span className="text-gray-600">{r.label}</span>
              <span className="ml-auto font-bold text-secondary tabular-nums">{r.count}</span>
            </li>
          ))}
        </ul>
      </div>
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${brandColor}15` }}
            >
              <HardHat className="w-4 h-4" style={{ color: brandColor }} aria-hidden="true" />
            </div>
            <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide font-semibold leading-tight">
              {c.label}
            </span>
          </div>
          <div className="text-2xl font-bold text-secondary">{c.count}</div>
          <div className="text-sm font-semibold text-gray-500">{money(c.total)}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Jobs — current and past jobs, Jobber-style. One page replaces the old
 * Active Projects + All Projects pair. Only projects where the customer has
 * signed the contract and paid the initial deposit appear here (see isJob).
 *
 * Lives at /estimator/jobs; the old /estimator/active-projects and
 * /estimator/projects list routes redirect here. /estimator/projects/:id
 * detail links are unchanged.
 */
export default function Jobs() {
  const navigate = useNavigate();
  const { brandColor } = useCompanyBrand();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState(() => new Set());
  const [bulkStatus, setBulkStatus] = useState("");

  // ContractorProject is well past 500 rows — page until a short page.
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["all-jobs-projects"],
    queryFn: async () => {
      // Page in 500s; the seen-id guard stops the loop even if the backend
      // ever ignores `skip`, so we can never duplicate or spin forever.
      const all = [];
      const seen = new Set();
      for (let page = 0; page < 10; page++) {
        const batch = await adminEntities.ContractorProject.list("-created_date", 500, page * 500);
        const fresh = batch.filter((p) => !seen.has(p.id));
        fresh.forEach((p) => seen.add(p.id));
        all.push(...fresh);
        if (batch.length < 500 || fresh.length === 0) break;
      }
      return all;
    },
  });

  const jobs = useMemo(() => projects.filter(isJob), [projects]);

  // URL-backed filter / sort / page state, matching the Customer Quotes page.
  const tab = searchParams.get("tab") || "all";
  const search = searchParams.get("q") || "";
  const jobType = searchParams.get("type") || "all";
  const sortKey = searchParams.get("sort") || "schedule";
  const dir = searchParams.get("dir") || "desc";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  const setParam = (key, value, defaultValue = "") => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const onSort = (key) => {
    const next = new URLSearchParams(searchParams);
    if (sortKey === key) next.set("dir", dir === "asc" ? "desc" : "asc");
    else {
      next.set("sort", key);
      next.set("dir", key === "client" ? "asc" : "desc");
    }
    next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const tabCounts = useMemo(() => {
    const counts = { all: jobs.length, active: 0, on_hold: 0, completed: 0 };
    jobs.forEach((j) => {
      counts[jobTabKey(j)] += 1;
    });
    return counts;
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = jobs.filter((p) => {
      if (tab !== "all" && jobTabKey(p) !== tab) return false;
      if (jobType !== "all" && p.project_type !== jobType) return false;
      if (
        q &&
        !(
          p.client_name?.toLowerCase().includes(q) ||
          p.client_address?.toLowerCase().includes(q) ||
          p.client_city?.toLowerCase().includes(q) ||
          p.project_type?.toLowerCase().includes(q)
        )
      )
        return false;
      return true;
    });

    const cmp = {
      client: (a, b) => (a.client_name || "").localeCompare(b.client_name || ""),
      type: (a, b) => (a.project_type || "").localeCompare(b.project_type || ""),
      schedule: (a, b) => scheduleSortDate(a) - scheduleSortDate(b),
      status: (a, b) => jobTabKey(a).localeCompare(jobTabKey(b)),
      total: (a, b) => jobValue(a) - jobValue(b),
    }[sortKey] || ((a, b) => scheduleSortDate(a) - scheduleSortDate(b));

    list.sort((a, b) => (dir === "asc" ? cmp(a, b) : cmp(b, a)));
    return list;
  }, [jobs, tab, jobType, search, sortKey, dir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, status }) => {
      await Promise.all(ids.map((id) => adminEntities.ContractorProject.update(id, { status })));
    },
    onSuccess: (_, { ids, status }) => {
      queryClient.invalidateQueries({ queryKey: ["all-jobs-projects"] });
      const label = BULK_STATUSES.find((s) => s.value === status)?.label || status;
      toast.success(`Updated ${ids.length} job${ids.length !== 1 ? "s" : ""} to "${label}"`);
      setSelected(new Set());
      setBulkStatus("");
    },
  });

  const pageIds = pageRows.map((p) => p.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      {/* Header — page title left, primary action right, like Jobber. */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-secondary">Jobs</h1>
          <p className="text-sm text-gray-500">
            Current and past jobs — contract signed and deposit paid
          </p>
        </div>
        <Link to="/estimator/walkthrough">
          <Button className="text-white gap-2" style={{ background: brandColor }}>
            <Plus className="w-4 h-4" /> New Walkthrough
          </Button>
        </Link>
      </div>

      <OverviewCards jobs={jobs} brandColor={brandColor} />

      {/* Status tabs — Jobber's status filter as our standard pipeline tabs. */}
      <div
        className="flex gap-1 border-b border-gray-200 overflow-x-auto scrollbar-hide bg-white rounded-t-xl px-2 pt-1 shadow-sm"
        role="tablist"
        aria-label="Filter jobs by status"
      >
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setParam("tab", t.key, "all")}
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
                {tabCounts[t.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter bar — job type left, search right, like Jobber's list header. */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white border-x border-gray-200 px-4 py-3">
        <Select value={jobType} onValueChange={(v) => setParam("type", v, "all")}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Job Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Job Types</SelectItem>
            {JOB_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search jobs..."
            className="pl-9"
            value={search}
            onChange={(e) => setParam("q", e.target.value)}
          />
        </div>
      </div>

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-secondary text-white px-4 py-3 border-x border-gray-200">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <div className="flex-1 flex items-center gap-2 flex-wrap">
            <Tag className="w-4 h-4 opacity-70" />
            <span className="text-xs opacity-70">Set status:</span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="text-xs rounded-lg px-2 py-1.5 bg-white/15 border border-white/20 text-white focus:outline-none"
            >
              <option value="">— pick status —</option>
              {BULK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!bulkStatus || bulkUpdateMutation.isPending}
              onClick={() => bulkUpdateMutation.mutate({ ids: [...selected], status: bulkStatus })}
              className="bg-white text-secondary hover:bg-white/90 text-xs h-7 px-3"
            >
              {bulkUpdateMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Apply"}
            </Button>
          </div>
          <button
            onClick={() => setSelected(new Set())}
            className="text-white/60 hover:text-white transition-colors ml-auto"
            aria-label="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-b-xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-48 hidden sm:block" />
                <Skeleton className="h-4 w-24 hidden md:block" />
                <Skeleton className="h-5 w-20 rounded-full ml-auto" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : pageRows.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p className="font-medium text-gray-500">No jobs found</p>
            <p className="text-sm mt-1">
              {jobs.length === 0
                ? "Jobs appear here once a customer signs their contract and pays the deposit."
                : "Try adjusting your filters or search."}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {pageRows.map((p) => {
                const sched = scheduleInfo(p);
                return (
                  <div
                    key={p.id}
                    className="p-4 flex gap-3 cursor-pointer"
                    onClick={() => navigate(`/estimator/projects/${p.id}`)}
                  >
                    <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggleOne(p.id)}
                        aria-label={`Select job for ${p.client_name || "unknown client"}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            to={`/estimator/projects/${p.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-secondary text-sm hover:underline"
                          >
                            {p.client_name || "—"}
                          </Link>
                          <div className="text-xs text-gray-400 truncate">
                            {p.client_address || p.client_city || p.project_type || ""}
                          </div>
                        </div>
                        <span className="font-semibold text-secondary text-sm tabular-nums shrink-0">
                          {money(jobValue(p))}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        <StatusBadge project={p} />
                        {p.project_type && <span className="text-xs text-gray-500">{p.project_type}</span>}
                        <span className="text-xs text-gray-400 ml-auto">
                          {sched.date ? `${sched.label} ${sched.date}` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/5 border-b border-gray-200">
                  <tr>
                    <th scope="col" className="px-3 py-3 w-10">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all jobs on this page"
                      />
                    </th>
                    <SortableHeader label="Client" columnKey="client" sortKey={sortKey} dir={dir} onSort={onSort} />
                    <th scope="col" className="px-3 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Property
                    </th>
                    <SortableHeader label="Job type" columnKey="type" sortKey={sortKey} dir={dir} onSort={onSort} />
                    <SortableHeader label="Schedule" columnKey="schedule" sortKey={sortKey} dir={dir} onSort={onSort} />
                    <SortableHeader label="Status" columnKey="status" sortKey={sortKey} dir={dir} onSort={onSort} />
                    <SortableHeader label="Total" columnKey="total" sortKey={sortKey} dir={dir} onSort={onSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((p) => {
                    const sched = scheduleInfo(p);
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/estimator/projects/${p.id}`)}
                      >
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(p.id)}
                            onCheckedChange={() => toggleOne(p.id)}
                            aria-label={`Select job for ${p.client_name || "unknown client"}`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            to={`/estimator/projects/${p.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-secondary text-sm hover:text-primary hover:underline"
                          >
                            {p.client_name || "—"}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600 max-w-[260px]">
                          <span className="block truncate">
                            {[p.client_address, p.client_city].filter(Boolean).join(", ") || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600">{p.project_type || "—"}</td>
                        <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {sched.date ? (
                            <>
                              <span className="block text-xs text-gray-400 uppercase">{sched.label}</span>
                              {sched.date}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge project={p} />
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-secondary whitespace-nowrap tabular-nums">
                          {money(jobValue(p))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500" aria-live="polite">
                {filtered.length === 0
                  ? "0 results"
                  : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setParam("page", String(safePage - 1), "1")}
                  disabled={safePage <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Prev</span>
                </Button>
                <span className="text-xs text-gray-500 tabular-nums px-1">
                  Page {safePage} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setParam("page", String(safePage + 1), "1")}
                  disabled={safePage >= pageCount}
                  aria-label="Next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
