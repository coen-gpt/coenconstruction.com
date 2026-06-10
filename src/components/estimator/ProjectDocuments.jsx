import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Trash2, Download, Eye, RefreshCw,
  FileImage, File, FileBadge, MessageSquare, Send,
  Users, EyeOff, CloudUpload, X, Search,
  Mail, FolderOpen, Lock, Share2, History, ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const DOC_CATEGORIES = ["Contract", "Estimate", "Change Order", "Design Spec", "Permit", "Inspection", "Invoice", "Photo", "Other"];

function getFileIcon(name, size = 20) {
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

function FilePreviewModal({ open, onClose, doc }) {
  if (!doc) return null;
  const ext = doc.url?.split(".").pop()?.toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
  const isPDF = ext === "pdf";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-lg">{doc.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <Badge variant="outline">{doc.category}</Badge>
                {doc.size && <span>{formatSize(doc.size)}</span>}
                {doc.uploaded_at && <span>· Uploaded {format(new Date(doc.uploaded_at), "MMM d, yyyy")}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <a href={doc.url} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" /> Open New Tab
                </Button>
              </a>
              <a href={doc.url} download={doc.original_name}>
                <Button size="sm" className="gap-2 bg-primary text-white">
                  <Download className="w-4 h-4" /> Download
                </Button>
              </a>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-gray-100 rounded-lg mt-4 flex items-center justify-center min-h-[400px]">
          {isImage ? (
            <img src={doc.url} alt={doc.name} className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg" />
          ) : isPDF ? (
            <iframe src={doc.url} className="w-full h-[60vh] rounded-lg border" title={doc.name} />
          ) : (
            <div className="text-center py-12">
              <FileBadge className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Preview not available for this file type</p>
              <a href={doc.url} download className="text-primary font-semibold mt-2 inline-block hover:underline">
                Download to view →
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActivityTimeline({ docs, messages }) {
  const events = [
    ...(docs || []).map(d => ({
      type: "file",
      action: d.visible_to_client !== false ? "Shared with client" : "Uploaded (internal)",
      icon: d.visible_to_client !== false ? Share2 : Lock,
      color: d.visible_to_client !== false ? "text-blue-600 bg-blue-50" : "text-gray-400 bg-gray-50",
      date: d.uploaded_at,
      author: "You",
      detail: d.name,
    })),
    ...(messages || []).map(m => ({
      type: "message",
      action: "Added team note",
      icon: MessageSquare,
      color: "text-purple-600 bg-purple-50",
      date: m.created_at,
      author: m.author,
      detail: m.text,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {events.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No activity yet</p>
      ) : (
        events.map((evt, i) => {
          const Icon = evt.icon;
          return (
            <div key={i} className="flex gap-3 items-start">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${evt.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{evt.author}</span>
                  <span className="text-xs text-gray-400">{evt.action}</span>
                </div>
                {evt.detail && <p className="text-sm text-gray-600 truncate">{evt.detail}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{format(new Date(evt.date), "MMM d, h:mm a")}</p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function ProjectDocuments({ project, onUpdate }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("Contract");
  const [docLabel, setDocLabel] = useState("");
  const [shareWithClient, setShareWithClient] = useState(true);
  const [notifyClient, setNotifyClient] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterVisibility, setFilterVisibility] = useState("All");
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [showActivity, setShowActivity] = useState(false);
  const fileInputRef = useRef(null);

  const docs = project?.documents_meta || [];
  const messages = project?.team_messages || [];

  const filteredDocs = docs.filter(d => {
    const matchesSearch = (d.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (d.original_name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "All" || d.category === filterCategory;
    const matchesVisibility = filterVisibility === "All" ||
                             (filterVisibility === "Client" && d.visible_to_client !== false) ||
                             (filterVisibility === "Internal" && d.visible_to_client === false);
    return matchesSearch && matchesCategory && matchesVisibility;
  });

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
          version: 1,
        };
      }));

      const updatedDocs = [...docs, ...uploaded];
      await base44.entities.ContractorProject.update(project.id, { documents_meta: updatedDocs });
      
      if (notifyClient && shareWithClient) {
        await base44.functions.invoke("sendCustomerNotification", {
          project_id: project.id,
          notification_type: "file_upload",
          custom_message: `${uploaded.length} new file${uploaded.length > 1 ? "s" : ""} uploaded: ${uploaded.map(f => f.name).join(", ")}`,
        });
      }

      toast({ 
        title: `${uploaded.length} file(s) uploaded`, 
        description: shareWithClient ? (notifyClient ? "Shared with client + notification sent" : "Visible in client portal") : "Internal only",
      });
      setDocLabel("");
      setNotifyClient(false);
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

  const bulkAction = async (action) => {
    const selected = docs.filter(d => selectedDocs.includes(d.id));
    if (!selected.length) return;

    let updated = [...docs];
    if (action === "share") {
      updated = updated.map(d => selectedDocs.includes(d.id) ? { ...d, visible_to_client: true } : d);
    } else if (action === "hide") {
      updated = updated.map(d => selectedDocs.includes(d.id) ? { ...d, visible_to_client: false } : d);
    } else if (action === "delete") {
      updated = updated.filter(d => !selectedDocs.includes(d.id));
    }

    await base44.entities.ContractorProject.update(project.id, { documents_meta: updated });
    setSelectedDocs([]);
    toast({ title: `Bulk ${action} complete`, description: `${selected.length} file(s) affected` });
    if (onUpdate) onUpdate();
  };

  const toggleSelect = (docId) => {
    setSelectedDocs(prev => prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]);
  };

  const toggleSelectAll = () => {
    if (selectedDocs.length === filteredDocs.length) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(filteredDocs.map(d => d.id));
    }
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
  const internalCount = docs.filter(d => d.visible_to_client === false).length;

  return (
    <div className="space-y-4">
      {/* Upload Panel - Premium Version */}
      <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-secondary text-lg flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <CloudUpload className="w-4 h-4 text-primary" />
            </div>
            Document Center
          </h2>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <Users className="w-3 h-3 mr-1" /> {clientVisibleCount} Client
            </Badge>
            <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
              <Lock className="w-3 h-3 mr-1" /> {internalCount} Internal
            </Badge>
          </div>
        </div>

        {/* Upload config row */}
        <div className="flex flex-wrap gap-2 mb-3">
          <Input
            value={docLabel}
            onChange={e => setDocLabel(e.target.value)}
            placeholder="Document label (optional)"
            className="flex-1 min-w-40 h-9 text-sm"
          />
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="h-9 text-sm border border-gray-200 rounded-md px-2 bg-white text-gray-700"
          >
            {DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <button
            onClick={() => setShareWithClient(s => !s)}
            className={`h-9 px-3 rounded-md border text-xs font-bold flex items-center gap-1.5 transition-all ${
              shareWithClient
                ? "bg-blue-500 border-blue-600 text-white shadow-sm"
                : "bg-gray-50 border-gray-200 text-gray-500"
            }`}
          >
            {shareWithClient ? <Users className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {shareWithClient ? "Share w/ Client" : "Internal Only"}
          </button>
        </div>

        {/* Notify client checkbox */}
        {shareWithClient && (
          <div className="flex items-center gap-2 mb-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <Checkbox
              id="notify"
              checked={notifyClient}
              onCheckedChange={setNotifyClient}
              className="border-blue-300 data-[state=checked]:bg-blue-500"
            />
            <label htmlFor="notify" className="text-xs text-blue-700 flex items-center gap-1.5 cursor-pointer">
              <Mail className="w-3 h-3" />
              Send email notification to client when files are uploaded
            </label>
          </div>
        )}

        {/* Drag & drop zone - Enhanced */}
        <label
          className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl py-10 px-4 cursor-pointer transition-all overflow-hidden ${
            dragOver ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5" : "border-gray-200 hover:border-primary/40 hover:bg-gray-50"
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {uploading ? (
            <div className="flex flex-col items-center">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mb-2" />
              <span className="text-sm font-semibold text-primary">Uploading files…</span>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <CloudUpload className="w-7 h-7 text-primary" />
              </div>
              <div className="text-center">
                <span className="text-base font-bold text-gray-700">Drag & drop files here</span>
                <span className="text-xs text-gray-400 block mt-1">or click to browse — multiple files allowed</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px]">PDF</Badge>
                <Badge variant="outline" className="text-[10px]">JPG/PNG</Badge>
                <Badge variant="outline" className="text-[10px]">Any format</Badge>
              </div>
            </>
          )}
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} disabled={uploading} />
        </label>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
            <div className="text-lg font-bold text-blue-700">{docs.length}</div>
            <div className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">Total Files</div>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
            <div className="text-lg font-bold text-green-700">{clientVisibleCount}</div>
            <div className="text-[10px] text-green-600 font-semibold uppercase tracking-wide">Client Visible</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
            <div className="text-lg font-bold text-purple-700">{messages.length}</div>
            <div className="text-[10px] text-purple-600 font-semibold uppercase tracking-wide">Team Notes</div>
          </div>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedDocs.length > 0 && (
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/20 rounded-xl p-3 flex items-center gap-2">
          <Badge className="bg-primary text-white">{selectedDocs.length} selected</Badge>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => bulkAction("share")} className="h-8 gap-1.5">
            <Users className="w-3.5 h-3.5" /> Share
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkAction("hide")} className="h-8 gap-1.5">
            <EyeOff className="w-3.5 h-3.5" /> Hide
          </Button>
          <Button size="sm" variant="destructive" onClick={() => bulkAction("delete")} className="h-8 gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedDocs([])} className="h-8">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search files…"
            className="pl-9 h-9 text-sm"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="h-9 text-sm border border-gray-200 rounded-md px-2 bg-white text-gray-700"
        >
          <option value="All">All Categories</option>
          {DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select
          value={filterVisibility}
          onChange={e => setFilterVisibility(e.target.value)}
          className="h-9 text-sm border border-gray-200 rounded-md px-2 bg-white text-gray-700"
        >
          <option value="All">All Files</option>
          <option value="Client">Client Visible</option>
          <option value="Internal">Internal Only</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowActivity(!showActivity)}
          className={`h-9 gap-1.5 ${showActivity ? "bg-primary/10 text-primary border-primary/20" : ""}`}
        >
          <History className="w-3.5 h-3.5" />
          Activity
        </Button>
      </div>

      {/* Activity Timeline */}
      {showActivity && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-secondary text-sm mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-primary" /> Recent Activity
          </h3>
          <ActivityTimeline docs={docs} messages={messages} />
        </div>
      )}

      {/* Document List - Enhanced */}
      {filteredDocs.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <Checkbox
              checked={selectedDocs.length === filteredDocs.length && filteredDocs.length > 0}
              onCheckedChange={toggleSelectAll}
              className="border-gray-300"
            />
            <div className="flex-1 text-xs font-bold text-gray-500 uppercase tracking-wide">
              {filteredDocs.length} file{filteredDocs.length !== 1 ? "s" : ""} found
            </div>
            <div className="text-xs text-gray-400">
              {filteredDocs.filter(d => d.visible_to_client !== false).length} visible · {filteredDocs.filter(d => d.visible_to_client === false).length} hidden
            </div>
          </div>

          {/* File list */}
          <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
            {filteredDocs.map(doc => {
              const Icon = getFileIcon(doc.original_name);
              const isVisible = doc.visible_to_client !== false;
              const isSelected = selectedDocs.includes(doc.id);
              return (
                <div
                  key={doc.id}
                  className={`flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-l-4 ${
                    isVisible ? "border-l-blue-500 bg-blue-50/20" : "border-l-gray-300"
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(doc.id)}
                    className="border-gray-300"
                  />
                  <button onClick={() => setPreviewDoc(doc)} className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0">
                    <Icon className="w-5 h-5 text-gray-500" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-secondary truncate">{doc.name}</p>
                      <Badge variant="outline" className="text-[10px]">{doc.category}</Badge>
                      {isVisible && <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200"><Users className="w-2.5 h-2.5 mr-0.5" /> Client</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                      <span>{format(new Date(doc.uploaded_at), "MMM d, yyyy")}</span>
                      {doc.size && <span>· {formatSize(doc.size)}</span>}
                      {doc.version > 1 && <span>· v{doc.version}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleClientVisibility(doc.id, !isVisible)}
                      title={isVisible ? "Hide from client" : "Share with client"}
                      className={`h-7 px-2 rounded-md text-[10px] font-bold flex items-center gap-1 border transition-colors ${
                        isVisible ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {isVisible ? <Users className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {isVisible ? "Client" : "Hidden"}
                    </button>
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
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <FolderOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No files match your filters</p>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filter criteria</p>
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
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
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

      {/* File Preview Modal */}
      <FilePreviewModal open={!!previewDoc} onClose={() => setPreviewDoc(null)} doc={previewDoc} />
    </div>
  );
}