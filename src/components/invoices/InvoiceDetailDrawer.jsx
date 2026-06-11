import { useState } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { X, Pin, PinOff, Paperclip, Clock, AlertTriangle, Download, Send, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { useToast } from "@/components/ui/use-toast";
import InvoiceStatusBadge from "./InvoiceStatusBadge";
import VendorPortalModal from "./VendorPortalModal";
import AttachmentPreviewModal from "./AttachmentPreviewModal";
import { schedulePaymentForApproval } from "@/lib/invoiceScheduling";
import PmApprovalPanel from "./PmApprovalPanel";
import GateStatusBadges from "./GateStatusBadges";
import { MatchConfidencePill } from "./ProjectCostsDashboard";

const PORTAL_APPROVER_ROLES = ["admin", "project_manager", "assistant_project_manager"];

function getSessionRole() {
  try { return JSON.parse(localStorage.getItem("coen_admin_session") || "null")?.role || null; } catch { return null; }
}

export default function InvoiceDetailDrawer({ record, onClose, onUpdate, onRefresh, projects = [] }) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [vendorPortalOpen, setVendorPortalOpen] = useState(false);
  const [docSplit, setDocSplit] = useState(false);
  const [manualTrade, setManualTrade] = useState(record.ai_classified_category || "");
  const [importingVendor, setImportingVendor] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [editData, setEditData] = useState({
    vendor_name: record.vendor_name || "",
    invoice_number: record.invoice_number || "",
    invoice_date: record.invoice_date || "",
    due_date: record.due_date || "",
    amount: record.amount || "",
    notes: record.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [vendor, setVendor] = useState(null);
  const [markupPct, setMarkupPct] = useState(record.markup_percent ?? 25);
  const [allowanceSel, setAllowanceSel] = useState(record.allowance_id || "__none");

  const canApprovePortal = PORTAL_APPROVER_ROLES.includes(getSessionRole());
  const taggedProject = projects.find(p => p.id === record.project_id);
  const projectAllowances = taggedProject?.allowances || [];
  const customerPrice = record.amount
    ? Math.round(Number(record.amount) * (1 + (Number(markupPct) || 0) / 100) * 100) / 100
    : null;

  // Load linked vendor for gate display
  useState(() => {
    if (record.vendor_id || record.vendor_email) {
      adminEntities.Vendor.filter(
        record.vendor_id ? { id: record.vendor_id } : { email: record.vendor_email }
      ).then(vs => setVendor(vs[0] || null)).catch(() => {});
    }
  });

  const TRADE_CATEGORIES = [
    "Lumber & Building Materials", "Electrical", "Plumbing", "HVAC", "Roofing",
    "Flooring", "Hardware", "Paint", "Concrete & Masonry", "General Supply", "Other"
  ];

  const handleImportVendor = async () => {
    if (!record.vendor_name && !record.vendor_email) {
      toast({ title: "Cannot import", description: "Vendor name or email required", variant: "destructive" });
      return;
    }
    
    setImportingVendor(true);
    try {
      // Check if vendor already exists by email
      let existing = null;
      if (record.vendor_email) {
        const matches = await adminEntities.Vendor.filter({ email: record.vendor_email });
        existing = matches[0] || null;
      }

      const vendorData = {
        company_name: record.vendor_name || "Unknown",
        contact_name: "", // Can be filled from notes if available
        email: record.vendor_email || "",
        phone: record.vendor_phone || "",
        address: "", // Not extracted from invoice
        category: manualTrade || (record.ai_classified_category || record.vendor_category || "General Supply"),
        notes: `Imported from invoice #${record.invoice_number || "unknown"}. Email: ${record.email_subject || ""}`,
        active: true
      };

      if (existing) {
        // Update existing vendor
        await adminEntities.Vendor.update(existing.id, vendorData);
        toast({ title: "Vendor updated", description: `${vendorData.company_name} has been updated in your vendor list.` });
      } else {
        // Create new vendor
        await adminEntities.Vendor.create(vendorData);
        toast({ title: "Vendor imported", description: `${vendorData.company_name} has been added to your vendor list.` });
      }

      // Update invoice record with the trade
      if (!record.ai_classified_category && manualTrade) {
        await onUpdate(record.id, { ai_classified_category: manualTrade }, `Vendor imported to list with trade: ${manualTrade}`);
      }
    } catch (e) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    }
    setImportingVendor(false);
  };

  const handleApprove = async () => {
    setApproving(true);
    const scheduledDate = schedulePaymentForApproval();
    await onUpdate(record.id, { status: 'approved', scheduled_payment_date: scheduledDate }, `Approved for payment - scheduled for ${scheduledDate}`);
    setApproving(false);
  };

  const isOverdue = record.status !== 'paid' && record.status !== 'rejected' &&
    record.email_received_date &&
    differenceInDays(new Date(), parseISO(record.email_received_date)) > 30;

  const handleStatusChange = async (status) => {
    setSaving(true);
    await onUpdate(record.id, { status }, `Status changed to ${status}`);
    setSaving(false);
  };

  const handlePin = async () => {
    await onUpdate(record.id, { pinned: !record.pinned }, record.pinned ? 'Unpinned' : 'Pinned');
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    await onUpdate(record.id, {
      vendor_name: editData.vendor_name,
      invoice_number: editData.invoice_number,
      invoice_date: editData.invoice_date || null,
      due_date: editData.due_date || null,
      amount: editData.amount ? Number(editData.amount) : null,
      notes: editData.notes,
    }, 'Details updated manually');
    setEditing(false);
    setSaving(false);
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    const h = [...(record.history || []), { action: 'note_added', by: 'admin', at: new Date().toISOString(), note }];
    await onUpdate(record.id, { history: h, notes: (record.notes ? record.notes + '\n' : '') + note }, note);
    setNote("");
    setSaving(false);
    onRefresh();
  };

  const fmt = (d) => { try { return d ? format(parseISO(d), 'MMM d, yyyy') : '—'; } catch { return d || '—'; } };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white shadow-2xl flex flex-col h-[92vh] sm:h-full overflow-hidden rounded-t-2xl sm:rounded-none">
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-start gap-3 ${isOverdue ? 'bg-red-50 border-red-200' : record.pinned ? 'bg-amber-50 border-amber-200' : 'border-gray-200'}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-gray-900 text-base truncate">{record.vendor_name || record.vendor_email}</h2>
              {record.pinned && <Pin className="w-4 h-4 text-amber-500" />}
              {isOverdue && <span className="flex items-center gap-1 text-xs text-red-600 font-semibold"><AlertTriangle className="w-3.5 h-3.5" />Past 30 days</span>}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 truncate">{record.email_subject}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePin}>
              {record.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Gate status + PM approval (for sub invoices) */}
          {(record.requires_packet !== false || record.vendor_id || record.gate_blocked_reasons?.length > 0) && (
            <div className="space-y-2">
              <GateStatusBadges invoice={record} vendor={vendor} />
              <PmApprovalPanel invoice={record} vendor={vendor} onRefresh={onRefresh} />
            </div>
          )}

          {/* Status + Approve */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <InvoiceStatusBadge status={record.status} />
            <div className="flex items-center gap-2 flex-wrap">
              {record.status === 'pending_review' && !record.requires_packet && (
                <Button size="sm" className="h-8 text-xs gap-1.5 bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={approving}>
                  {approving ? '…' : '✅'} Approve
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setVendorPortalOpen(true)}>
                <Send className="w-3 h-3" /> Vendor Portal
              </Button>
              <Select value={record.status} onValueChange={handleStatusChange} disabled={saving}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="outstanding">Outstanding</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Payment stage */}
          {record.payment_stage && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500 mb-1.5 font-semibold uppercase tracking-wide">Payment Stage</p>
              <div className="flex items-center gap-1">
                {["Initial Deposit","2nd Payment","3rd Payment","Final"].map((s, i, arr) => (
                  <div key={s} className="flex items-center flex-1 min-w-0">
                    <div className="flex-1">
                      <div className={`h-1 rounded-full ${
                        arr.indexOf(record.payment_stage) > i ? "bg-green-400" :
                        s === record.payment_stage ? "bg-primary" : "bg-gray-200"
                      }`} />
                      <span className={`text-[9px] mt-0.5 block text-center leading-tight ${s === record.payment_stage ? "text-primary font-bold" : "text-gray-300"}`}>{s}</span>
                    </div>
                    {i < arr.length - 1 && <ChevronRight className="w-2.5 h-2.5 text-gray-200 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duplicate warning */}
          {record.notes?.includes('⚠️ Possible duplicate') && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-800">
              <span>⚠️</span> <span>{record.notes}</span>
            </div>
          )}

          {/* Trade/Category Assignment */}
          {!record.ai_classified_category && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-2">⚠️ Assign Trade (AI couldn't detect)</div>
              <div className="flex gap-2">
                <Select value={manualTrade} onValueChange={setManualTrade}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Select trade…" /></SelectTrigger>
                  <SelectContent>
                    {TRADE_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1 bg-amber-600 hover:bg-amber-700"
                  onClick={async () => {
                    if (manualTrade) {
                      setSaving(true);
                      await onUpdate(record.id, { ai_classified_category: manualTrade }, `Trade assigned: ${manualTrade}`);
                      setSaving(false);
                    }
                  }}
                  disabled={!manualTrade || saving}
                >
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Job Costing — tag to project */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Tag to Project (Job Costing)</div>
            {record.project_match_status === 'suggested' && record.project_id && (
              <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <p className="text-xs text-amber-900 flex items-start gap-1.5 flex-wrap">
                  <MatchConfidencePill value={record.project_match_confidence} />
                  <span><span className="font-semibold">🤖 Auto-matched:</span> {record.project_match_reason || 'PO / address matched a project'}</span>
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs flex-1 bg-green-600 hover:bg-green-700"
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      await onUpdate(record.id, { project_match_status: 'confirmed' }, `Project match confirmed: ${record.project_match_reason || ''}`);
                      setSaving(false);
                    }}
                  >
                    ✓ Confirm Match
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs flex-1 text-red-600 border-red-200 hover:bg-red-50"
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      await onUpdate(record.id, { project_match_status: 'rejected', project_id: null }, 'Auto project match rejected');
                      setSaving(false);
                    }}
                  >
                    ✗ Wrong Project
                  </Button>
                </div>
              </div>
            )}
            {record.po_name && (
              <p className="text-xs text-gray-500 mb-2">PO / Job Name on receipt: <span className="font-mono font-medium text-gray-700">{record.po_name}</span></p>
            )}
            <Select
              value={record.project_id || '__none'}
              onValueChange={(val) => onUpdate(record.id, { project_id: val === '__none' ? null : val }, 'Tagged to project')}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select a project…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— No project —</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.client_name}{p.project_type ? ` · ${p.project_type}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {record.project_id && projects.find(p => p.id === record.project_id) && (
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <p className="text-xs text-green-700">
                  ✓ Tagged to: {projects.find(p => p.id === record.project_id)?.client_name}
                  {record.project_match_status === 'confirmed' && <span className="text-gray-400"> · match confirmed</span>}
                </p>
                <a
                  href={`/estimator/projects/${record.project_id}`}
                  className="text-xs text-primary hover:underline font-medium shrink-0"
                >
                  Open Project →
                </a>
              </div>
            )}
          </div>

          {/* Customer Portal visibility — marked-up price only, cost never shown */}
          {record.project_id && (
            <div className={`rounded-lg p-4 border ${record.portal_visible ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Customer Portal</span>
                {record.portal_visible && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">👁 VISIBLE TO CUSTOMER</span>
                )}
              </div>

              {record.portal_visible ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600">
                    Customer sees <span className="font-bold text-gray-900">${Number(record.customer_display_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span className="text-gray-400"> · your cost (${Number(record.amount || 0).toLocaleString()}) and the receipt stay hidden</span>
                  </p>
                  {record.portal_approved_by && (
                    <p className="text-[10px] text-gray-400">Approved by {record.portal_approved_by}{record.portal_approved_at ? ` · ${fmt(record.portal_approved_at.slice(0, 10))}` : ''}</p>
                  )}
                  {canApprovePortal && (
                    <Button
                      size="sm" variant="outline"
                      className="h-7 text-xs w-full text-red-600 border-red-200 hover:bg-red-50"
                      disabled={saving}
                      onClick={async () => {
                        setSaving(true);
                        await onUpdate(record.id, { portal_visible: false }, 'Removed from customer portal');
                        setSaving(false);
                      }}
                    >
                      Remove from Customer Portal
                    </Button>
                  )}
                </div>
              ) : canApprovePortal ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Markup %</label>
                      <Input
                        type="number" min="0" step="1"
                        className="h-8 text-xs mt-1"
                        value={markupPct}
                        onChange={e => setMarkupPct(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Customer will see</label>
                      <div className="h-8 mt-1 flex items-center px-2 bg-white border border-gray-200 rounded-md text-xs font-bold text-gray-900">
                        {customerPrice != null ? `$${customerPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'No amount on record'}
                      </div>
                    </div>
                  </div>
                  {projectAllowances.length > 0 && (
                    <div>
                      <label className="text-xs text-gray-500">Draws from allowance</label>
                      <Select value={allowanceSel} onValueChange={setAllowanceSel}>
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">— No allowance —</SelectItem>
                          {projectAllowances.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.name} (${Number(a.amount || 0).toLocaleString()})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="h-8 text-xs w-full bg-green-600 hover:bg-green-700"
                    disabled={saving || customerPrice == null}
                    onClick={async () => {
                      setSaving(true);
                      await onUpdate(record.id, {
                        portal_visible: true,
                        markup_percent: Number(markupPct) || 0,
                        customer_display_amount: customerPrice,
                        allowance_id: allowanceSel === '__none' ? null : allowanceSel,
                      }, `Approved for customer portal at $${customerPrice?.toLocaleString()} (${markupPct}% markup)`);
                      setSaving(false);
                    }}
                  >
                    👁 Approve for Customer Portal
                  </Button>
                  <p className="text-[10px] text-gray-400">
                    The customer only ever sees the marked-up price. Your cost and the receipt document are never shown.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-400">Not shown to customer. Only an Admin, PM, or Assistant PM can approve portal visibility.</p>
              )}
            </div>
          )}

          {/* Import to Vendor List */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-2">📋 Vendor Management</div>
            <Button
              size="sm"
              className="w-full h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700"
              onClick={handleImportVendor}
              disabled={importingVendor || (!record.vendor_name && !record.vendor_email)}
            >
              <Plus className="w-3.5 h-3.5" />
              {importingVendor ? "Importing…" : "Import to Vendor List"}
            </Button>
            <p className="text-[10px] text-blue-700 mt-2">
              {record.vendor_email ? "✓ Email will be used to prevent duplicates" : "⚠️ Add vendor email for duplicate prevention"}
            </p>
          </div>

          {/* Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Details</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(e => !e)}>
                {editing ? 'Cancel' : 'Edit'}
              </Button>
            </div>
            {editing ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-gray-500">Vendor Name</label><Input className="h-8 text-xs mt-1" value={editData.vendor_name} onChange={e => setEditData(d => ({...d, vendor_name: e.target.value}))} /></div>
                  <div><label className="text-xs text-gray-500">Invoice #</label><Input className="h-8 text-xs mt-1" value={editData.invoice_number} onChange={e => setEditData(d => ({...d, invoice_number: e.target.value}))} /></div>
                  <div><label className="text-xs text-gray-500">Invoice Date</label><Input type="date" className="h-8 text-xs mt-1" value={editData.invoice_date} onChange={e => setEditData(d => ({...d, invoice_date: e.target.value}))} /></div>
                  <div><label className="text-xs text-gray-500">Due Date</label><Input type="date" className="h-8 text-xs mt-1" value={editData.due_date} onChange={e => setEditData(d => ({...d, due_date: e.target.value}))} /></div>
                  <div><label className="text-xs text-gray-500">Amount ($)</label><Input type="number" className="h-8 text-xs mt-1" value={editData.amount} onChange={e => setEditData(d => ({...d, amount: e.target.value}))} /></div>
                </div>
                <div><label className="text-xs text-gray-500">Notes</label><Textarea className="text-xs mt-1" rows={2} value={editData.notes} onChange={e => setEditData(d => ({...d, notes: e.target.value}))} /></div>
                <Button size="sm" className="h-8 text-xs" onClick={handleSaveEdit} disabled={saving}>Save Changes</Button>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  ["Type", record.document_type],
                  ["Invoice #", record.invoice_number || '—'],
                  ["Invoice Date", fmt(record.invoice_date)],
                  ["Due Date", fmt(record.due_date)],
                  ["Amount", record.amount ? `$${Number(record.amount).toLocaleString()}` : '—'],
                  ["Received", fmt(record.email_received_date)],
                  ["From Email", record.vendor_email],
                  ["Scanned From", record.connected_user_email],
                  ["Trade/Service", record.ai_classified_category || record.vendor_category || '—'],
                  ["Vendor Category", record.vendor_category || '—'],
                  ["PO / Job Name", record.po_name || '—'],
                  ["Delivery Address", record.delivery_address || '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-gray-400">{k}</dt>
                    <dd className="text-xs font-medium text-gray-800 truncate">{v || '—'}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* Email snippet */}
          {record.email_snippet && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-500 mb-1">Email Snippet</div>
              <p className="text-xs text-gray-600">{record.email_snippet}</p>
            </div>
          )}

          {/* Attachments + Vendor submissions */}
          {(record.attachment_names?.length > 0 || record.all_attachment_versions?.length > 0) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-500">Attachments</div>
                {(record.attachment_urls?.[0] || record.all_attachment_versions?.[0]?.url) && (
                  <button onClick={() => setDocSplit(v => !v)} className="text-xs text-primary hover:underline">
                    {docSplit ? "Hide Preview" : "Side-by-Side Preview"}
                  </button>
                )}
              </div>

              {/* Side-by-side document viewer */}
              {docSplit && (record.attachment_urls?.[0] || record.all_attachment_versions?.[0]?.url) && (
                <div className="mb-3 border border-gray-200 rounded-xl overflow-hidden">
                  <iframe
                    src={record.all_attachment_versions?.slice(-1)[0]?.url || record.attachment_urls?.[0]}
                    className="w-full h-64"
                    title="Invoice Document Preview"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                {record.attachment_names?.map((name, i) => {
                  const url = record.attachment_urls?.[i];
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 text-xs text-gray-700 bg-gray-50 px-3 py-2.5 rounded hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => url && setPreviewAttachment({ url, name })}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate font-medium">{name}</span>
                      </div>
                      {url && (
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <a href={url} download className="p-1 hover:bg-gray-200 rounded transition-colors" title="Download">
                            <Download className="w-3.5 h-3.5 text-gray-600" />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Vendor-submitted versions */}
                {record.all_attachment_versions?.map((v, i) => (
                  <div
                    key={`v-${i}`}
                    className="flex items-center justify-between gap-2 text-xs bg-green-50 border border-green-100 px-3 py-2.5 rounded hover:bg-green-100 transition-colors cursor-pointer"
                    onClick={() => setPreviewAttachment({ url: v.url, name: v.file_name || v.stage })}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="truncate text-green-800 font-medium">{v.file_name || v.stage}</span>
                      <span className="shrink-0 text-[10px] font-bold bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full">{v.stage}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <a href={v.url} download className="p-1 hover:bg-green-200 rounded transition-colors" title="Download">
                        <Download className="w-3.5 h-3.5 text-green-700" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {record.notes && (
            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
              <div className="font-semibold mb-1">Notes</div>
              <p className="whitespace-pre-wrap">{record.notes}</p>
            </div>
          )}

          {/* Add note */}
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1.5">Add Note</div>
            <Textarea
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note or action…"
              className="text-xs"
            />
            <Button size="sm" className="mt-2 h-8 text-xs" onClick={handleAddNote} disabled={saving || !note.trim()}>
              Save Note
            </Button>
          </div>

          {/* History */}
          {record.history?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> History</div>
              <div className="space-y-2">
                {[...record.history].reverse().map((h, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                    <div>
                      <span className="font-medium text-gray-700">{h.action?.replace(/_/g, ' ')}</span>
                      <span className="text-gray-400"> by {h.by}</span>
                      {h.note && <div className="text-gray-500 italic">{h.note}</div>}
                      <div className="text-gray-300">{h.at ? fmt(h.at.slice(0, 10)) : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {vendorPortalOpen && (
        <VendorPortalModal
          record={record}
          onClose={() => setVendorPortalOpen(false)}
          onRefresh={onRefresh}
        />
      )}

      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  );
}