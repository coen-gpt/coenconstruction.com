import usePageTitle from "@/hooks/usePageTitle";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertTriangle, Clock, Plus, X, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function PayrollApprovalPortal() {
  usePageTitle("Payroll Approval");
  const [loading, setLoading] = useState(true);
  const [approval, setApproval] = useState(null);
  const [timeEntries, setTimeEntries] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [remarks, setRemarks] = useState("");
  const [employeeRemarks, setEmployeeRemarks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const approvalId = params.get("id");

  useEffect(() => {
    if (!token || !approvalId) { setError("Invalid approval link."); setLoading(false); return; }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    // PayrollApproval is RLS-locked — load through the token-checked function,
    // which also filters the week's records server-side
    try {
      const res = await base44.functions.invoke("payrollApprovalPortal", { token, approval_id: approvalId, action: "get" });
      if (res.data?.error || !res.data?.approval) {
        setError(res.data?.error || "Approval record not found or link expired.");
        setLoading(false);
        return;
      }
      setApproval(res.data.approval);
      setTimeEntries(res.data.time_entries || []);
      setReceipts(res.data.receipts || []);
      setTasks(res.data.tasks || []);
    } catch (err) {
      setError(err?.response?.data?.error || "Approval record not found or link expired.");
    }
    setLoading(false);
  };

  const addEmployeeRemark = () => {
    setEmployeeRemarks(prev => [...prev, { user_name: "", user_email: "", remark: "", remark_type: "other" }]);
  };

  const updateRemark = (idx, field, value) => {
    setEmployeeRemarks(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const submit = async (status) => {
    setSaving(true);
    const validRemarks = employeeRemarks.filter(r => r.remark.trim());
    await base44.functions.invoke("payrollApprovalPortal", {
      token,
      approval_id: approvalId,
      action: "decide",
      status,
      remarks,
      employee_remarks: validRemarks,
    });
    setDone(true);
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-sm border border-gray-100">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h1 className="font-bold text-gray-800 text-lg mb-2">Link Error</h1>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    </div>
  );

  if (done || approval?.status === "approved" || approval?.status === "approved_with_remarks") return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-sm border border-gray-100">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h1 className="font-bold text-gray-800 text-xl mb-2">Payroll Approved</h1>
        <p className="text-gray-500 text-sm">Week of {format(parseISO(approval.week_start), "MMM d")} – {format(parseISO(approval.week_end), "MMM d, yyyy")}</p>
        {approval.remarks && <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-xl p-3">"{approval.remarks}"</p>}
        <p className="mt-4 text-xs text-gray-400">The payroll report has been submitted to the office team.</p>
      </div>
    </div>
  );

  // Group by employee
  const byEmployee = {};
  timeEntries.forEach(e => {
    const k = e.user_email || e.user_name;
    if (!byEmployee[k]) byEmployee[k] = { name: e.user_name, email: e.user_email, entries: [], receipts: [], tasks: [] };
    byEmployee[k].entries.push(e);
  });
  receipts.forEach(r => {
    const k = r.user_email;
    if (byEmployee[k]) byEmployee[k].receipts.push(r);
  });
  tasks.forEach(t => {
    const k = t.assigned_to_email;
    if (byEmployee[k]) byEmployee[k].tasks.push(t);
  });

  const deadline = new Date();
  deadline.setHours(12, 0, 0, 0);
  const isPastDeadline = new Date() > deadline;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-secondary rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center font-bold text-lg">C</div>
            <div>
              <div className="font-bold text-lg">Weekly Payroll Approval</div>
              <div className="text-white/60 text-sm">Coen Construction — Site Superintendent Review</div>
            </div>
          </div>
          <div className="mt-3 bg-white/10 rounded-xl p-3 text-sm">
            <strong>Pay Week:</strong> {format(parseISO(approval.week_start), "EEEE, MMM d")} – {format(parseISO(approval.week_end), "EEEE, MMM d, yyyy")}
          </div>
          {isPastDeadline ? (
            <div className="mt-2 bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-xs text-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> Approval deadline (12:00 PM) has passed. Please approve immediately.
            </div>
          ) : (
            <div className="mt-2 bg-green-500/20 border border-green-400/30 rounded-xl p-3 text-xs text-green-200 flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" /> Please review and approve by 12:00 PM today. Note any early departures or missing clock-ins.
            </div>
          )}
        </div>

        {/* Employee breakdown */}
        {Object.values(byEmployee).map(emp => {
          const totalMins = emp.entries.reduce((s, e) => s + (e.total_minutes || 0), 0);
          const totalExpenses = emp.receipts.reduce((s, r) => s + (r.amount || 0), 0);
          return (
            <div key={emp.email} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <span className="font-bold text-secondary">{emp.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{emp.email}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-bold text-primary">{Math.floor(totalMins / 60)}h {totalMins % 60}m</span>
                  {totalExpenses > 0 && <span className="text-gray-500">${totalExpenses.toLocaleString()} expenses</span>}
                </div>
              </div>
              <div className="p-5 space-y-4">
                {/* Time entries */}
                {emp.entries.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Hours Logged</div>
                    <div className="space-y-1.5">
                      {emp.entries.map(e => {
                        const breakMins = (e.breaks || []).reduce((s, b) => b.start && b.end ? s + Math.round((new Date(b.end) - new Date(b.start)) / 60000) : s, 0);
                        return (
                          <div key={e.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                            <div>
                              <span className="font-medium text-gray-700">{e.date}</span>
                              <span className="text-gray-400 ml-2">{e.project_name}</span>
                              {e.gps_clock_in?.lat && (
                                <a href={`https://maps.google.com/?q=${e.gps_clock_in.lat},${e.gps_clock_in.lng}`} target="_blank" rel="noreferrer" className="ml-2 text-blue-400 text-xs">📍 GPS</a>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-semibold text-secondary">{Math.floor((e.total_minutes || 0) / 60)}h {(e.total_minutes || 0) % 60}m</span>
                              {breakMins > 0 && <span className="text-xs text-gray-400 ml-1">({breakMins}m break)</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Expenses */}
                {emp.receipts.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Expenses / Reimbursements</div>
                    {emp.receipts.map(r => (
                      <div key={r.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2 mb-1.5">
                        <div>
                          <span className="font-medium text-gray-700">{r.vendor_name || "Receipt"}</span>
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded capitalize ${r.receipt_type === "reimbursement" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{r.receipt_type?.replace("_", " ")}</span>
                        </div>
                        <span className="font-semibold text-secondary">${(r.amount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Tasks */}
                {emp.tasks.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Completed Tasks</div>
                    {emp.tasks.map(t => (
                      <div key={t.id} className="text-sm text-gray-600 flex items-center gap-2 py-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> {t.title}
                        {t.project_name && <span className="text-xs text-gray-400">— {t.project_name}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Superintendent remarks */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-bold text-secondary">Superintendent Remarks</h3>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">General Remarks</label>
            <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any general notes for payroll..." className="resize-none text-sm" rows={3} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Employee-Specific Remarks</label>
              <button onClick={addEmployeeRemark} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Remark
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">Flag any crew member leaving early, not clocked in, or absent so payroll can adjust their hours accurately.</p>
            <div className="space-y-3">
              {employeeRemarks.map((r, idx) => (
                <div key={idx} className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-800">Employee Remark #{idx + 1}</span>
                    <button onClick={() => setEmployeeRemarks(prev => prev.filter((_, i) => i !== idx))}><X className="w-3.5 h-3.5 text-gray-400" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={r.user_name} onChange={e => updateRemark(idx, "user_name", e.target.value)} placeholder="Employee name" className="border border-amber-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
                    <Select value={r.remark_type} onValueChange={v => updateRemark(idx, "remark_type", v)}>
                      <SelectTrigger className="h-8 text-xs bg-white border-amber-200"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="leaving_early">Leaving Early</SelectItem>
                        <SelectItem value="not_clocked_in">Not Clocked In</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <textarea value={r.remark} onChange={e => updateRemark(idx, "remark", e.target.value)} placeholder="Describe the situation for payroll accuracy..." className="w-full border border-amber-200 rounded-lg px-3 py-1.5 text-sm bg-white resize-none" rows={2} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pb-8">
          <Button onClick={() => submit("approved")} disabled={saving} className="flex-1 h-14 bg-green-500 hover:bg-green-600 text-white font-bold text-base rounded-2xl gap-2">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            Approve Payroll
          </Button>
          <Button onClick={() => submit("approved_with_remarks")} disabled={saving || !remarks.trim() && !employeeRemarks.filter(r => r.remark.trim()).length} variant="outline" className="flex-1 h-14 font-bold text-base rounded-2xl gap-2 border-amber-300 text-amber-700 hover:bg-amber-50">
            <AlertTriangle className="w-5 h-5" />
            Approve with Remarks
          </Button>
        </div>
      </div>
    </div>
  );
}