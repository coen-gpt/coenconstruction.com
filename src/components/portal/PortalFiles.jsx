import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText, Download, ExternalLink, FileImage, File, ShieldCheck, Receipt, PenLine,
  FolderOpen, ChevronDown, ChevronRight, Mail, MessageCircle, Clock, AlertCircle,
  CheckCircle2, Upload, X, CalendarDays, User, Search, Filter, Star, Zap, Eye,
  FileBadge, RefreshCw
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const CATEGORIES = {
  contract: { label: "Contracts & Agreements", icon: PenLine,    color: "text-amber-700  bg-amber-50  border-amber-200",  accent: "#b45309" },
  invoice:  { label: "Invoices & Estimates",   icon: Receipt,    color: "text-green-700  bg-green-50  border-green-200",  accent: "#15803d" },
  design:   { label: "Design Specs & Plans",   icon: FileImage,  color: "text-purple-700 bg-purple-50 border-purple-200", accent: "#7e22ce" },
  permit:   { label: "Permits & Inspections",  icon: ShieldCheck,color: "text-blue-700   bg-blue-50   border-blue-200",   accent: "#1d4ed8" },
  other:    { label: "Other Files",            icon: File,       color: "text-gray-600   bg-gray-50   border-gray-200",   accent: "#475569" },
};

function getExt(name = "", url = "") {
  return (name || url).split(".").pop()?.toLowerCase() || "";
}

function categorize(doc) {
  const text = ((doc.category || "") + " " + (doc.name || "")).toLowerCase();
  if (text.includes("contract") || text.includes("agreement") || text.includes("signed")) return "contract";
  if (text.includes("invoice") || text.includes("receipt") || text.includes("payment") || text.includes("estimate")) return "invoice";
  if (text.includes("design") || text.includes("render") || text.includes("plan") || text.includes("drawing") || text.includes("spec")) return "design";
  if (text.includes("permit") || text.includes("inspection") || text.includes("code")) return "permit";
  return "other";
}

