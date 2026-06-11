import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { CreditCard, Mail, CheckCircle, Loader2, DollarSign, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";

/**
 * Deposit payment — powered by QuickBooks Payments.
 *
 * "Pay Online" creates (or reuses) a deposit invoice in the company's
 * QuickBooks Online account and opens Intuit's hosted payment page, which
 * accepts debit/credit cards and ACH bank transfer and carries the company
 * branding configured in QuickBooks. No card data ever touches this app.
 * "Mail a Check" records the intent and unlocks the portal pending receipt.
 */
const METHODS = [
  { id: "online", label: "Pay Online — Card or Bank (ACH)", icon: CreditCard, desc: "Debit, credit, or bank transfer via our secure QuickBooks payment page" },
  { id: "check", label: "Mail a Check", icon: Mail, desc: "Send to our office" },
];

export default function DepositPaymentSection({ project, depositAmount, token, onPaid }) {
  const { toast } = useToast();
  const [method, setMethod] = useState("online");
  const [working, setWorking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paid, setPaid] = useState(project?.deposit_paid || false);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState(null);

  // Stay in sync when the parent re-fetches portal data and the project
  // arrives already paid (e.g. the office recorded the payment).
  useEffect(() => {
    if (project?.deposit_paid) setPaid(true);
  }, [project?.deposit_paid]);

  // If a deposit invoice already exists (e.g. the customer paid in another
  // tab and came back), pick up the paid state automatically.
  useEffect(() => {
    if (!token || paid || !project?.client_signed) return;
    base44.functions.invoke("createDepositInvoice", { token, action: "check_status" })
      .then((res) => {
        if (res.data?.paid) { setPaid(true); onPaid?.(); }
        else if (res.data?.payment_url) {
          setPaymentUrl(res.data.payment_url);
          setInvoiceNumber(res.data.invoice_number || null);
        }
      })
      .catch(() => {});
     
  }, [token]);

  const startOnlinePayment = async () => {
    setWorking(true);
    try {
      const res = await base44.functions.invoke("createDepositInvoice", { token });
      if (res.data?.paid) {
        setPaid(true);
        onPaid?.();
      } else if (res.data?.payment_url) {
        setPaymentUrl(res.data.payment_url);
        setInvoiceNumber(res.data.invoice_number || null);
        window.open(res.data.payment_url, "_blank", "noopener");
      } else {
        toast({ title: "Couldn't open the payment page", description: res.data?.error || "Please try again or call us at (617) 857-COEN.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Couldn't open the payment page", description: err?.response?.data?.error || err.message, variant: "destructive" });
    }
    setWorking(false);
  };

  const confirmPayment = async () => {
    setChecking(true);
    try {
      const res = await base44.functions.invoke("createDepositInvoice", { token, action: "check_status" });
      if (res.data?.paid) {
        setPaid(true);
        toast({ title: "Payment received! 🎉", description: "Your deposit has been processed and your portal is now active." });
        onPaid?.();
      } else {
        toast({ title: "Payment not received yet", description: "Bank transfers can take a moment to register. If you just paid, try again in a minute — or call us at (617) 857-COEN." });
      }
    } catch (err) {
      toast({ title: "Couldn't check payment status", description: err?.response?.data?.error || err.message, variant: "destructive" });
    }
    setChecking(false);
  };

  const mailCheck = async () => {
    setWorking(true);
    try {
      await base44.functions.invoke("processDepositPayment", { token, amount: depositAmount, method: "check" });
      toast({ title: "Got it! Mailing a check", description: "We'll activate your portal once your check is received." });
      setPaid(true);
      onPaid?.();
    } catch (err) {
      toast({ title: "Something went wrong", description: err?.response?.data?.error || err.message, variant: "destructive" });
    }
    setWorking(false);
  };

  if (paid) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
        <h3 className="font-bold text-green-800 text-lg">Deposit Received!</h3>
        <p className="text-green-700 text-sm mt-1">Your portal is now fully active. Welcome aboard! 🎉</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-secondary px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-5 h-5 text-primary" />
          <span className="text-white font-bold">Deposit Payment Required</span>
        </div>
        <p className="text-gray-400 text-sm">A deposit is required to activate your project and customer portal.</p>
        <div className="mt-3 bg-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-gray-300 text-sm">Deposit Amount</span>
          <span className="text-white font-bold text-2xl">
            {depositAmount > 0 ? `$${depositAmount.toLocaleString()}` : "Call us"}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Payment Method Selection */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Select Payment Method</label>
          <div className="space-y-2">
            {METHODS.map(m => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                  method === m.id ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${method === m.id ? "bg-primary" : "bg-gray-100"}`}>
                  <m.icon className={`w-4 h-4 ${method === m.id ? "text-white" : "text-gray-500"}`} />
                </div>
                <div>
                  <div className={`font-semibold text-sm ${method === m.id ? "text-primary" : "text-gray-800"}`}>{m.label}</div>
                  <div className="text-xs text-gray-400">{m.desc}</div>
                </div>
                <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center ${method === m.id ? "border-primary" : "border-gray-300"}`}>
                  {method === m.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Online payment via QuickBooks */}
        {method === "online" && (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                You'll be taken to our secure payment page powered by <strong>QuickBooks</strong> (Intuit) to pay
                by debit/credit card or bank transfer. Come back here afterward and tap
                "I've completed payment."
              </span>
            </div>

            {!paymentUrl ? (
              <Button onClick={startOnlinePayment} disabled={working} className="w-full py-3 font-bold bg-primary hover:bg-[#c94522] text-white gap-2">
                {working
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing your payment page…</>
                  : <><ExternalLink className="w-4 h-4" /> Pay ${depositAmount?.toLocaleString()} Online</>}
              </Button>
            ) : (
              <div className="space-y-2">
                <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <Button className="w-full py-3 font-bold bg-primary hover:bg-[#c94522] text-white gap-2">
                    <ExternalLink className="w-4 h-4" /> Open Payment Page{invoiceNumber ? ` (Invoice #${invoiceNumber})` : ""}
                  </Button>
                </a>
                <Button onClick={confirmPayment} disabled={checking} variant="outline" className="w-full py-3 font-semibold gap-2">
                  {checking
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking…</>
                    : <><RefreshCw className="w-4 h-4" /> I've completed payment</>}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Check Instructions */}
        {method === "check" && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
              <p className="font-semibold">Make check payable to:</p>
              <p className="font-bold text-blue-900">Coen Construction LLC</p>
              <p className="mt-2 font-semibold">Mail to:</p>
              <p>387 Page Street, Suite 10B<br />Stoughton, MA 02072</p>
              <p className="mt-2 text-xs text-blue-600">Please write your name and project address in the memo line. Your portal will be activated upon receipt.</p>
            </div>
            <Button onClick={mailCheck} disabled={working} className="w-full py-3 font-bold bg-primary hover:bg-[#c94522] text-white gap-2">
              {working
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Mail className="w-4 h-4" /> I'll Mail a Check — Activate Portal</>}
            </Button>
          </>
        )}

        <p className="text-center text-xs text-gray-400">
          🔒 Online payments are processed securely by Intuit QuickBooks. We never see or store your card or bank details.
        </p>
      </div>
    </div>
  );
}
