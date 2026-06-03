import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { format, differenceInDays } from "date-fns";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";
import {
  Users, BookOpen, FileText, Search, TrendingUp,
  DollarSign, Clock, CheckCircle2, Bell, AlertTriangle,
  Plus, ArrowRight, Briefcase, Wrench,
  Building2, CalendarDays, ChevronRight, Zap, Activity,
  Star, Receipt, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  denied: "Previously denied",
};
const REMINDER_URGENCY = {
  walkthrough: { dot: "bg-amber-400", badge: "bg-amber-100 text-amber-800" },
  draft: { dot: "bg-blue-400", badge: "bg-blue-100 text-blue-800" },
  sent: { dot: "bg-violet-400", badge: "bg-violet-100 text-violet-800" },
  pending_review: { dot: "bg-violet-400", badge: "bg-violet-100 text-violet-800" },
  modify: { dot: "bg-orange-400", badge: "bg-orange-100 text-orange-800" },
  denied: { dot: "bg-red-300", badge: "bg-red-100 text-red-800" },
};

function ageLabel(days) {
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

export default function AdminDashboard() {
  const { brandColor } = useCompanyBrand();
  const today = new Date();

  const { data: leads = [] } = useQuery({ queryKey: ["dash-leads"], queryFn: () => base44.entities.Lead.list("-created_date", 5) });
  const { data: allLeads = [] } = useQuery({ queryKey: ["dash-leads-all"], queryFn: () => base44.entities.Lead.list() });
  const { data: posts = [] } = useQuery({ queryKey: ["dash-posts"], queryFn: () => base44.entities.BlogPost.list("-created_date", 100) });
  const { data: projects = [] } = useQuery({
    queryKey: ["contractor-projects"],
    queryFn: () => base44.entities.ContractorProject.list("-created_date", 300),
  });

  const newLeads = allLeads.filter(l => l.status === "New").length;
  const publishedPosts = posts.filter(p => p.published !== false).length;
  const draftPosts = posts.filter(p => p.published === false).length;

  const approvedProjects = projects.filter(p => p.status === "approved");
  const inProgressProjects = projects.filter(p => p.status === "in_progress");
  const completedProjects = projects.filter(p => p.status === "completed");
  const pipelineProjects = projects.filter(p => ["draft", "sent", "pending_review"].includes(p.status));

  const approvedValue = approvedProjects.reduce((s, p) => s + (p.adjusted_total || p.original_estimate_total || 0), 0);
  const inProgressValue = inProgressProjects.reduce((s, p) => s + (p.adjusted_total || p.original_estimate_total || 0), 0);
  const completedValue = completedProjects.reduce((s, p) => s + (p.adjusted_total || p.original_estimate_total || 0), 0);
  const pipelineValue = pipelineProjects.reduce((s, p) => s + (p.original_estimate_total || p.adjusted_total || 0), 0);

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
    .slice(0, 8);

  const statusBreakdown = Object.entries(
    projects.reduce((acc, p) => {
      acc[p.status] = { count: (acc[p.status]?.count || 0) + 1, value: (acc[p.status]?.value || 0) + (p.adjusted_total || p.original_estimate_total || 0) };
      return acc;
    }, {})
  ).sort((a, b) => {
    const order = ["in_progress", "approved", "sent", "pending_review", "draft", "walkthrough", "modify", "denied", "completed", "cancelled", "imported"];
    return order.indexOf(a[0]) - order.indexOf(b[0]);
  });

  const recentProjects = projects.slice(0, 6);
  const mapProjects = projects.filter(p => ["approved", "in_progress", "sent", "pending_review", "draft", "walkthrough", "modify"].includes(p.status));

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* ── Page Header ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-5 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Admin Dashboard</h1>
            <p className="text-xs text-slate-400 mt-0.5">{format(today, "EEEE, MMMM d, yyyy")}</p>
          </div>
          <Link to="/admin/walkthrough">
            <Button className="gap-2 font-semibold text-sm shadow-sm" style={{ background: brandColor }}>
              <Plus className="w-4 h-4" /> New Walkthrough
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">

        {/* ── Revenue KPIs ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Signed & Approved", value: `$${approvedValue.toLocaleString()}`, sub: `${approvedProjects.length} project${approvedProjects.length !== 1 ? "s" : ""}`, icon: CheckCircle2, valueColor: "text-emerald-600", iconBg: "bg-emerald-50", iconColor: "text-emerald-600", dot: "#10b981" },
            { label: "In Progress", value: `$${inProgressValue.toLocaleString()}`, sub: `${inProgressProjects.length} active`, icon: Zap, valueColor: "text-orange-600", iconBg: "bg-orange-50", iconColor: "text-orange-500", dot: "#f97316" },
            { label: "Sales Pipeline", value: `$${pipelineValue.toLocaleString()}`, sub: `${pipelineProjects.length} pending`, icon: Clock, valueColor: "text-blue-600", iconBg: "bg-blue-50", iconColor: "text-blue-500", dot: "#3b82f6" },
            { label: "Completed Revenue", value: `$${completedValue.toLocaleString()}`, sub: `${completedProjects.length} jobs done`, icon: DollarSign, valueColor: "text-primary", iconBg: "bg-primary/10", iconColor: "text-primary", dot: brandColor },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.iconBg}`}>
                  <s.icon className={`w-5 h-5 ${s.iconColor}`} />
                </div>
                <div className="w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: s.dot }} />
              </div>
              <div className={`text-2xl font-bold ${s.valueColor} leading-tight`}>{s.value}</div>
              <div className="text-xs text-slate-400 mt-1">{s.label}</div>
              <div className="text-xs font-medium text-slate-500 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Website & Content KPIs ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "New Leads", value: newLeads, sub: `${allLeads.length} total`, icon: Users, color: "text-blue-600", bg: "bg-blue-50", path: "/admin/leads" },
            { label: "Published Posts", value: publishedPosts, sub: `${draftPosts} drafts`, icon: BookOpen, color: "text-emerald-600", bg: "bg-emerald-50", path: "/admin/blog" },
            { label: "Total Projects", value: projects.length, sub: `${inProgressProjects.length} active`, icon: Briefcase, color: "text-violet-600", bg: "bg-violet-50", path: "/admin/estimates" },
            { label: "Active Pipeline", value: pipelineProjects.length, sub: "awaiting decisions", icon: Activity, color: "text-orange-600", bg: "bg-orange-50", path: "/admin/estimates" },
          ].map(s => (
            <Link key={s.label} to={s.path}
              className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3.5 hover:shadow-md transition-shadow shadow-sm group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.bg}`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-2xl font-bold leading-tight ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 font-medium truncate">{s.label}</div>
                <div className="text-[11px] text-slate-400">{s.sub}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </Link>
          ))}
        </div>

        {/* ── Quick Actions for Admins ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
            <Zap className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-700 text-sm">Quick Access</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-gray-50">
            {[
              { label: "Leads CRM", icon: Users, path: "/admin/leads", desc: "Manage pipeline" },
              { label: "Blog Posts", icon: BookOpen, path: "/admin/blog", desc: "AI-write & publish" },
              { label: "SEO Audit", icon: Search, path: "/admin/seo", desc: "Analyze & improve" },
              { label: "Edit Pages", icon: Globe, path: "/admin/cms", desc: "Website content" },
              { label: "Reviews", icon: Star, path: "/admin/reviews", desc: "Google reviews" },
              { label: "Estimating →", icon: Briefcase, path: "/estimator", desc: "Full suite" },
            ].map(({ label, icon: Icon, path, desc }) => (
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

          {/* Reminders */}
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
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {reminders.length === 0 && (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  <p className="text-sm text-slate-400">All caught up!</p>
                </div>
              )}
              {reminders.map(p => {
                const urg = REMINDER_URGENCY[p.status] || REMINDER_URGENCY.draft;
                return (
                  <Link key={p.id} to={`/admin/projects/${p.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/80 transition-colors group">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${urg.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-slate-700 truncate">{p.client_name}</div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">{REMINDER_LABELS[p.status]}</div>
                    </div>
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${urg.badge}`}>{ageLabel(p.age)}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Pipeline */}
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
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, (count / Math.max(1, projects.length)) * 100)}%`, background: brandColor, opacity: 0.7 }} />
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
            <DashboardMap projects={mapProjects} />
          </div>
        </div>

        {/* ── Recent Activity ── */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Recent Projects */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
              <CalendarDays className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-slate-700 text-sm">Recent Projects</h2>
              <Link to="/admin/estimates" className="ml-auto text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: brandColor }}>
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {recentProjects.map(p => (
                <Link key={p.id} to={`/admin/projects/${p.id}`}
                  className="flex items-center justify-between py-3.5 px-5 hover:bg-gray-50/80 transition-colors gap-3 group">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                      style={{ background: brandColor }}>
                      {p.client_name?.charAt(0) || "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-700 truncate">{p.client_name}</div>
                      <div className="text-xs text-slate-400 truncate">{p.project_type || "Project"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(p.adjusted_total || p.original_estimate_total) > 0 && (
                      <span className="text-xs font-bold hidden sm:block" style={{ color: brandColor }}>
                        ${(p.adjusted_total || p.original_estimate_total).toLocaleString()}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[p.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {p.status?.replace(/_/g, " ")}
                    </span>
                  </div>
                </Link>
              ))}
              {projects.length === 0 && <p className="text-center text-sm text-slate-400 py-8">No projects yet.</p>}
            </div>
          </div>

          {/* Recent Leads */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
              <Users className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-slate-700 text-sm">Recent Leads</h2>
              <Link to="/admin/leads" className="ml-auto text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: brandColor }}>
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {leads.length === 0 && <div className="py-10 text-center text-slate-400 text-sm">No leads yet</div>}
              {leads.map(lead => (
                <div key={lead.id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 shrink-0 flex items-center justify-center">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-700 truncate">{lead.full_name}</div>
                      <div className="text-xs text-slate-400 truncate">{lead.project_type || "General Inquiry"}</div>
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                    lead.status === "New" ? "bg-blue-100 text-blue-700" :
                    lead.status === "Won" ? "bg-emerald-100 text-emerald-700" :
                    lead.status === "Lost" ? "bg-red-100 text-red-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>{lead.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}