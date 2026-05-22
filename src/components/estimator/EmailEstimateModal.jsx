import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Send, X, Mail, FileText } from "lucide-react";

export default function EmailEstimateModal({ project, estimate, onClose, isChangeOrder }) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(
    isChangeOrder
      ? `Please find your Change Order #${estimate?.change_order_number} attached for your review.`
      : `Please find your project estimate attached for review. Feel free to reach out with any questions!`
  );
  const [overrideEmail, setOverrideEmail] = useState(project?.client_email || "");

  const handleSend = async () => {
    if (!overrideEmail.trim()) {
      toast({ title: "Please enter a recipient email", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await base44.functions.invoke("emailEstimateToCustomer", {
        project_id: project.id,
        estimate_id: estimate.id,
        message: message.trim(),
        is_change_order: isChangeOrder,
        override_email: overrideEmail.trim(),
      });
      toast({
        title: isChangeOrder ? "Change Order emailed!" : "Estimate emailed!",
        description: `Sent to ${overrideEmail}`,
      });
      onClose(true);
    } catch (err) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-secondary">
              {isChangeOrder ? "Email Change Order" : "Email Estimate to Customer"}
            </h2>
          </div>
          <button onClick={() => onClose(false)} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Estimate Summary */}
          <div className="bg-muted rounded-lg p-3 flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary shrink-0" />
            <div>
              <div className="font-semibold text-sm text-secondary">
                {isChangeOrder ? `Change Order #${estimate?.change_order_number}` : "Project Estimate"}
              </div>
              <div className="text-xs text-gray-500">
                {project?.project_type} · ${(estimate?.grand_total || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Recipient */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
              Send To
            </label>
            <Input
              type="email"
              value={overrideEmail}
              onChange={e => setOverrideEmail(e.target.value)}
              placeholder="client@email.com"
              className="text-sm"
            />
          </div>

          {/* Custom Message */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
              Personal Message <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              className="resize-none text-sm"
              placeholder="Add a personal message..."
            />
          </div>

          <p className="text-xs text-gray-400">
            A branded PDF will be generated and attached. The customer will also receive a link to their personal project portal.
          </p>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
          <Button variant="outline" onClick={() => onClose(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending} className="gap-2 bg-primary text-white">
            <Send className="w-4 h-4" />
            {sending ? "Sending…" : "Send Email"}
          </Button>
        </div>
      </div>
    </div>
  );
}