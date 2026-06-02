import { useState } from "react";
import { base44, ADMIN_SESSION_KEY } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Phone, Mail, MessageSquare, Users, Globe, MoreHorizontal } from "lucide-react";
import { differenceInMinutes } from "date-fns";

const CHANNELS = [
  { value: "phone", label: "Phone Call", Ic: Phone },
  { value: "email", label: "Email", Ic: Mail },
  { value: "text", label: "Text / SMS", Ic: MessageSquare },
  { value: "in_person", label: "In Person", Ic: Users },
  { value: "portal", label: "Client Portal", Ic: Globe },
  { value: "other", label: "Other", Ic: MoreHorizontal },
];

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function LogContactModal({ item, onClose, onSaved }) {
  const [channel, setChannel] = useState(item.channel || "phone");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!note.trim()) { setError("Please write a brief note about the contact."); return; }
    setSaving(true);
    setError(null);
    const user = getCurrentUser();
    const now = new Date().toISOString();

    const dueRef = item.first_contact_at || item.due_at;
    const responseMinutes = dueRef
      ? Math.max(0, differenceInMinutes(new Date(now), new Date(dueRef)))
      : null;

    try {
      await base44.entities.ClientCommunication.update(item.id, {
        status: "logged",
        channel,
        contacted_at: now,
        handled_by: user?.email || "unknown",
        log_note: note.trim(),
        response_minutes: responseMinutes,
        urgency: "low",
      });

      // Append to project team_messages
      if (item.project_id) {
        const projects = await base44.entities.ContractorProject.filter({ id: item.project_id });
        const project = projects[0];
        if (project) {
          const existing = project.team_messages || [];
          await base44.entities.ContractorProject.update(item.project_id, {
            team_messages: [
              ...existing,
              {
                id: `tm_${Date.now()}`,
                text: `[${channel.toUpperCase()}] ${item.title}: ${note.trim()}`,
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
          <DialogTitle className="text-base">Log Client Contact</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Communication Item</p>
            <p className="text-sm font-medium text-secondary">{item.title}</p>
            {item.project_id && (
              <p className="text-xs text-gray-400">Project ID: {item.project_id}</p>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Channel Used</p>
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
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Contact Note <span className="text-red-400">*</span></p>
            <Textarea
              rows={3}
              placeholder="Brief summary of the conversation…"
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
            {saving ? "Saving…" : "Save Contact Log"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}