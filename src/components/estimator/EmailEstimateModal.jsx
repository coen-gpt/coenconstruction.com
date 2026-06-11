import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Send, X, Mail, DollarSign, CheckCircle2, CreditCard, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

export default function EmailEstimateModal({ project, estimate, onClose, isChangeOrder }) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState(
    isChangeOrder
      ? `Hi ${project?.client_name?.split(" ")[0] || "there"},\n\nWe've prepared Change Order #${estimate?.change_order_number} for your review. Please look it over and don't hesitate to reach out with any questions!`
      : `Hi ${project?.client_name?.split(" ")[0] || "there"},\n\nYour project estimate is ready! We've put together a detailed breakdown for your review. Feel free to ask us anything — we're happy to walk you through it.`
  );
  const [toEmail, setToEmail] = useState(project?.client_email || "");

  // ── Optional Payment Schedule prompt (original estimates only) ────────────
  // Filled in (or skipped) right before sending. If populated it becomes the
  // project's PaymentSchedule: shown on the customer portal's Payments tab and
  // as Exhibit B of the contract the customer signs. Editable any time after
  // from Project Detail → Payment Schedule.
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [existingSchedule, setExistingSchedule] = useState(null);
  const [scheduleRows, setScheduleRows] = useState([]);
  const grandTotal = estimate?.grand_total || 0;

  useEffect(() => {
    if (isChangeOrder || !project?.id) return;
    base44.entities.PaymentSchedule.filter({ project_id: project.id })
      .then(rows => setExistingSchedule(rows?.[0] || null))
      .catch(() => {});
  }, [project?.id, isChangeOrder]);

  const hasExisting = (existingSchedule?.milestones || []).length > 0;

  const addRow = (label = "", amount = "") =>
    setScheduleRows(prev => [...prev, { key: crypto.randomUUID(), label, amount }]);
  const updateRow = (key, field, val) =>
    setScheduleRows(prev => prev.map(r => (r.key === key ? { ...r, [field]: val } : r)));
  const removeRow = (key) => setScheduleRows(prev => prev.filter(r => r.key !== key));

  const useSuggestedSplit = () => {
    // Deposit at signing, balance at substantial completion, small final
    // holdback released on punchlist completion — the standard Exhibit B shape.
    const deposit = Math.round(grandTotal * 0.33);
    const final_ = Math.round(grandTotal * 0.05);
    const middle = Math.round((grandTotal - deposit - final_) * 100) / 100;
    setScheduleRows([
      { key: crypto.randomUUID(), label: "Deposit — due upon signing", amount: deposit },
      { key: crypto.randomUUID(), label: "2nd Installment — due upon substantial completion", amount: middle },
      { key: crypto.randomUUID(), label: "Final — due upon completion of punchlist", amount: final_ },
    ]);
  };

  const validRows = scheduleRows.filter(r => String(r.label).trim() && Number(r.amount) > 0);
  const scheduledTotal = validRows.reduce((s, r) => s + Number(r.amount), 0);
  const isBalanced = Math.abs(scheduledTotal - grandTotal) < 1;

  const saveSchedule = async () => {
    if (validRows.length === 0) return;
    const milestones = validRows.map((r, i) => ({
      id: crypto.randomUUID(),
      label: r.label.trim(),
      trigger_type: i === 0 ? "upfront" : "manually_triggered",
      trigger_phase: "",
      amount_type: "fixed",
      amount_value: Number(r.amount),
      amount_calculated: Number(r.amount),
      requires_field_photo: false,
      requires_pm_approval: i !== 0 && i !== validRows.length - 1,
      requires_sub_signoff: false,
      required_sub_trades: [],
      status: "upcoming",
      sub_signoffs: [],
      is_substantially_completed: false,
    }));
    const payload = {
      project_id: project.id,
      estimate_id: estimate?.id,
      total_amount: grandTotal,
      milestones,
      status: "active",
    };
    if (existingSchedule?.id) await base44.entities.PaymentSchedule.update(existingSchedule.id, payload);
    else await base44.entities.PaymentSchedule.create(payload);
  };

  const handleSend = async () => {
    if (!toEmail.trim()) {
      toast({ title: "Please enter a recipient email", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      // Save the payment schedule first (when provided) so the quote email's
      // portal link already shows it. A schedule problem shouldn't eat the
      // send — surface it, but keep going.
      if (!isChangeOrder && validRows.length > 0) {
        try {
          await saveSchedule();
        } catch (err) {
          toast({ title: "Payment schedule not saved", description: err.message, variant: "destructive" });
        }
      }
      await base44.functions.invoke("emailEstimateToCustomer", {
        project_id: project.id,
        estimate_id: estimate.id,
        message: message.trim(),
        is_change_order: isChangeOrder,
        override_email: toEmail.trim(),
      });
      setSent(true);
    } catch (err) {
      const detail = err?.response?.data?.error || err.message || "Unknown error";
      toast({ title: "Failed to send", description: detail, variant: "destructive" });
    }
    setSending(false);
  };

  if (sent) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Email Sent!</h2>
        <p className="text-gray-500 mb-1">
          {isChangeOrder ? "Change order" : "Estimate"} sent to
        </p>
        <p className="font-semibold text-gray-800 mb-6">{toEmail}</p>
        <p className="text-sm text-gray-400 mb-6">They'll also receive a link to their personal project portal where they can view it anytime.</p>
        <Button onClick={() => onClose(true)} className="w-full bg-secondary text-white font-semibold rounded-xl">
          Done
        </Button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">
              {isChangeOrder ? "Send Change Order" : "Send Estimate to Client"}
            </h2>
            <p className="text-gray-400 text-sm mt-0.5">A PDF will be attached automatically</p>
          </div>
          <button onClick={() => onClose(false)} className="text-gray-400 hover:text-gray-600 rounded-lg p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Estimate summary pill */}
          <div className="bg-slate-50 border border-gray-200 rounded-xl flex items-center gap-4 px-4 py-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-bold text-gray-800 text-sm">
                {isChangeOrder ? `Change Order #${estimate?.change_order_number}` : "Project Estimate"}
              </div>
              <div className="text-gray-500 text-xs">{project?.project_type} · <span className="font-semibold text-secondary">${(estimate?.grand_total || 0).toLocaleString()}</span></div>
            </div>
          </div>

          {/* To */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Send to</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="email"
                value={toEmail}
                onChange={e => setToEmail(e.target.value)}
                placeholder="client@email.com"
                className="pl-9 text-sm"
              />
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Personal message</label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              className="resize-none text-sm"
            />
          </div>

          {/* Optional Payment Schedule (original estimates only) */}
          {!isChangeOrder && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setScheduleOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Payment Schedule
                  <span className="text-xs font-normal text-gray-400">(optional)</span>
                </span>
                <span className="flex items-center gap-2">
                  {hasExisting && (
                    <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                      ✓ {existingSchedule.milestones.length} milestones set
                    </span>
                  )}
                  {scheduleOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </span>
              </button>

              {scheduleOpen && (
                <div className="px-4 py-4 space-y-3">
                  {hasExisting ? (
                    <>
                      <p className="text-xs text-gray-500">
                        This project already has a payment schedule — it will appear in the customer portal and as Exhibit B of the contract. Edit it from <strong>Project Detail → Payment Schedule</strong>.
                      </p>
                      <div className="space-y-1.5">
                        {existingSchedule.milestones.map((m, i) => (
                          <div key={m.id || i} className="flex justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
                            <span className="text-gray-600">{i + 1}. {m.label}</span>
                            <span className="font-semibold text-gray-800">${(m.amount_calculated || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500">
                        Set the Schedule of Payments now and it shows in the customer's portal and as Exhibit B of their contract. You can skip this and add it later from <strong>Project Detail → Payment Schedule</strong>.
                      </p>
                      {scheduleRows.length === 0 && (
                        <div className="flex gap-2 flex-wrap">
                          <Button type="button" variant="outline" size="sm" onClick={useSuggestedSplit} className="text-xs gap-1.5">
                            <CreditCard className="w-3.5 h-3.5" /> Use suggested 3-payment split
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => addRow()} className="text-xs gap-1.5">
                            <Plus className="w-3.5 h-3.5" /> Start blank
                          </Button>
                        </div>
                      )}
                      {scheduleRows.map((r, i) => (
                        <div key={r.key} className="flex items-center gap-2">
                          <span className="w-5 text-xs text-gray-400 font-semibold shrink-0">{i + 1}.</span>
                          <Input
                            value={r.label}
                            onChange={e => updateRow(r.key, "label", e.target.value)}
                            placeholder={i === 0 ? "Deposit — due upon signing" : "e.g. Due upon substantial completion"}
                            className="h-8 text-xs flex-1"
                          />
                          <div className="relative w-28 shrink-0">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                            <Input
                              type="number"
                              value={r.amount}
                              onChange={e => updateRow(r.key, "amount", e.target.value)}
                              className="h-8 text-xs pl-5"
                            />
                          </div>
                          <button type="button" onClick={() => removeRow(r.key)} className="text-gray-300 hover:text-red-400 shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {scheduleRows.length > 0 && (
                        <div className="flex items-center justify-between pt-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => addRow()} className="text-xs gap-1 h-7 text-gray-500">
                            <Plus className="w-3 h-3" /> Add payment
                          </Button>
                          <span className={`text-xs font-semibold ${isBalanced ? "text-green-600" : "text-amber-600"}`}>
                            ${scheduledTotal.toLocaleString()} of ${grandTotal.toLocaleString()}
                            {!isBalanced && " — doesn't match total"}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-600">
            💡 The client will also receive a private portal link to view their estimate and chat with your AI project manager anytime.
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <Button variant="outline" onClick={() => onClose(false)} disabled={sending} className="flex-1 rounded-xl">
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !toEmail.trim()} className="flex-1 gap-2 bg-primary hover:bg-[#c94522] text-white font-semibold rounded-xl">
            <Send className="w-4 h-4" />
            {sending ? "Sending…" : "Send Email"}
          </Button>
        </div>
      </div>
    </div>
  );
}
