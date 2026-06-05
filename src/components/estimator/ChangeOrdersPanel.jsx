import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, TrendingUp, Plus, Trash2, Save, Send, ChevronDown, ChevronRight,
  CheckCircle2, Clock, XCircle, PenLine, Mail, DollarSign, AlertTriangle
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const COST_TYPES = ["labor", "material", "subcontractor", "allowance", "other"];
const UNITS = ["each", "sq ft", "lin ft", "hr", "day", "ls", "ton", "cy", "bag", "gal"];

const STATUS_STYLES = {
  draft:    { label: "Draft", cls: "bg-gray-100 text-gray-600", icon: Clock },
  sent:     { label: "Sent – Awaiting Approval", cls: "bg-blue-100 text-blue-700", icon: Mail },
  approved: { label: "Approved", cls: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-700", icon: XCircle },
};

function calcTotal(item) {
  const base = (item.quantity || 0) * (item.unit_cost || 0);
  return base * (1 + (item.markup_pct || 0) / 100);
}

function newItem(markup = 20) {
  return {
    id: crypto.randomUUID(),
    parent_group: "Change",
    title: "",
    description: "",
    quantity: 1,
    unit: "ls",
    unit_cost: 0,
    markup_pct: markup,
    total: 0,
    cost_type: "labor",
  };
}

// ── Single Change Order Editor ────────────────────────────────────────────────
function ChangeOrderEditor({ co, project, onSaved, onSendToClient }) {
  const { toast } = useToast();
  const [items, setItems] = useState(co.line_items || []);
  const [scope, setScope] = useState(co.scope_change_description || "");
  const [notes, setNotes] = useState(co.notes || "");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const isLocked = ["approved", "rejected"].includes(co.status);
  const grandTotal = items.reduce((s, i) => s + (i.total || 0), 0);

  const updateItem = (id, field, val) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: val };
      if (["quantity", "unit_cost", "markup_pct"].includes(field)) {
        updated.total = calcTotal(updated);
      }
      return updated;
    }));
  };

  const addItem = () => setItems(prev => [...prev, newItem(co.default_markup_pct || 20)]);
  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));

  const save = async () => {
    setSaving(true);
    await base44.entities.Estimate.update(co.id, {
      line_items: items,
      grand_total: grandTotal,
      scope_change_description: scope,
      notes,
    });
    toast({ title: `CO #${co.change_order_number} saved` });
    setSaving(false);
    onSaved();
  };

  const sendToClient = async () => {
    setSending(true);
    // Save first
    await base44.entities.Estimate.update(co.id, {
      line_items: items,
      grand_total: grandTotal,
      scope_change_description: scope,
      notes,
      status: "sent",
    });
    // Notify via email
    try {
      await base44.functions.invoke("sendChangeOrderNotification", {
        project_id: project.id,
        change_order_id: co.id,
      });
      toast({ title: "Change order sent to client!", description: "They'll receive a portal link to review and sign." });
    } catch {
      toast({ title: "Saved but email failed", description: "Change order saved. Check email settings.", variant: "destructive" });
    }
    setSending(false);
    onSendToClient();
  };

  return (
    <div className="space-y-4 pt-4 border-t border-gray-100">
      {/* Scope Description */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Scope of Change</label>
        <Textarea
          value={scope}
          onChange={e => setScope(e.target.value)}
          placeholder="Describe what is being added, modified, or removed..."
          className="resize-none text-sm"
          rows={3}
          disabled={isLocked}
        />
      </div>

      {/* Line Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Line Items</label>
          {!isLocked && (
            <Button variant="ghost" size="sm" onClick={addItem} className="gap-1 text-xs text-primary">
              <Plus className="w-3 h-3" /> Add Item
            </Button>
          )}
        </div>

        {items.length === 0 && (
          <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-sm">No line items yet. Add items to this change order.</p>
          </div>
        )}

        {items.map(item => (
          <div key={item.id} className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-200">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Title</label>
                <Input value={item.title} onChange={e => updateItem(item.id, "title", e.target.value)}
                  className="h-8 text-sm" placeholder="Item title" disabled={isLocked} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Cost Type</label>
                <Select value={item.cost_type} onValueChange={v => updateItem(item.id, "cost_type", v)} disabled={isLocked}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COST_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Description</label>
              <Input value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)}
                className="h-8 text-sm" placeholder="Brief description" disabled={isLocked} />
            </div>
            <div className="grid grid-cols-5 gap-2 items-end">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Qty</label>
                <Input type="number" value={item.quantity} onChange={e => updateItem(item.id, "quantity", Number(e.target.value))}
                  className="h-8 text-sm text-center" disabled={isLocked} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Unit</label>
                <Select value={item.unit} onValueChange={v => updateItem(item.id, "unit", v)} disabled={isLocked}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Unit Cost</label>
                <Input type="number" value={item.unit_cost} onChange={e => updateItem(item.id, "unit_cost", Number(e.target.value))}
                  className="h-8 text-sm text-center" disabled={isLocked} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Markup %</label>
                <Input type="number" value={item.markup_pct} onChange={e => updateItem(item.id, "markup_pct", Number(e.target.value))}
                  className="h-8 text-sm text-center" disabled={isLocked} />
              </div>
              <div className="flex items-end gap-1">
                <div className="flex-1 h-8 flex items-center px-2 bg-white border border-gray-200 rounded text-sm font-semibold text-primary">
                  ${(item.total || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                {!isLocked && (
                  <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}
                    className="h-8 w-8 text-red-400 hover:text-red-600 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between bg-secondary text-white rounded-lg px-4 py-3">
        <span className="font-semibold">Change Order Total</span>
        <span className="text-xl font-bold text-primary">${grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Terms / Notes</label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)}
          className="resize-none text-sm" rows={2}
          placeholder="Payment terms, conditions, or client-facing notes..." disabled={isLocked} />
      </div>

      {/* Actions */}
      {!isLocked && (
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={save} disabled={saving} className="gap-1 text-sm">
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save Draft"}
          </Button>
          <Button onClick={sendToClient} disabled={sending || items.length === 0} className="gap-1 bg-primary text-white text-sm">
            <Send className="w-3.5 h-3.5" /> {sending ? "Sending…" : "Send to Client for Approval"}
          </Button>
        </div>
      )}

      {co.status === "sent" && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-blue-700">
          <Mail className="w-4 h-4 shrink-0" />
          Sent to client on {co.updated_date ? new Date(co.updated_date).toLocaleDateString() : "—"}. Awaiting e-signature via client portal.
        </div>
      )}

      {co.status === "approved" && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Approved by client. Signature on file.
        </div>
      )}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function ChangeOrdersPanel({ estimates = [], project }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(null);
  const [creating, setCreating] = useState(false);

  const originals = estimates.filter(e => e.type === "original");
  const changeOrders = estimates.filter(e => e.type === "change_order").sort((a, b) => (a.change_order_number || 0) - (b.change_order_number || 0));

  const approvedCO = changeOrders.filter(e => e.status === "approved").reduce((s, e) => s + (e.grand_total || 0), 0);
  const pendingCO  = changeOrders.filter(e => !["approved", "rejected", "superseded"].includes(e.status)).reduce((s, e) => s + (e.grand_total || 0), 0);
  const originalTotal = project.original_estimate_total || originals[0]?.grand_total || 0;

  const createCO = async () => {
    if (!originals[0]) {
      toast({ title: "No approved estimate found", description: "Save and approve the original estimate first.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const coNumber = changeOrders.length + 1;
    const co = await base44.entities.Estimate.create({
      project_id: project.id,
      type: "change_order",
      status: "draft",
      title: `Change Order #${coNumber}`,
      change_order_number: coNumber,
      line_items: [],
      grand_total: 0,
      default_markup_pct: originals[0]?.default_markup_pct || 20,
    });
    qc.invalidateQueries(["estimates", project.id]);
    setExpanded(co.id);
    setCreating(false);
    toast({ title: `Change Order #${coNumber} created` });
  };

  const deleteCO = async (co) => {
    if (!window.confirm(`Delete ${co.title}? This cannot be undone.`)) return;
    await base44.entities.Estimate.delete(co.id);
    qc.invalidateQueries(["estimates", project.id]);
    if (expanded === co.id) setExpanded(null);
    toast({ title: "Change order deleted" });
  };

  const onSaved = () => qc.invalidateQueries(["estimates", project.id]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase font-bold mb-1">Original Contract</p>
          <p className="text-2xl font-bold text-secondary">${originalTotal.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-green-100 rounded-xl p-4">
          <p className="text-xs text-green-600 uppercase font-bold mb-1">Approved Changes</p>
          <p className="text-2xl font-bold text-green-700">+${approvedCO.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-yellow-100 rounded-xl p-4">
          <p className="text-xs text-yellow-600 uppercase font-bold mb-1">Pending Approval</p>
          <p className="text-2xl font-bold text-yellow-700">${pendingCO.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-primary/20 rounded-xl p-4">
          <p className="text-xs text-primary uppercase font-bold mb-1">Revised Contract Total</p>
          <p className="text-2xl font-bold text-secondary">${(originalTotal + approvedCO).toLocaleString()}</p>
        </div>
      </div>

      {/* Change Orders List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-secondary flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Change Orders ({changeOrders.length})
          </h2>
          <Button size="sm" onClick={createCO} disabled={creating} className="gap-1 bg-primary text-white text-sm">
            <Plus className="w-3.5 h-3.5" /> {creating ? "Creating…" : "New Change Order"}
          </Button>
        </div>

        {changeOrders.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-gray-500">No change orders yet</p>
            <p className="text-sm mt-1">Click "New Change Order" to create a scope or budget adjustment for client approval.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {changeOrders.map(co => {
              const st = STATUS_STYLES[co.status] || STATUS_STYLES.draft;
              const StIcon = st.icon;
              const isOpen = expanded === co.id;
              return (
                <div key={co.id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : co.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-secondary">{co.title || `CO #${co.change_order_number}`}</span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${st.cls}`}>
                          <StIcon className="w-3 h-3" />{st.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{co.scope_change_description || "No scope description yet"}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-lg text-primary">${(co.grand_total || 0).toLocaleString()}</span>
                      {co.status === "draft" && (
                        <button
                          onClick={e => { e.stopPropagation(); deleteCO(co); }}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5">
                      <ChangeOrderEditor
                        co={co}
                        project={project}
                        onSaved={onSaved}
                        onSendToClient={onSaved}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Allowances Tracker */}
      <AllowancesPanel estimates={estimates} />
    </div>
  );
}

function AllowancesPanel({ estimates }) {
  const allowances = estimates.flatMap(e =>
    (e.line_items || [])
      .filter(i => i.is_allowance || i.cost_type === "allowance")
      .map(i => ({ ...i, estimate_title: e.title }))
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="font-bold text-secondary flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-primary" /> Allowances Tracker
      </h2>
      {allowances.length === 0 ? (
        <p className="text-sm text-gray-400">No allowance line items are currently tracked. Add items with cost type "allowance" to the estimate.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {allowances.map((a, idx) => {
            const variance = (a.actual_cost || 0) - (a.total || 0);
            return (
              <div key={`${a.id}-${idx}`} className="py-3 grid md:grid-cols-4 gap-2 text-sm items-center">
                <span className="font-medium text-secondary">{a.title}</span>
                <span className="text-gray-500">{a.estimate_title}</span>
                <span>Allowance: <span className="font-semibold">${(a.total || 0).toLocaleString()}</span></span>
                <span className={`font-semibold flex items-center gap-1 ${variance > 0 ? "text-red-600" : variance < 0 ? "text-green-600" : "text-gray-500"}`}>
                  {variance !== 0 && <AlertTriangle className="w-3.5 h-3.5" />}
                  Variance: ${variance.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}