import { useState } from "react";
import { FileText, Download, ExternalLink, FileImage, File, ShieldCheck, Receipt, PenLine, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";

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

function FileRow({ doc, idx }) {
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
        <a
          href={doc.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-white transition-colors"
          style={{}}
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

function CategorySection({ catKey, files }) {
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
            <FileRow key={doc.id || i} doc={doc} idx={i} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PortalFiles({ project, estimates, portal }) {
  // 1. Signed contract PDF
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

  // 2. documents_meta — only those marked visible_to_client (or all if field not set)
  const docFiles = (project?.documents_meta || []).filter(d =>
    d.url && (d.visible_to_client !== false)
  );
  allFiles.push(...docFiles);

  // Group by category
  const grouped = {};
  for (const f of allFiles) {
    const cat = categorize(f);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  }

  const totalFiles = allFiles.length;

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-[#1B2B3A] rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#E35235] flex items-center justify-center shrink-0">
            <FolderOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base">Your Project Files</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              {totalFiles > 0 ? `${totalFiles} file${totalFiles !== 1 ? "s" : ""} shared by your project manager` : "No files shared yet"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 mt-3">
          <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
          <p className="text-xs text-gray-300">Files are private and only accessible via your secure project link.</p>
        </div>
      </div>

      {totalFiles === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <FolderOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No files shared yet</p>
          <p className="text-gray-400 text-sm mt-1">Your contracts, invoices, and design specs will appear here when your PM uploads them.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(CATEGORIES).map(([catKey]) => {
            const files = grouped[catKey];
            if (!files?.length) return null;
            return <CategorySection key={catKey} catKey={catKey} files={files} />;
          })}
        </div>
      )}

      {/* Estimates section — inline view links */}
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
    </div>
  );
}