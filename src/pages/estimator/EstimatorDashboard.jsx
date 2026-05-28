import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";
import {
  DollarSign, Briefcase, Clock, CheckCircle2, Plus, ArrowRight,
  AlertTriangle, Bell, TrendingUp, FileText, CalendarDays,
  Wrench, PackageSearch, Users, HardHat, Building2, FileBadge, Receipt
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, differenceInDays } from "date-fns";
import DashboardMap from "@/components/estimator/DashboardMap";

const STATUS_COLORS = {
  walkthrough: "bg-yellow-100 text-yellow-800",
  draft: "bg-blue-100 text-blue-800",
  pending_review: "bg-purple-100 text-purple-800",
  sent: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  denied: "bg-red-100 text-red-800",
  modify: "bg-orange-100 text-orange-800",
  in_progress: "bg-orange-100 text-orange-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  imported: "bg-teal-100 text-teal-800",
};

const REMINDER_THRESHOLDS = {
  walkthrough: 3, draft: 5, sent: 7, pending_review: 7, modify: 5, denied: 14,
};

const REMINDER_LABELS = {
  walkthrough: "Walkthrough done — no estimate started",
  draft: "Draft estimate — not sent yet",
  sent: "Estimate sent — awaiting client response",
  pending_review: "Pending internal review",
  modify: "Modification requested — needs update",
  denied: "Previously denied — consider re-engaging",
};

const REMINDER_URGENCY = {
  walkthrough: { color: "border-l-yellow-400 bg-yellow-50", badge: "bg-yellow-100 text-yellow-800", icon: Clock },
  draft: { color: "border-l-blue-400 bg-blue-50", badge: "bg-blue-100 text-blue-800", icon: FileText },
  sent: { color: "border-l-purple-400 bg-purple-50", badge: "bg-purple-100 text-purple-800", icon: Bell },
  pending_review: { color: "border-l-purple-400 bg-purple-50", badge: "bg-purple-100 text-purple-800", icon: Bell },
  modify: { color: "border-l-orange-400 bg-orange-50", badge: "bg-orange-100 text-orange-800", icon: AlertTriangle },
  denied: { color: "border-l-red-300 bg-red-50", badge: "bg-red-100 text-red-800", icon: AlertTriangle },
};

