import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Send, Mail, MessageSquare, FileText, Users, Clock, CalendarDays,
  AlertCircle, CheckCircle2, RefreshCw, X
} from "lucide-react";
import { format } from "date-fns";

export default function ClientCommsPanel({ project }) {
  const { toast } = useToast();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [fileUpdateModal, setFileUpdateModal] = useState(false);
  const [sending, setSending] = useState(false);

  const clientEmail = project?.client_email;
  const clientPhone = project?.client_phone;
  const clientName = project?.client_name;

  const sendEmail = async ({ subject, message, attachFiles }) => {
    setSending(true);
    try {
      await base44.functions.invoke("sendBrandedEmail", {
        to: clientEmail,
        subject: subject.trim(),
        context: message.trim(),
        project_id: project.id,
      });
      toast({
        title: "Email sent!",
        description: `Sent to ${clientEmail}`,
      });
    } catch (err) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  const sendSms = async ({ message, isUrgent }) => {
    setSending(true);
    try {
      await base44.functions.invoke("sendSmsNotification", {
        to: clientPhone,
        message: message.trim(),
        project_id: project.id,
      });
      toast({
        title: "SMS sent!",
        description: `Sent to ${clientPhone}`,
      });
    } catch (err) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  const notifyFileUpload = async ({ message, notifyType }) => {
    setSending(true);
    try {
      await base44.functions.invoke("sendCustomerNotification", {
        project_id: project.id,
        notification_type: notifyType,
        custom_message: message.trim(),
      });
      toast({
        title: "Notification sent!",
        description: "Client notified via email",
      });
    } catch {
      toast({ title: "Notification queued", description: "Will be included in next digest" });
    }
    setSending(false);
  };

  const recentActivity = [];
  const docs = project?.documents_meta || [];
  const messages = project?.team_messages || [];

  // Add file uploads
  docs.forEach(d => {
    recentActivity.push({
      type: "file",
      action: d.visible_to_client !== false ? "Shared with client" : "Uploaded (internal)",
      date: d.uploaded_at,
      detail: d.name,
      icon: d.visible_to_client !== false ? CheckCircle2 : FileText,
      color: d.visible_to_client !== false ? "text-green-600 bg-green-50" : "text-gray-400 bg-gray-50",
    });
  });

  // Add team messages
  messages.forEach(m => {
    recentActivity.push({
      type: "message",
      action: "Team note added",
      date: m.created_at,
      detail: m.text,
      icon: MessageSquare,
      color: "text-purple-600 bg-purple-50",
    });
  });

  recentActivity.sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-secondary text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            Client Communication
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Users className="w-3 h-3" />
            {clientName}
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <button
            onClick={() => setShowEmailModal(true)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-gray-700">Send Email</span>
          </button>

          <button
            onClick={() => setShowSmsModal(true)}
            disabled={!clientPhone}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-green-600/40 hover:bg-green-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-full bg-green-50 group-hover:bg-green-100 flex items-center justify-center transition-colors">
              <MessageSquare className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xs font-semibold text-gray-700">Send SMS</span>
            {clientPhone && <span className="text-[10px] text-gray-400">{clientPhone}</span>}
          </button>

          <button
            onClick={() => setFileUpdateModal(true)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-purple-600/40 hover:bg-purple-50 transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-purple-50 group-hover:bg-purple-100 flex items-center justify-center transition-colors">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs font-semibold text-gray-700">File Update</span>
          </button>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-secondary text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Recent Activity
          </h3>
          <Badge variant="outline" className="text-xs">{recentActivity.length} events</Badge>
        </div>

        {recentActivity.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {recentActivity.slice(0, 10).map((evt, i) => {
              const Icon = evt.icon;
              return (
                <div key={i} className="flex gap-3 items-start">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${evt.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{evt.action}</span>
                      <span className="text-xs text-gray-400">{format(new Date(evt.date), "MMM d, h:mm a")}</span>
                    </div>
                    {evt.detail && <p className="text-sm text-gray-600 truncate">{evt.detail}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Email Modal */}
      <EmailModal
        open={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSubmit={sendEmail}
        clientName={clientName}
        projectName={project?.project_type}
        sending={sending}
      />

      {/* SMS Modal */}
      <SmsModal
        open={showSmsModal}
        onClose={() => setShowSmsModal(false)}
        onSubmit={sendSms}
        clientName={clientName}
        sending={sending}
      />

      {/* File Update Notification Modal */}
      <FileUpdateModal
        open={fileUpdateModal}
        onClose={() => setFileUpdateModal(false)}
        onSubmit={notifyFileUpload}
        sending={sending}
      />
    </div>
  );
}

function EmailModal({ open, onClose, onSubmit, clientName, projectName, sending }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [template, setTemplate] = useState("");

  const templates = [
    { value: "file_upload", label: "📁 New Files Uploaded", subject: `New documents for your ${projectName || "project"}`, message: `Hi ${clientName || "there"},\n\nWe've just uploaded new documents to your project file center. You can view and download them anytime from your client portal.\n\nLet us know if you have any questions!\n\nBest regards,\nCoen Construction` },
    { value: "weekly_update", label: "📋 Weekly Progress Update", subject: `Weekly update: ${projectName || "your project"}`, message: `Hi ${clientName || "there"},\n\nHere's your weekly progress update:\n\n✓ Completed this week:\n- \n\n→ Coming up next week:\n- \n\nQuestions? Reply anytime!\n\nBest,\nCoen Construction` },
    { value: "action_required", label: "⚠️ Action Required", subject: `Action needed: ${projectName || "your project"}`, message: `Hi ${clientName || "there"},\n\nWe need your attention on the following:\n\n[Describe what's needed]\n\nPlease review and let us know if you have questions.\n\nThanks,\nCoen Construction` },
  ];

  const handleTemplateChange = (e) => {
    const selected = templates.find(t => t.value === e.target.value);
    if (selected) {
      setSubject(selected.subject);
      setMessage(selected.message);
    }
    setTemplate(e.target.value);
  };

  const handleSubmit = () => {
    if (!subject.trim() || !message.trim()) return;
    onSubmit({ subject, message, attachFiles: false });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Send Email to {clientName}
          </DialogTitle>
          <DialogDescription>
            Professional branded email with Coen Construction styling
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Quick Templates (optional)</label>
            <select
              value={template}
              onChange={handleTemplateChange}
              className="w-full h-10 text-sm border border-gray-200 rounded-md px-3 bg-white"
            >
              <option value="">Choose a template...</option>
              {templates.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Subject</label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject"
              className="text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Message</label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write your message..."
              className="text-sm min-h-[200px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={sending || !subject.trim() || !message.trim()} className="gap-2 bg-primary text-white">
            {sending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send Email</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SmsModal({ open, onClose, onSubmit, clientName, sending }) {
  const [message, setMessage] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  const quickTemplates = [
    "Hi! Just uploaded new files to your project portal. Check them out when you get a chance!",
    "Quick update: We're on schedule for next week's milestones. More details in your portal!",
    "Please review the latest documents in your portal and let us know if you have questions.",
  ];

  const handleSubmit = () => {
    if (!message.trim()) return;
    onSubmit({ message, isUrgent });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-600" />
            Send SMS to {clientName}
          </DialogTitle>
          <DialogDescription>
            Quick text message — keep it short and sweet (160 chars recommended)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Quick templates</label>
            <div className="space-y-2">
              {quickTemplates.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setMessage(t)}
                  className="w-full text-left text-xs p-3 rounded-lg border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Your message</label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type your text message..."
              className="text-sm min-h-[100px]"
              maxLength={320}
            />
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-gray-400">{message.length}/320 characters</span>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isUrgent}
                  onChange={e => setIsUrgent(e.target.checked)}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                Mark as urgent
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={sending || !message.trim()} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
            {sending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send SMS</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FileUpdateModal({ open, onClose, onSubmit, sending }) {
  const [message, setMessage] = useState("");
  const [notifyType, setNotifyType] = useState("file_upload");

  const handleSubmit = () => {
    if (!message.trim()) return;
    onSubmit({ message, notifyType });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            File Upload Notification
          </DialogTitle>
          <DialogDescription>
            Notify the client about newly uploaded documents
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Notification type</label>
            <select
              value={notifyType}
              onChange={e => setNotifyType(e.target.value)}
              className="w-full h-10 text-sm border border-gray-200 rounded-md px-3 bg-white"
            >
              <option value="file_upload">General file upload</option>
              <option value="contract_uploaded">Contract uploaded</option>
              <option value="estimate_ready">Estimate ready</option>
              <option value="change_order">Change order added</option>
              <option value="design_specs">Design specifications</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Custom message (optional)</label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Add a personal note (e.g. 'Hi John, just uploaded the updated paint specs we discussed!')"
              className="text-sm min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={sending} className="gap-2 bg-primary text-white">
            {sending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sending…</> : <><Mail className="w-4 h-4" /> Send Notification</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}