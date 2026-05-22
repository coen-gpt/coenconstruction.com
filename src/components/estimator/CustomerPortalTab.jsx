import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Send, Link2, Bell, BellOff, Plus, CheckCircle2, Clock, Trash2,
  MessageSquare, User, ExternalLink, RefreshCw, Mail, Phone
} from "lucide-react";

export default function CustomerPortalTab({ project }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  const { data: portals = [], isLoading } = useQuery({
    queryKey: ["customer-portal", project.id],
    queryFn: () => base44.entities.CustomerPortal.filter({ project_id: project.id }),
  });
  const portal = portals[0];

  const updatePortal = useMutation({
    mutationFn: (data) => base44.entities.CustomerPortal.update(portal.id, data),
    onSuccess: () => qc.invalidateQueries(["customer-portal", project.id]),
  });

  const sendInvite = async () => {
    setSending(true);
    try {
      await base44.functions.invoke("sendCustomerPortalInvite", {
        project_id: project.id,
        channel: "email",
        custom_message: inviteMsg,
      });
      toast({ title: "Portal invite sent!", description: `Sent to ${project.client_email}` });
      qc.invalidateQueries(["customer-portal", project.id]);
      setShowInviteForm(false);
      setInviteMsg("");
    } catch (err) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    const note = {
      id: crypto.randomUUID(),
      note: newNote.trim(),
      author: "PM",
      created_at: new Date().toISOString(),
      notify_customer: true,
    };
    const updatedNotes = [...(portal?.customer_notes || []), note];
    if (portal) {
      await base44.entities.CustomerPortal.update(portal.id, { customer_notes: updatedNotes });
    } else {
      // Create portal first
      await base44.functions.invoke("sendCustomerPortalInvite", { project_id: project.id, channel: "none" });
      const fresh = await base44.entities.CustomerPortal.filter({ project_id: project.id });
      if (fresh[0]) await base44.entities.CustomerPortal.update(fresh[0].id, { customer_notes: updatedNotes });
    }
    // Send notification
    await base44.functions.invoke("sendCustomerNotification", {
      project_id: project.id,
      type: "customer_note",
      note_text: newNote.trim(),
    });
    qc.invalidateQueries(["customer-portal", project.id]);
    toast({ title: "Note added & customer notified" });
    setNewNote("");
    setAddingNote(false);
  };

  const deleteNote = async (noteId) => {
    const updatedNotes = (portal.customer_notes || []).filter(n => n.id !== noteId);
    await base44.entities.CustomerPortal.update(portal.id, { customer_notes: updatedNotes });
    qc.invalidateQueries(["customer-portal", project.id]);
  };

  const toggleNotification = async (field) => {
    if (!portal) return;
    updatePortal.mutate({ [field]: !portal[field] });
  };

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  const portalUrl = portal?.portal_token
    ? `https://coenconstruction.com/customer-portal?token=${portal.portal_token}`
    : null;

  return (
    <div className="space-y-5">
      {/* Portal Status Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-secondary">Customer Portal</h3>
          </div>
          {portal ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Active
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-semibold">Not activated</span>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div className="bg-muted rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-0.5">Client</div>
            <div className="font-medium text-sm text-secondary">{project.client_name}</div>
            {project.client_email && (
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                <Mail className="w-3 h-3" /> {project.client_email}
              </div>
            )}
            {project.client_phone && (
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <Phone className="w-3 h-3" /> {project.client_phone}
              </div>
            )}
          </div>
          {portal && (
            <div className="bg-muted rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-0.5">Portal Status</div>
              <div className="text-sm text-secondary">
                {portal.portal_sent_at
                  ? <>Invite sent {new Date(portal.portal_sent_at).toLocaleDateString()}</>
                  : "Not yet invited"}
              </div>
              {portal.last_viewed_at && (
                <div className="text-xs text-gray-400 mt-1">
                  Last viewed: {new Date(portal.last_viewed_at).toLocaleDateString()}
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">
                {portal.chat_messages?.length || 0} chat messages
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {!showInviteForm ? (
            <Button
              onClick={() => setShowInviteForm(true)}
              disabled={!project.client_email}
              className="gap-2 bg-primary text-white text-sm"
            >
              <Send className="w-4 h-4" />
              {portal?.portal_sent_at ? "Resend Portal Invite" : "Send Portal Invite"}
            </Button>
          ) : null}
          {portalUrl && (
            <Button variant="outline" size="sm" className="gap-1 text-sm" asChild>
              <a href={portalUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="w-3.5 h-3.5" /> Preview Portal
              </a>
            </Button>
          )}
          {portal && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-sm"
              onClick={() => {
                navigator.clipboard.writeText(portalUrl);
                toast({ title: "Portal link copied!" });
              }}
            >
              <Link2 className="w-3.5 h-3.5" /> Copy Link
            </Button>
          )}
        </div>

        {showInviteForm && (
          <div className="mt-4 border border-primary/30 bg-primary/5 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-secondary">Send Portal Invite to {project.client_email}</p>
            <Textarea
              placeholder="Optional personal message to include in the email..."
              value={inviteMsg}
              onChange={e => setInviteMsg(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={sendInvite} disabled={sending} className="gap-1 bg-primary text-white text-sm">
                <Send className="w-3.5 h-3.5" /> {sending ? "Sending…" : "Send Invite"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowInviteForm(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      {/* Customer-Facing Notes */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-secondary">Project Updates for Customer</h3>
          </div>
          <span className="text-xs text-gray-400">(Customer-facing — NOT internal notes)</span>
        </div>

        <div className="space-y-2 mb-4">
          {(portal?.customer_notes || []).length === 0 && (
            <p className="text-sm text-gray-400 py-3 text-center">No updates posted yet.</p>
          )}
          {(portal?.customer_notes || []).map(note => (
            <div key={note.id} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-secondary leading-relaxed">{note.note}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(note.created_at).toLocaleDateString()} · by {note.author}
                </p>
              </div>
              <button
                onClick={() => deleteNote(note.id)}
                className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="border border-gray-200 rounded-lg p-3 space-y-2">
          <Textarea
            placeholder="Add a customer-facing update (e.g. 'Your framing inspection passed — we start siding Monday!')"
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            rows={2}
            className="resize-none text-sm"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Customer will be notified by email</span>
            <Button
              onClick={addNote}
              disabled={addingNote || !newNote.trim()}
              className="gap-1 bg-secondary text-white text-sm h-8"
            >
              <Plus className="w-3.5 h-3.5" /> {addingNote ? "Posting…" : "Post Update"}
            </Button>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      {portal && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-secondary">Notification Preferences</h3>
          </div>
          <div className="space-y-2">
            {[
              ["email_notifications", "Email notifications (master switch)"],
              ["notify_on_estimate", "Notify when estimate is sent"],
              ["notify_on_change_order", "Notify on new change orders"],
              ["notify_on_status_change", "Notify on status changes"],
              ["notify_on_customer_note", "Notify on project updates"],
            ].map(([field, label]) => (
              <div key={field} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-secondary">{label}</span>
                <button
                  onClick={() => toggleNotification(field)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${portal[field] ? "bg-primary" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${portal[field] ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat History Preview */}
      {portal?.chat_messages?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-secondary">AI Chat History</h3>
            <span className="ml-auto text-xs text-gray-400">{portal.chat_messages.length} messages</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {portal.chat_messages.slice(-6).map((m, i) => (
              <div key={i} className={`text-xs p-2.5 rounded-lg ${m.role === "customer" ? "bg-blue-50 text-blue-900" : "bg-gray-50 text-gray-700"}`}>
                <span className="font-semibold">{m.role === "customer" ? "Customer" : "AI PM"}:</span> {m.content.slice(0, 200)}{m.content.length > 200 ? "…" : ""}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}