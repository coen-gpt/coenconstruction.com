import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import adminEntities from "@/api/adminEntities";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Hammer, AlertTriangle } from "lucide-react";

function MetricCard({ label, value, sub, color = "text-secondary", icon: Icon }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-gray-300" />}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ProfitabilityPanel({ project, estimates = [] }) {
  const { data: receipts = [] } = useQuery({
    queryKey: ["field-receipts-project", project.id],
    queryFn: () => adminEntities.FieldReceipt.filter({ project_id: project.id }),
  });

  const { data: subPayables = [] } = useQuery({
    queryKey: ["sub-payables-project", project.id],
    queryFn: () => base44.entities.SubPayable.filter({ project_id: project.id }),
  });

  // Contract value
  const contractValue = project.adjusted_total || project.original_estimate_total || 0;

  // Estimate cost breakdown (labor + material + sub lines)
  const latestEstimate = estimates.find(e => e.status === "approved") || estimates[0];
  const lineItems = latestEstimate?.line_items || [];

  const estimatedMaterialCost = lineItems
    .filter(l => l.cost_type === "material")
    .reduce((s, l) => s + (l.unit_cost * l.quantity || 0), 0);

  const estimatedLaborCost = lineItems
    .filter(l => l.cost_type === "labor")
    .reduce((s, l) => s + (l.unit_cost * l.quantity || 0), 0);

  const estimatedSubCost = lineItems
    .filter(l => l.cost_type === "subcontractor")
    .reduce((s, l) => s + (l.unit_cost * l.quantity || 0), 0);

  const totalEstimatedCost = estimatedMaterialCost + estimatedLaborCost + estimatedSubCost;

  // Actual costs from field receipts
  const actualMaterialCost = receipts
    .filter(r => r.receipt_type === "job_expense" && r.status !== "denied")
    .reduce((s, r) => s + (r.amount || 0), 0);

  // Actual sub payable costs (paid or approved invoices)
  const actualSubCost = subPayables.reduce((s, sp) => {
    const paid = (sp.invoices || [])
      .filter(inv => inv.status === "paid" || inv.status === "approved")
      .reduce((si, inv) => si + (inv.amount || 0), 0);
    return s + paid;
  }, 0);

  const totalActualCost = actualMaterialCost + actualSubCost;

  // Profitability
  const estimatedProfit = contractValue - totalEstimatedCost;
  const estimatedMarginPct = contractValue > 0 ? (estimatedProfit / contractValue) * 100 : 0;

  const actualProfit = contractValue > 0 ? contractValue - totalActualCost : null;
  const actualMarginPct = contractValue > 0 && totalActualCost > 0
    ? ((contractValue - totalActualCost) / contractValue) * 100
    : null;

  // Budget burn: actual vs estimated
  const materialVariance = estimatedMaterialCost > 0
    ? actualMaterialCost - estimatedMaterialCost
    : null;

  const fmt = (n) => `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const pct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

  return (
    <div className="space-y-6">
      {/* Header metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Contract Value"
          value={contractValue > 0 ? fmt(contractValue) : "—"}
          sub="approved estimate"
          icon={DollarSign}
        />
        <MetricCard
          label="Est. Profit"
          value={contractValue > 0 ? fmt(estimatedProfit) : "—"}
          sub={contractValue > 0 ? `${estimatedMarginPct.toFixed(1)}% margin` : "no contract value"}
          color={estimatedMarginPct >= 15 ? "text-green-600" : estimatedMarginPct >= 0 ? "text-amber-600" : "text-red-600"}
          icon={estimatedMarginPct >= 0 ? TrendingUp : TrendingDown}
        />
        <MetricCard
          label="Actual Costs"
          value={totalActualCost > 0 ? fmt(totalActualCost) : "$0"}
          sub={`${receipts.length} receipts · ${subPayables.length} payables`}
          icon={ShoppingCart}
        />
        <MetricCard
          label="Real-Time Margin"
          value={actualMarginPct !== null ? `${actualMarginPct.toFixed(1)}%` : "—"}
          sub={actualMarginPct !== null ? (actualMarginPct < 15 ? "⚠ below target" : "on track") : "enter actual costs to see"}
          color={actualMarginPct === null ? "text-gray-400" : actualMarginPct >= 15 ? "text-green-600" : actualMarginPct >= 0 ? "text-amber-600" : "text-red-600"}
          icon={actualMarginPct !== null && actualMarginPct >= 0 ? TrendingUp : TrendingDown}
        />
      </div>

      {/* Cost breakdown table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <h3 className="font-semibold text-secondary text-sm">Cost Breakdown</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-2.5 text-xs text-gray-400 font-semibold uppercase">Category</th>
              <th className="text-right px-5 py-2.5 text-xs text-gray-400 font-semibold uppercase">Estimated</th>
              <th className="text-right px-5 py-2.5 text-xs text-gray-400 font-semibold uppercase">Actual</th>
              <th className="text-right px-5 py-2.5 text-xs text-gray-400 font-semibold uppercase">Variance</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                label: "Materials",
                icon: ShoppingCart,
                estimated: estimatedMaterialCost,
                actual: actualMaterialCost,
              },
              {
                label: "Labor",
                icon: Hammer,
                estimated: estimatedLaborCost,
                actual: null, // time entries tracked separately
              },
              {
                label: "Subcontractors",
                icon: Hammer,
                estimated: estimatedSubCost,
                actual: actualSubCost,
              },
            ].map(row => {
              const variance = row.actual !== null && row.estimated > 0 ? row.actual - row.estimated : null;
              return (
                <tr key={row.label} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-medium text-secondary flex items-center gap-2">
                    <row.icon className="w-3.5 h-3.5 text-gray-400" />
                    {row.label}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">
                    {row.estimated > 0 ? fmt(row.estimated) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {row.actual !== null
                      ? <span className={row.actual > 0 ? "text-secondary font-medium" : "text-gray-300"}>{row.actual > 0 ? fmt(row.actual) : "—"}</span>
                      : <span className="text-gray-300 text-xs italic">via time entries</span>
                    }
                  </td>
                  <td className="px-5 py-3 text-right">
                    {variance !== null && row.actual > 0 ? (
                      <span className={`font-semibold ${variance > 0 ? "text-red-500" : "text-green-600"}`}>
                        {variance > 0 ? "+" : ""}{fmt(variance)}
                        {variance > 0 && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              );
            })}
            {/* Totals row */}
            <tr className="bg-gray-50 font-semibold">
              <td className="px-5 py-3 text-secondary">Total</td>
              <td className="px-5 py-3 text-right text-secondary">{totalEstimatedCost > 0 ? fmt(totalEstimatedCost) : "—"}</td>
              <td className="px-5 py-3 text-right text-secondary">{totalActualCost > 0 ? fmt(totalActualCost) : "—"}</td>
              <td className="px-5 py-3 text-right">
                {totalActualCost > 0 && totalEstimatedCost > 0 ? (
                  <span className={`${totalActualCost > totalEstimatedCost ? "text-red-500" : "text-green-600"}`}>
                    {totalActualCost > totalEstimatedCost ? "+" : ""}{fmt(totalActualCost - totalEstimatedCost)}
                  </span>
                ) : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Recent receipts */}
      {receipts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="font-semibold text-secondary text-sm">Recent Field Receipts</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {receipts.slice(0, 8).map(r => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-secondary">{r.vendor_name || "Unnamed vendor"}</div>
                  <div className="text-xs text-gray-400">{r.receipt_date} · {r.status}</div>
                </div>
                <div className={`font-semibold text-sm ${r.status === "denied" ? "text-gray-300 line-through" : "text-secondary"}`}>
                  ${(r.amount || 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}