import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit3, Trash2, Building2, Phone, Mail, Shield, FileText, CheckCircle, AlertTriangle, Clock, ExternalLink, Send, XCircle, Square, CheckSquare, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import SubContractorPacketModal from "@/components/estimator/SubContractorPacketModal";
import SubcontractorSmsDialog from "@/components/estimator/SubcontractorSmsDialog";
import AddressInput from "@/components/AddressInput";

const CATEGORIES = ["Lumber & Building Materials", "Electrical", "Plumbing", "HVAC", "Roofing", "Flooring", "Hardware", "Paint", "Concrete & Masonry", "General Supply", "Other"];

const emptyVendor = { company_name: "", contact_name: "", email: "", phone: "", address: "", category: "General Supply", notes: "", active: true };

const INS_STATUS = {
  valid: { label: "Valid", color: "bg-green-100 text-green-700", icon: CheckCircle },
  expiring_soon: { label: "Expiring Soon", color: "bg-amber-100 text-amber-700", icon: Clock },
  expired: { label: "Expired", color: "bg-red-100 text-red-600", icon: AlertTriangle },
  pending: { label: "Pending Docs", color: "bg-gray-100 text-gray-500", icon: Shield },
};

export default function AdminVendors() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyVendor);
  const [packetVendor, setPacketVendor] = useState(null);
  const [docsVendor, setDocsVendor] = useState(null);
  const [inviteSending, setInviteSending] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null); // { done, total, failed }

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => adminEntities.Vendor.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? adminEntities.Vendor.update(editing.id, data) : adminEntities.Vendor.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendors"] }); setOpen(false); toast({ title: "Vendor saved" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminEntities.Vendor.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendors"] }); toast({ title: "Vendor deleted" }); },
  });

  const openNew = () => { setEditing(null); setForm(emptyVendor); setOpen(true); };
  const openEdit = (v) => { setEditing(v); setForm({ ...v }); setOpen(true); };

  // Subcontractors eligible for bulk invite (pending packet only)
  const eligibleSubs = vendors.filter(v => v.is_subcontractor && !["completed", "approved"].includes(v.packet_status));
  const allEligibleSelected = eligibleSubs.length > 0 && eligibleSubs.every(v => selectedIds.has(v.id));

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allEligibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleSubs.map(v => v.id)));
    }
  };

  const sendBulkInvites = async () => {
    const targets = vendors.filter(v => selectedIds.has(v.id));
    if (!targets.length) return;
    setBulkSending(true);
    setBulkProgress({ done: 0, total: targets.length, failed: 0 });
    let done = 0, failed = 0;
    for (const v of targets) {
      try {
        await base44.functions.invoke("sendSubOnboardingInvite", { vendor_id: v.id });
        done++;
      } catch {
        failed++;
        done++;
      }
      setBulkProgress({ done, total: targets.length, failed });
    }
    setBulkSending(false);
    setSelectedIds(new Set());
    toast({
      title: `Invites sent to ${targets.length - failed} subcontractor${targets.length - failed !== 1 ? "s" : ""}`,
      description: failed > 0 ? `${failed} failed — check email/phone.` : "All invites delivered successfully.",
    });
    setBulkProgress(null);
  };

  const sendOnboardingInvite = async (v) => {
    setInviteSending(v.id);
    try {
      const res = await base44.functions.invoke("sendSubOnboardingInvite", { vendor_id: v.id });
      if (res.data?.email_sent === false && res.data?.portal_url) {
        navigator.clipboard?.writeText(res.data.portal_url).catch(() => {});
        toast({
          title: "Invite created — email delivery failed",
          description: `The onboarding link was copied to your clipboard — send it to ${v.company_name} directly: ${res.data.portal_url}`,
          duration: 15000,
        });
      } else {
        toast({ title: "Onboarding invite sent!", description: `Email & SMS sent to ${v.company_name}` });
      }
    } catch (err) {
      toast({ title: "Failed to send invite", description: err.message, variant: "destructive" });
    } finally {
      setInviteSending(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Vendor Directory</h1>
          <p className="text-sm text-gray-500">Supply houses for material take-off emails</p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-primary text-white">
          <Plus className="w-4 h-4" /> Add Vendor
        </Button>
      </div>

      {/* Bulk action toolbar */}
      {eligibleSubs.length > 0 && (
        <div className={`rounded-xl border px-4 py-3 flex flex-wrap items-center gap-3 transition-colors ${selectedIds.size > 0 ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-primary transition-colors"
          >
            {allEligibleSelected
              ? <CheckSquare className="w-4 h-4 text-primary" />
              : <Square className="w-4 h-4 text-gray-400" />}
            {allEligibleSelected ? "Deselect All" : `Select All (${eligibleSubs.length} pending)`}
          </button>

          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-blue-700 font-semibold bg-blue-100 px-2.5 py-1 rounded-full">
                {selectedIds.size} selected
              </span>
              <div className="ml-auto flex items-center gap-2">
                {bulkProgress && (
                  <span className="text-xs text-gray-500">
                    {bulkProgress.done}/{bulkProgress.total} sent
                    {bulkProgress.failed > 0 && <span className="text-red-500"> · {bulkProgress.failed} failed</span>}
                  </span>
                )}
                <Button
                  onClick={sendBulkInvites}
                  disabled={bulkSending}
                  size="sm"
                  className="gap-2 bg-primary text-white"
                >
                  {bulkSending
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Sending {bulkProgress?.done}/{bulkProgress?.total}…</>
                    : <><Send className="w-3 h-3" /> Send {selectedIds.size} Invite{selectedIds.size !== 1 ? "s" : ""}</>}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                >
                  <XCircle className="w-3 h-3 mr-1" /> Clear
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="space-y-3">
        {vendors.length === 0 && (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No vendors yet</p>
            <p className="text-sm mt-1">Add supply houses to send material take-offs.</p>
          </div>
        )}
        {vendors.map((v) => {
          const insStat = v.is_subcontractor ? (INS_STATUS[v.insurance_status] || INS_STATUS.pending) : null;
          const InsIcon = insStat?.icon;
          return (
            <div key={v.id} className={`bg-white border rounded-xl p-4 transition-colors ${selectedIds.has(v.id) ? "border-blue-300 bg-blue-50/30" : "border-gray-200"}`}>
              <div className="flex items-center gap-4">
                {/* Checkbox — only for pending subs */}
                {v.is_subcontractor && !["completed", "approved"].includes(v.packet_status) ? (
                  <button
                    onClick={() => toggleSelect(v.id)}
                    className="shrink-0 text-gray-400 hover:text-primary transition-colors"
                  >
                    {selectedIds.has(v.id)
                      ? <CheckSquare className="w-5 h-5 text-primary" />
                      : <Square className="w-5 h-5" />}
                  </button>
                ) : (
                  <div className="w-5 shrink-0" />
                )}
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-secondary">{v.company_name}</div>
                    {v.is_subcontractor && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Sub</span>}
                  </div>
                  <div className="text-sm text-gray-500">{v.contact_name}</div>
                  <div className="flex gap-4 mt-1">
                    {v.email && <span className="text-xs text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3" />{v.email}</span>}
                    {v.phone && <span className="text-xs text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3" />{v.phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {v.category && <span className="text-xs bg-muted px-2.5 py-1 rounded-full text-gray-600 hidden sm:block">{v.category}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${v.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {v.active ? "Active" : "Inactive"}
                  </span>
                  {v.is_subcontractor && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                      v.packet_status === "approved" ? "bg-green-100 text-green-700"
                        : v.packet_status === "completed" ? "bg-purple-100 text-purple-700"
                        : "bg-orange-100 text-orange-700"
                    }`}>
                      {v.packet_status === "approved" ? <CheckCircle className="w-3 h-3" /> : v.packet_status === "completed" ? <FileText className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {v.packet_status === "approved" ? "Packet Approved" : v.packet_status === "completed" ? "Submitted — Review" : "Packet Pending"}
                    </span>
                  )}
                  {v.is_subcontractor && insStat && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${insStat.color}`}>
                      <InsIcon className="w-3 h-3" /> {insStat.label}
                    </span>
                  )}
                  {v.is_subcontractor && (
                    <Button variant="outline" size="sm" onClick={() => setDocsVendor(v)} className="gap-1 h-7 text-xs">
                      <FileText className="w-3 h-3" /> Docs
                    </Button>
                  )}
                  {v.is_subcontractor && v.packet_status !== "completed" && v.packet_status !== "approved" && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => sendOnboardingInvite(v)}
                      disabled={inviteSending === v.id}
                      className="gap-1 h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <Send className="w-3 h-3" />
                      {inviteSending === v.id ? "Sending…" : "Send Invite"}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setPacketVendor(v)} className="gap-1 h-7 text-xs">
                    <Shield className="w-3 h-3" /> {["completed", "approved"].includes(v.packet_status) ? "Update" : "Packet"}
                  </Button>
                  {v.phone && <SubcontractorSmsDialog vendor={v} project={null} />}
                  <Button variant="ghost" size="icon" onClick={() => openEdit(v)} className="text-gray-400 hover:text-primary h-8 w-8">
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(v.id)} className="text-gray-400 hover:text-red-500 h-8 w-8">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subcontractor Docs Viewer */}
      {docsVendor && (
        <Dialog open={!!docsVendor} onOpenChange={() => setDocsVendor(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Documents — {docsVendor.company_name}</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              {[
                { label: "Workers Compensation", url: docsVendor.workers_comp_url, expiry: docsVendor.workers_comp_expiry },
                { label: "General Liability", url: docsVendor.liability_ins_url, expiry: docsVendor.liability_ins_expiry },
                { label: "W-9 Form", url: docsVendor.w9_url, expiry: null },
              ].map(({ label, url, expiry }) => (
                <div key={label} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div>
                    <div className="font-semibold text-secondary text-sm">{label}</div>
                    {expiry && <div className={`text-xs mt-0.5 ${new Date(expiry) < new Date() ? "text-red-500 font-semibold" : "text-gray-400"}`}>Expires: {new Date(expiry).toLocaleDateString()}</div>}
                    {!url && <div className="text-xs text-gray-400 mt-0.5">Not on file</div>}
                  </div>
                  {url ? (
                    <div className="flex gap-1.5">
                      <a href={url} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="gap-1 text-blue-600 border-blue-200"><ExternalLink className="w-3 h-3" /> View</Button>
                      </a>
                      <a href={url} target="_blank" rel="noreferrer" download>
                        <Button variant="outline" size="sm" className="gap-1 text-gray-600"><FileText className="w-3 h-3" /> Download</Button>
                      </a>
                    </div>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </div>
              ))}
              {docsVendor.packet_signed_at && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <div className="text-sm font-semibold text-green-800">Packet Signed</div>
                  <div className="text-xs text-green-700 mt-0.5">
                    By {docsVendor.packet_signed_name}
                    {docsVendor.packet_form_data?.signed_title ? `, ${docsVendor.packet_form_data.signed_title}` : ""} on {new Date(docsVendor.packet_signed_at).toLocaleDateString()}
                  </div>
                  {docsVendor.packet_form_data?.agreement_version && (
                    <div className="text-xs text-green-700 mt-0.5">
                      Subcontractor Agreement v{docsVendor.packet_form_data.agreement_version} accepted
                      {docsVendor.packet_form_data.agreement_accepted_at ? ` ${new Date(docsVendor.packet_form_data.agreement_accepted_at).toLocaleDateString()}` : ""}
                    </div>
                  )}
                  {docsVendor.packet_signature_data && (
                    <img src={docsVendor.packet_signature_data} alt="Signature" className="h-12 mt-2 bg-white rounded border border-green-100 px-2" />
                  )}
                </div>
              )}
              {docsVendor.packet_status === "completed" && (
                <Button
                  className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                  onClick={async () => {
                    let adminEmail = "";
                    try { adminEmail = JSON.parse(localStorage.getItem("coen_admin_session") || "{}")?.email || ""; } catch { /* ignore */ }
                    await adminEntities.Vendor.update(docsVendor.id, {
                      packet_status: "approved",
                      packet_approved_by: adminEmail,
                      packet_approved_at: new Date().toISOString(),
                    });
                    qc.invalidateQueries({ queryKey: ["vendors"] });
                    setDocsVendor(null);
                    toast({ title: "Packet approved ✓", description: `${docsVendor.company_name} is approved to do business.` });
                  }}
                >
                  <CheckCircle className="w-4 h-4" /> Approve Packet
                </Button>
              )}
              {docsVendor.packet_status === "approved" && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg p-2 text-center">
                  Approved{docsVendor.packet_approved_by ? ` by ${docsVendor.packet_approved_by}` : ""}{docsVendor.packet_approved_at ? ` on ${new Date(docsVendor.packet_approved_at).toLocaleDateString()}` : ""}
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Subcontractor Packet Modal */}
      {packetVendor && (
        <SubContractorPacketModal
          vendor={packetVendor}
          open={!!packetVendor}
          onClose={() => setPacketVendor(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["vendors"] }); setPacketVendor(null); toast({ title: "Packet saved!" }); }}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {[["company_name", "Company Name *"], ["contact_name", "Contact Name"], ["email", "Email *"], ["phone", "Phone"]].map(([field, label]) => (
              <div key={field}>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">{label}</label>
                <Input value={form[field] || ""} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Address</label>
              <AddressInput
                className="h-10 rounded-md"
                value={form.address || ""}
                onChange={(val) => setForm((f) => ({ ...f, address: val }))}
                placeholder="Business address"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Category</label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="active" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              <label htmlFor="active" className="text-sm text-gray-600">Active</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate(form)} className="bg-primary text-white">
                {saveMutation.isPending ? "Saving..." : "Save Vendor"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}