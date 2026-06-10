import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft, Plus, Save, X, Settings, ToggleLeft, ToggleRight, Clock, Edit3
} from "lucide-react";
import { Link } from "react-router-dom";

const TRIGGER_TYPES = [
  { value: "project_created", label: "Project Created" },
  { value: "project_status_change", label: "Project Status Change" },
  { value: "milestone_complete", label: "Milestone Complete" },
  { value: "time_interval", label: "Time Interval (recurring)" },
  { value: "days_since_last_contact", label: "Days Since Last Contact" },
  { value: "pre_milestone", label: "Before Milestone" },
];

const CHANNELS = ["phone", "email", "text", "in_person", "portal", "other"];
const URGENCIES = ["high", "normal", "low"];

const EMPTY_FORM = {
  key: "",
  name: "",
  description: "",
  active: true,
  trigger_type: "project_status_change",
  trigger_value: "",
  offset_hours: 0,
  channel_suggested: "phone",
  message_template: "",
  default_urgency: "normal",
  escalate_to_high_after_hours: 24,
};

export default function BenchmarkSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null); // benchmark id or "new"
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: benchmarks = [], isLoading } = useQuery({
    queryKey: ["comm-benchmarks"],
    queryFn: () => base44.entities.CommunicationBenchmark.list("-created_date"),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editing === "new") {
        return base44.entities.CommunicationBenchmark.create(data);
      }
      return base44.entities.CommunicationBenchmark.update(editing, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comm-benchmarks"] });
      setEditing(null);
      toast({ title: "Benchmark saved" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }) => base44.entities.CommunicationBenchmark.update(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comm-benchmarks"] }),
  });

  const startEdit = (bm) => {
    setForm({ ...EMPTY_FORM, ...bm });
    setEditing(bm.id);
  };

  const startNew = () => {
    setForm({ ...EMPTY_FORM });
    setEditing("new");
  };

  const f = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  const fNum = (field) => (e) => setForm(prev => ({ ...prev, [field]: Number(e.target.value) }));

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/estimator" className="text-gray-400 hover:opacity-70">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-secondary flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-500" /> Communication Benchmarks
          </h1>
          <p className="text-sm text-gray-500">Configure when the system prompts outbound client contact</p>
        </div>
        <Button size="sm" className="ml-auto gap-1.5 text-xs bg-primary text-white" onClick={startNew}>
          <Plus className="w-3.5 h-3.5" /> New Benchmark
        </Button>
      </div>

      {/* Edit / New form */}
      {editing && (
        <div className="bg-white border border-indigo-200 rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-secondary">{editing === "new" ? "New Benchmark" : "Edit Benchmark"}</h2>
            <button onClick={() => setEditing(null)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Key (unique)</label>
              <Input className="mt-1 h-8 text-sm" value={form.key} onChange={f("key")} placeholder="e.g. post_walkthrough_recap" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Name</label>
              <Input className="mt-1 h-8 text-sm" value={form.name} onChange={f("name")} placeholder="Human label" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Description (internal)</label>
              <Input className="mt-1 h-8 text-sm" value={form.description} onChange={f("description")} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Trigger Type</label>
              <select value={form.trigger_type} onChange={f("trigger_type")} className="mt-1 w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 h-8 bg-white">
                {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Trigger Value</label>
              <Input className="mt-1 h-8 text-sm" value={form.trigger_value} onChange={f("trigger_value")} placeholder="Status, milestone name, or days" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Offset Hours</label>
              <Input type="number" className="mt-1 h-8 text-sm" value={form.offset_hours} onChange={fNum("offset_hours")} />
              <p className="text-xs text-gray-400 mt-0.5">Negative = before trigger</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Suggested Channel</label>
              <select value={form.channel_suggested} onChange={f("channel_suggested")} className="mt-1 w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 h-8 bg-white">
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Default Urgency</label>
              <select value={form.default_urgency} onChange={f("default_urgency")} className="mt-1 w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 h-8 bg-white">
                {URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Escalate to High After (hrs)</label>
              <Input type="number" className="mt-1 h-8 text-sm" value={form.escalate_to_high_after_hours} onChange={fNum("escalate_to_high_after_hours")} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
                Message Template <span className="font-normal text-gray-400 normal-case">(client-facing: no internal cost details)</span>
              </label>
              <Textarea rows={4} className="mt-1 text-sm resize-none" value={form.message_template} onChange={f("message_template")} placeholder="Talking points / draft message for client…" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" className="bg-primary text-white gap-1" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              <Save className="w-3.5 h-3.5" /> {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Benchmark list */}
      {isLoading && <div className="text-center py-8 text-gray-400">Loading benchmarks…</div>}
      {!isLoading && benchmarks.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No benchmarks yet. Create one or run "Seed Defaults" below.</p>
          <Button size="sm" variant="outline" className="mt-3 text-xs" onClick={() => base44.functions.invoke("generateCommunications", { seed_defaults: true }).then(() => qc.invalidateQueries({ queryKey: ["comm-benchmarks"] }))}>
            Seed Default Benchmarks
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {benchmarks.map(bm => (
          <div key={bm.id} className={`bg-white border rounded-xl p-4 flex items-start gap-3 ${bm.active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
            <button
              onClick={() => toggleMutation.mutate({ id: bm.id, active: !bm.active })}
              className="shrink-0 mt-0.5 text-gray-400 hover:text-gray-600"
            >
              {bm.active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-secondary">{bm.name}</span>
                <span className="text-xs text-gray-400 font-mono">{bm.key}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  bm.default_urgency === "high" ? "bg-red-100 text-red-700"
                  : bm.default_urgency === "low" ? "bg-gray-100 text-gray-500"
                  : "bg-blue-100 text-blue-700"
                }`}>{bm.default_urgency}</span>
                {!bm.active && <span className="text-xs bg-gray-100 text-gray-400 rounded-full px-1.5 py-0.5">disabled</span>}
              </div>
              {bm.description && <p className="text-xs text-gray-500 mt-0.5">{bm.description}</p>}
              <div className="flex gap-3 mt-1 flex-wrap text-xs text-gray-400">
                <span>Trigger: <strong className="text-gray-600">{bm.trigger_type}</strong>{bm.trigger_value ? ` = ${bm.trigger_value}` : ""}</span>
                {bm.offset_hours !== 0 && <span>Offset: {bm.offset_hours}h</span>}
                <span>Channel: {bm.channel_suggested}</span>
                <span>Escalate after: {bm.escalate_to_high_after_hours}h</span>
              </div>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 gap-1 text-xs h-7" onClick={() => startEdit(bm)}>
              <Edit3 className="w-3 h-3" /> Edit
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}