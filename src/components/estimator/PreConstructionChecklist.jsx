import { useState } from "react";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2, Circle, Plus, Trash2, Save, RefreshCw,
  Package, HardHat, ClipboardList, Sparkles, Lock, Flag, AlertCircle
} from "lucide-react";

const DEFAULT_CHECKLIST = {
  materials: [
    { id: "mat_lumber", label: "Lumber / framing materials", done: false, notes: "" },
    { id: "mat_windows", label: "Windows & doors ordered", done: false, notes: "" },
    { id: "mat_roofing", label: "Roofing materials", done: false, notes: "" },
    { id: "mat_insulation", label: "Insulation", done: false, notes: "" },
    { id: "mat_drywall", label: "Drywall", done: false, notes: "" },
    { id: "mat_flooring", label: "Flooring", done: false, notes: "" },
    { id: "mat_paint", label: "Paint & finishes", done: false, notes: "" },
    { id: "mat_plumbing_fixtures", label: "Plumbing fixtures", done: false, notes: "" },
    { id: "mat_electrical", label: "Electrical materials", done: false, notes: "" },
    { id: "mat_cabinets", label: "Cabinets & millwork", done: false, notes: "" },
  ],
  subs: [
    { id: "sub_electrical", label: "Electrical sub scheduled", done: false, notes: "", trade: "Electrical" },
    { id: "sub_plumbing", label: "Plumbing sub scheduled", done: false, notes: "", trade: "Plumbing" },
    { id: "sub_hvac", label: "HVAC sub scheduled", done: false, notes: "", trade: "HVAC" },
    { id: "sub_roofing", label: "Roofing sub scheduled", done: false, notes: "", trade: "Roofing" },
    { id: "sub_framing", label: "Framing crew confirmed", done: false, notes: "", trade: "Framing" },
  ],
  general: [
    { id: "gen_permits", label: "Permits applied / pulled", done: false, notes: "" },
    { id: "gen_deposit", label: "Deposit received from client", done: false, notes: "" },
    { id: "gen_client_walkthrough", label: "Pre-con walkthrough with client", done: false, notes: "" },
    { id: "gen_site_survey", label: "Site survey / measurements complete", done: false, notes: "" },
    { id: "gen_dumpster", label: "Dumpster / debris removal arranged", done: false, notes: "" },
    { id: "gen_utility_locates", label: "Utility locates (Dig Safe) called", done: false, notes: "" },
    { id: "gen_safety_plan", label: "Site safety plan in place", done: false, notes: "" },
  ]
};

const CAN_EDIT_ROLES = ["admin", "project_manager", "assistant_project_manager", "operations_manager"];

