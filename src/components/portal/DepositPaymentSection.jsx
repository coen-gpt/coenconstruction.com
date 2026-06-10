import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { CreditCard, Building2, Mail, CheckCircle, Loader2, DollarSign } from "lucide-react";

const METHODS = [
  { id: "card", label: "Credit / Debit Card", icon: CreditCard, desc: "Visa, Mastercard, Amex, Discover" },
  { id: "ach", label: "Bank Transfer (ACH)", icon: Building2, desc: "Checking or savings account" },
  { id: "check", label: "Mail a Check", icon: Mail, desc: "Send to our office" },
];

export default function DepositPaymentSection({ project, depositAmount, token, onPaid }) {
  const { toast } = useToast();
  const [method, setMethod] = useState("card");
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(project?.deposit_paid || false);

  // Card fields
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  // ACH fields
  const [routingNum, setRoutingNum] = useState("");
  const [accountNum, setAccountNum] = useState("");
  const [accountName, setAccountName] = useState("");

  const formatCardNumber = (val) => val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (val) => {
    const clean = val.replace(/\D/g, "").slice(0, 4);
    return clean.length >= 3 ? clean.slice(0, 2) + "/" + clean.slice(2) : clean;
  };

  const handlePayment = async () => {
    if (method === "check") {
      // Token-validated backend call records the pending check and unlocks the
      // portal — the public page can't write to the project directly.
      setPaying(true);
      try {
        await base44.functions.invoke("processDepositPayment", {
          token,
          amount: depositAmount,
          method: "check",
        });
        toast({ title: "Got it! Mailing a check", description: "We'll activate your portal once your check is received." });
        setPaid(true);
        onPaid();
      } catch (err) {
        toast({ title: "Something went wrong", description: err?.response?.data?.error || err.message, variant: "destructive" });
      }
      setPaying(false);
      return;
    }

    setPaying(true);
    try {
      // Call backend to process payment
      const res = await base44.functions.invoke("processDepositPayment", {
        token,
        amount: depositAmount,
        method,
        card_name: cardName,
        card_number: cardNumber.replace(/\s/g, ""),
        card_expiry: cardExpiry,
        card_cvc: cardCvc,
        routing_number: routingNum,
        account_number: accountNum,
        account_name: accountName,
      });

      if (res.data?.success) {
        setPaid(true);
        toast({ title: "Payment received! 🎉", description: "Your deposit has been processed and your portal is now active." });
        onPaid();
      } else {
        toast({ title: "Payment issue", description: res.data?.error || "Please check your details and try again.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
    }
    setPaying(false);
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
      <div className="bg-[#1B2B3A] px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-5 h-5 text-[#E35235]" />
          <span className="text-white font-bold">Deposit Payment Required</span>
        </div>
        <p className="text-gray-400 text-sm">A deposit is required to activate your project and customer portal.</p>
        <div className="mt-3 bg-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-gray-300 text-sm">Deposit Amount</span>
          <span className="text-white font-bold text-2xl">${depositAmount?.toLocaleString()}</span>
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
                  method === m.id ? "border-[#E35235] bg-[#E35235]/5" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${method === m.id ? "bg-[#E35235]" : "bg-gray-100"}`}>
                  <m.icon className={`w-4 h-4 ${method === m.id ? "text-white" : "text-gray-500"}`} />
                </div>
                <div>
                  <div className={`font-semibold text-sm ${method === m.id ? "text-[#E35235]" : "text-gray-800"}`}>{m.label}</div>
                  <div className="text-xs text-gray-400">{m.desc}</div>
                </div>
                <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center ${method === m.id ? "border-[#E35235]" : "border-gray-300"}`}>
                  {method === m.id && <div className="w-2 h-2 rounded-full bg-[#E35235]" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Card Form */}
        {method === "card" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Name on Card</label>
              <Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="John Smith" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Card Number</label>
              <Input value={cardNumber} onChange={e => setCardNumber(formatCardNumber(e.target.value))} placeholder="1234 5678 9012 3456" maxLength={19} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Expiry</label>
                <Input value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" maxLength={5} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">CVC</label>
                <Input value={cardCvc} onChange={e => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" maxLength={4} />
              </div>
            </div>
          </div>
        )}

        {/* ACH Form */}
        {method === "ach" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Account Holder Name</label>
              <Input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="John Smith" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Routing Number</label>
              <Input value={routingNum} onChange={e => setRoutingNum(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9 digits" maxLength={9} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Account Number</label>
              <Input value={accountNum} onChange={e => setAccountNum(e.target.value.replace(/\D/g, ""))} placeholder="Account number" />
            </div>
          </div>
        )}

        {/* Check Instructions */}
        {method === "check" && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">Make check payable to:</p>
            <p className="font-bold text-blue-900">Coen Construction LLC</p>
            <p className="mt-2 font-semibold">Mail to:</p>
            <p>387 Page Street, Suite 10B<br />Stoughton, MA 02072</p>
            <p className="mt-2 text-xs text-blue-600">Please write your name and project address in the memo line. Your portal will be activated upon receipt.</p>
          </div>
        )}

        <Button
          onClick={handlePayment}
          disabled={paying || (method === "card" && (!cardName || !cardNumber || !cardExpiry || !cardCvc)) || (method === "ach" && (!accountName || !routingNum || !accountNum))}
          className="w-full py-3 font-bold bg-[#E35235] hover:bg-[#c94522] text-white gap-2"
        >
          {paying
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
            : method === "check"
              ? <><Mail className="w-4 h-4" /> I'll Mail a Check — Activate Portal</>
              : <><CheckCircle className="w-4 h-4" /> Pay ${depositAmount?.toLocaleString()} Deposit</>
          }
        </Button>

        <p className="text-center text-xs text-gray-400">
          🔒 Payments are processed securely. Your card information is encrypted.
        </p>
      </div>
    </div>
  );
}