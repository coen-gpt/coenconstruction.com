import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckCircle2, Circle, Plus, Trash2, Save, RefreshCw,
  CalendarDays, ChevronDown, ChevronUp, Flag, Clock, CheckSquare, Sparkles
} from "lucide-react";

const DEFAULT_STAGES = [
  {
    id: "pre_construction",
    name: "Pre-Construction",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    dot: "bg-yellow-400",
    milestones: [
      { id: "permits", label: "Permits pulled", done: false },
      { id: "materials_ordered", label: "Materials ordered", done: false },
      { id: "subs_scheduled", label: "Subs/crew scheduled", done: false },
      { id: "client_walkthrough", label: "Pre-construction walkthrough with client", done: false },
      { id: "deposit_received", label: "Deposit received", done: false },
    ]
  },
  {
    id: "demo_framing",
    name: "Demo & Framing",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    dot: "bg-orange-400",
    milestones: [
      { id: "demo_complete", label: "Demolition complete", done: false },
      { id: "framing_complete", label: "Framing complete", done: false },
      { id: "rough_inspections", label: "Rough inspections passed", done: false },
    ]
  },
  {
    id: "rough_ins",
    name: "Rough-Ins",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    dot: "bg-blue-400",
    milestones: [
      { id: "electrical_rough", label: "Electrical rough-in", done: false },
      { id: "plumbing_rough", label: "Plumbing rough-in", done: false },
      { id: "hvac_rough", label: "HVAC rough-in", done: false },
      { id: "insulation", label: "Insulation complete", done: false },
    ]
  },
  {
    id: "finishes",
    name: "Finishes",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    dot: "bg-purple-400",
    milestones: [
      { id: "drywall", label: "Drywall hung & finished", done: false },
      { id: "paint", label: "Paint complete", done: false },
      { id: "flooring", label: "Flooring installed", done: false },
      { id: "cabinets", label: "Cabinets & millwork installed", done: false },
      { id: "trim", label: "Trim & doors installed", done: false },
    ]
  },
  {
    id: "final",
    name: "Final & Close-Out",
    color: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-400",
    milestones: [
      { id: "final_inspections", label: "Final inspections passed", done: false },
      { id: "punch_list", label: "Punch list complete", done: false },
      { id: "final_payment", label: "Final payment received", done: false },
      { id: "client_sign_off", label: "Client sign-off obtained", done: false },
      { id: "warranty_docs", label: "Warranty docs delivered", done: false },
    ]
  }
];

