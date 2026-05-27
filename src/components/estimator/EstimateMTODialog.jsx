import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Mail, Building2, Send, Package, Filter } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Keywords that identify material line items suitable for vendor ordering
const MATERIAL_KEYWORDS = [
  "lumber", "hardware", "material", "wood", "framing", "plywood", "sheathing",
  "fastener", "nail", "screw", "bolt", "joist", "beam", "stud", "rafter",
  "decking", "siding", "roofing", "shingle", "concrete", "masonry", "block",
  "pipe", "pvc", "copper", "fitting", "wire", "conduit", "insulation", "drywall",
  "flooring", "tile", "trim", "molding", "door", "window", "cabinet", "supply",
];

function isMaterialItem(item) {
  if (item.cost_type === "material" || item.cost_type === "allowance") return true;
  const text = `${item.title} ${item.description} ${item.parent_group} ${item.subgroup}`.toLowerCase();
  return MATERIAL_KEYWORDS.some((kw) => text.includes(kw));
}

function buildEmailBody(filteredItems, project, customNote, companyName) {
  const projectLine = project
    ? `${project.client_name} — ${project.client_address || ""}${project.client_city ? ", " + project.client_city : ""} | ${project.project_type || ""}`
    : "";

  const grouped = filteredItems.reduce((acc, item) => {
    const g = item.parent_group || "General";
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  let body = `Dear Supply Partner,\n\nPlease provide pricing and availability for the following materials needed for our upcoming project:\n\n`;
  if (projectLine) body += `PROJECT: ${projectLine}\n\n`;

  Object.entries(grouped).forEach(([group, items]) => {
    body += `── ${group.toUpperCase()} ──\n`;
    items.forEach((i) => {
      const unitCost = i.unit_cost > 0 ? ` | Est. Unit Cost: $${i.unit_cost.toFixed(2)}` : "";
      body += `  • ${i.title}`;
      if (i.description) body += ` — ${i.description}`;
      body += ` | Qty: ${i.quantity || 1} ${i.unit || ""}${unitCost}\n`;
    });
    body += `\n`;
  });

  const total = filteredItems.reduce((s, i) => s + (i.unit_cost || 0) * (i.quantity || 1), 0);
  body += `ESTIMATED MATERIAL COST (pre-markup): $${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;

  if (customNote) body += `Notes:\n${customNote}\n\n`;

  body += `Please reply with your best pricing and earliest availability.\n\nThank you,\n${companyName || "Coen Construction"}\n`;
  return body;
}

export default function EstimateMTODialog({ open, onClose, estimate, project }) {
  const { toast } = useToast();
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [customNote, setCustomNote] = useState("");
  const [sending, setSending] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [deselectedItems, setDeselectedItems] = useState({});

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.filter({ active: true }),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => base44.entities.CompanyProfile.list(),
  });
  const companyName = profiles[0]?.company_name || "Coen Construction";

  // Filter to material/lumber/hardware items
  const allMaterialItems = useMemo(
    () => (estimate?.line_items || []).filter(isMaterialItem),
    [estimate]
  );

  // Items admin has kept selected
  const filteredItems = allMaterialItems.filter((i) => !deselectedItems[i.id]);

  const toggleItem = (id) =>
    setDeselectedItems((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleVendor = (id) =>
    setSelectedVendors((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );

  // Pre-select vendors in matching categories
  const materialVendors = vendors.filter((v) =>
    ["Lumber & Building Materials", "Hardware", "Concrete & Masonry", "Roofing",
      "Flooring", "Electrical", "Plumbing", "HVAC", "General Supply"].includes(v.category)
  );

  const emailBody = buildEmailBody(filteredItems, project, customNote, companyName);

  const handleSend = async () => {
    if (!selectedVendors.length) {
      toast({ title: "Select at least one vendor", variant: "destructive" });
      return;
    }
    if (!filteredItems.length) {
      toast({ title: "No material items to send", variant: "destructive" });
      return;
    }
    setSending(true);
    const chosen = vendors.filter((v) => selectedVendors.includes(v.id));
    try {
      for (const vendor of chosen) {
        await base44.integrations.Core.SendEmail({
          to: vendor.email,
          subject: `Material Order Request — ${project?.client_name || "Project"} | ${project?.project_type || ""}`,
          body: emailBody,
          from_name: companyName,
        });
      }
      toast({
        title: `MTO sent to ${chosen.length} vendor${chosen.length !== 1 ? "s" : ""}!`,
        description: chosen.map((v) => v.company_name).join(", "),
      });
      onClose();
      setSelectedVendors([]);
      setCustomNote("");
      setDeselectedItems({});
    } catch (err) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Send Material Order to Vendors
          </DialogTitle>
          <p className="text-xs text-gray-500 mt-1">
            Filtered {allMaterialItems.length} material line items from the approved estimate. Deselect any you don't want to order.
          </p>
        </DialogHeader>

        <div className="space-y-5 mt-1">

          {/* Toggle: Items view / Email preview */}
          <div className="flex gap-2">
            <Button size="sm" variant={!previewMode ? "default" : "outline"} onClick={() => setPreviewMode(false)} className="gap-1">
              <Filter className="w-3.5 h-3.5" /> Items ({filteredItems.length})
            </Button>
            <Button size="sm" variant={previewMode ? "default" : "outline"} onClick={() => setPreviewMode(true)} className="gap-1">
              <Mail className="w-3.5 h-3.5" /> Email Preview
            </Button>
          </div>

          {!previewMode ? (
            <>
              {/* Material Items */}
              {allMaterialItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No material line items found in this estimate.</p>
                  <p className="text-xs mt-1">Items with cost type "material" or lumber/hardware keywords are included.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {allMaterialItems.map((item) => {
                    const selected = !deselectedItems[item.id];
                    return (
                      <label
                        key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selected ? "border-primary/30 bg-primary/5" : "border-gray-200 bg-gray-50 opacity-60"}`}
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleItem(item.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-secondary">{item.title}</div>
                          {item.description && <div className="text-xs text-gray-500 truncate">{item.description}</div>}
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-gray-600">Qty: {item.quantity} {item.unit}</span>
                            {item.unit_cost > 0 && <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-gray-600">${item.unit_cost.toFixed(2)}/unit</span>}
                            {item.parent_group && <span className="text-xs text-gray-400">{item.parent_group}</span>}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{item.cost_type}</Badge>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Vendor Selection */}
              <div>
                <p className="text-sm font-semibold text-secondary mb-2">Select Vendors to Send To</p>
                {vendors.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-3">No vendors configured.</p>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {vendors.map((v) => (
                      <label key={v.id} className="flex items-center gap-3 p-2.5 border border-gray-200 rounded-lg cursor-pointer hover:border-primary transition-colors">
                        <Checkbox
                          checked={selectedVendors.includes(v.id)}
                          onCheckedChange={() => toggleVendor(v.id)}
                        />
                        <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-secondary">{v.company_name}</div>
                          <div className="text-xs text-gray-500 truncate">{v.email}</div>
                        </div>
                        {v.category && <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-gray-500 shrink-0">{v.category}</span>}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-semibold text-secondary block mb-1">Additional Notes (optional)</label>
                <Textarea
                  rows={2}
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Delivery deadline, special specs, site access notes..."
                  className="text-sm resize-none"
                />
              </div>
            </>
          ) : (
            /* Email Preview */
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Email Body Preview</p>
              <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto">
                {emailBody}
              </pre>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {filteredItems.length} items · {selectedVendors.length} vendor{selectedVendors.length !== 1 ? "s" : ""} selected
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handleSend}
                disabled={sending || !selectedVendors.length || !filteredItems.length}
                className="gap-2 bg-primary text-white"
              >
                <Send className="w-4 h-4" />
                {sending ? "Sending..." : `Send MTO to ${selectedVendors.length || 0} Vendor${selectedVendors.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}