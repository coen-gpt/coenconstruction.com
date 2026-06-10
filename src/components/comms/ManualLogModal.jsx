import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44, ADMIN_SESSION_KEY } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Phone, Mail, MessageSquare, Users, Globe, MoreHorizontal } from "lucide-react";

const CHANNELS = [
  { value: "phone", label: "Phone", Ic: Phone },
  { value: "email", label: "Email", Ic: Mail },
  { value: "text", label: "Text", Ic: MessageSquare },
  { value: "in_person", label: "In Person", Ic: Users },
  { value: "portal", label: "Portal", Ic: Globe },
  { value: "other", label: "Other", Ic: MoreHorizontal },
];

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function ManualLogModal({ onClose, onSaved }) {
  const [channel, setChannel] = useState("phone");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-manual-log"],
    queryFn: () => adminEntities.ContractorProject.list("-updated_date", 200),
  });

  const handleSave = async () => {
    if (!title.trim()) { setError("Please enter a title."); return; }
    if (!note.trim()) { setError("Please enter a contact note."); return; }
    setSaving(true);
    setError(null);
    const user = getCurrentUser();
    const now = new Date().toISOString();

    try {
      await base44.entities.ClientCommunication.create({
        kind: "manual",
        direction: "outbound",
        status: "logged",
        channel,
        title: title.trim(),
        log_note: note.trim(),
        project_id: projectId || undefined,
        assigned_to: user?.email,
        handled_by: user?.email,
        contacted_at: now,
        triggered_at: now,
        due_at: now,
        urgency: "normal",
      });

      if (projectId) {
        const projects2 = await adminEntities.ContractorProject.filter({ id: projectId });
        const project = projects2[0];
        if (project) {
          const existing = project.team_messages || [];
          await adminEntities.ContractorProject.update(projectId, {
            team_messages: [
              ...existing,
              {
                id: `tm_${Date.now()}`,
                text: `[${channel.toUpperCase()}] ${title.trim()}: ${note.trim()}`,
                author: user?.full_name || user?.name || "Team",
                author_email: user?.email || "",
                created_at: now,
              },
            ],
          });
        }
      }

      onSaved();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Log a Client Contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Title / Subject <span className="text-red-400">*</span></p>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Follow-up call with client" className="text-sm h-8" />
          </div>

          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Project (optional)</p>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white"
            >
              <option value="">— No project —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.client_name}{p.client_city ? ` · ${p.client_city}` : ""}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Channel</p>
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map(({ value, label, Ic }) => (
                <button
                  key={value}
                  onClick={() => setChannel(value)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                    channel === value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <Ic className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Note <span className="text-red-400">*</span></p>
            <Textarea
              rows={3}
              placeholder="Summary of the conversation…"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="text-sm resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary text-white">
            {saving ? "Saving…" : "Save Log"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}