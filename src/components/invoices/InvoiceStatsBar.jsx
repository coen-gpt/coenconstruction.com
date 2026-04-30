import { differenceInDays, parseISO } from "date-fns";

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

  const countStats = [
    { label: "Total Records", value: total, color: "text-gray-900" },
    { label: "Pending Review", value: pending, color: "text-yellow-700" },
    { label: "Outstanding", value: outstanding, color: "text-orange-600" },
    { label: "Paid", value: paid, color: "text-green-600" },
    { label: "Past 30 Days Old", value: overdue30, color: "text-red-600" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Count stats */}
        {countStats.map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-2 sm:p-3 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5 leading-tight">{s.label}</div>
          </div>
        ))}
        {/* Total Value — spans full width on its own row so amount never overflows */}
        <div className="col-span-3 bg-white border border-gray-200 rounded-lg p-2 sm:p-3 flex items-center justify-between gap-2 sm:block sm:text-center">
          <div className="text-xs text-gray-500 sm:mb-0.5 leading-tight">Total Value</div>
          <div className="text-lg sm:text-xl font-bold text-gray-900 break-all leading-tight">
            ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
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
            <span className="flex items-center gap-1 text-xs text-green-700"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Paid ${paidAmount.toLocaleString()} ({paidPct}%)</span>
            <span className="flex items-center gap-1 text-xs text-orange-600"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Outstanding ${outstandingAmount.toLocaleString()} ({outstandingPct}%)</span>
          </div>
        </div>
      )}
    </div>
  );
}