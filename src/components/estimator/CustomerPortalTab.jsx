import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Send, Link2, Bell, Plus, CheckCircle2, Trash2,
  MessageSquare, Mail, Phone, HardHat, Eye, MessageCircle
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
    queryFn: () => adminEntities.CustomerPortal.filter({ project_id: project.id }),
  });
  const portal = portals[0];

  const sendInvite = async () => {
    setSending(true);
    try {
      await base44.functions.invoke("sendCustomerPortalInvite", {
        project_id: project.id,
        channel: "email",
        custom_message: inviteMsg,
      });
      toast({ title: "✓ Portal invite sent!", description: `Emailed to ${project.client_email}` });
      qc.invalidateQueries({ queryKey: ["customer-portal", project.id] });
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
      await adminEntities.CustomerPortal.update(portal.id, { customer_notes: updatedNotes });
    } else {
      await base44.functions.invoke("sendCustomerPortalInvite", { project_id: project.id, channel: "none" });
      const fresh = await adminEntities.CustomerPortal.filter({ project_id: project.id });
      if (fresh[0]) await adminEntities.CustomerPortal.update(fresh[0].id, { customer_notes: updatedNotes });
    }
    await base44.functions.invoke("sendCustomerNotification", {
      project_id: project.id,
      type: "customer_note",
      note_text: newNote.trim(),
    });
    qc.invalidateQueries({ queryKey: ["customer-portal", project.id] });
    toast({ title: "✓ Update posted", description: "Customer notified by email" });
    setNewNote("");
    setAddingNote(false);
  };

  const deleteNote = async (noteId) => {
    const updatedNotes = (portal.customer_notes || []).filter(n => n.id !== noteId);
    await adminEntities.CustomerPortal.update(portal.id, { customer_notes: updatedNotes });
    qc.invalidateQueries({ queryKey: ["customer-portal", project.id] });
  };

  const toggleNotification = async (field) => {
    if (!portal) return;
    await adminEntities.CustomerPortal.update(portal.id, { [field]: !portal[field] });
    qc.invalidateQueries({ queryKey: ["customer-portal", project.id] });
  };

  if (isLoading) return <div className="p-10 text-center text-gray-400">Loading…</div>;

  const portalUrl = portal?.portal_token
    ? `${window.location.origin}/customer-portal?token=${portal.portal_token}`
    : null;

  return (
    <div className="space-y-5">

      {/* ── Client + Portal Status ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Client Header */}
        <div className="bg-slate-50 border-b border-gray-100 px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1B2B3A] flex items-center justify-center shrink-0">
            <HardHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-gray-800">{project.client_name}</div>
            <div className="text-xs text-gray-400 space-x-3">
              {project.client_email && <span><Mail className="w-3 h-3 inline mr-1" />{project.client_email}</span>}
              {project.client_phone && <span><Phone className="w-3 h-3 inline mr-1" />{project.client_phone}</span>}
            </div>
          </div>
          <div className="ml-auto">
            {portal ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Portal Active
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-semibold">Not Sent</span>
            )}
          </div>
        </div>

        <div className="p-5">
          {/* Portal stats if active */}
          {portal && (
            <div className="grid grid-cols-3 gap-3 mb-4 text-center">
              <div className="bg-slate-50 rounded-lg p-2.5">
                <div className="text-lg font-bold text-gray-800">{portal.customer_notes?.length || 0}</div>
                <div className="text-xs text-gray-400">Updates</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5">
                <div className="text-lg font-bold text-gray-800">{portal.chat_messages?.length || 0}</div>
                <div className="text-xs text-gray-400">Chat msgs</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5">
                <div className="text-sm font-bold text-gray-800">{portal.last_viewed_at ? new Date(portal.last_viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</div>
                <div className="text-xs text-gray-400">Last viewed</div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setShowInviteForm(!showInviteForm)}
              disabled={!project.client_email}
              className="gap-2 bg-[#E35235] text-white text-sm font-semibold"
            >
              <Send className="w-4 h-4" />
              {portal?.portal_sent_at ? "Resend Portal Invite" : "Send Portal Invite"}
            </Button>
            {portalUrl && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5 text-sm" asChild>
                  <a href={portalUrl} target="_blank" rel="noreferrer">
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-sm"
                  onClick={() => { navigator.clipboard.writeText(portalUrl); toast({ title: "✓ Link copied!" }); }}
                >
                  <Link2 className="w-3.5 h-3.5" /> Copy Link
                </Button>
              </>
            )}
          </div>

          {portal?.portal_sent_at && (
            <p className="text-xs text-gray-400 mt-2">
              Last sent: {new Date(portal.portal_sent_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}

          {/* Invite form */}
          {showInviteForm && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-0.5">Sending to: {project.client_email}</p>
                <p className="text-xs text-blue-600">They'll receive a secure link to view their project anytime.</p>
              </div>
              <Textarea
                placeholder="Add a personal note (optional) — e.g. 'Hi Sarah, your estimate is ready! Take a look and let me know if you have any questions.'"
                value={inviteMsg}
                onChange={e => setInviteMsg(e.target.value)}
                rows={3}
                className="resize-none text-sm bg-white"
              />
              <div className="flex gap-2">
                <Button onClick={sendInvite} disabled={sending} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm">
                  <Send className="w-3.5 h-3.5" /> {sending ? "Sending…" : "Send Invite Email"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowInviteForm(false)} className="bg-white">Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Project Updates ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-100 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-amber-900 text-sm">Customer-Facing Updates</h3>
          </div>
          <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full font-medium">Visible to client</span>
        </div>

        <div className="p-5">
          <div className="space-y-2 mb-4">
            {(portal?.customer_notes || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No updates yet. Post the first one below!</p>
            ) : (
              (portal.customer_notes || []).map(note => (
                <div key={note.id} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-relaxed">{note.note}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · by {note.author}
                    </p>
                  </div>
                  <button onClick={() => deleteNote(note.id)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0 mt-0.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add note */}
          <div className="border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50">
            <Textarea
              placeholder="Write an update for your client — e.g. 'Framing passed inspection! Electrical rough-in starts Monday.' They'll get an email notification."
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              rows={3}
              className="resize-none text-sm bg-white"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">📧 Client gets email notification</p>
              <Button
                onClick={addNote}
                disabled={addingNote || !newNote.trim()}
                className="gap-1.5 bg-[#1B2B3A] text-white text-sm h-8 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" /> {addingNote ? "Posting…" : "Post Update"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Notification Preferences ── */}
      {portal && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 border-b border-gray-100 px-5 py-3 flex items-center gap-2">
            <Bell className="w-4 h-4 text-gray-500" />
            <h3 className="font-bold text-gray-700 text-sm">Email Notifications</h3>
          </div>
          <div className="p-5 space-y-1">
            {[
              ["email_notifications", "All email notifications", true],
              ["notify_on_estimate", "When an estimate is sent"],
              ["notify_on_change_order", "When a change order is issued"],
              ["notify_on_status_change", "When project status changes"],
              ["notify_on_customer_note", "When you post an update"],
            ].map(([field, label, master]) => (
              <div key={field} className={`flex items-center justify-between py-2.5 ${master ? "border-b border-gray-100 mb-1 pb-3" : ""}`}>
                <span className={`text-sm ${master ? "font-semibold text-gray-800" : "text-gray-600"}`}>{label}</span>
                <button
                  onClick={() => toggleNotification(field)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${portal[field] !== false ? "bg-[#E35235]" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${portal[field] !== false ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SMS Notifications ── */}
      {portal && project.client_phone && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-green-50 border-b border-green-100 px-5 py-3 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-green-600" />
            <h3 className="font-bold text-green-900 text-sm">SMS Notifications</h3>
            <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full font-medium ml-auto">Auto-sends via Twilio</span>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between py-2.5 border-b border-gray-100 mb-3">
              <div>
                <span className="text-sm font-semibold text-gray-800">SMS Updates Enabled</span>
                <p className="text-xs text-gray-400 mt-0.5">Text {project.client_phone}</p>
              </div>
              <button
                onClick={() => toggleNotification("sms_notifications")}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${portal.sms_notifications !== false ? "bg-green-500" : "bg-gray-300"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${portal.sms_notifications !== false ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div className="space-y-1.5 text-xs text-gray-500">
              <p className="font-semibold text-gray-700 text-xs uppercase tracking-wide mb-2">Auto-triggered SMS events:</p>
              {[
                ["🏗️ Milestone completed", "Sent each time a workflow milestone is checked off"],
                ["📋 Project status change", "Sent on key transitions (Approved, In Progress, Completed)"],
              ].map(([label, desc]) => (
                <div key={label} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="font-medium text-gray-700 whitespace-nowrap">{label}</span>
                  <span className="text-gray-400">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {portal && !project.client_phone && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <MessageCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">Add a client phone number to enable automated SMS milestone updates.</p>
        </div>
      )}

      {/* ── Recent Chat ── */}
      {portal?.chat_messages?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 border-b border-gray-100 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <h3 className="font-bold text-gray-700 text-sm">Recent AI Chat</h3>
            </div>
            <span className="text-xs text-gray-400">{portal.chat_messages.length} messages total</span>
          </div>
          <div className="p-4 space-y-2 max-h-44 overflow-y-auto">
            {portal.chat_messages.slice(-5).map((m, i) => (
              <div key={i} className={`text-xs p-2.5 rounded-lg ${m.role === "customer" ? "bg-blue-50 text-blue-900 ml-4" : "bg-gray-50 text-gray-700 mr-4"}`}>
                <span className="font-bold">{m.role === "customer" ? `${project.client_name?.split(" ")[0]}` : "AI PM"}:</span>{" "}
                {m.content.slice(0, 180)}{m.content.length > 180 ? "…" : ""}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}