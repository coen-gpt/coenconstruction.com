import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Send, X, Mail, DollarSign, CheckCircle2 } from "lucide-react";

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

  const handleSend = async () => {
    if (!toEmail.trim()) {
      toast({ title: "Please enter a recipient email", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
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