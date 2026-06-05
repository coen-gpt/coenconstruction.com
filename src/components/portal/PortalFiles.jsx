import { FileText, Download, ExternalLink, FileImage, File, ShieldCheck, Receipt, PenLine } from "lucide-react";

const FILE_CATEGORIES = {
  contract: { label: "Contracts", icon: PenLine, color: "text-amber-600 bg-amber-50 border-amber-200" },
  invoice:  { label: "Invoices",  icon: Receipt,  color: "text-green-600 bg-green-50 border-green-200" },
  design:   { label: "Designs",   icon: FileImage, color: "text-purple-600 bg-purple-50 border-purple-200" },
  permit:   { label: "Permits",   icon: ShieldCheck, color: "text-blue-600 bg-blue-50 border-blue-200" },
  other:    { label: "Other",     icon: File,      color: "text-gray-600 bg-gray-50 border-gray-200" },
};

function getExt(name = "", url = "") {
  const src = name || url;
  return src.split(".").pop()?.toLowerCase() || "";
}

function FileIcon({ name, url }) {
  const ext = getExt(name, url);
  if (["jpg","jpeg","png","gif","webp"].includes(ext)) return <FileImage className="w-5 h-5" />;
  return <FileText className="w-5 h-5" />;
}

function categorize(doc) {
  const text = ((doc.category || "") + " " + (doc.name || "")).toLowerCase();
  if (text.includes("contract") || text.includes("agreement")) return "contract";
  if (text.includes("invoice") || text.includes("receipt") || text.includes("payment")) return "invoice";
  if (text.includes("design") || text.includes("render") || text.includes("plan") || text.includes("drawing")) return "design";
  if (text.includes("permit") || text.includes("inspection") || text.includes("code")) return "permit";
  return "other";
}

function FileRow({ doc, idx }) {
  const cat = categorize(doc);
  const { icon: CatIcon, color } = FILE_CATEGORIES[cat];
  const ext = getExt(doc.name, doc.url).toUpperCase();
  const displayName = doc.name || doc.original_name || `Document ${idx + 1}`;
  const uploadedDate = doc.uploaded_at
    ? new Date(doc.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 bg-white border border-gray-100 hover:border-[#E35235]/40 hover:bg-[#E35235]/5 rounded-xl px-4 py-3.5 transition-all group shadow-sm"
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${color}`}>
        <CatIcon className="w-5 h-5" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800 truncate">{displayName}</div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {ext && <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase">{ext}</span>}
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${color}`}>{FILE_CATEGORIES[cat].label}</span>
          {uploadedDate && <span className="text-xs text-gray-400">{uploadedDate}</span>}
        </div>
      </div>

      {/* Download / open indicator */}
      <div className="shrink-0 flex items-center gap-1.5 text-gray-300 group-hover:text-[#E35235] transition-colors">
        <Download className="w-4 h-4" />
      </div>
    </a>
  );
}

export default function PortalFiles({ project, estimates, portal }) {
  // --- Collect all file sources ---

  // 1. Signed contract PDF
  const contractFiles = [];
  if (project?.contract_signed_pdf_url) {
    contractFiles.push({
      name: "Signed Contract",
      url: project.contract_signed_pdf_url,
      category: "contract",
      uploaded_at: project.contract_signed_at,
    });
  }

  // 2. Project documents_meta
  const docFiles = (project?.documents_meta || []).map(d => ({ ...d }));

  // 3. Estimate PDFs (if any estimate has a pdf url — attach as invoice reference)
  const estimateFiles = (estimates || [])
    .filter(e => e.status !== "superseded")
    .map(e => ({
      name: e.type === "change_order"
        ? `Change Order #${e.change_order_number}`
        : `Project Estimate — $${(e.grand_total || 0).toLocaleString()}`,
      url: null, // estimates are viewed in-app, no raw PDF URL here
      category: "invoice",
      uploaded_at: e.approved_date || e.updated_date,
      _estimate: e, // flag for in-app view
    }))
    .filter(e => !e.url === false || e._estimate); // keep only valid

  // Combine all real file docs (with valid URLs)
  const allFiles = [
    ...contractFiles,
    ...docFiles,
  ].filter(f => f.url);

  // Group by category
  const grouped = {};
  for (const f of allFiles) {
    const cat = categorize(f);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  }

  const isEmpty = allFiles.length === 0;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-5 h-5 text-[#E35235]" />
          <h2 className="font-bold text-gray-800 text-base">Your Project Files</h2>
        </div>
        <p className="text-sm text-gray-500">Tap any file to view or download. All files are securely shared by your project manager.</p>
      </div>

      {isEmpty ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No files shared yet</p>
          <p className="text-gray-400 text-sm mt-1">Your contracts, invoices, and designs will appear here when your PM uploads them.</p>
        </div>
      ) : (
        <>
          {/* Category sections */}
          {Object.entries(FILE_CATEGORIES).map(([catKey, catCfg]) => {
            const files = grouped[catKey];
            if (!files?.length) return null;
            const CatIcon = catCfg.icon;
            return (
              <div key={catKey} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <CatIcon className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{catCfg.label}</span>
                  <span className="text-xs text-gray-300 font-semibold">{files.length}</span>
                </div>
                {files.map((doc, i) => (
                  <FileRow key={doc.id || i} doc={doc} idx={i} />
                ))}
              </div>
            );
          })}
        </>
      )}

      {/* Security note */}
      <div className="flex items-center gap-2.5 bg-slate-50 border border-gray-100 rounded-2xl px-4 py-3.5">
        <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
        <p className="text-xs text-gray-500">These files are private and only accessible via your secure project link.</p>
      </div>
    </div>
  );
}