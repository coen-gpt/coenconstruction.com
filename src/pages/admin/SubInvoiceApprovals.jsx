import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckCircle2, DollarSign, FileText, AlertCircle,
  ChevronDown, ChevronUp, Building2, Loader2, Clock, Filter
} from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS = {
  pending:  "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-blue-100 text-blue-800 border-blue-200",
  paid:     "bg-green-100 text-green-800 border-green-200",
};

// Flatten all pending invoices across all SubPayables + enrich with project info
function usePendingInvoices() {
  const { data: payables = [], isLoading: loadingP } = useQuery({
    queryKey: ["all-sub-payables"],
    queryFn: () => base44.entities.SubPayable.list("-created_date", 500),
  });
  const { data: projects = [], isLoading: loadingPr } = useQuery({
    queryKey: ["projects-for-approvals"],
    queryFn: () => base44.entities.ContractorProject.list("-created_date", 500),
  });

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  // Build flat list: one entry per invoice that is pending or approved
  const rows = [];
  for (const payable of payables) {
    for (const inv of (payable.invoices || [])) {
      if (inv.status === "pending" || inv.status === "approved") {
        rows.push({
          payableId: payable.id,
          payable,
          inv,
          project: projectMap[payable.project_id] || null,
        });
      }
    }
  }

  return { rows, isLoading: loadingP || loadingPr };
}

