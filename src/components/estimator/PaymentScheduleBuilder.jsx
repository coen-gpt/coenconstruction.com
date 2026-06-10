import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus, Trash2, Save, CheckCircle2, Clock, DollarSign, AlertCircle,
  CreditCard, Camera, HardHat, Lock, Unlock, ChevronDown, ChevronUp, Shield
} from "lucide-react";

const TRIGGER_TYPES = [
  { value: "upfront", label: "Upfront / At Signing" },
  { value: "phase_completion", label: "Phase Completion" },
  { value: "date", label: "Specific Date" },
  { value: "manually_triggered", label: "Manually Triggered" },
];

const STATUS_CONFIG = {
  upcoming:          { label: "Upcoming",           color: "bg-gray-100 text-gray-600",    icon: Clock },
  gate_pending:      { label: "Gate: Awaiting Work", color: "bg-yellow-100 text-yellow-700", icon: HardHat },
  pm_review:         { label: "PM Review Needed",   color: "bg-orange-100 text-orange-700", icon: AlertCircle },
  ready_to_invoice:  { label: "Ready to Invoice",   color: "bg-blue-100 text-blue-700",     icon: CreditCard },
  invoiced:          { label: "Invoiced",           color: "bg-purple-100 text-purple-700", icon: DollarSign },
  paid:              { label: "Paid",               color: "bg-green-100 text-green-700",   icon: CheckCircle2 },
  overdue:           { label: "Overdue",            color: "bg-red-100 text-red-700",       icon: AlertCircle },
};

function newMilestone(order) {
  return {
    id: crypto.randomUUID(),
    label: "",
    trigger_type: "phase_completion",
    trigger_phase: "",
    amount_type: "percentage",
    amount_value: 0,
    amount_calculated: 0,
    requires_field_photo: true,
    requires_pm_approval: true,
    requires_sub_signoff: false,
    required_sub_trades: [],
    status: "upcoming",
    sub_signoffs: [],
    is_substantially_completed: false,
  };
}

const DEFAULT_MILESTONES = [
  { label: "1st Deposit", trigger_type: "upfront", amount_type: "percentage", amount_value: 33, requires_field_photo: false, requires_pm_approval: false, requires_sub_signoff: false },
  { label: "2nd Progress Payment", trigger_type: "phase_completion", amount_type: "percentage", amount_value: 33, requires_field_photo: true, requires_pm_approval: true, requires_sub_signoff: false },
  { label: "Substantially Completed", trigger_type: "phase_completion", amount_type: "percentage", amount_value: 28, requires_field_photo: true, requires_pm_approval: true, requires_sub_signoff: false, is_substantially_completed: true },
  { label: "Final Payment", trigger_type: "manually_triggered", amount_type: "percentage", amount_value: 6, requires_field_photo: false, requires_pm_approval: false, requires_sub_signoff: false },
];

