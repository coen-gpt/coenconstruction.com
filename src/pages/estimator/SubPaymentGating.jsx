/**
 * Sub Payment Gating page — /estimator/payment-gating
 * Two tabs: Ready for Payment (grouped by Friday) | Blocked / Pending (with shortcut actions)
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44, ADMIN_SESSION_KEY } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import {
  CreditCard, ShieldCheck, ShieldX, RefreshCw, ArrowUpRight,
  Send, FileText, AlertTriangle, CheckCircle2
} from "lucide-react";
import { format, parseISO } from "date-fns";
import GateStatusBadges from "@/components/invoices/GateStatusBadges";
import PmApprovalPanel from "@/components/invoices/PmApprovalPanel";

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY)); } catch { return null; }
}

function groupByFriday(invoices) {
  const groups = {};
  invoices.forEach(inv => {
    const key = inv.scheduled_payment_date || "Unscheduled";
    if (!groups[key]) groups[key] = [];
    groups[key].push(inv);
  });
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function BlockedReasonActions({ invoice, vendor, onRefresh }) {
  const { toast } = useToast();
  const [sending, setSending] = useState(null);
  const reasons = invoice.gate_blocked_reasons || [];

  const sendPacketLink = async () => {
    setSending("packet");
    try {
      await base44.functions.invoke("sendVendorInvoiceLink", { invoice_id: invoice.id, type: "packet" });
      toast({ title: "Packet link sent" });
    } catch (e) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    setSending(null);
  };

  const sendInvoiceRequest = async () => {
    setSending("invoice");
    try {
      await base44.functions.invoke("sendVendorInvoiceLink", { invoice_id: invoice.id });
      toast({ title: "Invoice portal link sent to vendor" });
    } catch (e) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    setSending(null);
  };

  const needsPacket = reasons.some(r => r.includes("packet not completed") || r.includes("Vendor record not linked"));
  const needsInsurance = reasons.some(r => r.includes("Insurance expired") || r.includes("certificate not on file"));
  const needsDoc = reasons.some(r => r.includes("No invoice document") || r.includes("amount is $0"));
  const needsPMApproval = reasons.some(r => r.includes("Awaiting PM approval"));

  return (
    <div className="mt-3 space-y-2">
      <ul className="space-y-1">
        {reasons.map((r, i) => (
          <li key={i} className={`text-xs flex items-start gap-1.5 ${
            r.includes("expiring soon") || r.includes("still payable") ? "text-yellow-700" :
            "text-red-700"
          }`}>
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {r}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 mt-2">
        {needsPacket && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={sendPacketLink} disabled={sending === "packet"}>
            <Send className="w-3 h-3" /> Send packet link
          </Button>
        )}
        {needsInsurance && vendor && (
          <Link to={`/estimator/vendors`}>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50">
              <ShieldX className="w-3 h-3" /> Update insurance
            </Button>
          </Link>
        )}
        {needsDoc && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={sendInvoiceRequest} disabled={sending === "invoice"}>
            <FileText className="w-3 h-3" /> Request invoice
          </Button>
        )}
      </div>
      {needsPMApproval && !needsPacket && !needsInsurance && !needsDoc && (
        <div className="mt-2">
          <PmApprovalPanel invoice={invoice} vendor={vendor} onRefresh={onRefresh} />
        </div>
      )}
    </div>
  );
}

function InvoiceCard({ invoice, vendor, projects, onRefresh, showApproval = false }) {
  const [expanded, setExpanded] = useState(false);
  const project = projects.find(p => p.id === invoice.project_id);

  return (
    <div className={`bg-white border rounded-xl p-4 space-y-2 ${invoice.ready_for_payment ? "border-emerald-200" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-secondary text-sm">{invoice.vendor_name || invoice.vendor_email}</div>
          <div className="text-xs text-gray-500">
            {invoice.invoice_number ? `#${invoice.invoice_number}` : "No #"}
            {invoice.amount ? ` · $${Number(invoice.amount).toLocaleString()}` : ""}
            {invoice.ai_classified_category ? ` · ${invoice.ai_classified_category}` : ""}
          </div>
          {project && (
            <div className="text-xs text-gray-400 mt-0.5">{project.client_name}{project.client_city ? ` · ${project.client_city}` : ""}</div>
          )}
          {invoice.payment_stage && (
            <span className="inline-block mt-1 text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-semibold">{invoice.payment_stage}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {invoice.project_id && (
            <Link to={`/estimator/projects/${invoice.project_id}`}>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                <ArrowUpRight className="w-3 h-3" /> Project
              </Button>
            </Link>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setExpanded(e => !e)}>
            {expanded ? "Less" : "Details"}
          </Button>
        </div>
      </div>

      <GateStatusBadges invoice={invoice} vendor={vendor} />

      {expanded && (
        <div className="border-t border-gray-100 pt-3 space-y-3">
          {showApproval && (
            <PmApprovalPanel invoice={invoice} vendor={vendor} onRefresh={onRefresh} />
          )}
          {!showApproval && invoice.gate_blocked_reasons?.length > 0 && (
            <BlockedReasonActions invoice={invoice} vendor={vendor} onRefresh={onRefresh} />
          )}
        </div>
      )}
    </div>
  );
}

export default function SubPaymentGating() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("ready");
  const [recomputing, setRecomputing] = useState(false);

  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ["gating-invoices"],
    queryFn: () => base44.entities.InvoiceRecord.list("-email_received_date", 500),
    refetchInterval: 60_000,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-for-gating"],
    queryFn: () => base44.entities.Vendor.list(),
    staleTime: 60_000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-gating"],
    queryFn: () => base44.entities.ContractorProject.list("-updated_date", 300),
    staleTime: 60_000,
  });

  const vendorByEmail = Object.fromEntries(vendors.map(v => [v.email?.toLowerCase(), v]));
  const vendorById = Object.fromEntries(vendors.map(v => [v.id, v]));

  const getVendor = (inv) =>
    (inv.vendor_id && vendorById[inv.vendor_id]) ||
    (inv.vendor_email && vendorByEmail[inv.vendor_email?.toLowerCase()]) ||
    null;

  // Only sub invoices (requires_packet=true or vendor is_subcontractor)
  const subInvoices = invoices.filter(inv => {
    const v = getVendor(inv);
    return inv.requires_packet !== false || v?.is_subcontractor;
  });

  const readyInvoices = subInvoices.filter(i => i.ready_for_payment);
  const blockedInvoices = subInvoices.filter(i => !i.ready_for_payment && !["paid", "rejected"].includes(i.status));

  const fridayGroups = groupByFriday(readyInvoices);

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      const res = await base44.functions.invoke("computeInvoiceGates", { all: true });
      toast({ title: `Gates recomputed`, description: `${res.data?.updated} invoices processed, ${res.data?.approvedCount} newly approved.` });
      refetch();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setRecomputing(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-secondary flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" /> Sub Payment Gating
          </h1>
          <p className="text-sm text-gray-500">Invoices are only payable when all three gates pass</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleRecompute} disabled={recomputing}>
          <RefreshCw className={`w-3.5 h-3.5 ${recomputing ? "animate-spin" : ""}`} />
          Recompute All Gates
        </Button>
      </div>

      {/* Gate legend */}
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        {[
          { label: "Gate 1 — Packet & Insurance", desc: "Onboarding packet complete + insurance valid or expiring-soon", icon: ShieldCheck, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Gate 2 — Invoice Submitted", desc: "Document attached + amount > $0", icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Gate 3 — PM Approval", desc: "A PM/admin has signed off on this payment", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map(({ label, desc, icon: Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-3 border border-gray-200`}>
            <div className={`flex items-center gap-1.5 font-semibold text-xs ${color} mb-1`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </div>
            <p className="text-xs text-gray-500">{desc}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        <button
          onClick={() => setTab("ready")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "ready" ? "border-emerald-500 text-emerald-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <CheckCircle2 className="w-4 h-4" /> Ready for Payment
          {readyInvoices.length > 0 && <span className="ml-1 bg-emerald-600 text-white text-xs rounded-full px-1.5">{readyInvoices.length}</span>}
        </button>
        <button
          onClick={() => setTab("blocked")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "blocked" ? "border-red-400 text-red-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <ShieldX className="w-4 h-4" /> Blocked / Pending
          {blockedInvoices.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">{blockedInvoices.length}</span>}
        </button>
      </div>

      {isLoading && <div className="text-center py-10 text-gray-400 animate-pulse">Loading invoices…</div>}

      {/* READY TAB */}
      {tab === "ready" && !isLoading && (
        <div className="space-y-6">
          {readyInvoices.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl py-12 text-center text-gray-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No invoices ready for payment yet</p>
              <p className="text-xs mt-1">All three gates must pass for an invoice to appear here</p>
            </div>
          )}
          {fridayGroups.map(([friday, invs]) => (
            <div key={friday}>
              <h3 className="text-sm font-bold text-secondary mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Pay date: {friday === "Unscheduled" ? "Unscheduled" : (() => { try { return format(parseISO(friday), "EEEE, MMMM d, yyyy"); } catch { return friday; } })()}
                <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-semibold">${invs.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</span>
              </h3>
              <div className="space-y-3">
                {invs.map(inv => (
                  <InvoiceCard
                    key={inv.id}
                    invoice={inv}
                    vendor={getVendor(inv)}
                    projects={projects}
                    onRefresh={refetch}
                    showApproval={false}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BLOCKED TAB */}
      {tab === "blocked" && !isLoading && (
        <div className="space-y-3">
          {blockedInvoices.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl py-12 text-center text-gray-400">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-green-300" />
              <p className="text-sm">No blocked invoices</p>
            </div>
          )}
          {blockedInvoices.map(inv => (
            <InvoiceCard
              key={inv.id}
              invoice={inv}
              vendor={getVendor(inv)}
              projects={projects}
              onRefresh={refetch}
              showApproval
            />
          ))}
        </div>
      )}
    </div>
  );
}