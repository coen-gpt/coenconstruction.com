import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { format, differenceInDays } from "date-fns";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";
import {
  Users, BookOpen, FileText, Search, Calculator, TrendingUp,
  DollarSign, Clock, CheckCircle2, Bell, AlertTriangle,
  Plus, ArrowRight, Briefcase, PackageSearch, Wrench,
  HardHat, Building2, CalendarDays, MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

export default function AdminDashboard() {
  const { brandColor, companyName } = useCompanyBrand();

  // Website/admin data
  const { data: leads = [] } = useQuery({ queryKey: ["dash-leads"], queryFn: () => base44.entities.Lead.list("-created_date", 5) });
  const { data: allLeads = [] } = useQuery({ queryKey: ["dash-leads-all"], queryFn: () => base44.entities.Lead.list() });
  const { data: posts = [] } = useQuery({ queryKey: ["dash-posts"], queryFn: () => base44.entities.BlogPost.list("-created_date", 100) });

  // Estimating suite data
  const { data: projects = [] } = useQuery({
    queryKey: ["contractor-projects"],
    queryFn: () => base44.entities.ContractorProject.list("-created_date", 300),
  });

  // Derived stats
  const newLeads = allLeads.filter(l => l.status === "New").length;
  const publishedPosts = posts.filter(p => p.published !== false).length;

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

  const quickActions = [
    { label: "New Walkthrough", icon: Plus, path: "/estimator/walkthrough", desc: "Start a new job" },
    { label: "Material Take-Off", icon: PackageSearch, path: "/estimator/mto", desc: "Generate MTO" },
    { label: "Scope of Work", icon: FileText, path: "/estimator/sow", desc: "Build bid package" },
    { label: "Vendor Directory", icon: Building2, path: "/estimator/vendors", desc: "Subs & suppliers" },
    { label: "Generate Blog", icon: BookOpen, path: "/admin/blog", desc: "AI-write a post" },
    { label: "SEO Audit", icon: Search, path: "/admin/seo", desc: "Analyze & improve" },
    { label: "Edit Pages", icon: FileText, path: "/admin/cms", desc: "Website content" },
    { label: "Toolbox", icon: Wrench, path: "/estimator/toolbox", desc: "Pricing & reference" },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-secondary">Dashboard</h1>
          <p className="text-sm text-gray-500">{format(today, "EEEE, MMMM d, yyyy")}</p>
        </div>
        <Link to="/estimator/walkthrough">
          <Button className="gap-2 text-white font-semibold" style={{ background: brandColor }}>
            <Plus className="w-4 h-4" /> New Walkthrough
          </Button>
        </Link>
      </div>

      {/* ── Revenue KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[
          { label: "Signed / Approved", value: `$${approvedValue.toLocaleString()}`, sub: `${approvedProjects.length} project${approvedProjects.length !== 1 ? "s" : ""}`, icon: CheckCircle2, color: "text-green-600", border: "border-l-green-500", bg: "bg-green-50" },
          { label: "In Progress", value: `$${inProgressValue.toLocaleString()}`, sub: `${inProgressProjects.length} active`, icon: TrendingUp, color: "text-orange-600", border: "border-l-orange-500", bg: "bg-orange-50" },
          { label: "Sales Pipeline", value: `$${pipelineValue.toLocaleString()}`, sub: `${pipelineProjects.length} pending`, icon: Clock, color: "text-blue-600", border: "border-l-blue-500", bg: "bg-blue-50" },
          { label: "Completed Revenue", value: `$${completedValue.toLocaleString()}`, sub: `${completedProjects.length} jobs done`, icon: DollarSign, color: "text-primary", border: "border-l-primary", bg: "bg-primary/5" },
        ].map(s => (
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

      {/* ── Website KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        {[
          { label: "New Leads", value: newLeads, sub: `${allLeads.length} total`, icon: Users, color: "text-blue-600", bg: "bg-blue-50", path: "/admin/leads" },
          { label: "Published Posts", value: publishedPosts, sub: `${posts.length} total`, icon: BookOpen, color: "text-green-600", bg: "bg-green-50", path: "/admin/blog" },
          { label: "Total Projects", value: projects.length, sub: `${inProgressProjects.length} active`, icon: Briefcase, color: "text-secondary", bg: "bg-secondary/10", path: "/estimator/projects" },
        ].map(s => (
          <Link key={s.label} to={s.path} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-400 font-medium">{s.label}</div>
              <div className="text-xs text-gray-300">{s.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Quick Actions ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100" style={{ background: `${brandColor}12` }}>
          <HardHat className="w-4 h-4" style={{ color: brandColor }} />
          <h2 className="font-semibold text-secondary text-sm">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 divide-x divide-y divide-gray-100">
          {quickActions.map(({ label, icon: Icon, path, desc }) => (
            <Link key={path} to={path} className="flex flex-col items-center text-center p-3 sm:p-4 hover:bg-gray-50 transition-colors group">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: `${brandColor}15` }}>
                <Icon className="w-4 h-4" style={{ color: brandColor }} />
              </div>
              <div className="text-[10px] sm:text-xs font-semibold text-secondary leading-tight">{label}</div>
              <div className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 leading-tight hidden sm:block">{desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Reminders + Pipeline ── */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">

        {/* Follow-Up Reminders */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 bg-secondary/5 border-b border-gray-100">
            <Bell className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-secondary">Follow-Up Reminders</h2>
            {reminders.length > 0 && (
              <span className="ml-auto text-white text-xs font-bold rounded-full px-2 py-0.5" style={{ background: brandColor }}>{reminders.length}</span>
            )}
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {reminders.length === 0 && (
              <div className="py-10 text-center text-sm text-gray-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                All caught up!
              </div>
            )}
            {reminders.map(p => {
              const urg = REMINDER_URGENCY[p.status] || REMINDER_URGENCY.draft;
              const Icon = urg.icon;
              return (
                <Link key={p.id} to={`/estimator/projects/${p.id}`}
                  className={`flex items-start gap-3 px-4 py-3 border-l-4 hover:brightness-95 transition-all ${urg.color}`}>
                  <Icon className="w-4 h-4 mt-0.5 shrink-0 text-gray-500" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-secondary truncate">{p.client_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{REMINDER_LABELS[p.status]}</div>
                  </div>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${urg.badge}`}>{ageLabel(p.age)}</span>
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
                  <div className="h-2 rounded-full" style={{ width: `${Math.min(100, (count / Math.max(1, projects.length)) * 100)}%`, background: brandColor, opacity: 0.65 }} />
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
        <DashboardMap projects={mapProjects} />
      </div>

      {/* ── Recent Projects + Recent Leads ── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Recent Projects */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 bg-secondary/5 border-b border-gray-100">
            <CalendarDays className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-secondary">Recent Projects</h2>
            <Link to="/estimator/projects" className="ml-auto text-sm font-medium flex items-center gap-1 hover:underline" style={{ color: brandColor }}>
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentProjects.map(p => {
              const age = p.updated_date ? differenceInDays(today, new Date(p.updated_date)) : null;
              return (
                <Link key={p.id} to={`/estimator/projects/${p.id}`}
                  className="flex items-center justify-between py-3 px-5 hover:bg-gray-50 transition-colors gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-secondary truncate">{p.client_name}</div>
                    <div className="text-xs text-gray-400 truncate">{p.project_type}{p.client_city ? ` · ${p.client_city}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(p.adjusted_total || p.original_estimate_total) > 0 && (
                      <span className="text-xs font-semibold hidden sm:block" style={{ color: brandColor }}>
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
            {projects.length === 0 && <p className="text-center text-sm text-gray-400 py-6">No projects yet.</p>}
          </div>
        </div>

        {/* Recent Leads */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 bg-secondary/5 border-b border-gray-100">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-secondary">Recent Leads</h2>
            <Link to="/admin/leads" className="ml-auto text-sm font-medium flex items-center gap-1 hover:underline" style={{ color: brandColor }}>
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {leads.length === 0 && <div className="py-8 text-center text-gray-400 text-sm">No leads yet</div>}
            {leads.map(lead => (
              <div key={lead.id} className="px-5 py-3 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-secondary truncate">{lead.full_name}</div>
                  <div className="text-xs text-gray-400 truncate">{lead.project_type || "General Inquiry"}</div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap shrink-0 ${
                  lead.status === "New" ? "bg-blue-100 text-blue-700" :
                  lead.status === "Won" ? "bg-green-100 text-green-700" :
                  lead.status === "Lost" ? "bg-red-100 text-red-700" :
                  "bg-gray-100 text-gray-600"
                }`}>{lead.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}