import { useState } from "react";
import { ClipboardCheck, ExternalLink, FileBadge, Inbox, Plus, Save, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";

const DEFAULT_INSPECTIONS = ["Permit Submitted", "Permit Approved", "Framing", "Electrical Rough", "Plumbing Rough", "Insulation", "Final"];

const PERMIT_STATUSES = ["applied", "in_review", "info_requested", "issued", "denied", "closed"];

const STATUS_COLORS = {
  applied: "bg-blue-100 text-blue-700",
  in_review: "bg-yellow-100 text-yellow-700",
  info_requested: "bg-amber-100 text-amber-700",
  issued: "bg-green-100 text-green-700",
  denied: "bg-red-100 text-red-700",
  closed: "bg-gray-100 text-gray-500",
};

const emptyPermit = () => ({
  id: crypto.randomUUID(),
  permit_number: "",
  permit_type: "",
  municipality: "",
  status: "applied",
  applied_date: "",
  issued_date: "",
  cost: "",
  source_link: "",
  notes: "",
});

// Older projects stored a single flat permit on the project record — seed
// the permits list from it so nothing entered before the array existed is lost.
function initialPermits(project) {
  if (project.permits?.length) {
    return project.permits.map(p => ({ ...emptyPermit(), ...p, cost: p.cost ?? "" }));
  }
  if (project.permit_number || project.permit_status || project.permit_notes) {
    return [{
      ...emptyPermit(),
      permit_number: project.permit_number || "",
      status: project.permit_status === "approved" ? "issued" : "applied",
      applied_date: project.permit_submitted_date || "",
      issued_date: project.permit_approved_date || "",
      notes: project.permit_notes || "",
    }];
  }
  return [];
}

export default function PermitsInspectionsPanel({ project, onUpdate }) {
  const { toast } = useToast();
  const { brandColor } = useCompanyBrand();
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permits, setPermits] = useState(() => initialPermits(project));
  const [inspections, setInspections] = useState(() =>
    project.inspections?.length
      ? project.inspections
      : DEFAULT_INSPECTIONS.map(name => ({ id: crypto.randomUUID(), name, status: "pending", scheduled_date: "", completed_date: "", notes: "" }))
  );

  const updatePermit = (id, patch) => {
    setPermits(list => list.map(p => p.id === id ? { ...p, ...patch } : p));
  };

  const updateInspection = (id, patch) => {
    setInspections(list => list.map(i => i.id === id ? { ...i, ...patch } : i));
  };

  const save = async () => {
    setSaving(true);
    try {
      await adminEntities.ContractorProject.update(project.id, {
        permits: permits.map(p => ({ ...p, cost: p.cost === "" ? undefined : Number(p.cost) })),
        inspections,
      });
      toast({ title: "Saved", description: "Permits and inspections updated." });
      onUpdate?.();
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  // One pass = scan up to 50 permit-related emails in small batches (AI work
  // must finish inside the gateway timeout). Chained rounds drain the
  // backlog; a timed-out round is retried once — the server-side skip list
  // makes re-running safe.
  const scanInbox = async () => {
    setScanning(true);
    let matchedTotal = 0;
    let scanned = 0;
    let consecutiveFailures = 0;
    let lastError = null;
    try {
      for (let round = 0; round < 15; round++) {
        let d;
        try {
          const res = await base44.functions.invoke("scanPermitEmails", { maxResults: 50, processLimit: 3 });
          d = res.data || {};
          if (d.error) throw new Error(d.error);
          consecutiveFailures = 0;
        } catch (err) {
          lastError = err;
          consecutiveFailures++;
          if (consecutiveFailures >= 2) throw err;
          await new Promise(r => setTimeout(r, 2500));
          continue;
        }
        matchedTotal += d.matched || 0;
        scanned += d.scanned || 0;
        if (!d.remaining) break;
      }
      toast({
        title: matchedTotal > 0 ? `Permit info found on ${matchedTotal} email${matchedTotal !== 1 ? "s" : ""}` : "No new permit info found",
        description: `${scanned} emails scanned across all projects. Reload to see updates.`,
      });
      onUpdate?.();
    } catch (err) {
      toast({
        title: "Scan stopped early",
        description: `${scanned} scanned, ${matchedTotal} matched before the error (${(lastError || err).message}). Click again to continue — already-scanned emails are skipped.`,
        variant: "destructive",
      });
      onUpdate?.();
    }
    setScanning(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="font-bold text-secondary flex items-center gap-2"><FileBadge className="w-5 h-5 text-primary" /> Permits</h2>
            <p className="text-sm text-gray-500">Municipal permits for this project — numbers, status, dates, and fees.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={scanInbox} disabled={scanning} variant="outline" size="sm" className="gap-2">
              <Inbox className="w-4 h-4" /> {scanning ? "Scanning inbox…" : "Scan Email for Permits"}
            </Button>
            <Button onClick={() => setPermits(list => [...list, emptyPermit()])} variant="outline" size="sm" className="gap-1">
              <Plus className="w-4 h-4" /> Add Permit
            </Button>
            <Button onClick={save} disabled={saving} size="sm" className="gap-2 text-white font-semibold" style={{ background: brandColor }}>
              <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {permits.length === 0 && (
          <div className="text-center py-8 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-400">
            <FileBadge className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No permits on file</p>
            <p className="text-xs mt-1">Add one manually, or scan the company inbox for permit notifications.</p>
          </div>
        )}

        <div className="space-y-4">
          {permits.map(p => (
            <div key={p.id} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-secondary text-sm">{p.permit_number || "Permit"}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-500"}`}>
                    {(p.status || "").replace(/_/g, " ") || "—"}
                  </span>
                  {p.municipality && <span className="text-xs text-gray-400">{p.municipality}</span>}
                </div>
                <div className="flex items-center gap-1">
                  {p.source_link && (
                    <a href={p.source_link} target="_blank" rel="noreferrer" title="Open source email/document">
                      <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"><ExternalLink className="w-3 h-3" /> Source</Button>
                    </a>
                  )}
                  <button className="text-gray-300 hover:text-red-500 p-2" onClick={() => setPermits(list => list.filter(x => x.id !== p.id))}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid md:grid-cols-6 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Permit #</label>
                  <Input value={p.permit_number} onChange={e => updatePermit(p.id, { permit_number: e.target.value })} className="mt-1" placeholder="ALT1741248" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Type</label>
                  <Input value={p.permit_type} onChange={e => updatePermit(p.id, { permit_type: e.target.value })} className="mt-1" placeholder="Long Form Building" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Municipality</label>
                  <Input value={p.municipality} onChange={e => updatePermit(p.id, { municipality: e.target.value })} className="mt-1" placeholder="City of Boston (ISD)" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Status</label>
                  <select value={p.status} onChange={e => updatePermit(p.id, { status: e.target.value })} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    {PERMIT_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Applied</label>
                  <Input type="date" value={p.applied_date || ""} onChange={e => updatePermit(p.id, { applied_date: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Issued</label>
                  <Input type="date" value={p.issued_date || ""} onChange={e => updatePermit(p.id, { issued_date: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div className="grid md:grid-cols-6 gap-3 mt-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Fee ($)</label>
                  <Input type="number" value={p.cost ?? ""} onChange={e => updatePermit(p.id, { cost: e.target.value })} className="mt-1" placeholder="—" />
                </div>
                <div className="md:col-span-5">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Notes</label>
                  <Textarea rows={2} value={p.notes || ""} onChange={e => updatePermit(p.id, { notes: e.target.value })} className="mt-1" placeholder="Timeline, inspector contacts, outstanding requests…" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-secondary flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-primary" /> Inspection Checklist</h3>
          <Button variant="outline" size="sm" onClick={() => setInspections(list => [...list, { id: crypto.randomUUID(), name: "", status: "pending", scheduled_date: "", completed_date: "", notes: "" }])} className="gap-1"><Plus className="w-4 h-4" /> Add</Button>
        </div>
        <div className="space-y-3">
          {inspections.map(item => (
            <div key={item.id} className="grid md:grid-cols-12 gap-2 items-start border border-gray-100 rounded-lg p-3">
              <Input className="md:col-span-3" value={item.name} onChange={e => updateInspection(item.id, { name: e.target.value })} placeholder="Inspection" />
              <select value={item.status} onChange={e => updateInspection(item.id, { status: e.target.value })} className="md:col-span-2 h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="not_required">N/A</option>
              </select>
              <Input className="md:col-span-2" type="date" value={item.scheduled_date || ""} onChange={e => updateInspection(item.id, { scheduled_date: e.target.value })} />
              <Input className="md:col-span-2" type="date" value={item.completed_date || ""} onChange={e => updateInspection(item.id, { completed_date: e.target.value })} />
              <Input className="md:col-span-2" value={item.notes || ""} onChange={e => updateInspection(item.id, { notes: e.target.value })} placeholder="Notes" />
              <button className="text-gray-300 hover:text-red-500 p-2" onClick={() => setInspections(list => list.filter(i => i.id !== item.id))}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
