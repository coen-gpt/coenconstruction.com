import { useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, ChevronDown, ChevronUp, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import GateStatusBadges from "@/components/invoices/GateStatusBadges";

export default function ReadyForPaymentPanel({ invoices, loading }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
          <CreditCard className="w-4 h-4 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-secondary text-sm">Ready for Payment</h2>
            {invoices.length > 0 && (
              <span className="text-xs font-bold bg-green-600 text-white rounded-full px-2 py-0.5">{invoices.length}</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Invoices that have cleared all gates and are payable</p>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {!collapsed && (
        <div className="divide-y divide-gray-100 max-h-[360px] overflow-y-auto">
          {loading && <div className="py-6 text-center text-sm text-gray-400 animate-pulse">Loading…</div>}
          {!loading && invoices.length === 0 && (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-400">No invoices cleared all gates yet</p>
            </div>
          )}
          {!loading && invoices.map(inv => (
            <div key={inv.id} className="px-4 py-3 hover:bg-gray-50">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-secondary">{inv.vendor_name || "Unknown Vendor"}</div>
                  <div className="text-xs text-gray-500">
                    {inv.invoice_number ? `#${inv.invoice_number}` : "No invoice #"}
                    {inv.amount ? ` · $${Number(inv.amount).toLocaleString()}` : ""}
                    {inv.payment_stage ? ` · ${inv.payment_stage}` : ""}
                  </div>
                  {inv.scheduled_payment_date && (
                    <div className="text-xs text-green-600 font-medium mt-0.5">
                      Pay date: {format(new Date(inv.scheduled_payment_date), "EEE, MMM d")}
                    </div>
                  )}
                  <div className="mt-1.5">
                    <GateStatusBadges invoice={inv} vendor={null} />
                  </div>
                </div>
                <Link to="/estimator/payment-gating" className="shrink-0 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                  Review <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}