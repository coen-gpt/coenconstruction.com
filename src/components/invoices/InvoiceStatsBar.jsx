import { differenceInDays, parseISO } from "date-fns";
import { FileText, Clock, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";

function StaleTooltip() {
  return (
    <span className="relative group cursor-help">
      <span className="underline decoration-dotted">Stale (&gt;30d)</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 bg-gray-800 text-white text-xs rounded px-2 py-1.5 hidden group-hover:block z-20 leading-snug shadow-lg pointer-events-none">
        Unpaid invoices received more than 30 days ago
      </span>
    </span>
  );
}

export default function InvoiceStatsBar({ records }) {
  const total = records.length;
  const paid = records.filter(r => r.status === 'paid').length;
  const outstanding = records.filter(r => r.status === 'outstanding').length;
  const pending = records.filter(r => r.status === 'pending_review').length;
  const overdue30 = records.filter(r => {
    if (r.status === 'paid' || r.status === 'rejected') return false;
    if (!r.email_received_date) return false;
    return differenceInDays(new Date(), parseISO(r.email_received_date)) > 30;
  }).length;

  const totalAmount = records
    .filter(r => r.amount && r.status !== 'rejected')
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const paidAmount = records
    .filter(r => r.amount && r.status === 'paid')
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const outstandingAmount = records
    .filter(r => r.amount && (r.status === 'outstanding' || r.status === 'approved'))
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const paidPct = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
  const outstandingPct = totalAmount > 0 ? Math.round((outstandingAmount / totalAmount) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* 4 count cards + total value — horizontal scroll on small screens */}
      <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible">
        <div className="bg-white border border-gray-200 rounded-lg p-2 sm:p-3 text-center shrink-0 min-w-[90px] sm:min-w-0">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <FileText className="w-3 h-3 text-gray-500" />
            <div className="text-xl font-bold text-gray-900">{total}</div>
          </div>
          <div className="text-xs text-gray-500 leading-tight">Total Records</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-2 sm:p-3 text-center shrink-0 min-w-[90px] sm:min-w-0">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Clock className="w-3 h-3 text-yellow-600" />
            <div className="text-xl font-bold text-yellow-700">{pending}</div>
          </div>
          <div className="text-xs text-gray-500 leading-tight">Pending Review</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-2 sm:p-3 text-center shrink-0 min-w-[90px] sm:min-w-0">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingUp className="w-3 h-3 text-orange-500" />
            <div className="text-xl font-bold text-orange-600">{outstanding}</div>
          </div>
          <div className="text-xs text-gray-500 leading-tight">Outstanding</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-2 sm:p-3 text-center shrink-0 min-w-[90px] sm:min-w-0">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <CheckCircle className="w-3 h-3 text-green-600" />
            <div className="text-xl font-bold text-green-600">{paid}</div>
          </div>
          <div className="text-xs text-gray-500 leading-tight">Paid</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-2 sm:p-3 text-center shrink-0 min-w-[100px] sm:min-w-0">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <AlertTriangle className="w-3 h-3 text-red-500" />
            <div className="text-xl font-bold text-red-600">{overdue30}</div>
          </div>
          <div className="text-xs text-gray-500 leading-tight"><StaleTooltip /></div>
        </div>
      </div>

      {/* Total value full-width card */}
      <div className="bg-white border border-gray-200 rounded-lg p-2 sm:p-3 flex items-center justify-between gap-2">
        <div className="text-xs text-gray-500 leading-tight">Total Value (excl. rejected)</div>
        <div className="text-lg sm:text-xl font-bold text-gray-900 tabular-nums">
          ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      {/* Payment pipeline bar */}
      {totalAmount > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Pipeline</span>
            <span className="text-xs text-gray-400">${totalAmount.toLocaleString()} total</span>
          </div>
          <div className="flex rounded-full overflow-hidden h-2.5 bg-gray-100">
            <div className="bg-green-500 h-full transition-all" style={{ width: `${paidPct}%` }} title={`Paid: $${paidAmount.toLocaleString()}`} />
            <div className="bg-orange-400 h-full transition-all" style={{ width: `${outstandingPct}%` }} title={`Outstanding: $${outstandingAmount.toLocaleString()}`} />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-green-700">
              <CheckCircle className="w-3 h-3 shrink-0" /> Paid ${paidAmount.toLocaleString()} ({paidPct}%)
            </span>
            <span className="flex items-center gap-1 text-xs text-orange-600">
              <TrendingUp className="w-3 h-3 shrink-0" /> Outstanding ${outstandingAmount.toLocaleString()} ({outstandingPct}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}