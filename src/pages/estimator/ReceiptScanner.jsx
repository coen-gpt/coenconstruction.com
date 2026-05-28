import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, Sparkles, CheckCircle, Search, Package, ChevronDown, ChevronUp, Trash2, ShoppingCart, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import HomeDepotSync from "@/components/estimator/HomeDepotSync";

const STATUS_COLORS = {
  pending_review: "bg-yellow-100 text-yellow-800",
  reconciled: "bg-green-100 text-green-800",
  unmatched: "bg-red-100 text-red-700",
  approved: "bg-blue-100 text-blue-800",
};

const MATCH_COLORS = {
  high: "text-green-600",
  medium: "text-yellow-600",
  low: "text-orange-500",
  none: "text-gray-400",
};

export default function ReceiptScanner() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [tab, setTab] = useState("scan"); // scan | history | homedepot
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [extracted, setExtracted] = useState(null); // AI-extracted receipt data
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [expandedReceipt, setExpandedReceipt] = useState(null);
  const [projectSearch, setProjectSearch] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["contractor-projects"],
    queryFn: () => base44.entities.ContractorProject.list("-created_date", 200),
  });

  const { data: receipts = [], isLoading: loadingReceipts } = useQuery({
    queryKey: ["purchase-receipts"],
    queryFn: () => base44.entities.PurchaseReceipt.list("-created_date", 100),
  });

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => base44.auth.me(),
  });

  const filteredProjects = projects.filter(p =>
    !projectSearch || [p.client_name, p.client_address, p.client_city, p.project_type]
      .join(" ").toLowerCase().includes(projectSearch.toLowerCase())
  );

  const activeProjects = filteredProjects.filter(p =>
    ["in_progress", "approved", "walkthrough", "draft"].includes(p.status)
  );

  // Upload image and scan
  const handleImageCapture = async (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setExtracted(null);
    setSelectedProjectId("");

    setScanning(true);
    try {
      // Upload image first
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      // Call AI scan
      const res = await base44.functions.invoke("scanReceipt", { image_url: file_url });
      const data = res.data;
      setExtracted({ ...data, image_url: file_url });
      toast({ title: "Receipt scanned!", description: `Found ${data.line_items?.length || 0} line items` });
    } catch (err) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  // Match extracted items against project estimate
  const reconcileWithEstimate = async () => {
    if (!selectedProjectId || !extracted) return;
    const estimates = await base44.entities.Estimate.filter({ project_id: selectedProjectId });
    const estimate = estimates.find(e => e.type === "original" && e.status !== "superseded");
    if (!estimate?.line_items?.length) return;

    const updatedItems = extracted.line_items.map(ri => {
      const desc = ri.description?.toLowerCase() || "";
      const match = estimate.line_items.find(ei => {
        const title = (ei.title + " " + ei.description).toLowerCase();
        const words = desc.split(" ").filter(w => w.length > 3);
        const hits = words.filter(w => title.includes(w));
        return hits.length >= Math.max(1, Math.floor(words.length * 0.4));
      });
      if (match) {
        return { ...ri, matched_estimate_item_id: match.id, match_confidence: "medium" };
      }
      return { ...ri, match_confidence: "none" };
    });

    setExtracted(prev => ({ ...prev, line_items: updatedItems }));
    toast({ title: "Reconciled with estimate", description: `Matched ${updatedItems.filter(i => i.match_confidence !== "none").length} of ${updatedItems.length} items` });
  };

  const saveReceipt = async () => {
    if (!extracted) return;
    if (!selectedProjectId) {
      toast({ title: "Please select a project", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.PurchaseReceipt.create({
        ...extracted,
        project_id: selectedProjectId,
        source: "camera_scan",
        status: extracted.line_items?.some(i => i.match_confidence !== "none") ? "reconciled" : "pending_review",
        submitted_by_email: currentUser?.email,
        submitted_by_name: currentUser?.full_name,
      });
      qc.invalidateQueries(["purchase-receipts"]);
      toast({ title: "Receipt saved!" });
      setExtracted(null);
      setPreviewUrl(null);
      setSelectedProjectId("");
      setTab("history");
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteReceipt = async (id) => {
    await base44.entities.PurchaseReceipt.delete(id);
    qc.invalidateQueries(["purchase-receipts"]);
    toast({ title: "Receipt deleted" });
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-secondary">Receipt Scanner</h1>
        <p className="text-xs text-gray-500">Scan material receipts · track purchases by project</p>
        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {[
            { key: "scan", label: "📷 Scan Receipt" },
            { key: "history", label: `📋 History (${receipts.length})` },
            { key: "homedepot", label: "🏠 Home Depot Pro" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t.key ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

        {/* ── SCAN TAB ── */}
        {tab === "scan" && (
          <>
            {/* Capture Buttons */}
            {!extracted && !scanning && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                  <Camera className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-secondary">Scan a Receipt</h2>
                  <p className="text-sm text-gray-500 mt-1">Take a photo or upload an image of any material receipt. AI will extract all line items automatically.</p>
                </div>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button
                    className="gap-2 bg-primary text-white"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="w-4 h-4" /> Take Photo
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" /> Upload Image
                  </Button>
                </div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => handleImageCapture(e.target.files[0])}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handleImageCapture(e.target.files[0])}
                />
              </div>
            )}

            {/* Scanning state */}
            {scanning && (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                {previewUrl && <img src={previewUrl} alt="Receipt" className="max-h-48 object-contain mx-auto rounded-xl mb-4 shadow" />}
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                  <span className="font-semibold">Extracting line items with AI...</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">This takes a few seconds</p>
              </div>
            )}

            {/* Extracted Receipt */}
            {extracted && !scanning && (
              <div className="space-y-4">
                {/* Receipt preview + header */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-start gap-3">
                    {previewUrl && (
                      <img src={previewUrl} alt="Receipt" className="w-20 h-20 object-cover rounded-xl border border-gray-200 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-secondary text-base">{extracted.vendor_name || "Unknown Vendor"}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {extracted.receipt_date || "Date unknown"} {extracted.receipt_number ? `· #${extracted.receipt_number}` : ""}
                      </div>
                      {extracted.po_reference && (
                        <div className="text-xs text-blue-600 mt-0.5">PO/Ref: {extracted.po_reference}</div>
                      )}
                      <div className="mt-2 flex gap-3 text-sm">
                        <span className="text-gray-500">Subtotal: <b>${(extracted.subtotal || 0).toFixed(2)}</b></span>
                        <span className="text-gray-500">Tax: <b>${(extracted.tax || 0).toFixed(2)}</b></span>
                        <span className="text-primary font-bold">Total: ${(extracted.grand_total || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <button onClick={() => { setExtracted(null); setPreviewUrl(null); }} className="text-gray-400 hover:text-gray-600 shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Line Items */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-secondary text-sm">Line Items ({extracted.line_items?.length || 0})</h3>
                    <Badge variant="outline" className="text-xs">{extracted.line_items?.filter(i => i.match_confidence !== "none").length || 0} matched</Badge>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {(extracted.line_items || []).map((item, idx) => (
                      <div key={item.id || idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-secondary truncate">{item.description}</div>
                          <div className="flex gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
                            {item.sku && <span>SKU: {item.sku}</span>}
                            <span>Qty: {item.quantity}</span>
                            <span>@ ${(item.unit_price || 0).toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-secondary">${(item.total || 0).toFixed(2)}</div>
                          {item.match_confidence !== "none" && (
                            <div className={`text-xs font-medium ${MATCH_COLORS[item.match_confidence]}`}>
                              ✓ matched
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Project Assignment */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-secondary text-sm mb-3">Assign to Project *</h3>
                  <Input
                    placeholder="Search projects by name, address..."
                    value={projectSearch}
                    onChange={e => setProjectSearch(e.target.value)}
                    className="mb-2 h-9 text-sm"
                  />
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {activeProjects.map(p => (
                      <label
                        key={p.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedProjectId === p.id ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}
                      >
                        <input
                          type="radio"
                          name="project"
                          value={p.id}
                          checked={selectedProjectId === p.id}
                          onChange={() => setSelectedProjectId(p.id)}
                          className="mt-0.5 accent-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-secondary text-sm">{p.client_name}</div>
                          <div className="text-xs text-gray-500 truncate">{p.client_address}{p.client_city ? `, ${p.client_city}` : ""}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${p.status === "in_progress" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                          {p.status?.replace("_", " ")}
                        </span>
                      </label>
                    ))}
                    {activeProjects.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-3">No matching projects</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  {selectedProjectId && (
                    <Button variant="outline" onClick={reconcileWithEstimate} className="gap-1 flex-1 text-sm">
                      <Search className="w-4 h-4" /> Reconcile with Estimate
                    </Button>
                  )}
                  <Button
                    onClick={saveReceipt}
                    disabled={saving || !selectedProjectId}
                    className="gap-2 bg-primary text-white flex-1 text-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {saving ? "Saving..." : "Save Receipt"}
                  </Button>
                </div>

                {/* Notes */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Notes</label>
                  <Textarea
                    rows={2}
                    value={extracted.notes || ""}
                    onChange={e => setExtracted(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any notes about this purchase..."
                    className="resize-none text-sm"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <div className="space-y-3">
            {loadingReceipts ? (
              <div className="text-center py-12 text-gray-400">Loading receipts...</div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-500">No receipts yet</p>
                <p className="text-sm text-gray-400 mt-1">Scan a receipt to get started</p>
              </div>
            ) : (
              receipts.map(r => {
                const proj = projects.find(p => p.id === r.project_id);
                const isExpanded = expandedReceipt === r.id;
                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div
                      className="p-4 flex items-center gap-3 cursor-pointer"
                      onClick={() => setExpandedReceipt(isExpanded ? null : r.id)}
                    >
                      {r.image_url ? (
                        <img src={r.image_url} alt="" className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                          <ShoppingCart className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-secondary text-sm">{r.vendor_name || "Receipt"}</div>
                        {proj && <div className="text-xs text-gray-500 truncate">{proj.client_name} — {proj.client_address}</div>}
                        <div className="text-xs text-gray-400 mt-0.5">
                          {r.receipt_date} · {r.line_items?.length || 0} items · ${(r.grand_total || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-600"}`}>
                          {r.status?.replace("_", " ")}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium`}>{r.source?.replace("_", " ")}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                        <div className="space-y-1">
                          {(r.line_items || []).map((item, i) => (
                            <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-50">
                              <span className="text-gray-700">{item.description} <span className="text-gray-400">×{item.quantity}</span></span>
                              <span className="font-medium">${(item.total || 0).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="text-xs text-gray-400">By {r.submitted_by_name || "field crew"} · {r.source?.replace("_", " ")}</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteReceipt(r.id)}
                            className="text-red-400 hover:text-red-600 gap-1 text-xs h-7"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── HOME DEPOT TAB ── */}
        {tab === "homedepot" && (
          <HomeDepotSync projects={projects} onImported={() => { qc.invalidateQueries(["purchase-receipts"]); setTab("history"); }} />
        )}
      </div>
    </div>
  );
}