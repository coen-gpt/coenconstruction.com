/**
 * Employees → Onboarding Packets — /admin/onboarding
 *
 * Send W2-employee or 1099-contractor onboarding packets, track their
 * progress, review every submitted form (W-4 / M-4 / W-9), view & download
 * the photo-ID proof and signature, and approve or request changes.
 * Contractor packets link straight to their synced Vendors & Subs record.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus, Send, Loader2, CheckCircle, Clock, AlertCircle, FileText, User,
  Download, ExternalLink, X, RefreshCw, Building2, BookOpen, PenLine,
} from "lucide-react";

const STATUS_META = {
  sent: { label: "Link Sent", cls: "bg-blue-100 text-blue-700", icon: Send },
  in_progress: { label: "In Progress", cls: "bg-amber-100 text-amber-700", icon: Clock },
  submitted: { label: "Submitted — Review", cls: "bg-purple-100 text-purple-700", icon: FileText },
  approved: { label: "Approved", cls: "bg-green-100 text-green-700", icon: CheckCircle },
  changes_requested: { label: "Changes Requested", cls: "bg-red-100 text-red-700", icon: AlertCircle },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.sent;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
}

function KV({ k, v }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-gray-50 text-sm">
      <span className="text-gray-500">{k}</span>
      <span className="font-medium text-secondary text-right">{v ?? "—"}</span>
    </div>
  );
}

const W4_FILING = { single: "Single / Married filing separately", married_jointly: "Married filing jointly", head_of_household: "Head of household" };
const W9_CLASS = { sole_prop: "Individual / Sole proprietor", c_corp: "C Corp", s_corp: "S Corp", partnership: "Partnership", trust_estate: "Trust / Estate", llc_c: "LLC (C)", llc_s: "LLC (S)", llc_p: "LLC (P)", other: "Other" };

function DetailDrawer({ record, onClose, onChanged }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(null);

  const review = async (action) => {
    if (action === "request_changes" && !notes.trim()) {
      toast({ title: "Add a note", description: "Tell them what needs to change.", variant: "destructive" });
      return;
    }
    setActing(action);
    try {
      const res = await base44.functions.invoke("reviewEmployeeOnboarding", { onboarding_id: record.id, action, notes: notes.trim() });
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: action === "approve" ? "Packet approved ✓" : "Changes requested", description: `${record.full_name} has been emailed.` });
      qc.invalidateQueries({ queryKey: ["employee-onboarding"] });
      onChanged?.();
      onClose();
    } catch (err) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActing(null);
    }
  };

  const resend = async () => {
    setActing("resend");
    try {
      const res = await base44.functions.invoke("sendEmployeeOnboardingInvite", { onboarding_id: record.id });
      if (res.data?.error) throw new Error(res.data.error);
      if (res.data?.email_sent === false && res.data?.portal_url) {
        navigator.clipboard?.writeText(res.data.portal_url).catch(() => {});
        toast({ title: "Link refreshed — email delivery failed", description: `Copied to clipboard — send it directly: ${res.data.portal_url}`, duration: 15000 });
      } else {
        toast({ title: "Link re-sent", description: `Email sent to ${record.email}` });
      }
    } catch (err) {
      toast({ title: "Resend failed", description: err.message, variant: "destructive" });
    } finally {
      setActing(null);
    }
  };

  const w4 = record.form_w4 || {};
  const m4 = record.form_m4 || {};
  const w9 = record.form_w9 || {};
  const personal = record.personal_info || {};
  const isContractor = record.worker_type === "contractor";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-bold text-secondary">{record.full_name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={record.status} />
              <span className="text-xs text-gray-400">{isContractor ? "1099 Contractor" : "W2 Employee"}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Basics */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Details</h3>
            <KV k="Email" v={record.email} />
            <KV k="Phone" v={record.phone || personal.phone} />
            <KV k="Position" v={record.position} />
            <KV k="Start date" v={record.start_date} />
            <KV k="Address" v={personal.address} />
            <KV k="Date of birth" v={personal.dob} />
            <KV k="Emergency contact" v={personal.emergency_contact_name ? `${personal.emergency_contact_name} · ${personal.emergency_contact_phone || ""}` : null} />
            <KV k="Invited by" v={record.invited_by} />
            {record.submitted_at && <KV k="Submitted" v={format(new Date(record.submitted_at), "MMM d, yyyy h:mm a")} />}
            {record.reviewed_by && <KV k="Reviewed" v={`${record.reviewed_by} · ${record.reviewed_at ? format(new Date(record.reviewed_at), "MMM d, yyyy") : ""}`} />}
          </section>

          {/* Tax forms */}
          {isContractor ? (
            <section>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Form W-9</h3>
              <KV k="Name on tax return" v={w9.name} />
              <KV k="Business / DBA" v={w9.business_name} />
              <KV k="Tax classification" v={W9_CLASS[w9.tax_classification] || w9.tax_classification} />
              <KV k={`TIN (${(w9.tin_type || "ssn").toUpperCase()})`} v={w9.tin} />
              <KV k="Address" v={w9.address} />
              <KV k="Certified" v={w9.certified ? "Yes — under penalties of perjury" : "No"} />
              {record.vendor_id && (
                <Link to="/estimator/vendors" className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold mt-2 hover:underline">
                  <Building2 className="w-4 h-4" /> View synced Vendors &amp; Subs record
                </Link>
              )}
            </section>
          ) : (
            <>
              <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Federal W-4</h3>
                <KV k="SSN" v={w4.ssn} />
                <KV k="Filing status" v={W4_FILING[w4.filing_status] || w4.filing_status} />
                <KV k="Multiple jobs (2c)" v={w4.multiple_jobs ? "Yes" : "No"} />
                <KV k="Qualifying children" v={w4.dependents_children} />
                <KV k="Other dependents" v={w4.dependents_other} />
                <KV k="Other income (4a)" v={w4.other_income ? `$${w4.other_income}` : "—"} />
                <KV k="Deductions (4b)" v={w4.deductions ? `$${w4.deductions}` : "—"} />
                <KV k="Extra withholding (4c)" v={w4.extra_withholding ? `$${w4.extra_withholding}` : "—"} />
                <KV k="Claims exempt" v={w4.claim_exempt ? "YES" : "No"} />
              </section>
              <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Massachusetts M-4</h3>
                <KV k="Personal exemption" v={m4.personal_exemption ? "Yes" : "No"} />
                <KV k="Spouse exemption" v={m4.spouse_exemption ? "Yes" : "No"} />
                <KV k="Dependents" v={m4.dependents_count} />
                <KV k="Additional withholding" v={m4.additional_withholding ? `$${m4.additional_withholding}` : "—"} />
                <KV k="Head of household" v={m4.head_of_household ? "Yes" : "No"} />
                <KV k="Blind / 65+ / student" v={[m4.blind && "Blind", m4.age_65_or_over && "65+", m4.full_time_student && "Student"].filter(Boolean).join(", ") || "—"} />
              </section>
              <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> Handbook</h3>
                <KV k="Acknowledged" v={record.handbook_acknowledged ? `Yes · ${record.handbook_acknowledged_at ? format(new Date(record.handbook_acknowledged_at), "MMM d, yyyy") : ""}` : "No"} />
              </section>
            </>
          )}

          {/* ID proof */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Photo ID Proof {record.id_capture_method ? `(${record.id_capture_method === "camera" ? "live capture" : "uploaded"})` : ""}</h3>
            <div className="grid grid-cols-2 gap-3">
              {[["Front", record.id_front_url], ["Back", record.id_back_url]].map(([side, url]) => (
                <div key={side} className="border border-gray-200 rounded-xl p-2">
                  <p className="text-xs text-gray-400 mb-1">{side}</p>
                  {url ? (
                    <>
                      <a href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={`ID ${side}`} className="w-full h-28 object-cover rounded-lg" />
                      </a>
                      <a href={url} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-1 text-xs text-primary font-semibold mt-1.5 hover:underline">
                        <Download className="w-3 h-3" /> Download
                      </a>
                    </>
                  ) : (
                    <p className="text-xs text-gray-300 py-10 text-center">Not provided</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Signature */}
          {record.signature_data && (
            <section>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1"><PenLine className="w-3.5 h-3.5" /> Signature</h3>
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                <img src={record.signature_data} alt="Signature" className="h-16" />
                <p className="text-xs text-gray-500 mt-1">{record.signed_name} · {record.signed_at ? format(new Date(record.signed_at), "MMM d, yyyy h:mm a") : ""}</p>
                <a href={record.signature_data} download={`signature-${(record.full_name || "employee").replace(/\s+/g, "-")}.png`} className="inline-flex items-center gap-1 text-xs text-primary font-semibold mt-1 hover:underline">
                  <Download className="w-3 h-3" /> Download signature
                </a>
              </div>
            </section>
          )}

          {/* Actions */}
          <section className="border-t border-gray-100 pt-4 space-y-3">
            {record.status !== "approved" && (
              <>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional note to the new hire (required when requesting changes)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <Button onClick={() => review("approve")} disabled={!!acting} className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white">
                    {acting === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Approve
                  </Button>
                  <Button onClick={() => review("request_changes")} disabled={!!acting} variant="outline" className="flex-1 gap-2 text-amber-700 border-amber-300">
                    {acting === "request_changes" ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />} Request Changes
                  </Button>
                </div>
              </>
            )}
            <Button onClick={resend} disabled={!!acting} variant="outline" className="w-full gap-2">
              {acting === "resend" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Re-send Onboarding Link
            </Button>
            {record.review_notes && (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-2">Last review note: {record.review_notes}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeOnboardingAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showSend, setShowSend] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", worker_type: "w2", position: "", start_date: "" });

  const { data: packets = [], isLoading } = useQuery({
    queryKey: ["employee-onboarding"],
    // RLS-locked entity (SSNs / ID photos) — read through the admin function
    queryFn: () => base44.functions.invoke("listEmployeeOnboarding", {}).then((res) => res.data?.records || []),
  });

  const sendMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await base44.functions.invoke("sendEmployeeOnboardingInvite", payload);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["employee-onboarding"] });
      setShowSend(false);
      setForm({ full_name: "", email: "", phone: "", worker_type: "w2", position: "", start_date: "" });
      if (data?.email_sent === false && data?.portal_url) {
        navigator.clipboard?.writeText(data.portal_url).catch(() => {});
        toast({
          title: "Packet created — email delivery failed",
          description: `The onboarding link was copied to your clipboard — send it to the new hire directly: ${data.portal_url}`,
          duration: 15000,
        });
      } else {
        toast({ title: "Onboarding packet sent!", description: "The new hire received the link by email (and SMS if a phone was provided)." });
      }
    },
    onError: (err) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  const needsReview = packets.filter((p) => p.status === "submitted").length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Onboarding Packets</h1>
          <p className="text-sm text-gray-500">
            Send new hires their W2 or 1099 onboarding packet — tax forms, photo ID, handbook &amp; signature.
            {needsReview > 0 && <span className="text-purple-600 font-semibold"> {needsReview} awaiting review.</span>}
          </p>
        </div>
        <Button onClick={() => setShowSend(true)} className="gap-2 bg-primary text-white">
          <Plus className="w-4 h-4" /> Send New Packet
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : packets.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No onboarding packets yet — send your first one.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-secondary/5 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">New Hire</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Type</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Sent</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {packets.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setDetail(p)}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-secondary text-sm">{p.full_name}</div>
                    <div className="text-xs text-gray-400">{p.email}{p.position ? ` · ${p.position}` : ""}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${p.worker_type === "contractor" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-700"}`}>
                      {p.worker_type === "contractor" ? "1099 Contractor" : "W2 Employee"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 hidden md:table-cell">
                    {p.last_sent_at ? format(new Date(p.last_sent_at), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <ExternalLink className="w-4 h-4 text-gray-300 inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Send dialog */}
      <Dialog open={showSend} onOpenChange={setShowSend}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Send Onboarding Packet</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-2">
              {[["w2", "W2 Employee", "W-4 + MA M-4, ID, handbook"], ["contractor", "1099 Contractor", "W-9, ID — syncs to Vendors & Subs"]].map(([val, label, hint]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, worker_type: val }))}
                  className={`p-3 rounded-xl border-2 text-left transition-colors ${form.worker_type === val ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <p className="font-semibold text-sm text-secondary">{label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>
                </button>
              ))}
            </div>
            {[["full_name", "Full Name *"], ["email", "Email *"], ["phone", "Phone (for SMS link)"], ["position", "Position / Title"]].map(([field, label]) => (
              <div key={field}>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">{label}</label>
                <Input value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Start Date</label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowSend(false)}>Cancel</Button>
              <Button
                onClick={() => sendMutation.mutate(form)}
                disabled={sendMutation.isPending || !form.full_name || !form.email}
                className="bg-primary text-white gap-2"
              >
                {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Packet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {detail && (
        <DetailDrawer
          record={detail}
          onClose={() => setDetail(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["employee-onboarding"] })}
        />
      )}
    </div>
  );
}