export default function ProjectWorkflow({ project, onUpdate }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedStage, setExpandedStage] = useState(null);
  const [newMilestoneText, setNewMilestoneText] = useState({});
  const [newMilestoneDate, setNewMilestoneDate] = useState({});

  const initStages = () => {
    if (project?.workflow_stages?.length) return project.workflow_stages;
    return DEFAULT_STAGES;
  };

  const [stages, setStages] = useState(initStages);

  const [schedule, setSchedule] = useState(project?.workflow_schedule || {
    start_date: project?.walkthrough_date || "",
    estimated_duration_weeks: "",
    key_dates: []
  });

  const toggleMilestone = (stageId, milestoneId) => {
    setStages(prev => prev.map(s => {
      if (s.id !== stageId) return s;
      return {
        ...s,
        milestones: s.milestones.map(m =>
          m.id === milestoneId ? { ...m, done: !m.done, done_at: !m.done ? new Date().toISOString() : null } : m
        )
      };
    }));
  };

  const addMilestone = (stageId) => {
    const text = newMilestoneText[stageId]?.trim();
    if (!text) return;
    setStages(prev => prev.map(s => {
      if (s.id !== stageId) return s;
      return {
        ...s,
        milestones: [...s.milestones, {
          id: `custom_${Date.now()}`,
          label: text,
          done: false,
          due_date: newMilestoneDate[stageId] || null,
          custom: true,
        }]
      };
    }));
    setNewMilestoneText(p => ({ ...p, [stageId]: "" }));
    setNewMilestoneDate(p => ({ ...p, [stageId]: "" }));
  };

  const removeMilestone = (stageId, milestoneId) => {
    setStages(prev => prev.map(s => {
      if (s.id !== stageId) return s;
      return { ...s, milestones: s.milestones.filter(m => m.id !== milestoneId) };
    }));
  };

  const addKeyDate = () => {
    setSchedule(prev => ({
      ...prev,
      key_dates: [...(prev.key_dates || []), { id: `kd_${Date.now()}`, label: "", date: "", done: false }]
    }));
  };

  const updateKeyDate = (id, field, val) => {
    setSchedule(prev => ({
      ...prev,
      key_dates: prev.key_dates.map(d => d.id === id ? { ...d, [field]: val } : d)
    }));
  };

  const generateAIChecklist = async () => {
    setGenerating(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a detailed construction milestone checklist for a residential contractor project.
Project Type: ${project.project_type || "General Remodel"}
Scope of Work: ${project.scope_of_work || "Not specified"}
Client: ${project.client_name}

Return a list of project-specific milestones organized by stage (pre_construction, demo_framing, rough_ins, finishes, final).
Each stage should have 3-6 relevant milestones specific to this project type.`,
        response_json_schema: {
          type: "object",
          properties: {
            stages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  milestones: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        label: { type: "string" }
                      }
                    }
                  }
                }
              }
            },
            estimated_duration_weeks: { type: "number" }
          }
        }
      });

      if (res.stages?.length) {
        const merged = res.stages.map((aiStage, i) => {
          const defaultStage = DEFAULT_STAGES.find(s => s.id === aiStage.id) || DEFAULT_STAGES[i] || DEFAULT_STAGES[0];
          return {
            ...defaultStage,
            id: aiStage.id || defaultStage.id,
            name: aiStage.name || defaultStage.name,
            milestones: (aiStage.milestones || []).map(m => ({ ...m, done: false }))
          };
        });
        setStages(merged);
        if (res.estimated_duration_weeks) {
          setSchedule(prev => ({ ...prev, estimated_duration_weeks: res.estimated_duration_weeks }));
        }
        toast({ title: "AI checklist generated!", description: "Milestones tailored to your project scope." });
      }
    } catch (err) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.ContractorProject.update(project.id, {
        workflow_stages: stages,
        workflow_schedule: schedule,
      });
      toast({ title: "Workflow saved!" });
      if (onUpdate) onUpdate();
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Progress calc
  const totalMilestones = stages.reduce((s, st) => s + st.milestones.length, 0);
  const doneMilestones = stages.reduce((s, st) => s + st.milestones.filter(m => m.done).length, 0);
  const progressPct = totalMilestones > 0 ? Math.round((doneMilestones / totalMilestones) * 100) : 0;

  const currentStage = stages.find(s => s.milestones.some(m => !m.done) && s.milestones.some(m => m.done))
    || stages.find(s => s.milestones.some(m => !m.done))
    || stages[stages.length - 1];

  return (
    <div className="space-y-4">
      {/* Header + Progress */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-secondary flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-primary" /> Project Workflow
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Track milestones, stages, and key dates</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={generateAIChecklist} disabled={generating} className="gap-2">
              {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              AI Checklist
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2 bg-primary text-white">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span className="font-medium">{doneMilestones}/{totalMilestones} milestones complete</span>
            <span className="font-bold text-primary">{progressPct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Flag className="w-3.5 h-3.5" />
          Current stage: <span className="font-semibold text-secondary">{currentStage?.name || "Not started"}</span>
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-secondary mb-3 flex items-center gap-2 text-sm">
          <CalendarDays className="w-4 h-4 text-primary" /> Schedule
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Start Date</label>
            <Input type="date" value={schedule.start_date || ""} onChange={e => setSchedule(p => ({ ...p, start_date: e.target.value }))} className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Est. Duration (weeks)</label>
            <Input type="number" value={schedule.estimated_duration_weeks || ""} onChange={e => setSchedule(p => ({ ...p, estimated_duration_weeks: e.target.value }))} className="h-8 text-sm" placeholder="e.g. 8" />
          </div>
        </div>

        {/* Key Dates */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Key Dates</label>
            <Button variant="ghost" size="sm" onClick={addKeyDate} className="gap-1 text-xs h-7">
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {(schedule.key_dates || []).map(kd => (
              <div key={kd.id} className="flex items-center gap-2">
                <button onClick={() => updateKeyDate(kd.id, "done", !kd.done)}>
                  {kd.done ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-gray-300" />}
                </button>
                <Input value={kd.label} onChange={e => updateKeyDate(kd.id, "label", e.target.value)} placeholder="Milestone name" className="h-7 text-sm flex-1" />
                <Input type="date" value={kd.date || ""} onChange={e => updateKeyDate(kd.id, "date", e.target.value)} className="h-7 text-sm w-36" />
                <button onClick={() => setSchedule(p => ({ ...p, key_dates: p.key_dates.filter(d => d.id !== kd.id) }))} className="text-gray-300 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {!schedule.key_dates?.length && (
              <p className="text-xs text-gray-400">No key dates added yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Stages & Milestones */}
      <div className="space-y-3">
        {stages.map((stage, si) => {
          const doneCount = stage.milestones.filter(m => m.done).length;
          const pct = stage.milestones.length > 0 ? Math.round((doneCount / stage.milestones.length) * 100) : 0;
          const isExpanded = expandedStage === stage.id || expandedStage === null;

          return (
            <div key={stage.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
              >
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${stage.color}`}>{si + 1}</span>
                <span className="font-semibold text-secondary flex-1 text-left">{stage.name}</span>
                <span className="text-xs text-gray-400">{doneCount}/{stage.milestones.length}</span>
                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? "#16a34a" : "#E35235" }} />
                </div>
                {pct === 100 && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                {expandedStage === stage.id ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 px-5 pb-4 pt-3">
                  <div className="space-y-2 mb-3">
                    {stage.milestones.map(m => (
                      <div key={m.id} className="flex items-center gap-3 group">
                        <button onClick={() => toggleMilestone(stage.id, m.id)} className="shrink-0">
                          {m.done
                            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                            : <Circle className="w-4 h-4 text-gray-300 hover:text-primary transition-colors" />
                          }
                        </button>
                        <span className={`text-sm flex-1 ${m.done ? "line-through text-gray-400" : "text-secondary"}`}>{m.label}</span>
                        {m.due_date && (
                          <span className="text-xs text-gray-400 flex items-center gap-0.5">
                            <Clock className="w-3 h-3" /> {m.due_date}
                          </span>
                        )}
                        {m.done_at && (
                          <span className="text-xs text-green-500">✓ {new Date(m.done_at).toLocaleDateString()}</span>
                        )}
                        {m.custom && (
                          <button onClick={() => removeMilestone(stage.id, m.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add custom milestone */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <Input
                      value={newMilestoneText[stage.id] || ""}
                      onChange={e => setNewMilestoneText(p => ({ ...p, [stage.id]: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && addMilestone(stage.id)}
                      placeholder="Add custom milestone…"
                      className="flex-1 h-7 text-xs"
                    />
                    <Input
                      type="date"
                      value={newMilestoneDate[stage.id] || ""}
                      onChange={e => setNewMilestoneDate(p => ({ ...p, [stage.id]: e.target.value }))}
                      className="w-32 h-7 text-xs"
                    />
                    <Button size="sm" variant="outline" onClick={() => addMilestone(stage.id)} className="h-7 px-2">
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}