export default function PreConstructionChecklist({ project, onUpdate }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [newItem, setNewItem] = useState({ materials: "", subs: "", general: "" });

  const seedChecklist = async () => {
    setSeeding(true);
    try {
      await base44.functions.invoke("seedProjectWorkflow", { project_id: project.id });
      toast({ title: "Pre-con checklist seeded!", description: `Loaded defaults for ${project.project_type || "this job type"}.` });
      if (onUpdate) onUpdate();
    } catch (err) {
      toast({ title: "Seed failed", description: err.message, variant: "destructive" });
    }
    setSeeding(false);
  };

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  const { data: adminUser } = useQuery({
    queryKey: ["admin-user-me", user?.email],
    queryFn: () => base44.entities.AdminUser.filter({ email: user?.email }),
    enabled: !!user?.email,
    select: (d) => d[0],
  });

  const canEdit = !adminUser || CAN_EDIT_ROLES.includes(adminUser?.role);

  const initChecklist = () => {
    if (project?.precon_checklist) return project.precon_checklist;
    return DEFAULT_CHECKLIST;
  };

  const [checklist, setChecklist] = useState(initChecklist);

  const toggle = (section, id) => {
    if (!canEdit) return;
    setChecklist(prev => ({
      ...prev,
      [section]: prev[section].map(item =>
        item.id === id ? { ...item, done: !item.done, done_at: !item.done ? new Date().toISOString() : null } : item
      )
    }));
  };

  const updateNotes = (section, id, notes) => {
    setChecklist(prev => ({
      ...prev,
      [section]: prev[section].map(item => item.id === id ? { ...item, notes } : item)
    }));
  };

  const addItem = (section) => {
    const label = newItem[section]?.trim();
    if (!label) return;
    setChecklist(prev => ({
      ...prev,
      [section]: [...prev[section], { id: `custom_${Date.now()}`, label, done: false, notes: "", custom: true }]
    }));
    setNewItem(p => ({ ...p, [section]: "" }));
  };

  const removeItem = (section, id) => {
    setChecklist(prev => ({
      ...prev,
      [section]: prev[section].filter(item => item.id !== id)
    }));
  };

  const generateAI = async () => {
    setGenerating(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a pre-construction checklist for a residential contractor.
Project Type: ${project.project_type || "General Remodel"}
Scope of Work: ${project.scope_of_work || "Not specified"}

Return materials to order, subcontractors to schedule (with their trade), and general pre-con tasks specific to this project type.`,
        response_json_schema: {
          type: "object",
          properties: {
            materials: { type: "array", items: { type: "object", properties: { id: { type: "string" }, label: { type: "string" } } } },
            subs: { type: "array", items: { type: "object", properties: { id: { type: "string" }, label: { type: "string" }, trade: { type: "string" } } } },
            general: { type: "array", items: { type: "object", properties: { id: { type: "string" }, label: { type: "string" } } } }
          }
        }
      });
      if (res?.materials?.length || res?.subs?.length || res?.general?.length) {
        setChecklist({
          materials: (res.materials || []).map(i => ({ ...i, done: false, notes: "" })),
          subs: (res.subs || []).map(i => ({ ...i, done: false, notes: "" })),
          general: (res.general || []).map(i => ({ ...i, done: false, notes: "" })),
        });
        toast({ title: "AI checklist generated!", description: "Tailored to your project scope." });
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
      await adminEntities.ContractorProject.update(project.id, { precon_checklist: checklist });
      toast({ title: "Pre-Con checklist saved!" });
      if (onUpdate) onUpdate();
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const totalItems = Object.values(checklist).flat().length;
  const doneItems = Object.values(checklist).flat().filter(i => i.done).length;
  const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  const SECTIONS = [
    { key: "general", label: "General Pre-Con Tasks", icon: ClipboardList, color: "text-orange-600" },
    { key: "materials", label: "Materials to Order", icon: Package, color: "text-blue-600" },
    { key: "subs", label: "Subcontractors & Crew", icon: HardHat, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-secondary flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" /> Pre-Construction Checklist
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Materials, subs, and tasks to complete before job start</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {canEdit && !project?.precon_checklist && (
              <Button variant="outline" size="sm" onClick={seedChecklist} disabled={seeding} className="gap-2 border-primary text-primary">
                {seeding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
                Load Defaults
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" size="sm" onClick={generateAI} disabled={generating} className="gap-2">
                {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                AI Generate
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2 bg-primary text-white">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span className="font-medium">{doneItems}/{totalItems} items complete</span>
            <span className="font-bold text-primary">{pct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {!canEdit && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            <Lock className="w-3.5 h-3.5" /> Only Project Managers and Admins can add/remove items.
          </div>
        )}
        {pct < 100 && totalItems > 0 && ["approved", "in_progress"].includes(project?.status) && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span><strong>Gate active:</strong> Project cannot advance to Scheduled/Active until all pre-con items are complete. {totalItems - doneItems} item(s) remaining.</span>
          </div>
        )}
      </div>

      {/* Sections */}
      {SECTIONS.map(({ key, label, icon: Icon, color }) => {
        const items = checklist[key] || [];
        const sectionDone = items.filter(i => i.done).length;
        return (
          <div key={key} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-secondary text-sm flex items-center gap-2">
                <Icon className={`w-4 h-4 ${color}`} /> {label}
              </h3>
              <span className="text-xs text-gray-400">{sectionDone}/{items.length} done</span>
            </div>

            <div className="space-y-2 mb-4">
              {items.map(item => (
                <div key={item.id} className="group">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggle(key, item.id)}
                      className="shrink-0"
                      disabled={!canEdit}
                    >
                      {item.done
                        ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                        : <Circle className="w-4 h-4 text-gray-300 hover:text-primary transition-colors" />
                      }
                    </button>
                    <span className={`text-sm flex-1 ${item.done ? "line-through text-gray-400" : "text-secondary"}`}>
                      {item.label}
                      {item.trade && <span className="ml-1.5 text-xs text-gray-400">({item.trade})</span>}
                    </span>
                    {item.done_at && (
                      <span className="text-xs text-green-500 hidden sm:block">✓ {new Date(item.done_at).toLocaleDateString()}</span>
                    )}
                    {canEdit && item.custom && (
                      <button onClick={() => removeItem(key, item.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canEdit && !item.custom && (
                      <button onClick={() => removeItem(key, item.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Notes inline */}
                  <div className="ml-7 mt-1">
                    <input
                      value={item.notes || ""}
                      onChange={e => updateNotes(key, item.id, e.target.value)}
                      placeholder="Add note…"
                      className="w-full text-xs text-gray-500 placeholder-gray-300 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-primary focus:outline-none pb-0.5 transition-colors"
                    />
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <p className="text-xs text-gray-400 py-2">No items yet. Add below or use AI Generate.</p>
              )}
            </div>

            {/* Add item row */}
            {canEdit && (
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <Input
                  value={newItem[key] || ""}
                  onChange={e => setNewItem(p => ({ ...p, [key]: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && addItem(key)}
                  placeholder={`Add ${key === "subs" ? "subcontractor / crew…" : key === "materials" ? "material…" : "task…"}`}
                  className="flex-1 h-7 text-xs"
                />
                <Button size="sm" variant="outline" onClick={() => addItem(key)} className="h-7 px-2">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}