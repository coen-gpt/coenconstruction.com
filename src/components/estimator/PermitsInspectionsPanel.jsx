import { useState } from "react";
import { ClipboardCheck, FileBadge, Plus, Save, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_INSPECTIONS = ["Permit Submitted", "Permit Approved", "Framing", "Electrical Rough", "Plumbing Rough", "Insulation", "Final"];

export default function PermitsInspectionsPanel({ project, onUpdate }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    permit_number: project.permit_number || "",
    permit_status: project.permit_status || "not_started",
    permit_submitted_date: project.permit_submitted_date || "",
    permit_approved_date: project.permit_approved_date || "",
    permit_notes: project.permit_notes || "",
    inspections: project.inspections?.length ? project.inspections : DEFAULT_INSPECTIONS.map(name => ({ id: crypto.randomUUID(), name, status: "pending", scheduled_date: "", completed_date: "", notes: "" })),
  });

  const updateInspection = (id, patch) => {
    setForm(f => ({ ...f, inspections: f.inspections.map(i => i.id === id ? { ...i, ...patch } : i) }));
  };

  const save = async () => {
    setSaving(true);
    await base44.entities.ContractorProject.update(project.id, form);
    setSaving(false);
    onUpdate?.();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-bold text-secondary flex items-center gap-2"><FileBadge className="w-5 h-5 text-primary" /> Permits & Inspections</h2>
            <p className="text-sm text-gray-500">Track municipal permit status and residential inspection milestones.</p>
          </div>
          <Button onClick={save} disabled={saving} className="gap-2 bg-primary text-white"><Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}</Button>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Permit #</label>
            <Input value={form.permit_number} onChange={e => setForm(f => ({ ...f, permit_number: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Status</label>
            <select value={form.permit_status} onChange={e => setForm(f => ({ ...f, permit_status: e.target.value }))} className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="not_started">Not Started</option>
              <option value="preparing">Preparing</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="revisions_required">Revisions Required</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Submitted</label>
            <Input type="date" value={form.permit_submitted_date} onChange={e => setForm(f => ({ ...f, permit_submitted_date: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Approved</label>
            <Input type="date" value={form.permit_approved_date} onChange={e => setForm(f => ({ ...f, permit_approved_date: e.target.value }))} className="mt-1" />
          </div>
        </div>
        <Textarea rows={3} value={form.permit_notes} onChange={e => setForm(f => ({ ...f, permit_notes: e.target.value }))} placeholder="Permit notes, town requirements, inspection office contact…" className="mt-4" />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-secondary flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-primary" /> Inspection Checklist</h3>
          <Button variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, inspections: [...f.inspections, { id: crypto.randomUUID(), name: "", status: "pending", scheduled_date: "", completed_date: "", notes: "" }] }))} className="gap-1"><Plus className="w-4 h-4" /> Add</Button>
        </div>
        <div className="space-y-3">
          {form.inspections.map(item => (
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
              <button className="text-gray-300 hover:text-red-500 p-2" onClick={() => setForm(f => ({ ...f, inspections: f.inspections.filter(i => i.id !== item.id) }))}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
