import { useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Search } from "lucide-react";

const STATUS_DOT = {
  walkthrough: "bg-yellow-400",
  draft: "bg-blue-400",
  pending_review: "bg-purple-400",
  approved: "bg-green-400",
  modify: "bg-orange-400",
  denied: "bg-red-400",
  in_progress: "bg-indigo-400",
  completed: "bg-gray-400",
  cancelled: "bg-gray-300",
  imported: "bg-teal-400",
};

const STATUS_LABEL = {
  walkthrough: "Walkthrough",
  draft: "Draft",
  pending_review: "Pending Review",
  approved: "Approved",
  modify: "Modify",
  denied: "Denied",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  imported: "Imported",
};

// Active statuses shown by default (not archived)
const ACTIVE_STATUSES = ["walkthrough", "draft", "pending_review", "approved", "modify", "in_progress"];

export default function SidebarProjectSearch({ onNavigate, brandColor }) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const params = useParams();

  const { data: projects = [] } = useQuery({
    queryKey: ["contractor-projects"],
    queryFn: () => base44.entities.ContractorProject.list("-updated_date", 300),
    staleTime: 30000,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter((p) => {
      const matchSearch = !q ||
        p.client_name?.toLowerCase().includes(q) ||
        p.client_city?.toLowerCase().includes(q) ||
        p.project_type?.toLowerCase().includes(q) ||
        p.client_address?.toLowerCase().includes(q);
      const matchStatus = showAll || search ? true : ACTIVE_STATUSES.includes(p.status);
      return matchSearch && matchStatus;
    }).slice(0, search ? 20 : 12);
  }, [projects, search, showAll]);

  const activeCount = projects.filter(p => ACTIVE_STATUSES.includes(p.status)).length;

  return (
    <div className="flex flex-col min-h-0">
      {/* Header */}
      <div className="px-3 pt-1 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Projects</span>
          <span className="text-xs text-white/40">{activeCount} active</span>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="w-full bg-white/10 text-white placeholder-white/30 text-xs rounded-lg pl-8 pr-3 py-2 border border-white/10 focus:outline-none focus:border-white/30 focus:bg-white/15"
          />
        </div>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
        {filtered.length === 0 && (
          <p className="text-xs text-white/30 text-center py-4">No projects found</p>
        )}
        {filtered.map((p) => {
          const isActive = window.location.pathname.includes(p.id);
          const value = p.adjusted_total || p.original_estimate_total;
          return (
            <Link
              key={p.id}
              to={`/estimator/projects/${p.id}`}
              onClick={onNavigate}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors group ${
                isActive ? "bg-white/20 text-white" : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[p.status] || "bg-gray-400"}`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate leading-tight">{p.client_name}</div>
                <div className="text-xs text-white/40 truncate leading-tight">
                  {p.project_type || p.client_city || "—"}
                </div>
              </div>
              {value > 0 && (
                <span className="text-xs text-white/40 shrink-0 group-hover:text-white/70 hidden xl:block">
                  ${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Show all / completed toggle */}
      {!search && (
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-xs text-white/30 hover:text-white/60 transition-colors w-full text-center py-1"
          >
            {showAll ? "Show active only" : `+ Show all ${projects.length} projects`}
          </button>
        </div>
      )}
    </div>
  );
}