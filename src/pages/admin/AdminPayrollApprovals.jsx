import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, CheckCircle2, Clock, RefreshCw, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";

function safeDate(value) {
  if (!value) return "—";
  try {
    return format(parseISO(value), "MMM d, yyyy");
  } catch {
    return value;
  }
}

function statusBadge(status) {
  if (status === "approved") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Approved</Badge>;
  if (status === "approved_with_remarks") return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Approved with remarks</Badge>;
  return <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">Pending</Badge>;
}

function StatCard({ label, value, icon: Icon, tone }) {
  const colors = {
    pending: "border-red-200 bg-red-50 text-red-700",
    approved: "border-green-200 bg-green-50 text-green-700",
    remarks: "border-amber-200 bg-amber-50 text-amber-700",
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[tone]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="w-6 h-6 opacity-70" />
      </div>
    </div>
  );
}

export default function AdminPayrollApprovals() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadApprovals = async () => {
    setLoading(true);
    const data = await base44.entities.PayrollApproval.list("-week_start", 100);
    setApprovals(data);
    setLoading(false);
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const stats = useMemo(() => ({
    pending: approvals.filter((item) => item.status === "pending" || !item.status).length,
    approved: approvals.filter((item) => item.status === "approved").length,
    remarks: approvals.filter((item) => item.status === "approved_with_remarks").length,
  }), [approvals]);

  return (
    <div className="p-3 sm:p-4 lg:p-6 bg-gray-50 min-h-screen space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Payroll Approvals</h1>
            <p className="text-sm text-gray-500">Internal overview of weekly superintendent payroll approvals.</p>
          </div>
        </div>
        <Button onClick={loadApprovals} disabled={loading} variant="outline">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Pending" value={stats.pending} icon={AlertTriangle} tone="pending" />
        <StatCard label="Approved" value={stats.approved} icon={CheckCircle2} tone="approved" />
        <StatCard label="With Remarks" value={stats.remarks} icon={Clock} tone="remarks" />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Pay Week</th>
                <th className="px-4 py-3">Superintendent</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Approved At</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="px-4 py-3">Approval Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="6" className="px-4 py-10 text-center text-gray-500">Loading payroll approvals…</td></tr>
              ) : approvals.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-10 text-center text-gray-500">No payroll approvals found.</td></tr>
              ) : approvals.map((approval) => (
                <tr key={approval.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                    {safeDate(approval.week_start)} – {safeDate(approval.week_end)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{approval.superintendent_name || "—"}</div>
                    <div className="text-xs text-gray-500">{approval.superintendent_email}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{statusBadge(approval.status || "pending")}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{safeDate(approval.approved_at)}</td>
                  <td className="px-4 py-3 text-gray-600 min-w-[220px]">{approval.remarks || approval.employee_remarks?.[0]?.remark || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {approval.approval_token ? (
                      <a className="text-primary hover:underline font-medium" href={`/payroll-approval?id=${approval.id}&token=${approval.approval_token}`} target="_blank" rel="noreferrer">Open link</a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}