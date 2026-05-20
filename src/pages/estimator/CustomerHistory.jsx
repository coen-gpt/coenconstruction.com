import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronDown, ChevronRight, ExternalLink, GitBranch, FileText, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

const STATUS_COLORS = {
  walkthrough: "bg-yellow-100 text-yellow-800",
  draft: "bg-blue-100 text-blue-800",
  pending_review: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  denied: "bg-red-100 text-red-800",
  modify: "bg-orange-100 text-orange-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  imported: "bg-teal-100 text-teal-800",
};

export default function CustomerHistory() {
  const [search, setSearch] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("search") || "";
  });
  const [expanded, setExpanded] = useState({});
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["all-contractor-projects"],
    queryFn: () => base44.entities.ContractorProject.list("-created_date", 500),
  });

  const { data: allEstimates = [] } = useQuery({
    queryKey: ["all-estimates"],
    queryFn: () => base44.entities.Estimate.list("-created_date", 500),
  });

  // Group projects by customer (normalize by name + address)
  const customers = useMemo(() => {
    const map = {};
    projects.forEach((p) => {
      const key = (p.client_name || "").trim().toLowerCase();
      if (!key) return;
      if (!map[key]) {
        map[key] = {
          name: p.client_name,
          email: p.client_email,
          phone: p.client_phone,
          projects: [],
        };
      }
      const estimatesForProject = allEstimates.filter((e) => e.project_id === p.id);
      map[key].projects.push({ ...p, estimates: estimatesForProject });
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, allEstimates]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        c.projects.some((p) => (p.client_address || "").toLowerCase().includes(q))
    );
  }, [customers, search]);

  // Auto-expand when coming in with a search pre-filled
  useEffect(() => {
    if (search && filtered.length === 1) {
      setExpanded({ [filtered[0].name]: true });
    }
  }, [filtered.length]);

  const toggleCustomer = (name) => {
    setExpanded((e) => ({ ...e, [name]: !e[name] }));
  };

  const startNewWalkthrough = (customer) => {
    const params = new URLSearchParams({
      lead_name: customer.name,
      lead_phone: customer.phone || "",
      lead_email: customer.email || "",
      lead_address: customer.projects[0]?.client_address || "",
      lead_city: customer.projects[0]?.client_city || "",
      lead_zipcode: customer.projects[0]?.client_zipcode || "",
    });
    navigate(`/estimator/walkthrough?${params.toString()}`);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-secondary">Customer History</h1>
        <p className="text-sm text-gray-500 mt-1">All past and current customers with their project & estimate history.</p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or address..."
          className="pl-9"
        />
      </div>

      {isLoading && (
        <div className="text-center py-12 text-gray-400 text-sm">Loading customers...</div>
      )}

      <div className="space-y-3">
        {filtered.map((customer) => (
          <div key={customer.name} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Customer Header */}
            <button
              onClick={() => toggleCustomer(customer.name)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {customer.name[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-secondary">{customer.name}</div>
                  <div className="text-xs text-gray-400">
                    {customer.projects.length} project{customer.projects.length !== 1 ? "s" : ""}
                    {customer.email ? ` · ${customer.email}` : ""}
                    {customer.phone ? ` · ${customer.phone}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={(e) => { e.stopPropagation(); startNewWalkthrough(customer); }}
                >
                  <FileText className="w-3 h-3" /> New Estimate
                </Button>
                {expanded[customer.name] ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {/* Project List */}
            {expanded[customer.name] && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {customer.projects.map((proj) => (
                  <div key={proj.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-secondary">
                            {proj.project_type || "Project"} — {proj.client_address || "No address"}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[proj.status] || "bg-gray-100 text-gray-600"}`}>
                            {proj.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {proj.created_date ? format(new Date(proj.created_date), "MMM d, yyyy") : "—"}
                          {proj.client_city ? ` · ${proj.client_city}` : ""}
                        </div>
                      </div>
                      <Link
                        to={`/estimator/projects/${proj.id}`}
                        className="shrink-0 text-primary hover:underline text-xs flex items-center gap-1"
                      >
                        Open <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>

                    {/* Estimates for this project */}
                    {proj.estimates?.length > 0 && (
                      <div className="space-y-1.5 ml-2">
                        {proj.estimates.map((est) => (
                          <div key={est.id} className="flex items-center justify-between bg-muted rounded-lg px-3 py-2 text-xs">
                            <div className="flex items-center gap-2">
                              {est.type === "change_order" && <GitBranch className="w-3 h-3 text-purple-500" />}
                              <span className="font-medium text-gray-700">
                                {est.title || (est.type === "change_order" ? `CO #${est.change_order_number}` : "Original Estimate")}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded-full font-semibold ${
                                est.status === "approved" ? "bg-green-100 text-green-700" :
                                est.status === "draft" ? "bg-blue-100 text-blue-700" :
                                "bg-yellow-100 text-yellow-700"
                              }`}>
                                {est.status}
                              </span>
                            </div>
                            <span className="font-semibold text-primary">
                              ${(est.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {proj.estimates?.length === 0 && (
                      <p className="text-xs text-gray-400 ml-2">No estimates yet</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="font-medium">No customers found.</p>
            {search && <p className="text-sm mt-1">Try a different search.</p>}
          </div>
        )}
      </div>
    </div>
  );
}