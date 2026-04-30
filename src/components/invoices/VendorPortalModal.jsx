import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Mail, MessageSquare, Send, CheckCircle, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const PAYMENT_STAGES = ["Initial Deposit", "2nd Payment", "3rd Payment", "Final"];

export default function VendorPortalModal({ record, onClose, onRefresh }) {
  const { toast } = useToast();
  const [channel, setChannel] = useState("email");
  const [email, setEmail] = useState(record.vendor_email || "");
  const [phone, setPhone] = useState(record.vendor_phone || "");
  const [stage, setStage] = useState(record.payment_stage || "Initial Deposit");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [manualUrl, setManualUrl] = useState(null);

  const handleSend = async () => {
    setSending(true);
    const res = await base44.functions.invoke("sendVendorInvoiceLink", {
      invoice_id: record.id,
      channel,
      vendor_email: channel === "email" ? email : undefined,
      vendor_phone: channel === "sms" ? phone : undefined,
      payment_stage: stage,
    });

    setSending(false);
    if (res.data?.success) {
      if (res.data?.manual) {
        setManualUrl(res.data.portal_url);
      } else {
        setSent(true);
        toast({ title: `✅ Portal link sent via ${channel.toUpperCase()}`, description: `Sent to ${channel === "email" ? email : phone}` });
        onRefresh();
      }
    } else {
      toast({ title: "Failed to send", description: res.data?.error || "Unknown error", variant: "destructive" });
    }
  };

  const currentStageIndex = PAYMENT_STAGES.indexOf(record.payment_stage || "");
  const versions = record.all_attachment_versions || [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-secondary px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-base">Vendor Self-Service Portal</h2>
            <p className="text-white/60 text-xs mt-0.5">{record.vendor_name || record.vendor_email}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Payment stage pipeline */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payment Stage</p>
            <div className="flex items-center gap-1 mb-3">
              {PAYMENT_STAGES.map((s, i) => (
                <div key={s} className="flex items-center flex-1 min-w-0">
                  <div className="flex-1">
                    <div className={`h-1.5 rounded-full ${
                      i < currentStageIndex ? "bg-green-400" :
                      s === record.payment_stage ? "bg-primary" :
                      "bg-gray-200"
                    }`} />
                  </div>
                  {i < PAYMENT_STAGES.length - 1 && <ChevronRight className="w-3 h-3 text-gray-200 shrink-0" />}
                </div>
              ))}
            </div>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STAGES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Previously submitted docs */}
          {versions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Submitted Documents</p>
              <div className="space-y-1.5">
                {versions.map((v, i) => (
                  <a key={i} href={v.url} target="_blank" rel="noopener noreferrer"
                    className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border transition-colors hover:bg-blue-50 ${
                      v.uploaded_by_vendor ? "bg-green-50 border-green-200 text-green-800" : "bg-blue-50 border-blue-100 text-blue-800"
                    }`}>
                    <span className="flex-1 truncate">{v.file_name || v.stage}</span>
                    <span className={`shrink-0 font-semibold ${v.uploaded_by_vendor ? "text-green-600" : "text-blue-500"}`}>{v.stage}</span>
                    {v.uploaded_by_vendor && <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Channel selection */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Send Portal Link Via</p>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setChannel("email")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  channel === "email" ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Mail className="w-4 h-4" /> Email
              </button>
              <button
                onClick={() => setChannel("sms")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  channel === "sms" ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <MessageSquare className="w-4 h-4" /> SMS
              </button>
            </div>

            {channel === "email" ? (
              <Input
                type="email"
                placeholder="vendor@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-9 text-sm"
              />
            ) : (
              <Input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="h-9 text-sm"
              />
            )}
          </div>

          {/* Manual URL fallback */}
          {manualUrl && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800">Twilio not configured — copy & send manually:</p>
              <input
                readOnly
                value={manualUrl}
                onClick={e => { e.target.select(); navigator.clipboard.writeText(manualUrl); }}
                className="w-full text-xs bg-white border border-amber-200 rounded px-2 py-1.5 text-amber-900 cursor-pointer"
              />
              <p className="text-xs text-amber-600">Click to copy to clipboard</p>
            </div>
          )}

          {sent ? (
            <div className="flex flex-col items-center gap-2 py-3">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <p className="text-sm font-semibold text-green-700">Link sent successfully!</p>
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            </div>
          ) : (
            <Button
              onClick={handleSend}
              disabled={sending || (channel === "email" ? !email : !phone)}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send {stage} Request</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}