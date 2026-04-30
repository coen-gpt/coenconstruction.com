import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Building2, Send } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function VendorEmailDialog({ open, onClose, mtoItems, project, total, groupMode }) {
  const { toast } = useToast();
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [customNote, setCustomNote] = useState("");
  const [sending, setSending] = useState(false);

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.filter({ active: true }),
  });

  const toggleVendor = (id) =>
    setSelectedVendors((prev) => prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]);

  const buildEmailBody = () => {
    const projectInfo = project
      ? `Project: ${project.client_name} | ${project.client_address}, ${project.client_city} | Type: ${project.project_type || "N/A"}`
      : "";

    const grouped = mtoItems.reduce((acc, item) => {
      const key = groupMode === "by_trade" ? (item.trade || "General") : (item.line_item_ref || "General");
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    let body = `Dear Supply Partner,\n\nPlease find below our material take-off request for the following project:\n\n${projectInfo}\n\n`;

    Object.entries(grouped).forEach(([group, items]) => {
      body += `--- ${group.toUpperCase()} ---\n`;
      items.forEach((i) => {
        body += `  ${i.material_name} | Qty: ${i.quantity} ${i.unit} | Est. Unit: $${(i.unit_cost || 0).toFixed(2)} | Est. Total: $${(i.total_cost || 0).toFixed(2)}${i.suggested_supplier ? ` | Ref: ${i.suggested_supplier}` : ""}\n`;
      });
      body += `\n`;
    });

    body += `\nESTIMATED TOTAL MATERIAL COST: $${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;

    if (customNote) body += `Additional Notes:\n${customNote}\n\n`;

    body += `Please respond with your best pricing and availability.\n\nThank you,\nCoen Construction\n(617) 857-COEN | info@coenconstruction.com`;
    return body;
  };

  const handleSend = async () => {
    if (!selectedVendors.length) return toast({ title: "Select at least one vendor", variant: "destructive" });
    setSending(true);
    const chosen = vendors.filter((v) => selectedVendors.includes(v.id));
    const emailBody = buildEmailBody();

    try {
      // Send BCC to all selected vendors — one email with all as BCC
      for (const vendor of chosen) {
        await base44.integrations.Core.SendEmail({
          to: vendor.email,
          subject: `Material Take-Off Request — ${project?.client_name || "Project"}`,
          body: emailBody,
        });
      }
      toast({ title: `Sent to ${chosen.length} vendor${chosen.length > 1 ? "s" : ""}!`, description: chosen.map((v) => v.company_name).join(", ") });
      onClose();
      setSelectedVendors([]);
      setCustomNote("");
    } catch (err) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" /> Email Material Take-Off to Vendors
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <p className="text-sm font-semibold text-secondary mb-2">Select Vendors (BCC all recipients)</p>
            {vendors.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No vendors configured. Add vendors in Admin → Vendors.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {vendors.map((v) => (
                  <label key={v.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-primary transition-colors">
                    <Checkbox
                      checked={selectedVendors.includes(v.id)}
                      onCheckedChange={() => toggleVendor(v.id)}
                    />
                    <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-secondary">{v.company_name}</div>
                      <div className="text-xs text-gray-500">{v.contact_name} — {v.email}</div>
                    </div>
                    {v.category && <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-gray-500">{v.category}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-secondary block mb-1">Additional Note (optional)</label>
            <Textarea
              rows={3}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Any special requests or notes for the vendors..."
              className="text-sm resize-none"
            />
          </div>

          <div className="bg-muted rounded-lg p-3 text-xs text-gray-500">
            <strong className="text-secondary">Email Preview includes:</strong> project details, {mtoItems.length} material items grouped by {groupMode === "by_trade" ? "trade" : "line item"}, estimated total of ${total.toLocaleString()}.
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handleSend}
              disabled={sending || selectedVendors.length === 0}
              className="gap-2 bg-primary text-white"
            >
              <Send className="w-4 h-4" /> {sending ? "Sending..." : `Send to ${selectedVendors.length} Vendor${selectedVendors.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}