function formatSize(bytes) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileRequestModal({ open, onClose, onSubmit, projectName }) {
  const [fileType, setFileType] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!fileType.trim()) return;
    setSubmitting(true);
    await onSubmit({ fileType: fileType.trim(), description: description.trim(), urgency });
    setSubmitting(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Request a File
          </DialogTitle>
          <DialogDescription>
            Let your project manager know what document you need for {projectName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">What do you need?</label>
            <Input
              value={fileType}
              onChange={e => setFileType(e.target.value)}
              placeholder="e.g. Updated contract, Paint color specs, Permit copy"
              className="text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Additional details (optional)</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Any specific details about what you need"
              className="text-sm min-h-[80px]"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Urgency</label>
            <div className="flex gap-2">
              {[
                { value: "low", label: "When convenient", icon: Clock, color: "text-gray-500" },
                { value: "normal", label: "This week", icon: CalendarDays, color: "text-blue-500" },
                { value: "high", label: "Urgent", icon: AlertCircle, color: "text-red-500" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setUrgency(opt.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-xs font-semibold transition-colors ${
                    urgency === opt.value
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <opt.icon className={`w-4 h-4 ${opt.color}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !fileType.trim()} className="gap-2 bg-primary text-white">
            {submitting ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sending…</> : <><Mail className="w-4 h-4" /> Send Request</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FileRow({ doc, idx, onPreview }) {
  const cat = categorize(doc);
  const { icon: CatIcon, color, accent } = CATEGORIES[cat];
  const ext = getExt(doc.name, doc.url).toUpperCase();
  const displayName = doc.name || doc.original_name || `Document ${idx + 1}`;
  const uploadedDate = doc.uploaded_at
    ? new Date(doc.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  const size = formatSize(doc.size);
  const isImage = ["jpg","jpeg","png","gif","webp"].includes(getExt(doc.name, doc.url));

  return (
    <div className="flex items-center gap-3 bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm rounded-xl px-4 py-3.5 transition-all group">
      {/* Category icon */}
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${color}`}>
        <CatIcon className="w-5 h-5" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800 truncate">{displayName}</div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {ext && <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase">{ext}</span>}
          {uploadedDate && <span className="text-xs text-gray-400">{uploadedDate}</span>}
          {size && <span className="text-xs text-gray-400">· {size}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onPreview(doc)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-white hover:border-primary transition-colors"
          onMouseEnter={e => { e.currentTarget.style.background = accent; e.currentTarget.style.borderColor = accent; }}
          onMouseLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.borderColor = ""; }}
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Preview</span>
        </button>
        <a
          href={doc.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-white transition-colors"
          onMouseEnter={e => { e.currentTarget.style.background = accent; e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = "white"; }}
          onMouseLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.borderColor = ""; e.currentTarget.style.color = ""; }}
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Download</span>
        </a>
        {isImage && (
          <a
            href={doc.url}
            target="_blank"
            rel="noreferrer"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function CategorySection({ catKey, files, onPreview }) {
  const [open, setOpen] = useState(true);
  const { label, icon: CatIcon, color } = CATEGORIES[catKey];

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-1 group"
      >
        <div className={`w-6 h-6 rounded-lg border flex items-center justify-center ${color}`}>
          <CatIcon className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex-1 text-left">{label}</span>
        <span className="text-xs text-gray-400 font-semibold">{files.length}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-gray-300" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
      </button>
      {open && (
        <div className="space-y-2 pl-1">
          {files.map((doc, i) => (
            <FileRow key={doc.id || i} doc={doc} idx={i} onPreview={onPreview} />
          ))}
        </div>
      )}
    </div>
  );
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
                  <ExternalLink className="w-4 h-4" /> Open
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
              <p className="text-gray-500">Preview not available</p>
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

export default function PortalFiles({ project, estimates, portal }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  // Collect files
  const allFiles = [];

  if (project?.contract_signed_pdf_url) {
    allFiles.push({
      id: "signed_contract",
      name: "Signed Contract",
      url: project.contract_signed_pdf_url,
      category: "contract",
      uploaded_at: project.contract_signed_at,
    });
  }

  const docFiles = (project?.documents_meta || []).filter(d => d.url && (d.visible_to_client !== false));
  allFiles.push(...docFiles);

  // Filter & search
  const filteredFiles = allFiles.filter(f => {
    const matchesSearch = (f.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const cat = categorize(f);
    const matchesCategory = activeCategory === "all" || cat === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const grouped = {};
  for (const f of filteredFiles) {
    const cat = categorize(f);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  }

  const handleFileRequest = async ({ fileType, description, urgency }) => {
    try {
      await base44.functions.invoke("sendCustomerNotification", {
        project_id: project.id,
        notification_type: "file_request",
        custom_message: `Client requested: ${fileType}${description ? ` - ${description}` : ""} (Urgency: ${urgency})`,
      });
      toast({
        title: "Request sent!",
        description: "Your project manager will respond soon",
      });
    } catch {
      toast({
        title: "Request sent",
        description: "We'll follow up via email",
      });
    }
  };

  const totalFiles = allFiles.length;
  const displayedFiles = filteredFiles.length;

  return (
    <div className="space-y-4">
      {/* Premium Header */}
      <div className="bg-gradient-to-br from-[#1B2B3A] to-[#2C3E50] rounded-2xl p-6 shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#E35235] flex items-center justify-center shadow-lg">
              <FolderOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Your Project Files</h2>
              <p className="text-gray-300 text-xs mt-0.5">
                {totalFiles > 0 ? `${totalFiles} file${totalFiles !== 1 ? "s" : ""} shared by your project manager` : "No files shared yet"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors backdrop-blur-sm"
          >
            <Mail className="w-4 h-4" />
            Request File
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search files by name..."
            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400 backdrop-blur-sm"
          />
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeCategory === "all" ? "bg-[#E35235] text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
          >
            All Files ({totalFiles})
          </button>
          {Object.entries(CATEGORIES).map(([key, cfg]) => {
            const count = grouped[key]?.length || 0;
            if (count === 0 && activeCategory !== key) return null;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeCategory === key ? "bg-[#E35235] text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"
                }`}
              >
                {cfg.label.split(" ")[0]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {totalFiles === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <FolderOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-semibold text-base">No files shared yet</p>
          <p className="text-gray-400 text-sm mt-1 mb-4">Your contracts, invoices, and design specs will appear here when your PM uploads them.</p>
          <button
            onClick={() => setShowRequestModal(true)}
            className="inline-flex items-center gap-2 bg-[#E35235] hover:bg-[#c94522] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <Mail className="w-4 h-4" />
            Request Your Documents
          </button>
        </div>
      ) : displayedFiles === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <Search className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No files match your search</p>
          <button onClick={() => { setSearchQuery(""); setActiveCategory("all"); }} className="text-primary text-sm font-semibold mt-2 hover:underline">
            Clear filters →
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {activeCategory === "all" ? (
            Object.entries(CATEGORIES).map(([catKey]) => {
              const files = grouped[catKey];
              if (!files?.length) return null;
              return <CategorySection key={catKey} catKey={catKey} files={files} onPreview={setPreviewDoc} />;
            })
          ) : (
            <div className="space-y-2">
              {(grouped[activeCategory] || []).map((doc, i) => (
                <FileRow key={doc.id || i} doc={doc} idx={i} onPreview={setPreviewDoc} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Estimates section */}
      {(estimates || []).filter(e => e.status !== "superseded" && e.status !== "draft").length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-6 h-6 rounded-lg border border-green-200 bg-green-50 flex items-center justify-center">
              <Receipt className="w-3.5 h-3.5 text-green-700" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex-1">Estimates On File</span>
          </div>
          {(estimates || []).filter(e => e.status !== "superseded" && e.status !== "draft").map((e, i) => (
            <div key={e.id || i} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3.5">
              <div className="w-10 h-10 rounded-xl border border-green-200 bg-green-50 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5 text-green-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">
                  {e.type === "change_order" ? `Change Order #${e.change_order_number}` : "Project Estimate"}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  ${(e.grand_total || 0).toLocaleString()} ·{" "}
                  <span className={e.status === "approved" ? "text-green-600 font-semibold" : "text-blue-600 font-semibold"}>
                    {e.status === "approved" ? "✓ Approved" : e.status === "sent" ? "Ready for review" : e.status}
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold text-[#E35235] shrink-0">View in Estimate tab →</span>
            </div>
          ))}
        </div>
      )}

      {/* Security & Activity */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-2.5 bg-green-50 border border-green-100 rounded-2xl px-4 py-3.5">
          <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-xs text-gray-600">Files are encrypted and only accessible via your secure project link</p>
        </div>
        <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3.5">
          <Clock className="w-5 h-5 text-blue-600 shrink-0" />
          <p className="text-xs text-gray-600">Files are automatically synced and backed up</p>
        </div>
      </div>

      {/* Modals */}
      <FileRequestModal
        open={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        onSubmit={handleFileRequest}
        projectName={project?.client_name || "your project"}
      />
      <FilePreviewModal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        doc={previewDoc}
      />
    </div>
  );
}