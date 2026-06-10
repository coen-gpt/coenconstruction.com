import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Download, Mail, Copy, Package, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import VendorEmailDialog from "@/components/estimator/VendorEmailDialog";

const GROUP_MODES = ["by_trade", "by_line_item"];

export default function MaterialTakeoffPanel({ projectId, project }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [groupMode, setGroupMode] = useState("by_trade");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [emailOpen, setEmailOpen] = useState(false);

  const { data: mtos = [] } = useQuery({
    queryKey: ["mto", projectId],
    queryFn: () => base44.entities.MaterialTakeoff.filter({ project_id: projectId }),
  });

  const mto = mtos[0];
  const items = mto?.items || [];
  const total = mto?.total_estimated_cost || items.reduce((s, i) => s + (i.total_cost || 0), 0);

  const generateMTO = async () => {
    setGenerating(true);
    try {
      const { data: estimates } = await base44.entities.Estimate.filter({ project_id: projectId });
      const estimate = estimates?.find((e) => e.type === "original");
      const res = await base44.functions.invoke("generateMTO", {
        project_id: projectId,
        scope: project?.scope_of_work,
        project_type: project?.project_type,
        rooms: project?.rooms,
        estimate_line_items: estimate?.line_items || [],
      });
      if (res.data?.items) {
        const payload = {
          project_id: projectId,
          estimate_id: estimate?.id,
          items: res.data.items,
          total_estimated_cost: res.data.total,
          generated_by_ai: true,
          title: `MTO — ${project?.client_name}`,
        };
        if (mto) {
          await base44.entities.MaterialTakeoff.update(mto.id, payload);
        } else {
          await base44.entities.MaterialTakeoff.create(payload);
        }
        qc.invalidateQueries({ queryKey: ["mto", projectId] });
        toast({ title: "Material Take-Off generated!", description: `${res.data.items.length} materials listed.` });
      }
    } catch (err) {
      toast({ title: "MTO generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    const text = items.map((i) => `${i.material_name}\t${i.quantity} ${i.unit}\t$${i.unit_cost}\t$${i.total_cost}\t${i.suggested_supplier}`).join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const exportXLSX = async () => {
    const XLSX = await import("xlsx");
    const rows = items.map((i) => ({
      Trade: i.trade,
      "Line Item Ref": i.line_item_ref,
      Material: i.material_name,
      Description: i.description,
      Qty: i.quantity,
      Unit: i.unit,
      "Unit Cost": i.unit_cost,
      "Total Cost": i.total_cost,
      Supplier: i.suggested_supplier,
      SKU: i.sku,
      Notes: i.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Material Take-Off");
    XLSX.writeFile(wb, `mto_${project?.client_name || projectId}.xlsx`);
  };

  // Group items
  const grouped = items.reduce((acc, item) => {
    const key = groupMode === "by_trade" ? (item.trade || "General") : (item.line_item_ref || "General");
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex gap-2">
          <Button onClick={generateMTO} disabled={generating} className="gap-2 bg-primary text-white text-sm">
            <Sparkles className="w-4 h-4" /> {generating ? "Generating..." : "AI Generate MTO"}
          </Button>
          <Select value={groupMode} onValueChange={setGroupMode}>
            <SelectTrigger className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="by_trade">Group by Trade</SelectItem>
              <SelectItem value="by_line_item">Group by Line Item</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyToClipboard} className="gap-1 text-sm">
            <Copy className="w-4 h-4" /> Copy
          </Button>
          <Button variant="outline" onClick={exportXLSX} className="gap-1 text-sm">
            <Download className="w-4 h-4" /> Export XLSX
          </Button>
          <Button onClick={() => setEmailOpen(true)} disabled={items.length === 0} className="gap-1 bg-secondary text-white text-sm">
            <Mail className="w-4 h-4" /> Email to Vendors
          </Button>
        </div>
      </div>

      {/* Total */}
      {items.length > 0 && (
        <div className="bg-secondary text-white rounded-xl px-5 py-3 flex justify-between items-center">
          <span className="font-semibold">Estimated Material Cost</span>
          <span className="text-2xl font-bold text-primary">${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      )}

      {/* Grouped Items */}
      {Object.entries(grouped).map(([group, groupItems]) => (
        <div key={group} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setCollapsedGroups((c) => ({ ...c, [group]: !c[group] }))}
            className="w-full flex items-center justify-between px-5 py-3 bg-muted hover:bg-gray-100 transition-colors"
          >
            <span className="font-semibold text-secondary text-sm">{group}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-primary font-medium">
                ${groupItems.reduce((s, i) => s + (i.total_cost || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {collapsedGroups[group] ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>
          {!collapsedGroups[group] && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Material</th>
                    <th className="text-left px-4 py-2">Description</th>
                    <th className="text-right px-4 py-2">Qty</th>
                    <th className="text-left px-4 py-2">Unit</th>
                    <th className="text-right px-4 py-2">Unit Cost</th>
                    <th className="text-right px-4 py-2">Total</th>
                    <th className="text-left px-4 py-2">Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupItems.map((item, i) => (
                    <tr key={item.id || i} className="hover:bg-muted/50">
                      <td className="px-4 py-2 font-medium text-secondary">{item.material_name}</td>
                      <td className="px-4 py-2 text-gray-500 max-w-xs truncate">{item.description}</td>
                      <td className="px-4 py-2 text-right">{item.quantity}</td>
                      <td className="px-4 py-2 text-gray-500">{item.unit}</td>
                      <td className="px-4 py-2 text-right">${(item.unit_cost || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-primary">${(item.total_cost || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{item.suggested_supplier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {items.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No material take-off yet.</p>
          <p className="text-sm mt-1">Generate an estimate first, then click "AI Generate MTO".</p>
        </div>
      )}

      <VendorEmailDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        mtoItems={items}
        project={project}
        total={total}
        groupMode={groupMode}
      />
    </div>
  );
}