import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";
import {
  DollarSign, Briefcase, Clock, CheckCircle2, Plus, ArrowRight,
  AlertTriangle, Bell, TrendingUp, FileText, CalendarDays,
  Wrench, PackageSearch, Users, HardHat, Building2, FileBadge, Receipt,
  Zap, ChevronRight, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, differenceInDays } from "date-fns";
import DashboardMap from "@/components/estimator/DashboardMap";

const STATUS_COLORS = {
  walkthrough: "bg-amber-100 text-amber-800 border-amber-200",
  draft: "bg-blue-100 text-blue-800 border-blue-200",
  pending_review: "bg-violet-100 text-violet-800 border-violet-200",
  sent: "bg-violet-100 text-violet-800 border-violet-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  denied: "bg-red-100 text-red-800 border-red-200",
  modify: "bg-orange-100 text-orange-800 border-orange-200",
  in_progress: "bg-orange-100 text-orange-800 border-orange-200",
  completed: "bg-slate-100 text-slate-600 border-slate-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  imported: "bg-teal-100 text-teal-800 border-teal-200",
};

const REMINDER_THRESHOLDS = {
  walkthrough: 3, draft: 5, sent: 7, pending_review: 7, modify: 5, denied: 14,
};
const REMINDER_LABELS = {
  walkthrough: "Walkthrough done — no estimate started",
  draft: "Draft estimate — not sent yet",
  sent: "Estimate sent — awaiting response",
  pending_review: "Pending internal review",
  modify: "Modification requested",
  denied: "Previously denied — consider re-engaging",
};
const REMINDER_URGENCY = {
  walkthrough: { dot: "bg-amber-400", badge: "bg-amber-100 text-amber-800", bar: "bg-amber-400" },
  draft: { dot: "bg-blue-400", badge: "bg-blue-100 text-blue-800", bar: "bg-blue-400" },
  sent: { dot: "bg-violet-400", badge: "bg-violet-100 text-violet-800", bar: "bg-violet-400" },
  pending_review: { dot: "bg-violet-400", badge: "bg-violet-100 text-violet-800", bar: "bg-violet-400" },
  modify: { dot: "bg-orange-400", badge: "bg-orange-100 text-orange-800", bar: "bg-orange-400" },
  denied: { dot: "bg-red-300", badge: "bg-red-100 text-red-800", bar: "bg-red-300" },
};

