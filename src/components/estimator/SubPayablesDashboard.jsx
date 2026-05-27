import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  CreditCard, Plus, CheckCircle2, Clock, DollarSign,
  ChevronDown, ChevronUp, Trash2, Edit3, Save, X, FileText, AlertCircle
} from "lucide-react";
import { format } from "date-fns";

const STATUS_CONFIG = {
  pending:  { label: "Pending",  color: "bg-yellow-100 text-yellow-700" },
  approved: { label: "Approved", color: "bg-blue-100 text-blue-700" },
  paid:     { label: "Paid",     color: "bg-green-100 text-green-700" },
};

function PayableRow({ payable, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null); // invoice id
  const [invoiceForm, setInvoiceForm] = useState({});
  const [addingInvoice, setAddingInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ label: "", amount: "", due_date: "", notes: "" });

  const invoices = payable.invoices || [];
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.amount || 0), 0);
  const totalApproved = invoices.filter(i => i.status === "approved").reduce((s, i) => s + (i.amount || 0), 0);
  const remaining = (payable.contract_amount || 0) - totalPaid;
  const pctPaid = payable.contract_amount > 0 ? Math.round((totalPaid / payable.contract_amount) * 100) : 0;

  const updateInvoice = (updatedInvoice) => {
    const updated = invoices.map(i => i.id === updatedInvoice.id ? updatedInvoice : i);
    onUpdate({ invoices: updated });
    setEditingInvoice(null);
  };

  const deleteInvoice = (invoiceId) => {
    onUpdate({ invoices: invoices.filter(i => i.id !== invoiceId) });
  };

  const approveInvoice = (inv) => {
    updateInvoice({ ...inv, status: "approved", approved_date: new Date().toISOString() });
  };

  const markPaid = (inv) => {
    updateInvoice({ ...inv, status: "paid", paid_date: new Date().toISOString() });
  };

  const addInvoice = () => {
    if (!newInvoice.label || !newInvoice.amount) return;
    const inv = {
      id: crypto.randomUUID(),
      ...newInvoice,
      amount: parseFloat(newInvoice.amount),
      status: "pending",
    };
    onUpdate({ invoices: [...invoices, inv] });
    setNewInvoice({ label: "", amount: "", due_date: "", notes: "" });
    setAddingInvoice(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-secondary text-sm">{payable.vendor_company || payable.vendor_name}</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{payable.trade}</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{payable.vendor_email}</div>
        </div>

        {/* Progress */}
        <div className="hidden sm:flex flex-col items-end gap-1 min-w-40">
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(pctPaid, 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-500">
            <span className="font-semibold text-green-600">${totalPaid.toLocaleString()}</span>
            <span className="text-gray-400"> paid of </span>
            <span className="font-semibold text-secondary">${(payable.contract_amount || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xs text-gray-500 mb-0.5">Remaining</div>
          <div className={`text-base font-bold ${remaining <= 0 ? "text-green-600" : "text-secondary"}`}>
            {remaining <= 0 ? "✓ Paid Off" : `$${remaining.toLocaleString()}`}
          </div>
        </div>

        <div className="text-gray-400 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded invoices */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-secondary">${(payable.contract_amount || 0).toLocaleString()}</div>
              <div className="text-xs text-gray-500">Contract Total</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-green-600">${totalPaid.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Total Paid</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-yellow-600">${remaining.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Remaining</div>
            </div>
          </div>

          {invoices.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-3">No payment entries yet. Add one below.</p>
          )}

          {/* Invoice rows */}
          {invoices.map(inv => {
            const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
            const isEditing = editingInvoice === inv.id;

            if (isEditing) {
              return (
                <div key={inv.id} className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Label</label>
                      <Input value={invoiceForm.label || ""} onChange={e => setInvoiceForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Deposit, Rough-In" className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Amount</label>
                      <Input type="number" value={invoiceForm.amount || ""} onChange={e => setInvoiceForm(f => ({ ...f, amount: parseFloat(e.target.value) }))} className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Due Date</label>
                      <Input type="date" value={invoiceForm.due_date || ""} onChange={e => setInvoiceForm(f => ({ ...f, due_date: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Notes</label>
                      <Input value={invoiceForm.notes || ""} onChange={e => setInvoiceForm(f => ({ ...f, notes: e.target.value }))} className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditingInvoice(null)}><X className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" onClick={() => updateInvoice(invoiceForm)} className="bg-primary text-white gap-1"><Save className="w-3.5 h-3.5" /> Save</Button>
                  </div>
                </div>
              );
            }

            return (
              <div key={inv.id} className="flex items-center gap-3 flex-wrap bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-40">
                  <div className="font-semibold text-sm text-secondary">{inv.label}</div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {inv.due_date && <span className="text-xs text-gray-400">Due: {inv.due_date}</span>}
                    {inv.approved_date && <span className="text-xs text-blue-600">Approved: {format(new Date(inv.approved_date), "MMM d")}</span>}
                    {inv.paid_date && <span className="text-xs text-green-600">Paid: {format(new Date(inv.paid_date), "MMM d")}</span>}
                    {inv.notes && <span className="text-xs text-gray-400 italic">{inv.notes}</span>}
                  </div>
                </div>

                <div className="font-bold text-secondary text-base shrink-0">
                  ${(inv.amount || 0).toLocaleString()}
                </div>

                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${cfg.color}`}>{cfg.label}</span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {inv.invoice_url && (
                    <a href={inv.invoice_url} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><FileText className="w-3 h-3" /> PDF</Button>
                    </a>
                  )}
                  {inv.status === "pending" && (
                    <Button size="sm" onClick={() => approveInvoice(inv)} className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white">
                      <CheckCircle2 className="w-3 h-3" /> Approve
                    </Button>
                  )}
                  {inv.status === "approved" && (
                    <Button size="sm" onClick={() => markPaid(inv)} className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white">
                      <DollarSign className="w-3 h-3" /> Mark Paid
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setInvoiceForm({ ...inv }); setEditingInvoice(inv.id); }} className="h-7 w-7 p-0 text-gray-400 hover:text-primary">
                    <Edit3 className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteInvoice(inv.id)} className="h-7 w-7 p-0 text-gray-300 hover:text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Add invoice row */}
          {addingInvoice ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-green-800">New Payment Entry</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Label *</label>
                  <Input value={newInvoice.label} onChange={e => setNewInvoice(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Deposit, Rough-In, Final" className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Amount *</label>
                  <Input type="number" value={newInvoice.amount} onChange={e => setNewInvoice(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Due Date</label>
                  <Input type="date" value={newInvoice.due_date} onChange={e => setNewInvoice(f => ({ ...f, due_date: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Notes</label>
                  <Input value={newInvoice.notes} onChange={e => setNewInvoice(f => ({ ...f, notes: e.target.value }))} placeholder="Optional note" className="h-8 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setAddingInvoice(false)}>Cancel</Button>
                <Button size="sm" onClick={addInvoice} disabled={!newInvoice.label || !newInvoice.amount} className="bg-primary text-white gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Entry
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAddingInvoice(true)} className="gap-1.5 w-full">
              <Plus className="w-3.5 h-3.5" /> Add Payment Entry
            </Button>
          )}

          {payable.notes && (
            <p className="text-xs text-gray-500 italic pt-1 border-t border-gray-100">{payable.notes}</p>
          )}

          <div className="flex justify-end pt-1">
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-xs text-gray-300 hover:text-red-400 gap-1">
              <Trash2 className="w-3 h-3" /> Remove Payable
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SubPayablesDashboard({ project }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ vendor_company: "", vendor_name: "", vendor_email: "", trade: "", contract_amount: "", notes: "" });

  const { data: payables = [] } = useQuery({
    queryKey: ["sub-payables", project.id],
    queryFn: () => base44.entities.SubPayable.filter({ project_id: project.id }, "-created_date"),
  });

  // Load selected sub bids to pre-fill
  const { data: subBids = [] } = useQuery({
    queryKey: ["sub-bids", project.id],
    queryFn: () => base44.entities.SubBid.filter({ project_id: project.id }, "-created_date"),
  });

  const selectedBids = subBids.filter(b => b.status === "selected");
  const existingSubBidIds = new Set(payables.map(p => p.sub_bid_id).filter(Boolean));
  const unlinkedBids = selectedBids.filter(b => !existingSubBidIds.has(b.id));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SubPayable.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sub-payables", project.id] });
      setAddOpen(false);
      setForm({ vendor_company: "", vendor_name: "", vendor_email: "", trade: "", contract_amount: "", notes: "" });
      toast({ title: "Payable added!" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SubPayable.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sub-payables", project.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SubPayable.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sub-payables", project.id] }),
  });

  // Aggregate stats
  const totalContract = payables.reduce((s, p) => s + (p.contract_amount || 0), 0);
  const totalPaid = payables.reduce((s, p) =>
    s + (p.invoices || []).filter(i => i.status === "paid").reduce((ss, i) => ss + (i.amount || 0), 0), 0);
  const totalApproved = payables.reduce((s, p) =>
    s + (p.invoices || []).filter(i => i.status === "approved").reduce((ss, i) => ss + (i.amount || 0), 0), 0);
  const totalPending = payables.reduce((s, p) =>
    s + (p.invoices || []).filter(i => i.status === "pending").reduce((ss, i) => ss + (i.amount || 0), 0), 0);

  const prefillFromBid = (bid) => {
    setForm({
      vendor_company: bid.vendor_company || "",
      vendor_name: bid.vendor_name || "",
      vendor_email: bid.vendor_email || "",
      trade: bid.trade || "",
      contract_amount: String(bid.bid_amount || ""),
      notes: "",
      sub_bid_id: bid.id,
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-secondary">Sub Payables</h3>
          {payables.length > 0 && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{payables.length}</span>}
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm" className="gap-2 bg-primary text-white">
          <Plus className="w-3.5 h-3.5" /> Add Payable
        </Button>
      </div>

      {/* Auto-import banner for unlinked selected bids */}
      {unlinkedBids.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800">{unlinkedBids.length} selected sub{unlinkedBids.length !== 1 ? "s" : ""} not yet tracked</p>
            <p className="text-xs text-blue-600 mt-0.5 mb-3">Import them to start tracking payments against accepted bids.</p>
            <div className="flex flex-wrap gap-2">
              {unlinkedBids.map(bid => (
                <Button key={bid.id} size="sm" variant="outline" onClick={() => {
                  createMutation.mutate({
                    project_id: project.id,
                    sub_bid_id: bid.id,
                    vendor_company: bid.vendor_company || "",
                    vendor_name: bid.vendor_name || "",
                    vendor_email: bid.vendor_email || "",
                    trade: bid.trade,
                    contract_amount: bid.bid_amount || 0,
                    invoices: [],
                  });
                }} className="text-xs gap-1 h-7 bg-white">
                  <Plus className="w-3 h-3" /> {bid.vendor_company || bid.vendor_name} ({bid.trade})
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {payables.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Contract", value: totalContract, color: "text-secondary" },
            { label: "Paid", value: totalPaid, color: "text-green-600" },
            { label: "Approved", value: totalApproved, color: "text-blue-600" },
            { label: "Remaining", value: totalContract - totalPaid, color: "text-yellow-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className={`text-xl font-bold ${color}`}>${value.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {payables.length === 0 && unlinkedBids.length === 0 && (
        <div className="text-center py-12 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-400">
          <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No payables tracked yet</p>
          <p className="text-xs mt-1">Select subcontractor winners in the Sub Bids tab, then import them here to track payments.</p>
        </div>
      )}

      {/* Payable rows */}
      {payables.map(p => (
        <PayableRow
          key={p.id}
          payable={p}
          onUpdate={(data) => updateMutation.mutate({ id: p.id, data })}
          onDelete={() => deleteMutation.mutate(p.id)}
        />
      ))}

      {/* Add Payable Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Sub Payable</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            {selectedBids.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Quick-Fill from Selected Bids</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  defaultValue=""
                  onChange={e => {
                    const bid = selectedBids.find(b => b.id === e.target.value);
                    if (bid) prefillFromBid(bid);
                  }}
                >
                  <option value="">Choose a selected bid…</option>
                  {selectedBids.map(b => <option key={b.id} value={b.id}>{b.vendor_company || b.vendor_name} — {b.trade} (${(b.bid_amount || 0).toLocaleString()})</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Company</label>
                <Input value={form.vendor_company} onChange={e => setForm(f => ({ ...f, vendor_company: e.target.value }))} placeholder="ABC Electric" className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Trade *</label>
                <Input value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} placeholder="Electrical" className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Contact Name</label>
                <Input value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Email</label>
                <Input type="email" value={form.vendor_email} onChange={e => setForm(f => ({ ...f, vendor_email: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Contract Amount *</label>
              <Input type="number" value={form.contract_amount} onChange={e => setForm(f => ({ ...f, contract_amount: e.target.value }))} placeholder="0" className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Notes</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" className="h-8 text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate({ ...form, project_id: project.id, contract_amount: parseFloat(form.contract_amount) || 0, invoices: [] })}
                disabled={!form.trade || !form.contract_amount || createMutation.isPending}
                className="bg-primary text-white"
              >
                {createMutation.isPending ? "Adding..." : "Add Payable"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}