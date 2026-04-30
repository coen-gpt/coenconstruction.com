import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Users, BookOpen, FileText, Search, Calculator, TrendingUp, AlertCircle } from "lucide-react";

export default function AdminDashboard() {
  const { data: leads = [] } = useQuery({ queryKey: ["dash-leads"], queryFn: () => base44.entities.Lead.list("-created_date", 5) });
  const { data: allLeads = [] } = useQuery({ queryKey: ["dash-leads-all"], queryFn: () => base44.entities.Lead.list() });
  const { data: posts = [] } = useQuery({ queryKey: ["dash-posts"], queryFn: () => base44.entities.BlogPost.list("-created_date", 100) });
  const { data: estimates = [] } = useQuery({ queryKey: ["dash-estimates"], queryFn: () => base44.entities.Estimate.list() });

  const newLeads = allLeads.filter(l => l.status === "New").length;
  const publishedPosts = posts.filter(p => p.published !== false).length;
  const draftEstimates = estimates.filter(e => e.status === "Draft").length;

  const cards = [
    { label: "New Leads", value: newLeads, total: allLeads.length, icon: Users, color: "text-blue-600 bg-blue-50", path: "/admin/leads" },
    { label: "Blog Posts", value: publishedPosts, total: posts.length, icon: BookOpen, color: "text-green-600 bg-green-50", path: "/admin/blog" },
    { label: "Draft Estimates", value: draftEstimates, total: estimates.length, icon: Calculator, color: "text-orange-600 bg-orange-50", path: "/admin/estimates" },
    { label: "SEO Audits", value: "Run Audit", icon: Search, color: "text-purple-600 bg-purple-50", path: "/admin/seo" },
  ];

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-secondary">Welcome back</h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-1">Here's what's happening with Coen Construction today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-6 sm:mb-8">
        {cards.map(({ label, value, total, icon: Icon, color, path }) => (
          <Link key={label} to={path} className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-primary/20 transition-all border-l-4 border-l-primary/30">
            <div className={`w-8 sm:w-10 h-8 sm:h-10 rounded-lg flex items-center justify-center mb-2 sm:mb-3 ${color}`}>
              <Icon className="w-4 sm:w-5 h-4 sm:h-5" />
            </div>
            <div className="text-lg sm:text-2xl md:text-3xl font-bold text-secondary">{value}</div>
            <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 line-clamp-2">{label}{total !== undefined ? ` (${total})` : ""}</div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent leads */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 bg-secondary/5 border-b border-gray-100 gap-2">
            <h2 className="font-bold text-secondary text-sm sm:text-base">Recent Leads</h2>
            <Link to="/admin/leads" className="text-[10px] sm:text-xs text-primary font-semibold hover:underline whitespace-nowrap">View all →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {leads.length === 0 && <div className="py-6 sm:py-8 text-center text-gray-400 text-xs sm:text-sm">No leads yet</div>}
            {leads.map(lead => (
              <div key={lead.id} className="px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs sm:text-sm text-secondary truncate">{lead.full_name}</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 truncate">{lead.project_type || "General Inquiry"}</div>
                </div>
                <span className={`text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap shrink-0 ${
                   lead.status === "New" ? "bg-blue-100 text-blue-700" :
                   lead.status === "Won" ? "bg-green-100 text-green-700" :
                   lead.status === "Lost" ? "bg-red-100 text-red-700" :
                   "bg-gray-100 text-gray-600"
                }`}>{lead.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-3 sm:px-5 py-3 sm:py-4 bg-secondary/5 border-b border-gray-100">
            <h2 className="font-bold text-secondary text-sm sm:text-base">Quick Actions</h2>
          </div>
          <div className="p-3 sm:p-5 grid grid-cols-2 gap-2 sm:gap-3">
            {[
              { label: "New Estimate", path: "/admin/estimates", desc: "Create a ProEstimate", icon: Calculator },
              { label: "Generate Blog Post", path: "/admin/blog", desc: "AI-write a new post", icon: BookOpen },
              { label: "SEO Audit", path: "/admin/seo", desc: "Analyze & improve SEO", icon: Search },
              { label: "Edit Pages", path: "/admin/cms", desc: "Manage website content", icon: FileText },
            ].map(({ label, path, desc, icon: Icon }) => (
              <Link key={label} to={path} className="p-2.5 sm:p-4 border border-gray-100 rounded-lg sm:rounded-xl hover:border-primary hover:bg-primary/5 transition-colors group bg-gray-50">
                <Icon className="w-4 sm:w-5 h-4 sm:h-5 text-primary mb-1 sm:mb-2" />
                <div className="font-semibold text-xs sm:text-sm text-secondary group-hover:text-primary line-clamp-2">{label}</div>
                <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5 line-clamp-1">{desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}