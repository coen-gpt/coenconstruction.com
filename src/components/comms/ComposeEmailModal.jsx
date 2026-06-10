/**
 * ComposeEmailModal
 * AI-assisted email compose panel for any audience type.
 * Works standalone (+ New Email) or pre-seeded from a queue item.
 */
import { useState, useEffect } from "react";
import { base44, ADMIN_SESSION_KEY } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import {
  Mail, Wand2, Send, Eye, EyeOff, ChevronDown, User, HardHat,
  Building2, Users, Loader2, CheckCircle2, RefreshCw, X, BookOpen
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const AUDIENCE_TYPES = [
  { value: "customer",      label: "Customer",       icon: User,      color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200" },
  { value: "subcontractor", label: "Subcontractor",  icon: HardHat,   color: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-200" },
  { value: "vendor",        label: "Vendor",          icon: Building2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  { value: "team_member",   label: "Team Member",     icon: Users,     color: "text-violet-600",  bg: "bg-violet-50",  border: "border-violet-200" },
];

const QUICK_INTENTS = {
  customer: [
    "Introduce the project team and confirm start date",
    "Send a weekly progress update",
    "Clarify an allowance item",
    "Address a question about scope or spec",
    "Share a milestone completion update",
    "Follow up on unsigned estimate",
    "Post-completion thank you and review request",
  ],
  subcontractor: [
    "Confirm work schedule and site access",
    "Request updated insurance certificate",
    "Send scope of work assignment",
    "Follow up on outstanding bid",
    "Confirm milestone completion",
  ],
  vendor: [
    "Request material pricing or lead time",
    "Follow up on outstanding purchase order",
    "Confirm delivery schedule",
  ],
  team_member: [
    "Project status briefing",
    "Schedule coordination",
    "Action item follow-up",
    "Share important project update",
  ],
};

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function ComposeEmailModal({ onClose, onSent, prefill = {} }) {
  const { toast } = useToast();
  const user = getCurrentUser();

  const [audienceType, setAudienceType] = useState(prefill.audience_type || "customer");
  const [toEmail, setToEmail] = useState(prefill.to_email || "");
  const [toName, setToName] = useState(prefill.to_name || "");
  const [subject, setSubject] = useState(prefill.subject || "");
  const [contextHint, setContextHint] = useState(prefill.context_hint || "");
  const [projectId, setProjectId] = useState(prefill.project_id || "");
  const [bodyHtml, setBodyHtml] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [step, setStep] = useState("compose"); // compose | preview
  const [showIntents, setShowIntents] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["email-templates-compose"],
    queryFn: () => base44.entities.EmailTemplate.list("-created_date", 200),
    staleTime: 120_000,
  });

  const activeTemplates = templates.filter(t => t.active !== false && t.audience_type === audienceType);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-compose"],
    queryFn: () => adminEntities.ContractorProject.list("-updated_date", 200),
    staleTime: 60_000,
  });

  // Auto-fill contact from project when project changes
  useEffect(() => {
    if (!projectId) return;
    const p = projects.find(pr => pr.id === projectId);
    if (!p) return;
    if (audienceType === "customer") {
      if (!toEmail && p.client_email) setToEmail(p.client_email);
      if (!toName && p.client_name) setToName(p.client_name);
    }
  }, [projectId]);

  const selectedAudience = AUDIENCE_TYPES.find(a => a.value === audienceType);
  const AudienceIcon = selectedAudience?.icon || User;

  const handleDraft = async () => {
    if (!subject.trim()) { toast({ title: "Enter a subject first", variant: "destructive" }); return; }
    setDrafting(true);
    setBodyHtml("");
    setPreviewHtml("");
    try {
      const res = await base44.functions.invoke("sendBrandedEmail", {
        audience_type: audienceType,
        to_email: toEmail || "preview@example.com",
        to_name: toName || "there",
        subject: subject.trim(),
        project_id: projectId || undefined,
        comm_id: prefill.comm_id || undefined,
        draft_only: true,
        context_hint: contextHint.trim(),
      });
      const draft = res.data?.draft;
      if (draft) {
        setBodyHtml(draft.body_html || "");
        setPreviewHtml(draft.full_html || "");
        setStep("preview");
        setShowPreview(true);
      }
    } catch (e) {
      toast({ title: "Draft failed", description: e.message, variant: "destructive" });
    }
    setDrafting(false);
  };

  const handleSend = async () => {
    if (!toEmail.trim()) { toast({ title: "Recipient email is required", variant: "destructive" }); return; }
    if (!subject.trim()) { toast({ title: "Subject is required", variant: "destructive" }); return; }
    setSending(true);
    try {
      await base44.functions.invoke("sendBrandedEmail", {
        audience_type: audienceType,
        to_email: toEmail.trim(),
        to_name: toName.trim() || "there",
        subject: subject.trim(),
        body_html: bodyHtml || undefined,
        project_id: projectId || undefined,
        comm_id: prefill.comm_id || undefined,
        draft_only: false,
        context_hint: contextHint.trim(),
      });
      setSent(true);
      toast({ title: "Email sent!", description: `Delivered to ${toEmail}` });
      setTimeout(() => { onSent?.(); onClose(); }, 1500);
    } catch (e) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    }
    setSending(false);
  };

  const intents = QUICK_INTENTS[audienceType] || [];

  if (sent) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-sm text-center py-12">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">Email Sent!</h3>
          <p className="text-sm text-slate-500 mt-1">Delivered to {toEmail}</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-slate-800 text-base leading-tight">Compose Email</h2>
            <p className="text-xs text-slate-400">AI-assisted · branded · logged automatically</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Audience type selector */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Who are you writing to?</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AUDIENCE_TYPES.map(({ value, label, icon: Icon, color, bg, border }) => (
                <button
                  key={value}
                  onClick={() => { setAudienceType(value); setShowIntents(false); }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
                    audienceType === value
                      ? `${bg} ${border} ${color} border-2`
                      : "border-gray-200 text-slate-500 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* To fields */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Recipient Name</label>
              <Input
                value={toName}
                onChange={e => setToName(e.target.value)}
                placeholder="e.g. John Smith"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Recipient Email <span className="text-red-400">*</span></label>
              <Input
                type="email"
                value={toEmail}
                onChange={e => setToEmail(e.target.value)}
                placeholder="client@example.com"
                className="text-sm"
              />
            </div>
          </div>

          {/* Project link */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Link to Project (optional)</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">— No project —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.client_name}{p.project_type ? ` · ${p.project_type}` : ""}{p.client_city ? ` · ${p.client_city}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Template Picker */}
          {activeTemplates.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Use a Template</label>
                <button
                  onClick={() => setShowTemplates(v => !v)}
                  className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                >
                  <BookOpen className="w-3 h-3" /> {showTemplates ? "Hide" : `${activeTemplates.length} templates`}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showTemplates ? "rotate-180" : ""}`} />
                </button>
              </div>
              {showTemplates && (
                <div className="border border-gray-200 rounded-xl overflow-hidden mb-2">
                  {activeTemplates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSubject(t.subject);
                        setContextHint(t.context_hint);
                        setShowTemplates(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-gray-100 last:border-0 transition-colors"
                    >
                      <div className="text-sm font-semibold text-slate-700">{t.name}</div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">{t.subject}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Subject Line <span className="text-red-400">*</span></label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Your Kitchen Remodel — Week 2 Update"
              className="text-sm"
            />
          </div>

          {/* Intent / context */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">What should the email say? <span className="text-slate-300">(AI context)</span></label>
              <button
                onClick={() => setShowIntents(v => !v)}
                className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
              >
                Quick picks <ChevronDown className={`w-3 h-3 transition-transform ${showIntents ? "rotate-180" : ""}`} />
              </button>
            </div>
            {showIntents && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {intents.map(i => (
                  <button
                    key={i}
                    onClick={() => { setContextHint(i); setShowIntents(false); }}
                    className="text-xs px-2.5 py-1 rounded-full bg-slate-100 hover:bg-primary/10 hover:text-primary text-slate-600 border border-slate-200 transition-colors"
                  >
                    {i}
                  </button>
                ))}
              </div>
            )}
            <Textarea
              rows={3}
              value={contextHint}
              onChange={e => setContextHint(e.target.value)}
              placeholder="Describe what you want to communicate — the AI will write a professional email…"
              className="text-sm resize-none"
            />
          </div>

          {/* AI Draft button */}
          <Button
            onClick={handleDraft}
            disabled={drafting || !subject.trim()}
            className="w-full gap-2 font-semibold"
            variant="outline"
            style={{ borderColor: "#E35235", color: "#E35235" }}
          >
            {drafting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Drafting with AI…</>
              : <><Wand2 className="w-4 h-4" /> Generate AI Draft</>
            }
          </Button>

          {/* Preview / Edit draft */}
          {bodyHtml && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-bold text-slate-600">Email Draft</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPreview(v => !v)}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-primary transition-colors"
                  >
                    {showPreview ? <><EyeOff className="w-3.5 h-3.5" /> Edit</> : <><Eye className="w-3.5 h-3.5" /> Preview</>}
                  </button>
                  <button
                    onClick={handleDraft}
                    disabled={drafting}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-primary transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Redraft
                  </button>
                </div>
              </div>

              {showPreview && previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  title="Email preview"
                  className="w-full border-0"
                  style={{ height: "420px" }}
                  sandbox="allow-same-origin"
                />
              ) : (
                <Textarea
                  value={bodyHtml}
                  onChange={e => setBodyHtml(e.target.value)}
                  rows={10}
                  className="text-xs font-mono border-0 rounded-none resize-none focus:ring-0 focus-visible:ring-0"
                  placeholder="Edit the HTML draft here…"
                />
              )}
            </div>
          )}

          {/* Send */}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              onClick={handleSend}
              disabled={sending || !toEmail.trim() || !subject.trim()}
              className="flex-1 gap-2 bg-primary text-white font-semibold"
            >
              {sending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                : <><Send className="w-4 h-4" /> Send Email</>
              }
            </Button>
          </div>

          {/* Disclosure */}
          <p className="text-[11px] text-slate-400 text-center">
            Email will be sent from <strong>Coen Construction</strong>, logged to the project timeline, and marked done in the queue.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}