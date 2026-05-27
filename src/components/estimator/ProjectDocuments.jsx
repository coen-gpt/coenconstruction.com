import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  FileText, Upload, Trash2, Download, Eye, RefreshCw, Plus,
  FileImage, File, FileBadge, CheckCircle2, Clock, MessageSquare, Send
} from "lucide-react";
import { format } from "date-fns";

const DOC_CATEGORIES = ["Contract", "Estimate", "Change Order", "Permit", "Inspection", "Invoice", "Photo", "Other"];

function getFileIcon(name) {
  const ext = name?.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return FileImage;
  if (["pdf"].includes(ext)) return FileBadge;
  return File;
}

export default function ProjectDocuments({ project, onUpdate }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState("Other");
  const [docLabel, setDocLabel] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const docs = project?.documents_meta || [];
  const messages = project?.team_messages || [];

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        return {
          id: `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: docLabel || file.name,
          original_name: file.name,
          url: file_url,
          category,
          uploaded_at: new Date().toISOString(),
          size: file.size,
        };
      }));

      const updatedDocs = [...docs, ...uploaded];
      await base44.entities.ContractorProject.update(project.id, { documents_meta: updatedDocs });
      toast({ title: `${uploaded.length} file(s) uploaded`, description: "Documents saved to project." });
      setDocLabel("");
      if (onUpdate) onUpdate();
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeDoc = async (docId) => {
    const updated = docs.filter(d => d.id !== docId);
    await base44.entities.ContractorProject.update(project.id, { documents_meta: updated });
    toast({ title: "Document removed" });
    if (onUpdate) onUpdate();
  };

  const sendTeamMessage = async () => {
    if (!newMessage.trim()) return;
    setSendingMsg(true);
    try {
      const me = await base44.auth.me();
      const msg = {
        id: `msg_${Date.now()}`,
        text: newMessage.trim(),
        author: me?.full_name || me?.email || "Team Member",
        author_email: me?.email,
        created_at: new Date().toISOString(),
      };
      const updated = [...messages, msg];
      await base44.entities.ContractorProject.update(project.id, { team_messages: updated });
      setNewMessage("");
      if (onUpdate) onUpdate();
    } catch (err) {
      toast({ title: "Message failed", description: err.message, variant: "destructive" });
    } finally {
      setSendingMsg(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-secondary mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" /> Project Documents
        </h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <Input
            value={docLabel}
            onChange={e => setDocLabel(e.target.value)}
            placeholder="Document label (optional)"
            className="flex-1 min-w-40 h-8 text-sm"
          />
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="h-8 text-sm border border-gray-200 rounded-md px-2 bg-white text-gray-700"
          >
            {DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" className="gap-2 h-8" disabled={uploading} asChild>
              <span>
                {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? "Uploading…" : "Upload File"}
              </span>
            </Button>
            <input type="file" multiple className="hidden" onChange={handleUpload} />
          </label>
        </div>

        {docs.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-xl">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No documents uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {DOC_CATEGORIES.filter(c => docs.some(d => d.category === c)).map(cat => (
              <div key={cat}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{cat}</p>
                {docs.filter(d => d.category === cat).map(doc => {
                  const Icon = getFileIcon(doc.original_name);
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors mb-1">
                      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-secondary truncate">{doc.name}</p>
                        <p className="text-xs text-gray-400">
                          {doc.uploaded_at ? format(new Date(doc.uploaded_at), "MMM d, yyyy") : ""}{doc.size ? ` · ${formatSize(doc.size)}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <a href={doc.url} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-primary">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                        <a href={doc.url} download={doc.original_name}>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-primary">
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                        <Button variant="ghost" size="sm" onClick={() => removeDoc(doc.id)} className="h-7 w-7 p-0 text-gray-300 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Messaging */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-secondary mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" /> Internal Team Notes
        </h2>
        <div className="max-h-72 overflow-y-auto space-y-3 mb-4">
          {messages.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No team notes yet.</p>
          )}
          {messages.map(msg => (
            <div key={msg.id} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-xs font-bold shrink-0">
                {(msg.author || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-secondary">{msg.author}</span>
                  <span className="text-xs text-gray-400">
                    {msg.created_at ? format(new Date(msg.created_at), "MMM d, h:mm a") : ""}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendTeamMessage()}
            placeholder="Add a team note…"
            className="flex-1 text-sm"
          />
          <Button onClick={sendTeamMessage} disabled={sendingMsg || !newMessage.trim()} className="gap-2 bg-primary text-white shrink-0">
            {sendingMsg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}