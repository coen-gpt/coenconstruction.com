import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Plus, Search, Briefcase, ChevronRight, CheckSquare, Square, X, RefreshCw, Tag, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";

const STATUS_COLORS = {
  walkthrough: "bg-yellow-100 text-yellow-800",
  draft: "bg-blue-100 text-blue-800",
  sent: "bg-sky-100 text-sky-800",
  pending_review: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  denied: "bg-red-100 text-red-800",
  modify: "bg-orange-100 text-orange-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  on_hold: "bg-amber-100 text-amber-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  imported: "bg-teal-100 text-teal-800",
};

const ALL_STATUSES = [
  { value: "walkthrough", label: "Walkthrough" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Quote Sent" },
  { value: "pending_review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "modify", label: "Modify" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "imported", label: "Imported" },
];

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
  { value: "oldest", label: "Oldest First" },
  { value: "newest", label: "Newest First" },
  { value: "client_az", label: "Client A–Z" },
  { value: "client_za", label: "Client Z–A" },
  { value: "value_high", label: "Value: High→Low" },
  { value: "value_low", label: "Value: Low→High" },
];

export default function ProjectList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("oldest");
  const [selected, setSelected] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("");

  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["contractor-projects"],
    queryFn: () => base44.entities.ContractorProject.list("created_date", 200),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, status }) => {
      await Promise.all(ids.map(id => base44.entities.ContractorProject.update(id, { status })));
    },
    onSuccess: (_, { ids, status }) => {
      queryClient.invalidateQueries({ queryKey: ["contractor-projects"] });
      toast.success(`Updated ${ids.length} project${ids.length !== 1 ? "s" : ""} to "${status.replace(/_/g, " ")}"`);
      setSelected(new Set());
      setBulkStatus("");
    },
  });

  const filtered = projects
    .filter((p) => {
      const matchSearch =
        !search ||
        p.client_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.client_address?.toLowerCase().includes(search.toLowerCase()) ||
        p.project_type?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchJobType = jobTypeFilter === "all" || p.project_type === jobTypeFilter;
      return matchSearch && matchStatus && matchJobType;
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

  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(p => p.id)));
    }
  };

  const toggleOne = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkStatusUpdate = () => {
    if (!bulkStatus || selected.size === 0) return;
    bulkUpdateMutation.mutate({ ids: [...selected], status: bulkStatus });
  };

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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {ALL_STATUSES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Job Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Job Types</SelectItem>
            {JOB_TYPES.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-44">
            <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="flex flex-wrap items-center gap-3 mb-4 bg-secondary text-white px-4 py-3 rounded-xl shadow-sm">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <div className="flex-1 flex items-center gap-2 flex-wrap">
            <Tag className="w-4 h-4 opacity-70" />
            <span className="text-xs opacity-70">Set status:</span>
            <select
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value)}
              className="text-xs rounded-lg px-2 py-1.5 bg-white/15 border border-white/20 text-white placeholder-white/50 focus:outline-none"
            >
              <option value="">— pick status —</option>
              {ALL_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!bulkStatus || bulkUpdateMutation.isPending}
              onClick={handleBulkStatusUpdate}
              className="bg-white text-secondary hover:bg-white/90 text-xs h-7 px-3"
            >
              {bulkUpdateMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Apply"}
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

      {isLoading ? (
        <div className="text-center py-20 text-gray-400">Loading projects...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No projects found</p>
          <p className="text-sm mt-1">Start a new walkthrough to create your first project.</p>
        </div>
      ) : (
        <>
          {/* Select all row */}
          <div className="flex items-center gap-3 px-5 py-2 mb-1">
            <button onClick={toggleAll} className="shrink-0 text-gray-400 hover:text-primary transition-colors">
              {allSelected
                ? <CheckSquare className="w-4 h-4 text-primary" />
                : <Square className="w-4 h-4" />}
            </button>
            <span className="text-xs text-gray-400 font-medium">
              {allSelected ? "Deselect all" : `Select all ${filtered.length}`}
            </span>
          </div>

          <div className="space-y-2">
            {filtered.map((p) => {
              const isSelected = selected.has(p.id);
              return (
                <div key={p.id} className="relative flex items-center group">
                  {/* Checkbox */}
                  <button
                    onClick={(e) => toggleOne(p.id, e)}
                    className="absolute left-3 z-10 text-gray-300 hover:text-primary transition-colors"
                  >
                    {isSelected
                      ? <CheckSquare className="w-4 h-4 text-primary" />
                      : <Square className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </button>

                  <Link
                    to={`/estimator/projects/${p.id}`}
                    className={`flex-1 flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 pl-10 hover:border-primary hover:shadow-sm transition-all border-l-4 ${
                      isSelected ? "border-l-primary bg-primary/3" : "border-l-transparent hover:border-l-primary"
                    }`}
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
                        {p.status?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary" />
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}