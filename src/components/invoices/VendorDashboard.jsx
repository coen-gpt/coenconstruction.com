import { useMemo } from "react";
import { TrendingUp, Package } from "lucide-react";

export default function VendorDashboard({ records }) {
  const vendors = useMemo(() => {
    const map = {};
    for (const r of records) {
      if (r.status === 'rejected') continue;
      const key = r.vendor_name || r.vendor_email || 'Unknown';
      if (!map[key]) map[key] = { name: key, email: r.vendor_email, count: 0, total: 0, paid: 0, pending: 0, invoiceNums: [] };
      map[key].count++;
      map[key].total += r.amount || 0;
      if (r.status === 'paid') map[key].paid += r.amount || 0;
      if (r.status === 'pending_review' || r.status === 'approved' || r.status === 'outstanding') map[key].pending += r.amount || 0;
      if (r.invoice_number) map[key].invoiceNums.push(r.invoice_number);
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [records]);

  const grandTotal = vendors.reduce((s, v) => s + v.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-gray-800">Vendor Spend Dashboard</h2>
        <span className="ml-auto text-xs text-gray-500 font-medium">Total: <span className="text-gray-900 font-bold">${grandTotal.toLocaleString()}</span></span>
      </div>

      {vendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-24 text-sm text-gray-400 gap-1 bg-white border border-gray-200 rounded-xl">
          <Package className="w-5 h-5" />
          <span>No vendor data yet</span>
        </div>
      ) : (
        <>
          {/* Mobile: card view */}
          <div className="sm:hidden space-y-2">
            {vendors.map((v) => {
              const pct = grandTotal > 0 ? (v.total / grandTotal) * 100 : 0;
              return (
                <div key={v.name} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">{v.name}</div>
                      {v.email && <div className="text-xs text-gray-400 truncate">{v.email}</div>}
                    </div>
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">{v.count} inv</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-400">Total</div>
                      <div className="font-bold text-gray-900 text-sm">${v.total.toLocaleString()}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2">
                      <div className="text-xs text-gray-400">Paid</div>
                      <div className="font-bold text-green-700 text-sm">{v.paid > 0 ? `$${v.paid.toLocaleString()}` : '—'}</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2">
                      <div className="text-xs text-gray-400">Owed</div>
                      <div className="font-bold text-orange-600 text-sm">{v.pending > 0 ? `$${v.pending.toLocaleString()}` : '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right shrink-0">{pct.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table view */}
          <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Vendor</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">Invoices</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">Total Spend</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">Paid</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">Outstanding</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v, i) => {
                  const pct = grandTotal > 0 ? (v.total / grandTotal) * 100 : 0;
                  return (
                    <tr key={v.name} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-sm">{v.name}</div>
                        {v.email && <div className="text-xs text-gray-400">{v.email}</div>}
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-medium text-gray-700">{v.count}</td>
                      <td className="px-3 py-3 text-right font-bold text-gray-900">${v.total.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right text-xs text-green-700 font-medium">{v.paid > 0 ? `$${v.paid.toLocaleString()}` : '—'}</td>
                      <td className="px-3 py-3 text-right text-xs text-orange-600 font-medium">{v.pending > 0 ? `$${v.pending.toLocaleString()}` : '—'}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}