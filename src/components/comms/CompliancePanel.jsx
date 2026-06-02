/**
 * Compliance Panel for Command Center — shows subs with expiring/expired insurance
 * and subs with open payables.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Shield, ChevronDown, ChevronUp, AlertTriangle, ArrowUpRight, Send, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function CompliancePanel() {
  const [collapsed, setCollapsed] = useState(false);
  const { toast } = useToast();
  const [sending, setSending] = useState(null);

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-compliance"],
    queryFn: () => base44.entities.Vendor.filter({ is_subcontractor: true }),
    staleTime: 120_000,
  });

  const { data: payables = [] } = useQuery({
    queryKey: ["all-payables-compliance"],
    queryFn: () => base44.entities.SubPayable.list("-created_date", 200),
    staleTime: 120_000,
  });

  const atRisk = vendors.filter(v =>
    v.insurance_status === "expired" || v.insurance_status === "expiring_soon"
  );

  // Cross-reference with open payables
  const payableVendorEmails = new Set(payables.map(p => p.vendor_email?.toLowerCase()).filter(Boolean));
  const withOpenPayable = atRisk.filter(v => payableVendorEmails.has(v.email?.toLowerCase()));

  const sendReminder = async (vendor) => {
    setSending(vendor.id);
    try {
      const resendKey = await base44.functions.invoke("sendLeadNotification", {
        email: vendor.email,
        subject: "Insurance Certificate Update Required — Coen Construction",
        message: `Hi ${vendor.contact_name || vendor.company_name},\n\nOur records show your insurance certificate is ${vendor.insurance_status === "expired" ? "expired" : "expiring soon"}.\n\nPlease provide an updated certificate of insurance (Workers Comp and General Liability) to continue receiving payments. Expired insurance blocks payment processing.\n\nThank you,\nCoen Construction`,
      });
      toast({ title: "Reminder sent to " + vendor.company_name });
    } catch (e) {
      toast({ title: "Error sending reminder", description: e.message, variant: "destructive" });
    }
    setSending(null);
  };

  const totalAtRisk = atRisk.length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${totalAtRisk > 0 ? "bg-red-100" : "bg-gray-100"}`}>
          <Shield className={`w-4 h-4 ${totalAtRisk > 0 ? "text-red-600" : "text-gray-400"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-secondary text-sm">Insurance Compliance</h2>
            {totalAtRisk > 0 && (
              <span className={`text-xs font-bold rounded-full px-2 py-0.5 text-white ${atRisk.some(v => v.insurance_status === "expired") ? "bg-red-600" : "bg-yellow-500"}`}>
                {totalAtRisk} at risk
              </span>
            )}
            {withOpenPayable.length > 0 && (
              <span className="text-xs font-bold bg-red-800 text-white rounded-full px-2 py-0.5">
                {withOpenPayable.length} blocking payment
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Subcontractors with expired or expiring certificates</p>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {!collapsed && (
        <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
          {atRisk.length === 0 && (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <p className="text-sm text-green-700 font-medium">All subcontractors are insurance compliant</p>
            </div>
          )}
          {atRisk.map(v => {
            const hasPayable = payableVendorEmails.has(v.email?.toLowerCase());
            const expired = v.insurance_status === "expired";
            return (
              <div key={v.id} className={`flex items-start gap-3 px-4 py-3 ${expired ? "bg-red-50 border-l-4 border-l-red-400" : "bg-yellow-50 border-l-4 border-l-yellow-400"}`}>
                <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${expired ? "text-red-500" : "text-yellow-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-secondary">{v.company_name}</span>
                    <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 ${expired ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {expired ? "EXPIRED" : "EXPIRING SOON"}
                    </span>
                    {hasPayable && (
                      <span className="text-xs bg-red-800 text-white rounded-full px-1.5 py-0.5 font-semibold">Open payable</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {v.email}
                    {v.liability_ins_expiry && ` · GL expires: ${(() => { try { return format(parseISO(v.liability_ins_expiry), "MMM d, yyyy"); } catch { return v.liability_ins_expiry; }})()}`}
                    {v.workers_comp_expiry && ` · WC expires: ${(() => { try { return format(parseISO(v.workers_comp_expiry), "MMM d, yyyy"); } catch { return v.workers_comp_expiry; }})()}`}
                  </div>
                  {expired && hasPayable && (
                    <p className="text-xs text-red-600 font-semibold mt-0.5">
                      ⛔ Payments hard-blocked until certificate is updated
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex flex-col gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => sendReminder(v)}
                    disabled={sending === v.id}
                  >
                    <Send className="w-3 h-3" /> Remind
                  </Button>
                  <Link to="/estimator/vendors">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <ArrowUpRight className="w-3 h-3" /> Update
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}