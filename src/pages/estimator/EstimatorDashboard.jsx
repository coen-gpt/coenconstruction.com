import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { DollarSign, Briefcase, Clock, TrendingUp, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const STATUS_COLORS = {
  walkthrough: "bg-yellow-100 text-yellow-800",
  draft: "bg-blue-100 text-blue-800",
  sent: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  in_progress: "bg-orange-100 text-orange-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  imported: "bg-teal-100 text-teal-800",
};

export default function EstimatorDashboard() {
  const { data: projects = [] } = useQuery({
    queryKey: ["contractor-projects"],
    queryFn: () => base44.entities.ContractorProject.list("-created_date", 200),
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ["all-estimates"],
    queryFn: () => base44.entities.Estimate.list("-created_date", 200),
  });

  const activeProjects = projects.filter((p) => ["walkthrough", "draft", "sent", "approved", "in_progress"].includes(p.status));
  const totalContractValue = projects.reduce((s, p) => s + (p.adjusted_total || p.original_estimate_total || 0), 0);
  const activeRevenue = activeProjects.reduce((s, p) => s + (p.adjusted_total || p.original_estimate_total || 0), 0);
  const approvedProjects = projects.filter((p) => p.status === "approved");
  const pipeline = projects.filter((p) => ["draft", "sent"].includes(p.status)).reduce((s, p) => s + (p.original_estimate_total || 0), 0);

  const stats = [
    { label: "Total Contract Value", value: `$${totalContractValue.toLocaleString()}`, icon: DollarSign, color: "text-primary" },
    { label: "Active Revenue", value: `$${activeRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-green-600" },
    { label: "Sales Pipeline", value: `$${pipeline.toLocaleString()}`, icon: Clock, color: "text-blue-600" },
    { label: "Active Projects", value: activeProjects.length.toString(), icon: Briefcase, color: "text-secondary" },
  ];

  const recent = projects.slice(0, 8);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-secondary">Dashboard</h1>
          <p className="text-sm text-gray-500">{format(new Date(), "MMMM d, yyyy")}</p>
        </div>
        <Link to="/estimator/walkthrough">
          <Button className="gap-2 bg-primary text-white w-full sm:w-auto">
            <Plus className="w-4 h-4" /> New Walkthrough
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5 border-l-4 border-l-primary/40">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <s.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${s.color}`} />
              </div>
              <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide font-semibold leading-tight">{s.label}</span>
            </div>
            <div className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Status Breakdown */}
      <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-secondary mb-4 pb-2 border-b border-gray-100">Pipeline by Status</h2>
          <div className="space-y-2">
            {Object.entries(
              projects.reduce((acc, p) => {
                acc[p.status] = (acc[p.status] || 0) + 1;
                return acc;
              }, {})
            ).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status] || "bg-gray-100 text-gray-600"}`}>
                  {status?.replace("_", " ")}
                </span>
                <span className="text-sm font-semibold text-secondary">{count} project{count !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-secondary mb-4 pb-2 border-b border-gray-100">By Project Type</h2>
          <div className="space-y-2">
            {Object.entries(
              projects.reduce((acc, p) => {
                const t = p.project_type || "Other";
                acc[t] = (acc[t] || 0) + 1;
                return acc;
              }, {})
            ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{type}</span>
                <span className="font-semibold text-secondary">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-secondary/5 border-b border-gray-100">
          <h2 className="font-semibold text-secondary">Recent Projects</h2>
          <Link to="/estimator/projects" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="space-y-1 p-5">
        {recent.map((p) => (
          <Link key={p.id} to={`/estimator/projects/${p.id}`}
            className="flex items-center justify-between py-2.5 px-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded transition-colors group gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm text-secondary truncate">{p.client_name}</div>
              <div className="text-xs text-gray-400 truncate">{p.project_type} · {p.client_city || p.client_address}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-semibold text-primary hidden sm:block">
                {(p.adjusted_total || p.original_estimate_total) > 0
                  ? `$${(p.adjusted_total || p.original_estimate_total).toLocaleString()}`
                  : "—"}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[p.status] || "bg-gray-100"}`}>
                {p.status?.replace("_", " ")}
              </span>
            </div>
          </Link>
        ))}
          {projects.length === 0 && (
           <p className="text-center text-sm text-gray-400 py-6">No projects yet. Start a new walkthrough!</p>
          )}
        </div>
      </div>
    </div>
  );
}