import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { AlertTriangle, TrendingUp, Loader2 } from "lucide-react";

// Compares actual clocked labor hours against estimated labor line items per project
export default function LaborBudgetAlert() {
  const { data: projects = [], isLoading: loadingP } = useQuery({
    queryKey: ["projects-in-progress-labor"],
    queryFn: () => adminEntities.ContractorProject.filter({ status: "in_progress" }),
  });
  const { data: estimates = [], isLoading: loadingE } = useQuery({
    queryKey: ["all-estimates-labor"],
    queryFn: () => base44.entities.Estimate.filter({ status: "approved" }),
  });
  const { data: timeEntries = [], isLoading: loadingT } = useQuery({
    queryKey: ["time-entries-labor"],
    // TimeEntry goes through the admin proxy — backend staff aren't Base44 users
    queryFn: () => adminEntities.TimeEntry.filter({ status: "clocked_out" }),
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["company-profile-threshold"],
    queryFn: () => base44.entities.CompanyProfile.list(),
  });

  const threshold = profiles[0]?.profitability_threshold_pct || 15;
  const ALERT_PCT = 80; // warn at 80% labor budget consumed
  const OVER_PCT = 100;

  if (loadingP || loadingE || loadingT) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  // Build project labor budget map from approved estimates
  const laborBudget = {}; // project_id -> { budgetHours, budgetCost }
  for (const est of estimates) {
    const laborItems = (est.line_items || []).filter(i => i.cost_type === "labor");
    const budgetHours = laborItems.reduce((s, i) => {
      // Estimate hours from total/unit_cost if unit is "hours", else fallback to quantity
      if ((i.unit || "").toLowerCase().includes("hour") || (i.unit || "").toLowerCase() === "hr") {
        return s + (i.quantity || 0);
      }
      // Rough estimate: if unit_cost > 0, derive from total
      if (i.unit_cost > 0 && i.total) return s + (i.total / i.unit_cost);
      return s + (i.quantity || 0);
    }, 0);
    const budgetCost = laborItems.reduce((s, i) => s + (i.total || 0), 0);
    if (!laborBudget[est.project_id]) laborBudget[est.project_id] = { budgetHours: 0, budgetCost: 0 };
    laborBudget[est.project_id].budgetHours += budgetHours;
    laborBudget[est.project_id].budgetCost += budgetCost;
  }

  // Build actual hours per project from time entries
  const actualHours = {};
  for (const entry of timeEntries) {
    if (!entry.project_id) continue;
    if (!actualHours[entry.project_id]) actualHours[entry.project_id] = 0;
    actualHours[entry.project_id] += (entry.total_minutes || 0) / 60;
  }

  // Build rows for all in-progress projects
  const rows = projects.map(proj => {
    const budget = laborBudget[proj.id] || { budgetHours: 0, budgetCost: 0 };
    const actual = actualHours[proj.id] || 0;
    const pct = budget.budgetHours > 0 ? (actual / budget.budgetHours) * 100 : null;
    const status = pct === null ? "no_budget" : pct >= OVER_PCT ? "over" : pct >= ALERT_PCT ? "warning" : "ok";
    return { proj, budget, actual, pct, status };
  }).sort((a, b) => {
    const order = { over: 0, warning: 1, ok: 2, no_budget: 3 };
    return order[a.status] - order[b.status];
  });

  const overCount = rows.filter(r => r.status === "over").length;
  const warnCount = rows.filter(r => r.status === "warning").length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-bold text-secondary text-lg">Labor Hours vs Budget</h2>
        <p className="text-gray-500 text-sm">Compares actual field crew hours against approved estimate labor line items per project.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`rounded-xl p-4 border ${overCount > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
          <div className="text-xs font-bold text-gray-400 uppercase mb-1">Over Budget</div>
          <div className={`text-2xl font-bold ${overCount > 0 ? "text-red-600" : "text-gray-400"}`}>{overCount}</div>
        </div>
        <div className={`rounded-xl p-4 border ${warnCount > 0 ? "bg-yellow-50 border-yellow-200" : "bg-white border-gray-200"}`}>
          <div className="text-xs font-bold text-gray-400 uppercase mb-1">Warning ≥80%</div>
          <div className={`text-2xl font-bold ${warnCount > 0 ? "text-yellow-600" : "text-gray-400"}`}>{warnCount}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-bold text-gray-400 uppercase mb-1">On Track</div>
          <div className="text-2xl font-bold text-green-600">{rows.filter(r => r.status === "ok").length}</div>
        </div>
      </div>

      {/* Project rows */}
      <div className="space-y-3">
        {rows.map(({ proj, budget, actual, pct, status }) => {
          const barColor = status === "over" ? "bg-red-500" : status === "warning" ? "bg-yellow-400" : "bg-green-500";
          const badgeCls = status === "over" ? "bg-red-100 text-red-700" : status === "warning" ? "bg-yellow-100 text-yellow-700" : status === "ok" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500";
          const badgeLabel = status === "over" ? "⚠️ Over Budget" : status === "warning" ? "⚡ Warning" : status === "ok" ? "✓ On Track" : "No Budget";

          return (
            <div key={proj.id} className={`bg-white border rounded-xl p-4 ${status === "over" ? "border-red-300" : status === "warning" ? "border-yellow-300" : "border-gray-200"}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-secondary truncate">{proj.client_name}</div>
                  <div className="text-xs text-gray-400 truncate">{proj.client_address}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${badgeCls}`}>{badgeLabel}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3 text-center">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Budgeted</div>
                  <div className="font-bold text-secondary">{budget.budgetHours > 0 ? `${budget.budgetHours.toFixed(0)}h` : "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Actual</div>
                  <div className={`font-bold ${status === "over" ? "text-red-600" : "text-secondary"}`}>{actual.toFixed(1)}h</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Used</div>
                  <div className={`font-bold ${status === "over" ? "text-red-600" : status === "warning" ? "text-yellow-600" : "text-green-600"}`}>
                    {pct !== null ? `${pct.toFixed(0)}%` : "—"}
                  </div>
                </div>
              </div>

              {pct !== null && (
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              )}

              {status === "over" && (
                <div className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {(actual - budget.budgetHours).toFixed(1)}h over budget — review with PM
                </div>
              )}
            </div>
          );
        })}
        {!rows.length && (
          <div className="py-12 text-center text-gray-400">
            <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p>No active projects found</p>
          </div>
        )}
      </div>
    </div>
  );
}