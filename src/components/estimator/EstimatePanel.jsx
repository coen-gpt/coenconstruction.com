import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Sparkles, Download, Save, ChevronDown, ChevronRight, Copy, GitBranch } from "lucide-react";
import RichDescriptionInput from "@/components/estimator/RichDescriptionInput";
import { useToast } from "@/components/ui/use-toast";

const COST_TYPES = ["labor", "material", "subcontractor", "allowance", "other"];
const UNITS = ["each", "sq ft", "lin ft", "hr", "day", "ls", "ton", "cy", "bag", "gal"];

function newItem() {
  return {
    id: crypto.randomUUID(),
    parent_group: "",
    subgroup: "",
    title: "",
    description: "",
    quantity: 1,
    unit: "ls",
    unit_cost: 0,
    markup_pct: 20,
    total: 0,
    cost_type: "material",
    is_allowance: false,
    internal_notes: "",
  };
}

function calcTotal(item) {
  const base = (item.quantity || 0) * (item.unit_cost || 0);
  return base * (1 + (item.markup_pct || 0) / 100);
}

export default function EstimatePanel({ projectId, project }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [localItems, setLocalItems] = useState(null);
  const [localNotes, setLocalNotes] = useState("");
  const [localMarkup, setLocalMarkup] = useState(20);
  const [initialized, setInitialized] = useState(false);

  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates", projectId],
    queryFn: () => base44.entities.Estimate.filter({ project_id: projectId }),
  });

  const originalEstimate = estimates.find((e) => e.type === "original" && e.status !== "superseded");
  const changeOrders = estimates.filter((e) => e.type === "change_order");

  // Initialize local state once from fetched estimate
  useEffect(() => {
    if (!initialized && originalEstimate) {
      setLocalItems(originalEstimate.line_items || []);
      setLocalNotes(originalEstimate.notes || "");
      setLocalMarkup(originalEstimate.default_markup_pct || 20);
      setInitialized(true);
    } else if (!initialized && estimates.length > 0) {
      // estimates loaded but no original estimate yet
      setLocalItems([]);
      setInitialized(true);
    }
  }, [originalEstimate, estimates, initialized]);

  const items = localItems ?? [];

  const updateItem = (id, field, val) => {
    setLocalItems((prev) =>
      (prev || []).map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };
        updated.total = calcTotal(updated);
        return updated;
      })
    );
  };

  const addItem = (parentGroup = "") => {
    const item = newItem();
    item.parent_group = parentGroup;
    item.markup_pct = localMarkup;
    setLocalItems((prev) => [...(prev || []), item]);
  };

  const removeItem = (id) => {
    setLocalItems((prev) => (prev || []).filter((i) => i.id !== id));
  };

  const grandTotal = items.reduce((sum, i) => sum + (i.total || 0), 0);

  const groups = items.reduce((acc, item) => {
    const g = item.parent_group || "General";
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  const saveEstimate = async () => {
    setSaving(true);
    const payload = {
      project_id: projectId,
      type: "original",
      status: originalEstimate?.status === "approved" ? "approved" : "draft",
      line_items: items,
      grand_total: grandTotal,
      notes: localNotes,
      default_markup_pct: localMarkup,
    };
    if (originalEstimate) {
      await base44.entities.Estimate.update(originalEstimate.id, payload);
    } else {
      await base44.entities.Estimate.create(payload);
    }
    await base44.entities.ContractorProject.update(projectId, {
      original_estimate_total: grandTotal,
      adjusted_total: grandTotal,
    });
    qc.invalidateQueries(["estimates", projectId]);
    qc.invalidateQueries(["contractor-project", projectId]);
    setSaving(false);
    toast({ title: "Estimate saved" });
  };

  const cloneAsNewProject = async () => {
    setCloning(true);
    try {
      const newProject = await base44.entities.ContractorProject.create({
        client_name: project.client_name,
        client_phone: project.client_phone,
        client_email: project.client_email,
        client_address: project.client_address,
        client_city: project.client_city,
        client_zipcode: project.client_zipcode,
        project_type: project.project_type,
        status: "draft",
        scope_of_work: project.scope_of_work,
        rooms: project.rooms,
      });
      if (items.length > 0) {
        const clonedItems = items.map((i) => ({ ...i, id: crypto.randomUUID() }));
        await base44.entities.Estimate.create({
          project_id: newProject.id,
          type: "original",
          status: "draft",
          line_items: clonedItems,
          grand_total: grandTotal,
          notes: localNotes,
          default_markup_pct: localMarkup,
        });
      }
      toast({ title: "Project cloned!", description: `New project created for ${project.client_name}` });
      window.open(`/estimator/projects/${newProject.id}`, "_blank");
    } catch (err) {
      toast({ title: "Clone failed", description: err.message, variant: "destructive" });
    }
    setCloning(false);
  };

  const createChangeOrder = async () => {
    if (!originalEstimate) {
      toast({ title: "Save the estimate first before creating a change order.", variant: "destructive" });
      return;
    }
    const coNumber = changeOrders.length + 1;
    const co = await base44.entities.Estimate.create({
      project_id: projectId,
      type: "change_order",
      status: "draft",
      title: `Change Order #${coNumber}`,
      change_order_number: coNumber,
      line_items: [],
      grand_total: 0,
      default_markup_pct: localMarkup,
    });
    qc.invalidateQueries(["estimates", projectId]);
    toast({ title: `Change Order #${coNumber} created` });
  };

  const generateAI = async () => {
    setGenerating(true);
    try {
      const response = await base44.functions.invoke("generateEstimate", {
        project_id: projectId,
        scope: project?.scope_of_work,
        project_type: project?.project_type,
        rooms: project?.rooms,
        default_markup: localMarkup,
      });
      if (response.data?.line_items) {
        setLocalItems(
          response.data.line_items.map((i) => ({
            ...i,
            id: i.id || crypto.randomUUID(),
            total: calcTotal(i),
          }))
        );
        toast({ title: "AI estimate generated!", description: `${response.data.line_items.length} line items created.` });
      }
    } catch (err) {
      toast({ title: "AI generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const exportXLSX = async () => {
    const XLSX = await import("xlsx");
    const rows = items.map((i) => ({
      Group: i.parent_group,
      Subgroup: i.subgroup,
      Title: i.title,
      Description: i.description,
      Qty: i.quantity,
      Unit: i.unit,
      "Unit Cost": i.unit_cost,
      "Markup %": i.markup_pct,
      Total: i.total,
      "Cost Type": i.cost_type,
      Notes: i.internal_notes,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estimate");
    XLSX.writeFile(wb, `estimate_${project?.client_name || projectId}.xlsx`);
  };

  const isApproved = originalEstimate?.status === "approved";

  return (
    <div className="space-y-4">
      {isApproved && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-green-800 font-semibold text-sm">✓ This estimate is Approved — editing is locked.</span>
          <Button size="sm" variant="outline" onClick={createChangeOrder} className="gap-1 text-sm border-green-400 text-green-700">
            <GitBranch className="w-3.5 h-3.5" /> Create Change Order
          </Button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={generateAI} disabled={generating || isApproved} className="gap-2 bg-primary text-white text-sm">
            <Sparkles className="w-4 h-4" /> {generating ? "Generating..." : "AI Generate"}
          </Button>
          <Button variant="outline" onClick={() => addItem()} disabled={isApproved} className="gap-1 text-sm">
            <Plus className="w-4 h-4" /> Add Line Item
          </Button>
          <Button variant="outline" onClick={cloneAsNewProject} disabled={cloning} className="gap-1 text-sm">
            <Copy className="w-4 h-4" /> {cloning ? "Cloning..." : "Clone Project"}
          </Button>
          {!isApproved && (
            <Button variant="outline" onClick={createChangeOrder} className="gap-1 text-sm text-purple-600 border-purple-200">
              <GitBranch className="w-4 h-4" /> Change Order
            </Button>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-xs text-gray-500">Markup %</label>
          <Input
            type="number"
            value={localMarkup}
            onChange={(e) => setLocalMarkup(Number(e.target.value))}
            className="w-16 h-8 text-sm text-center"
            disabled={isApproved}
          />
          <Button variant="outline" onClick={exportXLSX} className="gap-1 text-sm">
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button onClick={saveEstimate} disabled={saving || isApproved} className="gap-1 bg-secondary text-white text-sm">
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Grand Total Bar */}
      <div className="bg-secondary text-white rounded-xl px-5 py-3 flex justify-between items-center">
        <span className="font-semibold">Grand Total</span>
        <span className="text-2xl font-bold text-primary">
          ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Line Items by Group */}
      {Object.entries(groups).map(([group, groupItems]) => (
        <div key={group} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setCollapsedGroups((c) => ({ ...c, [group]: !c[group] }))}
            className="w-full flex items-center justify-between px-5 py-3 bg-muted hover:bg-gray-100 transition-colors"
          >
            <span className="font-semibold text-secondary text-sm">{group}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-primary font-medium">
                ${groupItems.reduce((s, i) => s + (i.total || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {collapsedGroups[group] ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>
          {!collapsedGroups[group] && (
            <div className="divide-y divide-gray-100">
              {groupItems.map((item) => (
                <div key={item.id} className="p-4 grid gap-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-400 block mb-1">Title</label>
                      <Input
                        value={item.title}
                        onChange={(e) => updateItem(item.id, "title", e.target.value)}
                        className="h-8 text-sm"
                        placeholder="Line item title"
                        disabled={isApproved}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Subgroup</label>
                      <Input
                        value={item.subgroup}
                        onChange={(e) => updateItem(item.id, "subgroup", e.target.value)}
                        className="h-8 text-sm"
                        placeholder="Subgroup"
                        disabled={isApproved}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Cost Type</label>
                      <Select value={item.cost_type} onValueChange={(v) => updateItem(item.id, "cost_type", v)} disabled={isApproved}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COST_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Description</label>
                    <RichDescriptionInput
                      value={item.description || ""}
                      onChange={(val) => updateItem(item.id, "description", val)}
                      disabled={isApproved}
                    />
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 items-end">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Qty</label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                        className="h-8 text-sm text-center"
                        disabled={isApproved}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Unit</label>
                      <Select value={item.unit} onValueChange={(v) => updateItem(item.id, "unit", v)} disabled={isApproved}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Unit Cost</label>
                      <Input
                        type="number"
                        value={item.unit_cost}
                        onChange={(e) => updateItem(item.id, "unit_cost", Number(e.target.value))}
                        className="h-8 text-sm text-center"
                        disabled={isApproved}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Markup %</label>
                      <Input
                        type="number"
                        value={item.markup_pct}
                        onChange={(e) => updateItem(item.id, "markup_pct", Number(e.target.value))}
                        className="h-8 text-sm text-center"
                        disabled={isApproved}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Total</label>
                      <div className="h-8 flex items-center px-2 bg-muted rounded text-sm font-semibold text-primary">
                        ${(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        className="h-8 w-8 text-red-400 hover:text-red-600"
                        disabled={isApproved}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Internal Notes</label>
                    <Input
                      value={item.internal_notes}
                      onChange={(e) => updateItem(item.id, "internal_notes", e.target.value)}
                      className="h-8 text-sm"
                      placeholder="Internal notes (not shown to client)"
                      disabled={isApproved}
                    />
                  </div>
                </div>
              ))}
              {!isApproved && (
                <div className="px-4 pb-3 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => addItem(group)} className="gap-1 text-xs text-gray-500">
                    <Plus className="w-3 h-3" /> Add to {group}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {items.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="font-medium">No line items yet.</p>
          <p className="text-sm mt-1">Click "AI Generate" or "Add Line Item" to get started.</p>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Estimate Notes</label>
        <Textarea
          rows={3}
          value={localNotes}
          onChange={(e) => setLocalNotes(e.target.value)}
          className="resize-none text-sm"
          placeholder="Terms, conditions, payment schedule..."
          disabled={isApproved}
        />
      </div>

      {changeOrders.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-secondary mb-3">Change Orders ({changeOrders.length})</h3>
          <div className="space-y-2">
            {changeOrders.map((co) => (
              <div key={co.id} className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm">
                <span className="font-medium">{co.title || `CO #${co.change_order_number}`}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    co.status === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {co.status}
                </span>
                <span className="font-semibold text-primary">${(co.grand_total || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}