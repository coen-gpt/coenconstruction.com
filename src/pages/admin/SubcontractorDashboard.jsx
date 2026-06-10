import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  CheckCircle2, AlertTriangle, XCircle, Clock, ExternalLink, Search, ChevronDown, ChevronUp,
  Building2, Phone, Mail, CheckSquare, Square, X, RefreshCw
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const INSURANCE_STATUS_CONFIG = {
  valid:         { label: "Compliant",      bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500",  icon: CheckCircle2 },
  expiring_soon: { label: "Expiring Soon",  bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-500",  icon: AlertTriangle },
  expired:       { label: "Expired",        bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500",    icon: XCircle },
  pending:       { label: "Incomplete",     bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400",   icon: Clock },
};

function getCompliancePct(v) {
  let score = 0;
  if (v.packet_status === "completed") score++;
  if (v.workers_comp_url) score++;
  if (v.liability_ins_url) score++;
  if (v.w9_url) score++;
  return Math.round((score / 4) * 100);
}

function StatusBadge({ status }) {
  const cfg = INSURANCE_STATUS_CONFIG[status] || INSURANCE_STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function ComplianceMeter({ pct }) {
  const color = pct === 100 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-600 w-8 text-right">{pct}%</span>
    </div>
  );
}

function SubRow({ vendor, projects, expanded, onToggle, selected, onSelect }) {
  const compPct = getCompliancePct(vendor);

  const allAssignments = projects.flatMap(p =>
    (p.subcontractor_assignments || []).map(a => ({ ...a, project_name: p.client_name, project_id: p.id }))
  );
  const myAssignments = allAssignments.filter(a =>
    a.subcontractor_email === vendor.email || a.subcontractor_name === vendor.company_name
  );
  const completed = myAssignments.filter(a => a.status === "complete").length;
  const inProgress = myAssignments.filter(a => a.status === "in_progress").length;
  const pending = myAssignments.filter(a => a.status === "pending").length;
  const completionPct = myAssignments.length > 0 ? Math.round((completed / myAssignments.length) * 100) : null;

  const wcDays = vendor.workers_comp_expiry
    ? Math.ceil((new Date(vendor.workers_comp_expiry) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const glDays = vendor.liability_ins_expiry
    ? Math.ceil((new Date(vendor.liability_ins_expiry) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-colors ${
      selected ? "border-primary ring-1 ring-primary/20" : "border-gray-100"
    }`}>
      <div className="flex items-start gap-2 p-4">
        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="shrink-0 mt-0.5 text-gray-300 hover:text-primary transition-colors"
        >
          {selected
            ? <CheckSquare className="w-4 h-4 text-primary" />
            : <Square className="w-4 h-4" />}
        </button>

        <button onClick={onToggle} className="flex-1 text-left hover:bg-slate-50/50 transition-colors -m-1 p-1 rounded-xl">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-white text-sm ${
              compPct === 100 ? "bg-green-500" : compPct >= 75 ? "bg-amber-500" : "bg-red-400"
            }`}>
              {vendor.company_name?.charAt(0) || "S"}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-bold text-gray-800 text-sm">{vendor.company_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{vendor.category || "Subcontractor"}</div>
                </div>
                <StatusBadge status={vendor.insurance_status} />
              </div>

              <div className="grid grid-cols-3 gap-3 mt-3">
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Compliance</div>
                  <ComplianceMeter pct={compPct} />
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Completion</div>
                  {completionPct !== null ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${completionPct >= 80 ? "bg-green-500" : completionPct >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                          style={{ width: `${completionPct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-600 w-8 text-right">{completionPct}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">No data</span>
                  )}
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Active Jobs</div>
                  <div className="text-sm font-bold text-gray-700">{inProgress + pending}</div>
                </div>
              </div>
            </div>
            <div className="shrink-0 text-gray-300 mt-1">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4 bg-slate-50/50">
          <div className="flex gap-3 flex-wrap">
            {vendor.email && (
              <a href={`mailto:${vendor.email}`} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#E35235] transition-colors">
                <Mail className="w-3.5 h-3.5" /> {vendor.email}
              </a>
            )}
            {vendor.phone && (
              <a href={`tel:${vendor.phone}`} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#E35235] transition-colors">
                <Phone className="w-3.5 h-3.5" /> {vendor.phone}
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "packet", label: "Agreement", ok: vendor.packet_status === "completed", url: null },
              { key: "w9", label: "W-9", ok: !!vendor.w9_url, url: vendor.w9_url },
              { key: "wc", label: `Workers Comp${wcDays !== null ? ` (${wcDays}d)` : ""}`, ok: !!vendor.workers_comp_url && (wcDays === null || wcDays > 0), url: vendor.workers_comp_url, warn: wcDays !== null && wcDays > 0 && wcDays <= 30, expired: wcDays !== null && wcDays <= 0 },
              { key: "gl", label: `Gen. Liability${glDays !== null ? ` (${glDays}d)` : ""}`, ok: !!vendor.liability_ins_url && (glDays === null || glDays > 0), url: vendor.liability_ins_url, warn: glDays !== null && glDays > 0 && glDays <= 30, expired: glDays !== null && glDays <= 0 },
            ].map(doc => (
              <div key={doc.key} className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold ${
                doc.expired ? "bg-red-50 border-red-200 text-red-700" :
                doc.warn ? "bg-amber-50 border-amber-200 text-amber-700" :
                doc.ok ? "bg-green-50 border-green-200 text-green-700" :
                "bg-gray-50 border-gray-200 text-gray-500"
              }`}>
                <div className="flex items-center gap-1.5">
                  {doc.expired ? <XCircle className="w-3.5 h-3.5" /> :
                   doc.warn ? <AlertTriangle className="w-3.5 h-3.5" /> :
                   doc.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                   <Clock className="w-3.5 h-3.5" />}
                  {doc.label}
                </div>
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>

          {myAssignments.length > 0 && (
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Project Assignments ({myAssignments.length})</div>
              <div className="space-y-1.5">
                {myAssignments.slice(0, 5).map((a, i) => (
                  <div key={i} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-3 py-2">
                    <div className="text-xs font-medium text-gray-700 truncate flex-1">{a.project_name}</div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 shrink-0 ${
                      a.status === "complete" ? "bg-green-100 text-green-700" :
                      a.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {a.status === "complete" ? "✓ Done" : a.status === "in_progress" ? "In Progress" : "Pending"}
                    </span>
                  </div>
                ))}
                {myAssignments.length > 5 && (
                  <p className="text-xs text-gray-400 text-center">+{myAssignments.length - 5} more</p>
                )}
              </div>
            </div>
          )}

          <a
            href={`/sub-onboarding?vendor=${vendor.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[#1B2B3A] text-white text-xs font-bold py-2.5 rounded-xl hover:bg-[#1B2B3A]/90 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open Onboarding Portal
          </a>
        </div>
      )}
    </div>
  );
}

export default function SubcontractorDashboard() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [sort, setSort] = useState("compliance");
  const [selected, setSelected] = useState(new Set());
  const [bulkAction, setBulkAction] = useState("");

  const queryClient = useQueryClient();

  const { data: vendors = [], isLoading: loadingVendors } = useQuery({
    queryKey: ["sub-dashboard-vendors"],
    queryFn: () => base44.entities.Vendor.filter({ is_subcontractor: true }),
    staleTime: 60_000,
  });

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["sub-dashboard-projects"],
    queryFn: () => base44.entities.ContractorProject.filter({ status: "in_progress" }),
    staleTime: 60_000,
  });

  const bulkNotifyMutation = useMutation({
    mutationFn: async (vendorIds) => {
      const targets = vendors.filter(v => vendorIds.includes(v.id));
      await Promise.all(targets.map(v =>
        base44.functions.invoke("sendSubOnboardingInvite", { vendor_id: v.id })
      ));
    },
    onSuccess: (_, ids) => {
      toast.success(`Onboarding reminder sent to ${ids.length} subcontractor${ids.length !== 1 ? "s" : ""}`);
      setSelected(new Set());
      setBulkAction("");
    },
    onError: () => toast.error("Some notifications failed — check individual records"),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }) => {
      await Promise.all(ids.map(id => base44.entities.Vendor.update(id, { insurance_status: status })));
    },
    onSuccess: (_, { ids, status }) => {
      queryClient.invalidateQueries({ queryKey: ["sub-dashboard-vendors"] });
      toast.success(`Updated ${ids.length} subcontractor${ids.length !== 1 ? "s" : ""} to "${status}"`);
      setSelected(new Set());
      setBulkAction("");
    },
  });

  const loading = loadingVendors || loadingProjects;

  const compliant = vendors.filter(v => v.insurance_status === "valid").length;
  const expiringSoon = vendors.filter(v => v.insurance_status === "expiring_soon").length;
  const expired = vendors.filter(v => v.insurance_status === "expired").length;
  const incomplete = vendors.filter(v => !v.insurance_status || v.insurance_status === "pending").length;

  const filtered = vendors
    .filter(v => {
      const matchSearch = !search || v.company_name?.toLowerCase().includes(search.toLowerCase()) || v.email?.toLowerCase().includes(search.toLowerCase());
      const matchFilter =
        filter === "all" ? true :
        filter === "issues" ? ["expired", "expiring_soon", "pending"].includes(v.insurance_status) :
        v.insurance_status === filter;
      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      if (sort === "compliance") return getCompliancePct(b) - getCompliancePct(a);
      if (sort === "name") return (a.company_name || "").localeCompare(b.company_name || "");
      if (sort === "status") {
        const order = { expired: 0, pending: 1, expiring_soon: 2, valid: 3 };
        return (order[a.insurance_status] ?? 1) - (order[b.insurance_status] ?? 1);
      }
      return 0;
    });

  const FILTERS = [
    { key: "all", label: `All (${vendors.length})` },
    { key: "issues", label: `Needs Attention (${expiringSoon + expired + incomplete})` },
    { key: "valid", label: `Compliant (${compliant})` },
    { key: "expired", label: `Expired (${expired})` },
  ];

  const allSelected = filtered.length > 0 && filtered.every(v => selected.has(v.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(v => v.id)));
    }
  };

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkAction = () => {
    if (!bulkAction || selected.size === 0) return;
    const ids = [...selected];
    if (bulkAction === "notify") {
      bulkNotifyMutation.mutate(ids);
    } else {
      bulkStatusMutation.mutate({ ids, status: bulkAction });
    }
  };

  const isBusy = bulkNotifyMutation.isPending || bulkStatusMutation.isPending;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#1B2B3A] flex items-center justify-center">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Subcontractor Dashboard</h1>
          <p className="text-sm text-gray-500">Performance, compliance, and document tracking for all active subs</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Compliant", value: compliant, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 border-green-100" },
          { label: "Expiring Soon", value: expiringSoon, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
          { label: "Expired", value: expired, icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-100" },
          { label: "Incomplete Docs", value: incomplete, icon: Clock, color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs font-semibold text-gray-500">{s.label}</span>
              </div>
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          );
        })}
      </div>

      {/* Filters + Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${
                filter === f.key ? "bg-[#1B2B3A] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-400">Sort:</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600"
            >
              <option value="status">Status</option>
              <option value="compliance">Compliance %</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <Input
            placeholder="Search subcontractors…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
      </div>

      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="flex flex-wrap items-center gap-3 bg-[#1B2B3A] text-white px-4 py-3 rounded-xl shadow-sm">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <div className="flex-1 flex items-center gap-2 flex-wrap">
            <select
              value={bulkAction}
              onChange={e => setBulkAction(e.target.value)}
              className="text-xs rounded-lg px-2 py-1.5 bg-white/15 border border-white/20 text-white focus:outline-none"
            >
              <option value="">— choose action —</option>
              <option value="notify">📧 Send onboarding reminder</option>
              <option value="valid">✅ Mark as Compliant</option>
              <option value="expiring_soon">⚠️ Mark as Expiring Soon</option>
              <option value="expired">❌ Mark as Expired</option>
              <option value="pending">⏳ Mark as Pending</option>
            </select>
            <Button
              size="sm"
              disabled={!bulkAction || isBusy}
              onClick={handleBulkAction}
              className="bg-white text-[#1B2B3A] hover:bg-white/90 text-xs h-7 px-3"
            >
              {isBusy ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Apply"}
            </Button>
          </div>
          <button
            onClick={() => setSelected(new Set())}
            className="text-white/60 hover:text-white transition-colors ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-[#E35235] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No subcontractors found</p>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filter.</p>
        </div>
      ) : (
        <>
          {/* Select all row */}
          <div className="flex items-center gap-3 px-1 py-1">
            <button onClick={toggleAll} className="text-gray-400 hover:text-primary transition-colors flex items-center gap-2">
              {allSelected
                ? <CheckSquare className="w-4 h-4 text-primary" />
                : <Square className="w-4 h-4" />}
              <span className="text-xs text-gray-400 font-medium">
                {allSelected ? "Deselect all" : `Select all ${filtered.length}`}
              </span>
            </button>
          </div>

          <div className="space-y-3">
            {filtered.map(v => (
              <SubRow
                key={v.id}
                vendor={v}
                projects={projects}
                expanded={expandedId === v.id}
                onToggle={() => setExpandedId(expandedId === v.id ? null : v.id)}
                selected={selected.has(v.id)}
                onSelect={() => toggleOne(v.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}