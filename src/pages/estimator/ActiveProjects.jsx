import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Search, HardHat, ChevronRight, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

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

const SORT_OPTIONS = [
  { value: "client_az", label: "Client A–Z" },
  { value: "client_za", label: "Client Z–A" },
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "value_high", label: "Value: High→Low" },
  { value: "value_low", label: "Value: Low→High" },
];

/**
 * Active Projects — jobs we are CURRENTLY working on.
 * Strictly status === "in_progress" (customer approved, signed & paid).
 * Completed / cancelled / walkthrough / sent quotes live on their own pages.
 */
export default function ActiveProjects() {
  const [search, setSearch] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("client_az");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["active-contractor-projects"],
    queryFn: () => base44.entities.ContractorProject.filter({ status: "in_progress" }, "client_name", 500),
  });

  const filtered = projects
    .filter((p) => {
      const matchSearch =
        !search ||
        p.client_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.client_address?.toLowerCase().includes(search.toLowerCase()) ||
        p.project_type?.toLowerCase().includes(search.toLowerCase());
      const matchJobType = jobTypeFilter === "all" || p.project_type === jobTypeFilter;
      return matchSearch && matchJobType;
    })
    .sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.created_date) - new Date(b.created_date);
      if (sortBy === "newest") return new Date(b.created_date) - new Date(a.created_date);
      if (sortBy === "client_az") return (a.client_name || "").localeCompare(b.client_name || "");
      if (sortBy === "client_za") return (b.client_name || "").localeCompare(a.client_name || "");
      if (sortBy === "value_high") return (b.adjusted_total || b.original_estimate_total || 0) - (a.adjusted_total || a.original_estimate_total || 0);
      if (sortBy === "value_low") return (a.adjusted_total || a.original_estimate_total || 0) - (b.adjusted_total || b.original_estimate_total || 0);
      return 0;
    });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <HardHat className="w-5 h-5 text-indigo-700" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-secondary">Active Projects</h1>
            <p className="text-sm text-gray-500">{projects.length} job{projects.length !== 1 ? "s" : ""} currently in progress</p>
          </div>
        </div>
        <Link to="/estimator/projects">
          <span className="text-sm text-primary font-semibold hover:underline flex items-center gap-1">
            <Briefcase className="w-4 h-4" /> View All Projects
          </span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by client, address, type..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Job Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Job Types</SelectItem>
            {JOB_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-gray-400">Loading active projects...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <HardHat className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No active projects</p>
          <p className="text-sm mt-1">Projects appear here once a customer approves, signs and pays.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to={`/estimator/projects/${p.id}`}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-primary hover:shadow-sm transition-all border-l-4 border-l-indigo-500 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                  <HardHat className="w-5 h-5 text-indigo-700" />
                </div>
                <div>
                  <div className="font-semibold text-secondary">{p.client_name}</div>
                  <div className="text-sm text-gray-500">{p.client_address || p.client_city || "No address"}</div>
                  {p.project_type && <div className="text-xs text-gray-400 mt-0.5">{p.project_type}</div>}
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
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                  In Progress
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