export default function PaymentScheduleBuilder({ project, estimate }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [milestones, setMilestones] = useState([]);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [scheduleId, setScheduleId] = useState(null);
  const [adminApproved, setAdminApproved] = useState(false);
  const [adminApprovedBy, setAdminApprovedBy] = useState(null);
  const [expandedMilestone, setExpandedMilestone] = useState(null);

  const grandTotal = estimate?.grand_total || project?.adjusted_total || project?.original_estimate_total || 0;

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["payment-schedule", project.id],
    queryFn: () => base44.entities.PaymentSchedule.filter({ project_id: project.id }),
  });

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const canApprove = ["admin", "project_manager", "operations_manager"].includes(user?.role);

  useEffect(() => {
    const existing = schedules[0];
    if (existing) {
      setScheduleId(existing.id);
      setAdminApproved(existing.admin_approved || false);
      setAdminApprovedBy(existing.admin_approved_by || null);
      const mils = (existing.milestones || []).map(m => ({
        ...m,
        amount_calculated: computeAmount(m, grandTotal),
      }));
      setMilestones(mils);
    } else if (schedules.length === 0 && !isLoading) {
      // Load defaults
      const defaults = DEFAULT_MILESTONES.map((m, i) => ({
        ...newMilestone(i),
        ...m,
        amount_calculated: computeAmount(m, grandTotal),
      }));
      setMilestones(defaults);
    }
   
  }, [schedules, isLoading]);

  function computeAmount(m, total) {
    if (m.amount_type === "fixed") return m.amount_value || 0;
    return Math.round(((m.amount_value || 0) / 100) * total * 100) / 100;
  }

  const updateMilestone = (id, field, val) => {
    setMilestones(prev => prev.map(m => {
      if (m.id !== id) return m;
      const updated = { ...m, [field]: val };
      updated.amount_calculated = computeAmount(updated, grandTotal);
      return updated;
    }));
  };

  const totalScheduled = milestones.reduce((s, m) => s + (m.amount_calculated || 0), 0);
  const totalPct = milestones.filter(m => m.amount_type === "percentage").reduce((s, m) => s + (m.amount_value || 0), 0);
  const isBalanced = Math.abs(totalScheduled - grandTotal) < 1;

  const save = async (andApprove = false) => {
    setSaving(true);
    const payload = {
      project_id: project.id,
      estimate_id: estimate?.id,
      total_amount: grandTotal,
      milestones: milestones.map(m => ({ ...m, amount_calculated: computeAmount(m, grandTotal) })),
      status: andApprove ? "active" : "draft",
      admin_approved: andApprove ? true : adminApproved,
      admin_approved_by: andApprove ? user?.email : adminApprovedBy,
      admin_approved_at: andApprove ? new Date().toISOString() : undefined,
    };
    try {
      if (scheduleId) {
        await base44.entities.PaymentSchedule.update(scheduleId, payload);
      } else {
        const created = await base44.entities.PaymentSchedule.create(payload);
        setScheduleId(created.id);
      }
      if (andApprove) {
        setAdminApproved(true);
        setAdminApprovedBy(user?.email);
      }
      qc.invalidateQueries({ queryKey: ["payment-schedule", project.id] });
      toast({ title: andApprove ? "✓ Schedule approved & activated!" : "Schedule saved" });
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
    setSaving(false);
    setApproving(false);
  };

  const addMilestone = () => {
    setMilestones(prev => [...prev, newMilestone(prev.length)]);
  };

  const removeMilestone = (id) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
  };

  const approveMilestone = async (milestoneId) => {
    const updated = milestones.map(m => {
      if (m.id !== milestoneId) return m;
      return {
        ...m,
        status: "ready_to_invoice",
        pm_approved_by: user?.email,
        pm_approved_at: new Date().toISOString(),
      };
    });
    setMilestones(updated);
    toast({ title: "Milestone approved — ready to invoice!" });
    // Auto-save
    const payload = {
      project_id: project.id,
      estimate_id: estimate?.id,
      total_amount: grandTotal,
      milestones: updated,
      admin_approved: adminApproved,
    };
    if (scheduleId) await base44.entities.PaymentSchedule.update(scheduleId, payload);
    qc.invalidateQueries({ queryKey: ["payment-schedule", project.id] });
  };

  const markInvoiced = async (milestoneId) => {
    const updated = milestones.map(m => m.id === milestoneId ? { ...m, status: "invoiced", invoice_sent_at: new Date().toISOString() } : m);
    setMilestones(updated);
    const payload = { project_id: project.id, milestones: updated };
    if (scheduleId) await base44.entities.PaymentSchedule.update(scheduleId, payload);
    qc.invalidateQueries({ queryKey: ["payment-schedule", project.id] });
    toast({ title: "Marked as invoiced" });
  };

  const markPaid = async (milestoneId) => {
    const updated = milestones.map(m => m.id === milestoneId ? { ...m, status: "paid", paid_at: new Date().toISOString() } : m);
    setMilestones(updated);
    const payload = { project_id: project.id, milestones: updated };
    if (scheduleId) await base44.entities.PaymentSchedule.update(scheduleId, payload);
    qc.invalidateQueries({ queryKey: ["payment-schedule", project.id] });
    toast({ title: "✓ Payment marked as received!" });
  };

  const totalPaid = milestones.filter(m => m.status === "paid").reduce((s, m) => s + (m.amount_calculated || 0), 0);
  const totalPending = milestones.filter(m => ["invoiced", "ready_to_invoice"].includes(m.status)).reduce((s, m) => s + (m.amount_calculated || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="font-bold text-secondary text-base flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" /> Payment Schedule
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Total: <strong>${grandTotal.toLocaleString()}</strong>
            </p>
          </div>
          {adminApproved ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
              <Lock className="w-4 h-4 text-green-600" />
              <span className="text-xs font-semibold text-green-700">Approved by {adminApprovedBy}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <Unlock className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">Pending Admin Approval</span>
            </div>
          )}
        </div>

        {/* Financial summary bars */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-green-600">${totalPaid.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Collected</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-blue-600">${totalPending.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-secondary">${(grandTotal - totalPaid).toLocaleString()}</div>
            <div className="text-xs text-gray-500">Remaining</div>
          </div>
        </div>

        {/* Balance check */}
        {!isBalanced && milestones.length > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800 font-medium">
              Scheduled total ${totalScheduled.toLocaleString()} doesn't match contract ${grandTotal.toLocaleString()}. 
              Difference: ${Math.abs(totalScheduled - grandTotal).toLocaleString()}
            </p>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => save(false)} disabled={saving} variant="outline" size="sm" className="gap-1.5">
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save Draft"}
          </Button>
          {canApprove && !adminApproved && (
            <Button
              onClick={() => save(true)}
              disabled={saving || approving || !isBalanced}
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            >
              <Shield className="w-3.5 h-3.5" /> Approve & Activate
            </Button>
          )}
          <Button onClick={addMilestone} disabled={adminApproved} variant="outline" size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Milestone
          </Button>
        </div>
      </div>

      {/* Milestone List */}
      <div className="space-y-3">
        {milestones.map((m, idx) => {
          const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.upcoming;
          const StatusIcon = cfg.icon;
          const isExpanded = expandedMilestone === m.id;

          return (
            <div key={m.id} className={`bg-white border rounded-xl overflow-hidden ${m.is_substantially_completed ? "border-amber-300" : "border-gray-200"}`}>
              {/* Row Header */}
              <div
                className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedMilestone(isExpanded ? null : m.id)}
              >
                <div className="w-7 h-7 rounded-full bg-secondary text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-secondary text-sm flex items-center gap-2 flex-wrap">
                    {m.label || "Untitled Milestone"}
                    {m.is_substantially_completed && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">SC</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{TRIGGER_TYPES.find(t => t.value === m.trigger_type)?.label || m.trigger_type}</span>
                    {m.requires_field_photo && <span className="flex items-center gap-0.5"><Camera className="w-3 h-3" /> Photo required</span>}
                    {m.requires_pm_approval && <span className="flex items-center gap-0.5"><Shield className="w-3 h-3" /> PM review</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-secondary">
                    ${(m.amount_calculated || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">
                    {m.amount_type === "percentage" ? `${m.amount_value}%` : "fixed"}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${cfg.color}`}>
                  <StatusIcon className="w-3 h-3" /> {cfg.label}
                </span>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </div>

              {/* Expanded editor */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50/50">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Label</label>
                      <Input
                        value={m.label}
                        onChange={e => updateMilestone(m.id, "label", e.target.value)}
                        placeholder="e.g. 1st Deposit"
                        className="h-8 text-sm"
                        disabled={adminApproved}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Trigger</label>
                      <Select value={m.trigger_type} onValueChange={v => updateMilestone(m.id, "trigger_type", v)} disabled={adminApproved}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TRIGGER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {m.trigger_type === "phase_completion" && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-1">Phase Name</label>
                        <Input value={m.trigger_phase || ""} onChange={e => updateMilestone(m.id, "trigger_phase", e.target.value)} placeholder="e.g. Demo, Framing" className="h-8 text-sm" disabled={adminApproved} />
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Amount Type</label>
                      <Select value={m.amount_type} onValueChange={v => updateMilestone(m.id, "amount_type", v)} disabled={adminApproved}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">
                        {m.amount_type === "percentage" ? "Percentage %" : "Amount $"}
                      </label>
                      <Input
                        type="number"
                        value={m.amount_value}
                        onChange={e => updateMilestone(m.id, "amount_value", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                        disabled={adminApproved}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Calculated Amount</label>
                      <div className="h-8 flex items-center px-2 bg-white border border-gray-200 rounded text-sm font-bold text-primary">
                        ${(m.amount_calculated || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Gate Requirements */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gate Requirements</p>
                    <div className="flex flex-wrap gap-4">
                      {[
                        ["requires_field_photo", "Field Photo Required"],
                        ["requires_pm_approval", "PM Approval Required"],
                        ["requires_sub_signoff", "Sub Sign-Off Required"],
                        ["is_substantially_completed", "Substantially Completed (triggers punchlist)"],
                      ].map(([field, label]) => (
                        <label key={field} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!m[field]}
                            onChange={e => updateMilestone(m.id, field, e.target.checked)}
                            disabled={adminApproved}
                            className="rounded"
                          />
                          <span className="text-xs text-gray-600">{label}</span>
                        </label>
                      ))}
                    </div>
                    {m.requires_sub_signoff && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-1">Required Trades (comma separated)</label>
                        <Input
                          value={(m.required_sub_trades || []).join(", ")}
                          onChange={e => updateMilestone(m.id, "required_sub_trades", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                          placeholder="e.g. Electrical, Plumbing"
                          className="h-8 text-sm"
                          disabled={adminApproved}
                        />
                      </div>
                    )}
                  </div>

                  {/* PM Notes */}
                  {m.pm_notes && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
                      <strong>PM Notes:</strong> {m.pm_notes}
                    </div>
                  )}

                  {/* Sub signoffs status */}
                  {m.requires_sub_signoff && m.sub_signoffs?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-gray-500">Sub Sign-offs</p>
                      {m.sub_signoffs.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {s.signed_off ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Clock className="w-3.5 h-3.5 text-gray-400" />}
                          <span className={s.signed_off ? "text-green-700 font-medium" : "text-gray-500"}>{s.trade} — {s.sub_name || "Unassigned"}</span>
                          {s.photo_url && <a href={s.photo_url} target="_blank" rel="noreferrer" className="text-blue-500 underline">Photo</a>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-wrap pt-1 border-t border-gray-100">
                    {m.status === "pm_review" && canApprove && (
                      <Button size="sm" onClick={() => approveMilestone(m.id)} className="bg-green-600 hover:bg-green-700 text-white gap-1 h-8 text-xs">
                        <CheckCircle2 className="w-3 h-3" /> Approve — Ready to Invoice
                      </Button>
                    )}
                    {m.status === "ready_to_invoice" && (
                      <Button size="sm" onClick={() => markInvoiced(m.id)} className="bg-blue-600 hover:bg-blue-700 text-white gap-1 h-8 text-xs">
                        <DollarSign className="w-3 h-3" /> Mark Invoiced
                      </Button>
                    )}
                    {m.status === "invoiced" && (
                      <Button size="sm" onClick={() => markPaid(m.id)} className="bg-green-600 hover:bg-green-700 text-white gap-1 h-8 text-xs">
                        <CheckCircle2 className="w-3 h-3" /> Mark Paid
                      </Button>
                    )}
                    {!adminApproved && (
                      <Button size="sm" variant="ghost" onClick={() => removeMilestone(m.id)} className="gap-1 h-8 text-xs text-gray-400 hover:text-red-400">
                        <Trash2 className="w-3 h-3" /> Remove
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {milestones.length === 0 && (
        <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-xl text-gray-400">
          <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No payment schedule yet</p>
          <p className="text-xs mt-1">Click "Add Milestone" or use the defaults to build your schedule.</p>
        </div>
      )}

      {/* Summary Footer */}
      {milestones.length > 0 && (
        <div className="bg-secondary text-white rounded-xl px-5 py-3 flex justify-between items-center">
          <span className="font-semibold text-sm">Scheduled Total</span>
          <div className="text-right">
            <span className={`text-xl font-bold ${isBalanced ? "text-green-400" : "text-amber-400"}`}>
              ${totalScheduled.toLocaleString()}
            </span>
            {!isBalanced && (
              <span className="text-xs text-amber-300 block">
                (of ${grandTotal.toLocaleString()} contract)
              </span>
            )}
            {milestones.every(m => m.amount_type === "percentage") && (
              <span className="text-xs text-gray-300 block">{totalPct}% total</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}