function ageLabel(days) {
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
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


  const approvedProjects = projects.filter((p) => p.status === "approved");
  const inProgressProjects = projects.filter((p) => p.status === "in_progress");
  const completedProjects = projects.filter((p) => p.status === "completed");

  const approvedValue = approvedProjects.reduce((s, p) => s + (p.adjusted_total || p.original_estimate_total || 0), 0);
  const inProgressValue = inProgressProjects.reduce((s, p) => s + (p.adjusted_total || p.original_estimate_total || 0), 0);
  const completedValue = completedProjects.reduce((s, p) => s + (p.adjusted_total || p.original_estimate_total || 0), 0);

  const pipelineProjects = projects.filter((p) => ["draft", "sent", "pending_review"].includes(p.status));
  const pipelineValue = pipelineProjects.reduce((s, p) => s + (p.original_estimate_total || p.adjusted_total || 0), 0);

  const stats = [
    { label: "Signed / Approved", value: `$${approvedValue.toLocaleString()}`, sub: `${approvedProjects.length} project${approvedProjects.length !== 1 ? "s" : ""}`, icon: CheckCircle2, color: "text-green-600", border: "border-l-green-500", bg: "bg-green-50" },
    { label: "In Progress", value: `$${inProgressValue.toLocaleString()}`, sub: `${inProgressProjects.length} active`, icon: TrendingUp, color: "text-orange-600", border: "border-l-orange-500", bg: "bg-orange-50" },
    { label: "Sales Pipeline", value: `$${pipelineValue.toLocaleString()}`, sub: `${pipelineProjects.length} estimate${pipelineProjects.length !== 1 ? "s" : ""} pending`, icon: Clock, color: "text-blue-600", border: "border-l-blue-500", bg: "bg-blue-50" },
    { label: "Completed Revenue", value: `$${completedValue.toLocaleString()}`, sub: `${completedProjects.length} job${completedProjects.length !== 1 ? "s" : ""} done`, icon: DollarSign, color: "text-[#E35235]", border: "border-l-[#E35235]", bg: "bg-[#E35235]/5" },
  ];

  const today = new Date();
  const reminders = projects
    .filter((p) => {
      const threshold = REMINDER_THRESHOLDS[p.status];
      if (!threshold) return false;
      const ref = p.updated_date || p.created_date;
      if (!ref) return false;
      return differenceInDays(today, new Date(ref)) >= threshold;
    })
    .map((p) => ({ ...p, age: differenceInDays(today, new Date(p.updated_date || p.created_date)) }))
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


  const newLeads = leads.filter(l => ["New", "new", "unread"].includes(l.status));
  const awaitingApproval = estimates.filter(e => ["sent", "pending_review"].includes(e.status));
  const missingSubBids = subBids.filter(b => ["invited", "pending", "sent"].includes(b.status));
  const invoicesToReview = invoices.filter(i => ["new", "needs_review", "pending", "unpaid"].includes(i.status));
  const expiringInsurance = vendors.filter(v => ["expired", "expiring_soon"].includes(v.insurance_status));
  const permitAttention = projects.filter(p => ["preparing", "submitted", "revisions_required"].includes(p.permit_status) || (p.inspections || []).some(i => ["scheduled", "failed"].includes(i.status)));
  const lowMarginProjects = projects.filter(p => (p.margin_pct !== undefined && p.margin_pct < 15) || (p.profit_margin_pct !== undefined && p.profit_margin_pct < 15));
  const commandItems = [
    { label: "New leads", count: newLeads.length, icon: Users, path: "/admin/leads", tone: "bg-blue-50 text-blue-700", action: "Review leads" },
    { label: "Estimates awaiting approval", count: awaitingApproval.length, icon: FileText, path: "/estimator/projects", tone: "bg-purple-50 text-purple-700", action: "Follow up" },
    { label: "Missing sub bids", count: missingSubBids.length, icon: HardHat, path: "/estimator/sow", tone: "bg-orange-50 text-orange-700", action: "Chase bids" },
    { label: "Invoices to review", count: invoicesToReview.length, icon: Receipt, path: "/admin/invoices", tone: "bg-amber-50 text-amber-700", action: "Open inbox" },
    { label: "Insurance alerts", count: expiringInsurance.length, icon: AlertTriangle, path: "/estimator/vendors", tone: "bg-red-50 text-red-700", action: "Check subs" },
    { label: "Permit / inspection items", count: permitAttention.length, icon: FileBadge, path: "/estimator/projects", tone: "bg-teal-50 text-teal-700", action: "Review" },
    { label: "Margin risk", count: lowMarginProjects.length, icon: TrendingUp, path: "/estimator/margin", tone: "bg-rose-50 text-rose-700", action: "Guard margin" },
  ];
  const recent = projects.slice(0, 8);

  // Quick action shortcuts
  const quickActions = [
    { label: "New Walkthrough", icon: Plus, path: "/estimator/walkthrough", desc: "Start a new job" },
    { label: "Material Take-Off", icon: PackageSearch, path: "/estimator/mto", desc: "Generate MTO from scope" },
    { label: "Scope of Work", icon: FileText, path: "/estimator/sow", desc: "Build a bid package" },
    { label: "Vendor Directory", icon: Building2, path: "/estimator/vendors", desc: "Subs & suppliers" },
    { label: "Customer History", icon: Users, path: "/estimator/customers", desc: "Past client lookups" },
    { label: "Toolbox", icon: Wrench, path: "/estimator/toolbox", desc: "Pricing & reference tools" },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto bg-gray-50 min-h-screen">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-secondary">Dashboard</h1>
          <p className="text-sm text-gray-500">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <Link to="/estimator/walkthrough">
          <Button className="gap-2 text-white font-semibold" style={{ background: brandColor }}>
            <Plus className="w-4 h-4" /> New Walkthrough
          </Button>
        </Link>
      </div>

      {/* ── KPI Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className={`bg-white border border-gray-200 rounded-xl p-4 sm:p-5 border-l-4 ${s.border}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide font-semibold leading-tight">{s.label}</span>
            </div>
            <div className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>


      {/* ── Command Center ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100" style={{ background: `${brandColor}10` }}>
          <AlertTriangle className="w-4 h-4" style={{ color: brandColor }} />
          <h2 className="font-semibold text-secondary text-sm">Contractor Command Center</h2>
          <span className="text-xs text-gray-400 ml-auto">Daily priorities</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 divide-x divide-y divide-gray-100">
          {commandItems.map(({ label, count, icon: Icon, path, tone, action }) => (
            <Link key={label} to={path} className="p-4 hover:bg-gray-50 transition-colors">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${tone}`}><Icon className="w-4 h-4" /></div>
              <div className="text-2xl font-bold text-secondary">{count}</div>
              <div className="text-xs font-semibold text-gray-600 leading-tight">{label}</div>
              <div className="text-[11px] text-primary mt-2 font-medium">{action} →</div>
            </Link>
          ))}
        </div>
      </div>
      {/* ── Quick Actions ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100" style={{ background: `${brandColor}10` }}>
          <HardHat className="w-4 h-4" style={{ color: brandColor }} />
          <h2 className="font-semibold text-secondary text-sm">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-gray-100">
          {quickActions.map(({ label, icon: Icon, path, desc }) => (
            <Link key={path} to={path} className="flex flex-col items-center text-center p-4 hover:bg-gray-50 transition-colors group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-colors" style={{ background: `${brandColor}15` }}>
                <Icon className="w-5 h-5 transition-colors" style={{ color: brandColor }} />
              </div>
              <div className="text-xs font-semibold text-secondary group-hover:text-secondary leading-tight">{label}</div>
              <div className="text-xs text-gray-400 mt-0.5 leading-tight hidden sm:block">{desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Reminders + Pipeline ── */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">

        {/* Reminders */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 bg-secondary/5 border-b border-gray-100">
            <Bell className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-secondary">Follow-Up Reminders</h2>
            {reminders.length > 0 && (
              <span className="ml-auto text-white text-xs font-bold rounded-full px-2 py-0.5" style={{ background: brandColor }}>{reminders.length}</span>
            )}
          </div>
          <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
            {reminders.length === 0 && (
              <div className="py-10 text-center text-sm text-gray-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                All caught up! No follow-ups needed.
              </div>
            )}
            {reminders.map((p) => {
              const urg = REMINDER_URGENCY[p.status] || REMINDER_URGENCY.draft;
              const Icon = urg.icon;
              return (
                <Link key={p.id} to={`/estimator/projects/${p.id}`}
                  className={`flex items-start gap-3 px-4 py-3 border-l-4 hover:brightness-95 transition-all ${urg.color}`}>
                  <Icon className="w-4 h-4 mt-0.5 shrink-0 text-gray-500" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-secondary truncate">{p.client_name}</div>
                    <div className="text-xs text-gray-500 truncate">{p.project_type}{p.client_city ? ` · ${p.client_city}` : ""}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{REMINDER_LABELS[p.status]}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${urg.badge}`}>{ageLabel(p.age)}</span>
                    {(p.adjusted_total || p.original_estimate_total) > 0 && (
                      <div className="text-xs text-gray-500 mt-1 font-semibold">${(p.adjusted_total || p.original_estimate_total).toLocaleString()}</div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Pipeline by Status */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 bg-secondary/5 border-b border-gray-100">
            <Briefcase className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-secondary">Pipeline by Status</h2>
          </div>
          <div className="p-5 space-y-2.5">
            {statusBreakdown.map(([status, { count, value }]) => (
              <div key={status} className="flex items-center gap-3">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold w-28 text-center shrink-0 ${STATUS_COLORS[status] || "bg-gray-100 text-gray-600"}`}>
                  {status.replace(/_/g, " ")}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="h-2 rounded-full" style={{ width: `${Math.min(100, (count / Math.max(1, projects.length)) * 100)}%`, background: brandColor, opacity: 0.6 }} />
                </div>
                <span className="text-xs font-semibold text-secondary w-6 text-right">{count}</span>
                {value > 0 && <span className="text-xs text-gray-400 w-20 text-right">${value.toLocaleString()}</span>}
              </div>
            ))}
            {statusBreakdown.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No projects yet.</p>}
          </div>
        </div>
      </div>

      {/* ── Job Map ── */}
      <div className="mb-6">
        <DashboardMap projects={projects.filter((p) => ["approved", "in_progress", "sent", "pending_review", "draft", "walkthrough", "modify"].includes(p.status))} />
      </div>

      {/* ── Recent Projects ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 bg-secondary/5 border-b border-gray-100">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-secondary">Recent Projects</h2>
          <Link to="/estimator/projects" className="ml-auto text-sm hover:underline flex items-center gap-1 font-medium" style={{ color: brandColor }}>
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {recent.map((p) => {
            const ref = p.updated_date || p.created_date;
            const age = ref ? differenceInDays(new Date(), new Date(ref)) : null;
            return (
              <Link key={p.id} to={`/estimator/projects/${p.id}`}
                className="flex items-center justify-between py-3 px-5 hover:bg-gray-50 transition-colors gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-secondary truncate">{p.client_name}</div>
                  <div className="text-xs text-gray-400 truncate">{p.project_type}{p.client_city ? ` · ${p.client_city}` : ""}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {age !== null && <span className="text-xs text-gray-400 hidden sm:block">{ageLabel(age)}</span>}
                  {(p.adjusted_total || p.original_estimate_total) > 0 && (
                    <span className="text-sm font-semibold hidden sm:block" style={{ color: brandColor }}>
                      ${(p.adjusted_total || p.original_estimate_total).toLocaleString()}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[p.status] || "bg-gray-100"}`}>
                    {p.status?.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            );
          })}
          {projects.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">No projects yet. Start a new walkthrough!</p>
          )}
        </div>
      </div>
    </div>
  );
}