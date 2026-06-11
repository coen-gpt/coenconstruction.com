import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Users, Plus, Mail, Send, Inbox,
  Trophy, FileText, Trash2, Sparkles,
  Paperclip, ExternalLink, AlertTriangle
} from "lucide-react";

const STATUS_CONFIG = {
  invited:   { label: "Invited",   color: "bg-blue-100 text-blue-700" },
  viewed:    { label: "Viewed",    color: "bg-yellow-100 text-yellow-700" },
  submitted: { label: "Submitted", color: "bg-green-100 text-green-700" },
  selected:  { label: "Selected",  color: "bg-purple-100 text-purple-700" },
  rejected:  { label: "Rejected",  color: "bg-gray-100 text-gray-400" },
};

const SOURCE_CONFIG = {
  gmail_import: { label: "Email import", color: "bg-amber-50 text-amber-700 border border-amber-200" },
  drive_import: { label: "Drive import", color: "bg-sky-50 text-sky-700 border border-sky-200" },
};

const fmtMoney = (n) => `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function SubBidDashboard({ project }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [sending, setSending] = useState(null);
  const [selecting, setSelecting] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [form, setForm] = useState({ vendor_email: "", vendor_name: "", vendor_company: "", trade: "", sow_id: "", sow_trade_items: [] });
  const [selectedSowTrade, setSelectedSowTrade] = useState("");

  const { data: subBids = [] } = useQuery({
    queryKey: ["sub-bids", project.id],
    queryFn: () => base44.entities.SubBid.filter({ project_id: project.id }, "-created_date"),
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => adminEntities.Vendor.list(),
  });

  // Load SoWs linked to this project
  const { data: sows = [] } = useQuery({
    queryKey: ["saved-sow", project.id],
    queryFn: () => base44.entities.SavedSoW.filter({ project_id: project.id }, "-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SubBid.create(data),
    onSuccess: async (newBid) => {
      qc.invalidateQueries({ queryKey: ["sub-bids", project.id] });
      setInviteOpen(false);
      setForm({ vendor_email: "", vendor_name: "", vendor_company: "", trade: "", sow_id: "", sow_trade_items: [] });
      setSelectedSowTrade("");
      // Auto-send invite
      await sendInvite(newBid.id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SubBid.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sub-bids", project.id] }); },
  });

  // One pass = scan up to 50 matching emails, process up to 6 new ones.
  // Chained rounds drain the backlog so the user never has to mash the button.
  const scanInbox = async () => {
    setScanning(true);
    let imported = 0;
    let scanned = 0;
    try {
      for (let round = 0; round < 6; round++) {
        const res = await base44.functions.invoke("scanSubBidEmails", { maxResults: 50, processLimit: 6 });
        const d = res.data || {};
        if (d.error) throw new Error(d.error);
        imported += d.imported || 0;
        scanned += d.scanned || 0;
        if (d.imported) qc.invalidateQueries({ queryKey: ["sub-bids"] });
        if (!d.remaining) break;
      }
      toast({
        title: imported > 0 ? `${imported} bid${imported !== 1 ? "s" : ""} imported` : "No new bids found",
        description: `${scanned} emails scanned for sub quotes, bids, and estimates.`,
      });
      qc.invalidateQueries({ queryKey: ["sub-bids"] });
    } catch (err) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    }
    setScanning(false);
  };

  const sendInvite = async (subBidId) => {
    setSending(subBidId);
    try {
      await base44.functions.invoke("sendSubBidInvite", { sub_bid_id: subBidId });
      qc.invalidateQueries({ queryKey: ["sub-bids", project.id] });
      toast({ title: "Invite sent!", description: "The subcontractor has been emailed their portal link." });
    } catch (err) {
      toast({ title: "Failed to send invite", description: err.message, variant: "destructive" });
    }
    setSending(null);
  };

  const selectWinner = async (bid) => {
    if (!bid.bid_amount) {
      toast({ title: "No bid amount", description: "Add a bid amount to this bid before selecting it as the winner.", variant: "destructive" });
      return;
    }
    setSelecting(bid.id);
    try {
      // Mark this bid as selected, reject others for same trade
      const sameTrade = subBids.filter(b => b.trade === bid.trade && b.id !== bid.id);
      await base44.entities.SubBid.update(bid.id, {
        status: "selected",
        selected_at: new Date().toISOString(),
      });
      for (const other of sameTrade) {
        if (other.status !== "selected") {
          await base44.entities.SubBid.update(other.id, { status: "rejected" });
        }
      }

      // Update the project's adjusted total — find or create a sub line item in the estimate
      const estimates = await base44.entities.Estimate.filter({ project_id: project.id });
      const original = estimates.find(e => e.type === "original" && e.status !== "superseded");
      if (original) {
        const items = original.line_items || [];
        const existingIdx = items.findIndex(i =>
          i.cost_type === "subcontractor" && i.title?.toLowerCase().includes(bid.trade.toLowerCase())
        );
        const subItem = {
          id: existingIdx >= 0 ? items[existingIdx].id : crypto.randomUUID(),
          parent_group: "Subcontractors",
          subgroup: bid.trade,
          title: `${bid.trade} — ${bid.vendor_company || bid.vendor_name}`,
          description: bid.bid_notes || "",
          quantity: 1,
          unit: "ls",
          unit_cost: bid.bid_amount,
          markup_pct: 0,
          total: bid.bid_amount,
          cost_type: "subcontractor",
          internal_notes: `Selected from sub bid portal. Submitted by ${bid.vendor_email}`,
        };
        let newItems;
        if (existingIdx >= 0) {
          newItems = items.map((it, idx) => idx === existingIdx ? subItem : it);
        } else {
          newItems = [...items, subItem];
        }
        const newTotal = newItems.reduce((s, i) => s + (i.total || 0), 0);
        await base44.entities.Estimate.update(original.id, {
          line_items: newItems,
          grand_total: newTotal,
        });
        await adminEntities.ContractorProject.update(project.id, {
          adjusted_total: newTotal,
          original_estimate_total: newTotal,
        });
        toast({
          title: `${bid.vendor_company || bid.vendor_name} selected!`,
          description: `$${bid.bid_amount.toLocaleString()} added to project estimate.`,
        });
      } else {
        toast({ title: "Winner selected!", description: "No estimate found to update — create one first." });
      }

      qc.invalidateQueries({ queryKey: ["sub-bids", project.id] });
      qc.invalidateQueries({ queryKey: ["estimates", project.id] });
      qc.invalidateQueries({ queryKey: ["contractor-project", project.id] });
    } catch (err) {
      toast({ title: "Error selecting winner", description: err.message, variant: "destructive" });
    }
    setSelecting(null);
  };

  // Group bids by trade for comparison
  const bidsByTrade = subBids.reduce((acc, b) => {
    if (!acc[b.trade]) acc[b.trade] = [];
    acc[b.trade].push(b);
    return acc;
  }, {});

  const submittedBids = subBids.filter(b => ["submitted", "selected"].includes(b.status));
  const totalBidValue = submittedBids.reduce((s, b) => s + (b.bid_amount || 0), 0);
  const selectedBids = subBids.filter(b => b.status === "selected");
  const selectedTotal = selectedBids.reduce((s, b) => s + (b.bid_amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-secondary">Subcontractor Bids</h3>
          {subBids.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{subBids.length} bid{subBids.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={scanInbox} disabled={scanning} variant="outline" className="gap-2" size="sm">
            <Inbox className="w-3.5 h-3.5" />
            {scanning ? "Scanning inbox…" : "Scan Email for Bids"}
          </Button>
          <Button onClick={() => setInviteOpen(true)} className="gap-2 bg-primary text-white" size="sm">
            <Plus className="w-3.5 h-3.5" /> Invite Sub
          </Button>
        </div>
      </div>

      {/* Totals */}
      {submittedBids.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm">
          <div>
            <span className="text-gray-400 text-xs uppercase tracking-wide mr-2">Bids received</span>
            <span className="font-semibold text-secondary">{submittedBids.length}</span>
          </div>
          <div>
            <span className="text-gray-400 text-xs uppercase tracking-wide mr-2">Total bid value</span>
            <span className="font-semibold text-secondary">{fmtMoney(totalBidValue)}</span>
          </div>
          {selectedBids.length > 0 && (
            <div>
              <span className="text-gray-400 text-xs uppercase tracking-wide mr-2">Selected total</span>
              <span className="font-semibold text-purple-700">{fmtMoney(selectedTotal)}</span>
            </div>
          )}
        </div>
      )}

      {subBids.length === 0 && (
        <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-400">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No subcontractor bids yet</p>
          <p className="text-xs mt-1">Invite subs to bid, or scan the company inbox for quotes already received.</p>
        </div>
      )}

      {/* Bids grouped by trade */}
      {Object.entries(bidsByTrade).map(([trade, bids]) => {
        const submitted = bids.filter(b => ["submitted", "selected", "rejected"].includes(b.status));
        const winner = bids.find(b => b.status === "selected");
        const lowest = submitted.length
          ? submitted.filter(b => b.bid_amount).reduce((m, b) => b.bid_amount < (m?.bid_amount ?? Infinity) ? b : m, null)
          : null;

        const tradeTotal = submitted.reduce((s, b) => s + (b.bid_amount || 0), 0);

        return (
          <div key={trade} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-secondary text-sm">{trade}</span>
                <span className="text-xs text-gray-400">{bids.length} bid{bids.length !== 1 ? "s" : ""}</span>
                {tradeTotal > 0 && (
                  <span className="text-xs text-gray-500">
                    {fmtMoney(tradeTotal)} total{lowest?.bid_amount ? ` · low ${fmtMoney(lowest.bid_amount)}` : ""}
                  </span>
                )}
              </div>
              {winner && (
                <div className="flex items-center gap-1 text-xs text-purple-700 font-semibold">
                  <Trophy className="w-3.5 h-3.5" /> Winner: {winner.vendor_company || winner.vendor_name} — ${winner.bid_amount?.toLocaleString()}
                </div>
              )}
            </div>

            {/* Comparison grid */}
            <div className="divide-y divide-gray-100">
              {bids.map(bid => {
                const cfg = STATUS_CONFIG[bid.status] || STATUS_CONFIG.invited;
                const srcCfg = SOURCE_CONFIG[bid.source];
                const isLowest = lowest?.id === bid.id && bid.status === "submitted";
                const isWinner = bid.status === "selected";
                const attachmentUrls = bid.attachment_urls || [];
                const lowConfidence = srcCfg && typeof bid.ai_match_confidence === "number" && bid.ai_match_confidence < 70;
                return (
                  <div
                    key={bid.id}
                    className={`px-5 py-4 flex items-center gap-4 flex-wrap ${isWinner ? "bg-purple-50" : isLowest ? "bg-green-50/60" : ""}`}
                  >
                    <div className="flex-1 min-w-48">
                      <div className="font-semibold text-secondary text-sm">
                        {bid.vendor_company || bid.vendor_name}
                        {isLowest && !isWinner && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">Lowest</span>}
                        {isWinner && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold">✓ Selected</span>}
                        {srcCfg && <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-semibold ${srcCfg.color}`}>{srcCfg.label}</span>}
                      </div>
                      <div className="text-xs text-gray-400">{bid.vendor_email}</div>
                      {bid.ai_summary && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{bid.ai_summary}</div>}
                      {!bid.ai_summary && bid.bid_notes && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{bid.bid_notes}</div>}
                      {lowConfidence && (
                        <div className="flex items-center gap-1 text-xs text-amber-600 mt-1" title={bid.ai_match_reason || ""}>
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="line-clamp-1">Match {Math.round(bid.ai_match_confidence)}% — {bid.ai_match_reason || "verify this is the right project"}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      {bid.bid_amount ? (
                        <div className={`text-xl font-bold ${isWinner ? "text-purple-700" : isLowest ? "text-green-600" : "text-secondary"}`}>
                          ${bid.bid_amount.toLocaleString()}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400 italic">Awaiting bid</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.color}`}>
                        {cfg.label}
                      </span>

                      {attachmentUrls.length > 0 ? (
                        attachmentUrls.map((url, i) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer" title={bid.attachment_names?.[i] || "Attachment"}>
                            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs text-blue-600 border-blue-200">
                              <Paperclip className="w-3 h-3" />
                              {attachmentUrls.length > 1 ? `Doc ${i + 1}` : "Quote"}
                            </Button>
                          </a>
                        ))
                      ) : bid.quote_pdf_url && (
                        <a href={bid.quote_pdf_url} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs text-blue-600 border-blue-200">
                            <FileText className="w-3 h-3" /> PDF
                          </Button>
                        </a>
                      )}

                      {bid.gmail_link && (
                        <a href={bid.gmail_link} target="_blank" rel="noreferrer" title={bid.email_subject || "Open source email"}>
                          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                            <ExternalLink className="w-3 h-3" /> Email
                          </Button>
                        </a>
                      )}

                      {bid.drive_link && (
                        <a href={bid.drive_link} target="_blank" rel="noreferrer" title="Open in Google Drive">
                          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                            <ExternalLink className="w-3 h-3" /> Drive
                          </Button>
                        </a>
                      )}

                      {bid.status === "submitted" && (
                        <Button
                          size="sm"
                          onClick={() => selectWinner(bid)}
                          disabled={selecting === bid.id}
                          className="gap-1 h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <Trophy className="w-3 h-3" />
                          {selecting === bid.id ? "Saving..." : "Select Winner"}
                        </Button>
                      )}

                      {bid.status === "invited" && (
                        <Button
                          variant="outline" size="sm"
                          onClick={() => sendInvite(bid.id)}
                          disabled={sending === bid.id}
                          className="gap-1 h-7 text-xs"
                        >
                          <Send className="w-3 h-3" />
                          {sending === bid.id ? "Sending..." : "Resend"}
                        </Button>
                      )}

                      <Button
                        variant="ghost" size="sm"
                        onClick={() => deleteMutation.mutate(bid.id)}
                        className="h-7 w-7 p-0 text-gray-300 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invite Subcontractor to Bid</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">

            {/* SoW Picker */}
            {sows.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-800">Auto-fill from Scope of Work</span>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Select SoW</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                    value={form.sow_id}
                    onChange={e => {
                      const sow = sows.find(s => s.id === e.target.value);
                      setForm(f => ({ ...f, sow_id: e.target.value }));
                      setSelectedSowTrade("");
                      if (sow?.sow?.trades) {
                        // reset trade items
                        setForm(f => ({ ...f, sow_id: e.target.value, trade: "", sow_trade_items: [] }));
                      }
                    }}
                  >
                    <option value="">Choose a saved SoW…</option>
                    {sows.map(s => <option key={s.id} value={s.id}>{s.title} ({s.total_trades || 0} trades)</option>)}
                  </select>
                </div>

                {form.sow_id && (() => {
                  const sow = sows.find(s => s.id === form.sow_id);
                  const trades = sow?.sow?.trades || sow?.sow?.sections || [];
                  if (!trades.length) return null;
                  return (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Select Trade</label>
                      <select
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                        value={selectedSowTrade}
                        onChange={e => {
                          const tradeName = e.target.value;
                          setSelectedSowTrade(tradeName);
                          const tradeData = trades.find(t => (t.trade || t.name) === tradeName);
                          const items = tradeData?.items || tradeData?.line_items || [];
                          setForm(f => ({
                            ...f,
                            trade: tradeName,
                            sow_trade_items: items.map(it => ({
                              item: it.item || it.title || it.name || "",
                              description: it.description || it.notes || "",
                              quantity: String(it.quantity || ""),
                              unit: it.unit || "",
                              notes: it.notes || "",
                            })),
                          }));
                        }}
                      >
                        <option value="">Choose a trade…</option>
                        {trades.map(t => <option key={t.trade || t.name} value={t.trade || t.name}>{t.trade || t.name} ({(t.items || t.line_items || []).length} items)</option>)}
                      </select>
                      {form.sow_trade_items.length > 0 && (
                        <div className="mt-2 bg-white border border-blue-100 rounded-lg p-3 max-h-32 overflow-y-auto">
                          <p className="text-xs font-semibold text-blue-700 mb-1.5">{form.sow_trade_items.length} scope items will be sent to the sub:</p>
                          {form.sow_trade_items.map((it, i) => (
                            <div key={i} className="text-xs text-gray-600 py-0.5 border-b border-gray-100 last:border-0">
                              <span className="font-semibold text-gray-700">{it.item}</span>
                              {it.description && <span className="text-gray-400"> — {it.description}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Trade / Scope *</label>
              <Input
                value={form.trade}
                onChange={e => setForm(f => ({ ...f, trade: e.target.value }))}
                placeholder="e.g. Electrical, Plumbing, HVAC, Framing"
              />
            </div>

            {/* Quick-fill from vendor directory */}
            {vendors.filter(v => v.is_subcontractor).length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Quick-Fill from Sub Directory</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  onChange={e => {
                    const v = vendors.find(v => v.id === e.target.value);
                    if (v) setForm(f => ({ ...f, vendor_email: v.email, vendor_name: v.contact_name || "", vendor_company: v.company_name }));
                  }}
                  defaultValue=""
                >
                  <option value="">Select a subcontractor…</option>
                  {vendors.filter(v => v.is_subcontractor).map(v => <option key={v.id} value={v.id}>{v.company_name} — {v.email}</option>)}
                </select>
              </div>
            )}

            {vendors.filter(v => !v.is_subcontractor).length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Or from Vendor Directory</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  onChange={e => {
                    const v = vendors.find(v => v.id === e.target.value);
                    if (v) setForm(f => ({ ...f, vendor_email: v.email, vendor_name: v.contact_name || "", vendor_company: v.company_name }));
                  }}
                  defaultValue=""
                >
                  <option value="">Select a vendor…</option>
                  {vendors.filter(v => !v.is_subcontractor).map(v => <option key={v.id} value={v.id}>{v.company_name} — {v.email}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Company Name</label>
              <Input value={form.vendor_company} onChange={e => setForm(f => ({ ...f, vendor_company: e.target.value }))} placeholder="ABC Electric LLC" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Contact Name</label>
              <Input value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} placeholder="John Smith" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Email Address *</label>
              <Input type="email" value={form.vendor_email} onChange={e => setForm(f => ({ ...f, vendor_email: e.target.value }))} placeholder="john@abcelectric.com" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate({
                  ...form,
                  project_id: project.id,
                  status: "invited",
                  sow_id: form.sow_id || undefined,
                  sow_trade_items: form.sow_trade_items?.length ? form.sow_trade_items : undefined,
                })}
                disabled={!form.trade || !form.vendor_email || createMutation.isPending}
                className="bg-primary text-white gap-2"
              >
                <Mail className="w-3.5 h-3.5" />
                {createMutation.isPending ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}