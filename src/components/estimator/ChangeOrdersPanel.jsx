import { FileText, TrendingUp } from "lucide-react";

export default function ChangeOrdersPanel({ estimates = [], project }) {
  const originals = estimates.filter(e => e.type === "original");
  const changeOrders = estimates.filter(e => e.type === "change_order");
  const allowances = estimates.flatMap(e => (e.line_items || []).filter(i => i.is_allowance || i.cost_type === "allowance").map(i => ({ ...i, estimate_title: e.title })));
  const approvedCO = changeOrders.filter(e => e.status === "approved").reduce((s, e) => s + (e.grand_total || 0), 0);
  const pendingCO = changeOrders.filter(e => !["approved", "rejected", "superseded"].includes(e.status)).reduce((s, e) => s + (e.grand_total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5"><p className="text-xs text-gray-400 uppercase font-bold">Original Contract</p><p className="text-2xl font-bold text-secondary">${(project.original_estimate_total || originals[0]?.grand_total || 0).toLocaleString()}</p></div>
        <div className="bg-white border border-green-100 rounded-xl p-5"><p className="text-xs text-green-600 uppercase font-bold">Approved Changes</p><p className="text-2xl font-bold text-green-700">${approvedCO.toLocaleString()}</p></div>
        <div className="bg-white border border-yellow-100 rounded-xl p-5"><p className="text-xs text-yellow-600 uppercase font-bold">Pending Changes</p><p className="text-2xl font-bold text-yellow-700">${pendingCO.toLocaleString()}</p></div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-secondary flex items-center gap-2 mb-4"><FileText className="w-5 h-5 text-primary" /> Change Orders</h2>
        {changeOrders.length === 0 ? <p className="text-sm text-gray-400">No change orders yet. Create one from the Estimate tab using “Change Order”.</p> : (
          <div className="divide-y divide-gray-100">
            {changeOrders.map(co => (
              <div key={co.id} className="py-3 flex items-center justify-between gap-4">
                <div><p className="font-semibold text-secondary">{co.title || `Change Order #${co.change_order_number || ""}`}</p><p className="text-xs text-gray-500">{co.scope_change_description || "No scope description"}</p></div>
                <div className="text-right"><p className="font-bold">${(co.grand_total || 0).toLocaleString()}</p><span className="text-xs bg-gray-100 rounded px-2 py-0.5 capitalize">{co.status}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-secondary flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-primary" /> Allowances</h2>
        {allowances.length === 0 ? <p className="text-sm text-gray-400">No allowance line items are currently tracked.</p> : (
          <div className="divide-y divide-gray-100">
            {allowances.map((a, idx) => {
              const variance = (a.actual_cost || 0) - (a.total || 0);
              return <div key={`${a.id}-${idx}`} className="py-3 grid md:grid-cols-4 gap-2 text-sm"><span className="font-medium text-secondary">{a.title}</span><span>{a.estimate_title}</span><span>Allowance: ${(a.total || 0).toLocaleString()}</span><span className={variance > 0 ? "text-red-600" : "text-green-600"}>Variance: ${variance.toLocaleString()}</span></div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
