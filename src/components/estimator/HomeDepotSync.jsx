import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Sparkles, CheckCircle, Building2, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function HomeDepotSync({ projects, onImported }) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [csvText, setCsvText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedReceipts, setParsedReceipts] = useState(null);
  const [saving, setSaving] = useState(false);
  const [projectOverrides, setProjectOverrides] = useState({}); // receiptIndex → projectId

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target.result);
    reader.readAsText(file);
  };

  const handleParse = async () => {
    if (!csvText.trim()) {
      toast({ title: "Paste or upload your HD Pro export first", variant: "destructive" });
      return;
    }
    setParsing(true);
    try {
      const res = await base44.functions.invoke("importHomeDepotPro", { csv_text: csvText });
      const receipts = res.data?.receipts || [];
      setParsedReceipts(receipts);
      // Pre-fill overrides with AI suggestions
      const overrides = {};
      receipts.forEach((r, i) => {
        if (r.suggested_project_id) overrides[i] = r.suggested_project_id;
      });
      setProjectOverrides(overrides);
      toast({ title: `Parsed ${receipts.length} orders`, description: "Review and assign projects below" });
    } catch (err) {
      toast({ title: "Parse failed", description: err.message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const handleSaveAll = async () => {
    if (!parsedReceipts?.length) return;
    setSaving(true);
    let saved = 0;
    try {
      for (let i = 0; i < parsedReceipts.length; i++) {
        const r = parsedReceipts[i];
        const projectId = projectOverrides[i] || r.suggested_project_id || null;
        await base44.entities.PurchaseReceipt.create({
          project_id: projectId || null,
          source: "home_depot_pro",
          vendor_name: "Home Depot",
          receipt_date: r.receipt_date,
          receipt_number: r.receipt_number,
          po_reference: r.po_reference,
          line_items: r.line_items || [],
          subtotal: r.subtotal,
          tax: r.tax,
          grand_total: r.grand_total,
          status: projectId ? "pending_review" : "unmatched",
        });
        saved++;
      }
      toast({ title: `Saved ${saved} receipts!` });
      onImported?.();
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const activeProjects = projects.filter(p =>
    ["in_progress", "approved", "walkthrough", "draft"].includes(p.status)
  );

  return (
    <div className="space-y-4">
      {/* Info card */}
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-orange-800 text-sm">Home Depot Pro Account Import</div>
          <p className="text-xs text-orange-700 mt-1">
            Home Depot Pro doesn't have a direct API. Export your purchase history from <strong>homedepot.com/c/Pro → Order History → Export CSV</strong>, then paste or upload it here. AI will parse each order and auto-match to projects using PO numbers and job addresses.
          </p>
        </div>
      </div>

      {/* Upload / Paste */}
      {!parsedReceipts && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-secondary">Upload Order History</h3>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1 text-xs">
              <Upload className="w-3.5 h-3.5" /> Upload CSV
            </Button>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.txt" className="hidden" onChange={handleFileUpload} />
          </div>
          <Textarea
            rows={6}
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder={`Paste CSV export from HD Pro here, or upload above.\n\nExample format:\nOrder #,Order Date,Item,SKU,Qty,Price\n12345,2024-05-01,2x4x8 Stud,123456,20,$3.98\n...`}
            className="text-xs font-mono resize-none"
          />
          <Button
            onClick={handleParse}
            disabled={parsing || !csvText.trim()}
            className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Sparkles className="w-4 h-4" />
            {parsing ? "Parsing with AI..." : "Parse Orders with AI"}
          </Button>
        </div>
      )}

      {/* Parsed receipts review */}
      {parsedReceipts && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-secondary">{parsedReceipts.length} Orders Found — Assign Projects</h3>
            <Button variant="outline" size="sm" onClick={() => { setParsedReceipts(null); setCsvText(""); }} className="text-xs">
              ← Re-upload
            </Button>
          </div>

          {parsedReceipts.map((r, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-secondary text-sm">Order #{r.receipt_number || i + 1}</div>
                  <div className="text-xs text-gray-500">{r.receipt_date} · {r.line_items?.length || 0} items</div>
                  {r.po_reference && <div className="text-xs text-blue-600 mt-0.5">PO/Ref: {r.po_reference}</div>}
                  {r.match_reason && <div className="text-xs text-green-600 mt-0.5">AI match: {r.match_reason}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-primary text-sm">${(r.grand_total || 0).toFixed(2)}</div>
                  <div className="text-xs text-gray-400">Tax: ${(r.tax || 0).toFixed(2)}</div>
                </div>
              </div>

              {/* Items preview */}
              <div className="bg-gray-50 rounded-xl p-2 max-h-28 overflow-y-auto space-y-0.5">
                {(r.line_items || []).map((item, j) => (
                  <div key={j} className="flex justify-between text-xs py-0.5">
                    <span className="text-gray-700 truncate flex-1">{item.description} <span className="text-gray-400">×{item.quantity}</span></span>
                    <span className="text-gray-600 font-medium ml-2 shrink-0">${(item.total || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Project assignment */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Assign to Project</label>
                <Select
                  value={projectOverrides[i] || "__none__"}
                  onValueChange={v => setProjectOverrides(prev => ({ ...prev, [i]: v === "__none__" ? null : v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select project..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— No project assigned —</SelectItem>
                    {activeProjects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.client_name} — {p.client_address || p.client_city || ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}

          {/* Save all */}
          <Button
            onClick={handleSaveAll}
            disabled={saving}
            className="w-full gap-2 bg-primary text-white py-3"
          >
            <CheckCircle className="w-4 h-4" />
            {saving ? "Saving receipts..." : `Save All ${parsedReceipts.length} Receipts`}
          </Button>
        </div>
      )}
    </div>
  );
}