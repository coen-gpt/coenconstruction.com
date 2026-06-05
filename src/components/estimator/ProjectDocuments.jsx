import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  FileText, Upload, Trash2, Download, Eye, RefreshCw,
  FileImage, File, FileBadge, MessageSquare, Send,
  Users, EyeOff, CloudUpload, X
} from "lucide-react";
import { format } from "date-fns";

const DOC_CATEGORIES = ["Contract", "Estimate", "Change Order", "Design Spec", "Permit", "Inspection", "Invoice", "Photo", "Other"];

function getFileIcon(name) {
  const ext = name?.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return FileImage;
  if (["pdf"].includes(ext)) return FileBadge;
  return File;
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectDocuments({ project, onUpdate }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("Contract");
  const [docLabel, setDocLabel] = useState("");
  const [shareWithClient, setShareWithClient] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const docs = project?.documents_meta || [];
  const messages = project?.team_messages || [];

  const doUpload = async (files) => {
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
          visible_to_client: shareWithClient,
          uploaded_at: new Date().toISOString(),
          size: file.size,
        };
      }));

      const updatedDocs = [...docs, ...uploaded];
      await base44.entities.ContractorProject.update(project.id, { documents_meta: updatedDocs });
      toast({ title: `${uploaded.length} file(s) uploaded`, description: shareWithClient ? "Visible in client portal." : "Internal only." });
      setDocLabel("");
      if (onUpdate) onUpdate();
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileInput = (e) => doUpload(Array.from(e.target.files || []));

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    doUpload(Array.from(e.dataTransfer.files));
  };

  const removeDoc = async (docId) => {
    const updated = docs.filter(d => d.id !== docId);
    await base44.entities.ContractorProject.update(project.id, { documents_meta: updated });
    toast({ title: "Document removed" });
    if (onUpdate) onUpdate();
  };

  const toggleClientVisibility = async (docId, visible) => {
    const updated = docs.map(d => d.id === docId ? { ...d, visible_to_client: visible } : d);
    await base44.entities.ContractorProject.update(project.id, { documents_meta: updated });
    toast({ title: visible ? "Now visible in client portal" : "Hidden from client portal" });
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

  const clientVisibleCount = docs.filter(d => d.visible_to_client !== false).length;

  return (
    <div className="space-y-4">
      {/* Upload Panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-secondary flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Project Documents
          </h2>
          {clientVisibleCount > 0 && (
            <span className="text-xs bg-blue-50 border border-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
              <Users className="w-3 h-3" /> {clientVisibleCount} visible to client
            </span>
          )}
        </div>

        {/* Upload config row */}
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
          {/* Share toggle */}
          <button
            onClick={() => setShareWithClient(s => !s)}
            className={`h-8 px-3 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              shareWithClient
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-gray-50 border-gray-200 text-gray-500"
            }`}
          >
            {shareWithClient ? <Users className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {shareWithClient ? "Share w/ Client" : "Internal Only"}
          </button>
        </div>

        {/* Drag & drop zone */}
        <label
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-6 px-4 cursor-pointer transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/40 hover:bg-gray-50"
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {uploading ? (
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
          ) : (
            <CloudUpload className="w-7 h-7 text-gray-300" />
          )}
          <div className="text-center">
            <span className="text-sm font-semibold text-gray-600">
              {uploading ? "Uploading…" : "Drag & drop files here"}
            </span>
            <span className="text-xs text-gray-400 block mt-0.5">or click to browse — multiple files allowed</span>
          </div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} disabled={uploading} />
        </label>

        {shareWithClient && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-1.5">
            <Users className="w-3 h-3 shrink-0" />
            Files will be visible in the client's portal under "📁 Files"
          </div>
        )}
      </div>

      {/* Document List */}
      {docs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-secondary text-sm mb-3">Uploaded Files ({docs.length})</h3>
          <div className="space-y-1.5">
            {DOC_CATEGORIES.filter(c => docs.some(d => d.category === c)).map(cat => (
              <div key={cat}>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 mt-2 px-1">{cat}</p>
                {docs.filter(d => d.category === cat).map(doc => {
                  const Icon = getFileIcon(doc.original_name);
                  const isVisible = doc.visible_to_client !== false;
                  return (
                    <div key={doc.id} className={`flex items-center gap-3 p-3 rounded-lg group hover:bg-gray-50 transition-colors border mb-1 ${
                      isVisible ? "border-blue-100 bg-blue-50/40" : "border-gray-100 bg-white"
                    }`}>
                      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-secondary truncate">{doc.name}</p>
                        <p className="text-xs text-gray-400">
                          {doc.uploaded_at ? format(new Date(doc.uploaded_at), "MMM d, yyyy") : ""}
                          {doc.size ? ` · ${formatSize(doc.size)}` : ""}
                        </p>
                      </div>
                      {/* Client visibility toggle */}
                      <button
                        onClick={() => toggleClientVisibility(doc.id, !isVisible)}
                        title={isVisible ? "Hide from client portal" : "Show in client portal"}
                        className={`h-6 px-2 rounded text-[10px] font-semibold flex items-center gap-1 border transition-colors shrink-0 ${
                          isVisible
                            ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                            : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100"
                        }`}
                      >
                        {isVisible ? <Users className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {isVisible ? "Client" : "Hidden"}
                      </button>
                      <div className="flex gap-0.5 shrink-0">
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
            {/* Uncategorized */}
            {docs.filter(d => !DOC_CATEGORIES.includes(d.category)).length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 mt-2 px-1">Uncategorized</p>
                {docs.filter(d => !DOC_CATEGORIES.includes(d.category)).map(doc => {
                  const Icon = getFileIcon(doc.original_name);
                  const isVisible = doc.visible_to_client !== false;
                  return (
                    <div key={doc.id} className={`flex items-center gap-3 p-3 rounded-lg border mb-1 ${isVisible ? "border-blue-100 bg-blue-50/40" : "border-gray-100"}`}>
                      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-secondary truncate">{doc.name}</p>
                      </div>
                      <button onClick={() => toggleClientVisibility(doc.id, !isVisible)} className={`h-6 px-2 rounded text-[10px] font-semibold flex items-center gap-1 border ${isVisible ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}>
                        {isVisible ? <Users className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {isVisible ? "Client" : "Hidden"}
                      </button>
                      <Button variant="ghost" size="sm" onClick={() => removeDoc(doc.id)} className="h-7 w-7 p-0 text-gray-300 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

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