/**
 * Email Template Library
 * Manage reusable email templates for customer communications.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus, Edit3, Trash2, Users, User, HardHat, Building2, BookOpen, Copy, CheckCircle2
} from "lucide-react";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";

const CATEGORY_LABELS = {
  milestone: { label: "Milestone Update", color: "bg-indigo-100 text-indigo-700" },
  check_in: { label: "Check-In", color: "bg-blue-100 text-blue-700" },
  meeting_request: { label: "Meeting Request", color: "bg-amber-100 text-amber-700" },
  proposal: { label: "Proposal", color: "bg-purple-100 text-purple-700" },
  follow_up: { label: "Follow-Up", color: "bg-orange-100 text-orange-700" },
  onboarding: { label: "Onboarding", color: "bg-teal-100 text-teal-700" },
  completion: { label: "Completion", color: "bg-green-100 text-green-700" },
  other: { label: "Other", color: "bg-gray-100 text-gray-600" },
};

const AUDIENCE_ICONS = {
  customer: { icon: User, color: "text-blue-600" },
  subcontractor: { icon: HardHat, color: "text-orange-600" },
  vendor: { icon: Building2, color: "text-emerald-600" },
  team_member: { icon: Users, color: "text-violet-600" },
};

const EMPTY_FORM = {
  name: "", category: "milestone", audience_type: "customer",
  subject: "", context_hint: "", active: true,
};

const DEFAULT_TEMPLATES = [
  { name: "Week 2 Progress Update", category: "milestone", audience_type: "customer", subject: "Your {{project_type}} — Week 2 Update", context_hint: "Send a warm weekly progress update. Mention that work is going well, highlight 1-2 specific milestones completed this week, and set expectations for next week. Keep it friendly and reassuring." },
  { name: "Framing Complete Milestone", category: "milestone", audience_type: "customer", subject: "Big Milestone: Framing is Complete! 🏗️", context_hint: "Celebrate that framing is complete. Explain what this means for the project (now the bones are in place), what comes next (rough-ins), and approximate timeline to next stage." },
  { name: "Pre-Construction Check-In", category: "check_in", audience_type: "customer", subject: "We're Getting Ready — Quick Check-In Before We Start", context_hint: "Pre-construction check-in email. Confirm start date, introduce the crew lead, remind client what to expect on day 1 (noise, dust protection, parking), and share office/PM contact info." },
  { name: "Midpoint Check-In", category: "check_in", audience_type: "customer", subject: "Halfway There — How's Everything Looking?", context_hint: "Mid-project check-in. Ask if the client has any questions, invite them to share feedback or concerns, confirm upcoming milestone dates, and reinforce that the team is on schedule." },
  { name: "Walkthrough Meeting Request", category: "meeting_request", audience_type: "customer", subject: "Let's Schedule Your Progress Walkthrough", context_hint: "Request a convenient time for a mid-project walkthrough with the client. Explain the purpose (review progress, address any questions in person), suggest a few time slots, and make it feel like a valued touchpoint." },
  { name: "Final Walkthrough Invite", category: "meeting_request", audience_type: "customer", subject: "You're Almost Done — Schedule Your Final Walkthrough", context_hint: "Invite the client to their final project walkthrough. Explain what will be reviewed (punch list, final items), next steps after walkthrough (final invoice and sign-off), and express pride in the finished project." },
  { name: "Project Complete & Review Request", category: "completion", audience_type: "customer", subject: "Your Project is Complete — Thank You! 🎉", context_hint: "Congratulate the client on their completed project. Express gratitude for trusting the company. Include a warm ask for a Google review. Mention that warranty documentation has been or will be delivered." },
  { name: "Sub: Confirm Schedule & Site Access", category: "check_in", audience_type: "subcontractor", subject: "Confirming Your Schedule — {{project_type}} in {{client_city}}", context_hint: "Confirm the subcontractor's start date and site access details. Include the address, gate/access code if applicable, point of contact on site, and any specific safety or tool requirements." },
];

export default function EmailTemplates() {
  const { brandColor } = useCompanyBrand();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterCat, setFilterCat] = useState("all");
  const [filterAud, setFilterAud] = useState("all");
  const [copiedId, setCopiedId] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => base44.entities.EmailTemplate.list("-created_date", 200),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.EmailTemplate.update(editing.id, data)
      : base44.entities.EmailTemplate.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      setOpen(false);
      toast({ title: editing ? "Template updated" : "Template created" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EmailTemplate.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-templates"] }); toast({ title: "Template deleted" }); },
  });

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setOpen(true); };
  const openEdit = (t) => { setEditing(t); setForm({ ...t }); setOpen(true); };

  const copyHint = (t) => {
    navigator.clipboard.writeText(t.context_hint);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const seedDefaults = async () => {
    setSeeding(true);
    try {
      await Promise.all(DEFAULT_TEMPLATES.map(t => base44.entities.EmailTemplate.create(t)));
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      toast({ title: `${DEFAULT_TEMPLATES.length} default templates added!` });
    } catch (e) {
      toast({ title: "Seed failed", description: e.message, variant: "destructive" });
    }
    setSeeding(false);
  };

  const filtered = templates.filter(t => {
    if (filterCat !== "all" && t.category !== filterCat) return false;
    if (filterAud !== "all" && t.audience_type !== filterAud) return false;
    return true;
  });

  return (
    <div className="p-5 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-secondary flex items-center gap-2">
            <BookOpen className="w-5 h-5" style={{ color: brandColor }} />
            Email Template Library
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Reusable AI-context templates for customer, sub, and vendor communications</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {templates.length === 0 && (
            <Button variant="outline" size="sm" onClick={seedDefaults} disabled={seeding} className="gap-1.5 text-xs">
              {seeding ? "Adding…" : "Load Default Templates"}
            </Button>
          )}
          <Button size="sm" onClick={openNew} className="gap-1.5 text-xs text-white" style={{ background: brandColor }}>
            <Plus className="w-3.5 h-3.5" /> New Template
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex gap-1 flex-wrap">
          {["all", ...Object.keys(CATEGORY_LABELS)].map(c => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              className={`text-xs px-3 py-1 rounded-full font-semibold border transition-colors ${
                filterCat === c ? "bg-secondary text-white border-secondary" : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {c === "all" ? "All" : CATEGORY_LABELS[c]?.label}
            </button>
          ))}
        </div>
        <span className="text-gray-200 self-center">|</span>
        <div className="flex gap-1 flex-wrap">
          {["all", "customer", "subcontractor", "vendor", "team_member"].map(a => (
            <button
              key={a}
              onClick={() => setFilterAud(a)}
              className={`text-xs px-3 py-1 rounded-full font-semibold border transition-colors ${
                filterAud === a ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {a === "all" ? "All Audiences" : a.charAt(0).toUpperCase() + a.slice(1).replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Template Grid */}
      {isLoading && (
        <div className="text-center py-16 text-sm text-gray-400 animate-pulse">Loading templates…</div>
      )}
      {!isLoading && templates.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-14 text-center">
          <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">No templates yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Create your first template or load 8 professional defaults to get started.</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={seedDefaults} disabled={seeding}>Load Defaults</Button>
            <Button size="sm" onClick={openNew} className="text-white" style={{ background: brandColor }}>Create Template</Button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {filtered.map(t => {
          const catCfg = CATEGORY_LABELS[t.category] || CATEGORY_LABELS.other;
          const audCfg = AUDIENCE_ICONS[t.audience_type] || AUDIENCE_ICONS.customer;
          const AudIcon = audCfg.icon;
          return (
            <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                  <AudIcon className={`w-4 h-4 ${audCfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-secondary text-sm">{t.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${catCfg.color}`}>{catCfg.label}</span>
                    {!t.active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Inactive</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium">{t.subject}</p>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">{t.context_hint}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => copyHint(t)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Copy context hint"
                  >
                    {copiedId === t.id ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(t.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && templates.length > 0 && (
          <div className="text-center py-10 text-sm text-gray-400">No templates match the selected filters.</div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Template" : "New Email Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Template Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Week 2 Progress Update" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Category</label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Audience</label>
                <Select value={form.audience_type} onValueChange={v => setForm(f => ({ ...f, audience_type: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="subcontractor">Subcontractor</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="team_member">Team Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">
                Subject Line * <span className="font-normal text-gray-400 normal-case">— use {"{{client_name}}"}, {"{{project_type}}"}</span>
              </label>
              <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Your {{project_type}} — Week 2 Update" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">AI Context / Body Instructions *</label>
              <Textarea
                rows={5}
                value={form.context_hint}
                onChange={e => setForm(f => ({ ...f, context_hint: e.target.value }))}
                placeholder="Describe what the email should say. The AI will write the full professional email from this context…"
                className="text-sm resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">Be specific — mention tone, key points to include, and any calls to action.</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
              <label htmlFor="active" className="text-sm text-gray-600">Active (visible in Compose dropdown)</label>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending || !form.name || !form.subject || !form.context_hint}
                className="flex-1 text-white"
                style={{ background: brandColor }}
              >
                {saveMutation.isPending ? "Saving…" : editing ? "Update Template" : "Save Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}