export default function SubInvoiceApprovals() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { rows, isLoading } = usePendingInvoices();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [signOffNotes, setSignOffNotes] = useState({}); // invoiceId -> notes
  const [saving, setSaving] = useState(null); // invoiceId being saved
  const [expanded, setExpanded] = useState({}); // invoiceId -> bool

  const filtered = rows.filter(r => statusFilter === "all" || r.inv.status === statusFilter);

  const pendingCount = rows.filter(r => r.inv.status === "pending").length;
  const approvedCount = rows.filter(r => r.inv.status === "approved").length;
  const pendingTotal = rows.filter(r => r.inv.status === "pending").reduce((s, r) => s + (r.inv.amount || 0), 0);
  const approvedTotal = rows.filter(r => r.inv.status === "approved").reduce((s, r) => s + (r.inv.amount || 0), 0);

  const updateInvoiceStatus = async (row, newStatus) => {
    const { payable, inv } = row;
    setSaving(inv.id);
    const now = new Date().toISOString();
    const notes = signOffNotes[inv.id] || "";

    const updatedInvoices = (payable.invoices || []).map(i => {
      if (i.id !== inv.id) return i;
      return {
        ...i,
        status: newStatus,
        ...(newStatus === "approved" ? { approved_date: now, approval_notes: notes } : {}),
        ...(newStatus === "paid" ? { paid_date: now } : {}),
      };
    });

    await base44.entities.SubPayable.update(payable.id, { invoices: updatedInvoices });
    qc.invalidateQueries({ queryKey: ["all-sub-payables"] });

    toast({
      title: newStatus === "approved" ? "✅ Invoice Approved" : "💰 Marked as Paid",
      description: `${payable.vendor_company || payable.vendor_name} — ${inv.label} ($${(inv.amount || 0).toLocaleString()})`,
    });

    setSaving(null);
    // Clear notes for this invoice
    setSignOffNotes(prev => { const n = { ...prev }; delete n[inv.id]; return n; });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-secondary">Sub Invoice Approvals</h1>
        <p className="text-gray-500 text-sm mt-1">Review and sign off on subcontractor payment milestones across all projects.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-yellow-500" /><span className="text-xs font-bold text-gray-400 uppercase">Pending</span></div>
          <div className="text-2xl font-bold text-secondary">{pendingCount}</div>
          <div className="text-xs text-gray-400">${pendingTotal.toLocaleString()} total</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-blue-500" /><span className="text-xs font-bold text-gray-400 uppercase">Approved</span></div>
          <div className="text-2xl font-bold text-secondary">{approvedCount}</div>
          <div className="text-xs text-gray-400">${approvedTotal.toLocaleString()} total</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 col-span-2">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-primary" /><span className="text-xs font-bold text-gray-400 uppercase">Pending Value</span></div>
          <div className="text-2xl font-bold text-primary">${pendingTotal.toLocaleString()}</div>
          <div className="text-xs text-gray-400">awaiting your approval</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          ["pending", `Needs Approval (${pendingCount})`],
          ["approved", `Approved — Awaiting Payment (${approvedCount})`],
          ["all", "All"],
        ].map(([val, label]) => (
          <button key={val} onClick={() => setStatusFilter(val)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              statusFilter === val ? "bg-secondary text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-16 text-center text-gray-400">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="font-semibold">
            {statusFilter === "pending" ? "No invoices pending approval — all caught up!" : "No invoices in this status."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ payable, inv, project }) => {
            const isExpanded = expanded[inv.id];
            const isSaving = saving === inv.id;
            return (
              <div key={inv.id}
                className={`bg-white border rounded-xl overflow-hidden transition-shadow hover:shadow-md ${
                  inv.status === "pending" ? "border-yellow-200" : "border-blue-200"
                }`}>
                {/* Row header */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                  onClick={() => setExpanded(e => ({ ...e, [inv.id]: !e[inv.id] }))}
                >
                  {/* Vendor info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-bold text-secondary text-sm">{payable.vendor_company || payable.vendor_name}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{payable.trade}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${STATUS_COLORS[inv.status]}`}>
                        {inv.status === "pending" ? "Needs Approval" : "Approved"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {project ? `📍 ${project.client_name}${project.client_address ? ` — ${project.client_address}` : ""}` : payable.vendor_email}
                    </div>
                    {inv.due_date && (
                      <div className="text-xs text-gray-400 mt-0.5">Due: {inv.due_date}</div>
                    )}
                  </div>

                  {/* Invoice label + amount */}
                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-400 mb-0.5">{inv.label}</div>
                    <div className="text-xl font-bold text-secondary">${(inv.amount || 0).toLocaleString()}</div>
                  </div>

                  <div className="text-gray-400 shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expanded sign-off panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-4">
                    {/* Invoice details */}
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <div className="text-xs text-gray-400 mb-0.5">Sub / Company</div>
                        <div className="font-semibold text-sm text-secondary">{payable.vendor_company || payable.vendor_name}</div>
                        <div className="text-xs text-gray-400">{payable.vendor_email}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <div className="text-xs text-gray-400 mb-0.5">Contract Total</div>
                        <div className="font-bold text-secondary">${(payable.contract_amount || 0).toLocaleString()}</div>
                        <div className="text-xs text-gray-400">{payable.trade}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <div className="text-xs text-gray-400 mb-0.5">Payment Stage</div>
                        <div className="font-bold text-secondary">{inv.label}</div>
                        <div className="text-xs text-gray-400">
                          {Math.round(((inv.amount || 0) / (payable.contract_amount || 1)) * 100)}% of contract
                        </div>
                      </div>
                    </div>

                    {/* Progress context */}
                    <div>
                      <div className="text-xs text-gray-400 mb-1.5">Payment Progress</div>
                      <div className="space-y-1.5">
                        {(payable.invoices || []).map(i => (
                          <div key={i.id} className={`flex items-center gap-3 text-xs px-3 py-2 rounded-lg ${i.id === inv.id ? "bg-yellow-50 border border-yellow-200" : "bg-white border border-gray-100"}`}>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${i.status === "paid" ? "bg-green-500" : i.status === "approved" ? "bg-blue-500" : "bg-gray-300"}`} />
                            <span className="flex-1 font-medium text-gray-700">{i.label}</span>
                            <span className="font-bold text-secondary">${(i.amount || 0).toLocaleString()}</span>
                            <span className={`px-1.5 py-0.5 rounded font-semibold capitalize ${
                              i.status === "paid" ? "bg-green-100 text-green-700" : i.status === "approved" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                            }`}>{i.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Invoice PDF link */}
                    {inv.invoice_url && (
                      <a href={inv.invoice_url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium">
                        <FileText className="w-3.5 h-3.5" /> View Invoice PDF
                      </a>
                    )}

                    {inv.notes && (
                      <div className="text-xs text-gray-500 italic bg-white border border-gray-100 rounded-lg px-3 py-2">{inv.notes}</div>
                    )}

                    {/* Sign-off section */}
                    {inv.status === "pending" && (
                      <div className="space-y-3 pt-2 border-t border-gray-200">
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Approval Notes (optional)</label>
                          <Textarea
                            value={signOffNotes[inv.id] || ""}
                            onChange={e => setSignOffNotes(prev => ({ ...prev, [inv.id]: e.target.value }))}
                            placeholder="Add sign-off notes, conditions, or context..."
                            className="resize-none text-sm bg-white"
                            rows={2}
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={e => { e.stopPropagation(); updateInvoiceStatus({ payable, inv, project }, "approved"); }}
                            disabled={isSaving}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2"
                          >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Approve Invoice
                          </Button>
                        </div>
                        <p className="text-xs text-gray-400 text-center">
                          Approving triggers the payment cycle for this milestone.
                        </p>
                      </div>
                    )}

                    {inv.status === "approved" && (
                      <div className="space-y-2 pt-2 border-t border-gray-200">
                        {inv.approved_date && (
                          <div className="text-xs text-blue-600 font-medium">
                            ✅ Approved {format(new Date(inv.approved_date), "MMM d, yyyy 'at' h:mm a")}
                            {inv.approval_notes && <span className="text-gray-500 font-normal"> · "{inv.approval_notes}"</span>}
                          </div>
                        )}
                        <Button
                          onClick={e => { e.stopPropagation(); updateInvoiceStatus({ payable, inv, project }, "paid"); }}
                          disabled={isSaving}
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold gap-2"
                        >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                          Mark as Paid
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}