function ageLabel(days) {
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days}d ago`;
}

export default function EstimatorDashboard() {
  const { brandColor, companyName } = useCompanyBrand();

  const { data: projects = [] } = useQuery({
    queryKey: ["contractor-projects"],
    queryFn: () => base44.entities.ContractorProject.list("-created_date", 300),
  });
  const { data: estimates = [] } = useQuery({
    queryKey: ["all-estimates"],
    queryFn: () => base44.entities.Estimate.list("-created_date", 300),
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["dashboard-leads"],
    queryFn: () => base44.entities.Lead.list("-created_date", 100),
  });
  const { data: subBids = [] } = useQuery({
    queryKey: ["dashboard-sub-bids"],
    queryFn: () => base44.entities.SubBid.list("-created_date", 100),
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["dashboard-invoices"],
    queryFn: () => base44.entities.InvoiceRecord.list("-email_received_date", 100),
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ["dashboard-vendors"],
    queryFn: () => base44.entities.Vendor.list("-created_date", 200),
  });

  const approvedProjects = projects.filter(p => p.status === "approved");
  const inProgressProjects = projects.filter(p => p.status === "in_progress");
  const completedProjects = projects.filter(p => p.status === "completed");
  const pipelineProjects = projects.filter(p => ["draft", "sent", "pending_review"].includes(p.status));

  const approvedValue = approvedProjects.reduce((s, p) => s + (p.adjusted_total || p.original_estimate_total || 0), 0);
  const inProgressValue = inProgressProjects.reduce((s, p) => s + (p.adjusted_total || p.original_estimate_total || 0), 0);
  const completedValue = completedProjects.reduce((s, p) => s + (p.adjusted_total || p.original_estimate_total || 0), 0);
  const pipelineValue = pipelineProjects.reduce((s, p) => s + (p.original_estimate_total || p.adjusted_total || 0), 0);

  const today = new Date();
  const reminders = projects
    .filter(p => {
      const threshold = REMINDER_THRESHOLDS[p.status];
      if (!threshold) return false;
      const ref = p.updated_date || p.created_date;
      return ref && differenceInDays(today, new Date(ref)) >= threshold;
    })
    .map(p => ({ ...p, age: differenceInDays(today, new Date(p.updated_date || p.created_date)) }))
    .sort((a, b) => {
      const order = ["modify", "sent", "pending_review", "draft", "walkthrough", "denied"];
      return order.indexOf(a.status) - order.indexOf(b.status) || b.age - a.age;
    })
    .slice(0, 10);

  const statusBreakdown = Object.entries(
    projects.reduce((acc, p) => {
      acc[p.status] = { count: (acc[p.status]?.count || 0) + 1, value: (acc[p.status]?.value || 0) + (p.adjusted_total || p.original_estimate_total || 0) };
      return acc;
    }, {})
  ).sort((a, b) => {
    const order = ["in_progress", "approved", "sent", "pending_review", "draft", "walkthrough", "modify", "denied", "completed", "cancelled", "imported"];
    return order.indexOf(a[0]) - order.indexOf(b[0]);
  });

  const newLeads = leads.filter(l => ["New", "new"].includes(l.status));
  const awaitingApproval = estimates.filter(e => ["sent", "pending_review"].includes(e.status));
  const missingSubBids = subBids.filter(b => ["invited", "pending", "sent"].includes(b.status));
  const invoicesToReview = invoices.filter(i => ["pending_review"].includes(i.status));
  const expiringInsurance = vendors.filter(v => ["expired", "expiring_soon"].includes(v.insurance_status));
  const lowMarginProjects = projects.filter(p => (p.margin_pct !== undefined && p.margin_pct < 15) || (p.profit_margin_pct !== undefined && p.profit_margin_pct < 15));

  const alerts = [
    { label: "New Leads", count: newLeads.length, icon: Users, path: "/admin/leads", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
    { label: "Awaiting Approval", count: awaitingApproval.length, icon: FileText, path: "/admin/projects", color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100" },
    { label: "Missing Sub Bids", count: missingSubBids.length, icon: HardHat, path: "/estimator/sow", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100" },
    { label: "Invoices to Review", count: invoicesToReview.length, icon: Receipt, path: "/admin/invoices", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
    { label: "Insurance Alerts", count: expiringInsurance.length, icon: AlertTriangle, path: "/estimator/vendors", color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
    { label: "Margin Risk", count: lowMarginProjects.length, icon: TrendingUp, path: "/estimator/margin", color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
  ].filter(a => a.count > 0);

  const quickActions = [
    { label: "Material Take-Off", icon: PackageSearch, path: "/estimator/mto", desc: "Generate MTO" },
    { label: "Scope of Work", icon: FileText, path: "/estimator/sow", desc: "Build bid package" },
    { label: "Vendor Directory", icon: Building2, path: "/estimator/vendors", desc: "Subs & suppliers" },
    { label: "Customer History", icon: Users, path: "/estimator/customers", desc: "Past clients" },
    { label: "Toolbox", icon: Wrench, path: "/estimator/toolbox", desc: "Pricing & reference" },
    { label: "Roof Measure", icon: Activity, path: "/estimator/roof-measure", desc: "Satellite + calc" },
  ];

  const recent = projects.slice(0, 8);

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* ── Page Header ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-5 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Project Dashboard</h1>
            <p className="text-xs text-slate-400 mt-0.5">{format(today, "EEEE, MMMM d, yyyy")}</p>
          </div>
          <Link to="/estimator/walkthrough">
            <Button className="gap-2 font-semibold text-sm shadow-sm" style={{ background: brandColor }}>
              <Plus className="w-4 h-4" /> New Walkthrough
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Signed & Approved", value: `$${approvedValue.toLocaleString()}`, sub: `${approvedProjects.length} project${approvedProjects.length !== 1 ? "s" : ""}`, icon: CheckCircle2, valueColor: "text-emerald-600", iconBg: "bg-emerald-50", iconColor: "text-emerald-600", accent: "#10b981" },
            { label: "In Progress", value: `$${inProgressValue.toLocaleString()}`, sub: `${inProgressProjects.length} active`, icon: Zap, valueColor: "text-orange-600", iconBg: "bg-orange-50", iconColor: "text-orange-500", accent: "#f97316" },
            { label: "Sales Pipeline", value: `$${pipelineValue.toLocaleString()}`, sub: `${pipelineProjects.length} estimate${pipelineProjects.length !== 1 ? "s" : ""} pending`, icon: Clock, valueColor: "text-blue-600", iconBg: "bg-blue-50", iconColor: "text-blue-500", accent: "#3b82f6" },
            { label: "Completed Revenue", value: `$${completedValue.toLocaleString()}`, sub: `${completedProjects.length} job${completedProjects.length !== 1 ? "s" : ""} done`, icon: DollarSign, valueColor: "text-primary", iconBg: "bg-primary/10", iconColor: "text-primary", accent: brandColor },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.iconBg}`}>
                  <s.icon className={`w-5 h-5 ${s.iconColor}`} />
                </div>
                <div className="w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: s.accent }} />
              </div>
              <div className={`text-2xl font-bold ${s.valueColor} leading-tight`}>{s.value}</div>
              <div className="text-xs text-slate-400 mt-1">{s.label}</div>
              <div className="text-xs font-medium text-slate-500 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Priority Alerts ── */}
        {alerts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
              <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <h2 className="font-semibold text-slate-700 text-sm">Needs Attention</h2>
              <span className="ml-auto text-xs text-slate-400">{alerts.length} item{alerts.length !== 1 ? "s" : ""} requiring action</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 divide-x divide-y divide-gray-50">
              {alerts.map(({ label, count, icon: Icon, path, color, bg, border }) => (
                <Link key={label} to={path} className={`flex items-center gap-3 p-4 hover:bg-gray-50/80 transition-colors group`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg} border ${border} shrink-0`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-800">{count}</div>
                    <div className="text-xs text-slate-500 leading-tight">{label}</div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick Actions ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
            <Wrench className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-700 text-sm">Field Tools</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-gray-50">
            {quickActions.map(({ label, icon: Icon, path, desc }) => (
              <Link key={path} to={path} className="flex flex-col items-center text-center p-4 hover:bg-gray-50/80 transition-colors group">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-2.5 transition-transform group-hover:scale-105" style={{ background: `${brandColor}18` }}>
                  <Icon className="w-5 h-5" style={{ color: brandColor }} />
                </div>
                <div className="text-xs font-semibold text-slate-700 leading-tight">{label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">{desc}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Reminders + Pipeline ── */}
        <div className="grid lg:grid-cols-2 gap-4">

          {/* Follow-Up Reminders */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
              <Bell className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-slate-700 text-sm">Follow-Up Reminders</h2>
              {reminders.length > 0 && (
                <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: brandColor }}>
                  {reminders.length}
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-50 max-h-[380px] overflow-y-auto">
              {reminders.length === 0 && (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  <p className="text-sm text-slate-400">All caught up — no follow-ups needed.</p>
                </div>
              )}
              {reminders.map(p => {
                const urg = REMINDER_URGENCY[p.status] || REMINDER_URGENCY.draft;
                return (
                  <Link key={p.id} to={`/estimator/projects/${p.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/80 transition-colors group">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${urg.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-slate-700 truncate">{p.client_name}</div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">{REMINDER_LABELS[p.status]}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${urg.badge}`}>{ageLabel(p.age)}</span>
                      {(p.adjusted_total || p.original_estimate_total) > 0 && (
                        <div className="text-xs font-semibold text-slate-500 mt-1">${(p.adjusted_total || p.original_estimate_total).toLocaleString()}</div>
                      )}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Pipeline by Status */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
              <Briefcase className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-slate-700 text-sm">Pipeline by Status</h2>
              <span className="ml-auto text-xs text-slate-400">{projects.length} total</span>
            </div>
            <div className="p-5 space-y-3">
              {statusBreakdown.map(([status, { count, value }]) => (
                <div key={status} className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold w-28 text-center shrink-0 border ${STATUS_COLORS[status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                    {status.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (count / Math.max(1, projects.length)) * 100)}%`, background: brandColor, opacity: 0.7 }} />
                  </div>
                  <span className="text-xs font-bold text-slate-600 w-5 text-right shrink-0">{count}</span>
                  {value > 0 && <span className="text-xs text-slate-400 w-20 text-right shrink-0">${(value / 1000).toFixed(0)}k</span>}
                </div>
              ))}
              {statusBreakdown.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No projects yet.</p>}
            </div>
          </div>
        </div>

        {/* ── Job Map ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
            <Activity className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-700 text-sm">Active Job Map</h2>
          </div>
          <div className="p-4">
            <DashboardMap projects={projects.filter(p => ["approved", "in_progress", "sent", "pending_review", "draft", "walkthrough", "modify"].includes(p.status))} />
          </div>
        </div>

        {/* ── Recent Projects ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-700 text-sm">Recent Projects</h2>
            <Link to="/estimator/projects" className="ml-auto text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: brandColor }}>
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.map(p => {
              const age = p.updated_date ? differenceInDays(today, new Date(p.updated_date)) : null;
              return (
                <Link key={p.id} to={`/estimator/projects/${p.id}`}
                  className="flex items-center justify-between py-3.5 px-5 hover:bg-gray-50/80 transition-colors gap-3 group">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: brandColor }}>
                      {p.client_name?.charAt(0) || "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-700 truncate">{p.client_name}</div>
                      <div className="text-xs text-slate-400 truncate">{p.project_type}{p.client_city ? ` · ${p.client_city}` : ""}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {age !== null && <span className="text-xs text-slate-400 hidden md:block">{ageLabel(age)}</span>}
                    {(p.adjusted_total || p.original_estimate_total) > 0 && (
                      <span className="text-sm font-bold hidden sm:block" style={{ color: brandColor }}>
                        ${(p.adjusted_total || p.original_estimate_total).toLocaleString()}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[p.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {p.status?.replace(/_/g, " ")}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              );
            })}
            {projects.length === 0 && (
              <div className="text-center py-10">
                <p className="text-sm text-slate-400">No projects yet.</p>
                <Link to="/estimator/walkthrough">
                  <Button className="mt-3 gap-1.5 text-sm" style={{ background: brandColor }}>
                    <Plus className="w-4 h-4" /> Start First Walkthrough
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}