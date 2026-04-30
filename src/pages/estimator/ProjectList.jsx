import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Plus, Search, Filter, Briefcase, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export default function ProjectList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["contractor-projects"],
    queryFn: () => base44.entities.ContractorProject.list("-created_date", 200),
  });

  const filtered = projects.filter((p) => {
    const matchSearch =
      !search ||
      p.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.client_address?.toLowerCase().includes(search.toLowerCase()) ||
      p.project_type?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-secondary">Projects</h1>
          <p className="text-sm text-gray-500">{projects.length} total projects</p>
        </div>
        <Link to="/estimator/walkthrough" className="w-full sm:w-auto">
          <Button className="bg-primary text-white gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" /> New Walkthrough
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by client, address, type..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="walkthrough">Walkthrough</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="imported">Imported</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-gray-400">Loading projects...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No projects found</p>
          <p className="text-sm mt-1">Start a new walkthrough to create your first project.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to={`/estimator/projects/${p.id}`}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-primary hover:shadow-sm transition-all group border-l-4 border-l-transparent hover:border-l-primary"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                <div>
                   <div className="font-semibold text-secondary">{p.client_name}</div>
                   <div className="text-sm text-gray-500">{p.client_address || p.client_city || "No address"}</div>
                   {p.project_type && (
                     <div className="text-xs text-gray-400 mt-0.5">{p.project_type}</div>
                   )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                   <div className="font-semibold text-secondary">
                     {p.adjusted_total > 0
                       ? `$${p.adjusted_total.toLocaleString()}`
                       : p.original_estimate_total > 0
                       ? `$${p.original_estimate_total.toLocaleString()}`
                       : "—"}
                   </div>
                   <div className="text-xs text-gray-400">
                    {p.created_date ? format(new Date(p.created_date), "MMM d, yyyy") : ""}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-600"}`}>
                  {p.status?.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}