import { useState, useEffect, useRef, useCallback } from "react";
import { X, Download, ExternalLink, ChevronLeft, ChevronRight, Paperclip, FileText, ExternalLink as LinkIcon } from "lucide-react";

// ─── File-type detection ──────────────────────────────────────────────────────

function detectFileType(name = "", mime = "") {
  const ext = name.toLowerCase().split(".").pop();
  const m = (mime || "").toLowerCase();

  if (ext === "pdf" || m === "application/pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext) || m.startsWith("image/")) return "image";
  if (["xlsx", "xls", "xlsm"].includes(ext) ||
      m === "application/vnd.ms-excel" ||
      m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "excel";
  if (ext === "csv" || m === "text/csv") return "csv";
  if (["docx", "doc"].includes(ext) ||
      m === "application/msword" ||
      m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "word";
  return "other";
}

// ─── Rail file-type badge ─────────────────────────────────────────────────────

const TYPE_LABELS = { pdf: "PDF", image: "IMG", excel: "XLS", csv: "CSV", word: "DOC", other: "FILE" };
const TYPE_COLORS = {
  pdf:   "bg-red-100 text-red-700",
  image: "bg-blue-100 text-blue-700",
  excel: "bg-green-100 text-green-700",
  csv:   "bg-teal-100 text-teal-700",
  word:  "bg-indigo-100 text-indigo-700",
  other: "bg-gray-100 text-gray-500",
};

function FileTypeBadge({ type }) {
  return (
    <span className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${TYPE_COLORS[type] || TYPE_COLORS.other}`}>
      {TYPE_LABELS[type] || "FILE"}
    </span>
  );
}

// ─── Fallback icon ────────────────────────────────────────────────────────────

function FileIcon() {
  return (
    <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center">
      <FileText className="w-8 h-8 text-gray-400" />
    </div>
  );
}

// ─── PDF renderer (existing) ──────────────────────────────────────────────────

function PdfPreview({ url, name }) {
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setTimedOut(false);
    timerRef.current = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(timerRef.current);
  }, [url]);

  const handleLoad = () => { setLoading(false); clearTimeout(timerRef.current); };

  if (timedOut) return <FallbackPreview url={url} name={name} message="Preview timed out" />;

  return (
    <div className="relative w-full h-full min-h-[500px]">
      {loading && <LoadingSkeleton name={name} onCancel={() => setTimedOut(true)} />}
      <iframe src={`${url}#toolbar=1`} className="w-full h-full border-0 min-h-[500px]" title={name} onLoad={handleLoad} />
    </div>
  );
}

// ─── Office Online renderer (Excel + Word) ────────────────────────────────────

function OfficeOnlinePreview({ url, name }) {
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setTimedOut(false);
    timerRef.current = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timerRef.current);
  }, [url]);

  const handleLoad = () => { setLoading(false); clearTimeout(timerRef.current); };

  if (timedOut) return <FallbackPreview url={url} name={name} message="Preview unavailable — download to view" />;

  const embedUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

  return (
    <div className="relative w-full h-full min-h-[500px]">
      {loading && <LoadingSkeleton name={name} onCancel={() => setTimedOut(true)} />}
      <iframe
        src={embedUrl}
        className="w-full h-full border-0 min-h-[500px]"
        title={name}
        onLoad={handleLoad}
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}

// ─── CSV renderer ─────────────────────────────────────────────────────────────

const CSV_ROW_LIMIT = 500;

function CsvPreview({ url, name }) {
  const [rows, setRows] = useState(null);
  const [totalRows, setTotalRows] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setRows(null);

    fetch(url)
      .then(r => r.text())
      .then(text => {
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        const parsed = lines.map(line => {
          // Simple CSV split: handle quoted fields
          const result = [];
          let cur = "";
          let inQuotes = false;
          for (let ci = 0; ci < line.length; ci++) {
            const ch = line[ci];
            if (ch === '"') { inQuotes = !inQuotes; }
            else if (ch === "," && !inQuotes) { result.push(cur); cur = ""; }
            else { cur += ch; }
          }
          result.push(cur);
          return result;
        });
        setTotalRows(parsed.length - 1); // exclude header
        setRows(parsed.slice(0, CSV_ROW_LIMIT + 1)); // header + up to 500 rows
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [url]);

  if (loading) return <LoadingSkeleton name={name} />;
  if (error) return <FallbackPreview url={url} name={name} message={`Could not load CSV: ${error}`} />;
  if (!rows || rows.length === 0) return <FallbackPreview url={url} name={name} message="File appears empty" />;

  const header = rows[0];
  const dataRows = rows.slice(1);
  const capped = totalRows > CSV_ROW_LIMIT;

  return (
    <div className="w-full h-full overflow-auto p-2 flex flex-col">
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              {header.map((h, i) => (
                <th key={i} className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap bg-gray-100">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                {header.map((_, ci) => (
                  <td key={ci} className="border border-gray-100 px-2 py-1 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                    {row[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {capped && (
        <div className="shrink-0 border-t border-gray-200 py-2 px-3 text-xs text-gray-500 flex items-center justify-between bg-gray-50">
          <span>Showing first {CSV_ROW_LIMIT} of {totalRows} rows</span>
          <a href={url} download={name} className="inline-flex items-center gap-1 text-primary font-medium hover:underline">
            <Download className="w-3 h-3" /> Download full file
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function LoadingSkeleton({ name, onCancel }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50 z-10">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
      <p className="text-sm text-gray-500">Loading {name}…</p>
      {onCancel && (
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 underline">Cancel</button>
      )}
    </div>
  );
}

function FallbackPreview({ url, name, message, gmailUrl }) {
  return (
    <div className="flex flex-col items-center gap-4 p-8 text-center">
      <FileIcon />
      <p className="text-gray-600 font-medium">{name}</p>
      {message && <p className="text-sm text-gray-500">{message}</p>}
      <div className="flex gap-2 flex-wrap justify-center">
        <a href={url} download={name} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Download className="w-4 h-4" /> Download
        </a>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
          <ExternalLink className="w-4 h-4" /> Open
        </a>
        {gmailUrl && (
          <a href={gmailUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
            <LinkIcon className="w-4 h-4" /> Gmail Thread
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function AttachmentViewerModal({ record, onClose, lastFocusRef }) {
  const [idx, setIdx] = useState(0);
  const modalRef = useRef(null);
  const closeRef = useRef(null);
  const ariaLiveRef = useRef(null);

  const allUrls = record?.attachment_urls || [];
  const allNames = record?.attachment_names || allUrls.map((_, i) => `attachment-${i + 1}`);
  const allMimes = record?.attachment_mimes || [];
  const hasAttachments = allNames.length > 0;
  const url = allUrls[idx] || null;
  const name = allNames[idx] || `attachment-${idx + 1}`;
  const mime = allMimes[idx] || "";
  const fileType = detectFileType(name, mime);
  const gmailUrl = record?.gmail_message_id
    ? `https://mail.google.com/mail/u/0/#inbox/${record.gmail_message_id}`
    : null;

  const goTo = useCallback((newIdx) => {
    const clamped = Math.max(0, Math.min(Math.max(0, allUrls.length - 1), newIdx));
    setIdx(clamped);
    if (ariaLiveRef.current) {
      ariaLiveRef.current.textContent = `Showing attachment ${clamped + 1} of ${allUrls.length}: ${allNames[clamped] || ""}`;
    }
  }, [allUrls.length, allNames]);

  useEffect(() => {
    if (!record) return;
    const onKey = (e) => {
      if (e.key === "Escape") { onClose(); lastFocusRef?.current?.focus(); }
      if (e.key === "ArrowLeft") goTo(idx - 1);
      if (e.key === "ArrowRight") goTo(idx + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [idx, goTo, onClose, lastFocusRef, record]);

  useEffect(() => {
    if (!record) return;
    closeRef.current?.focus();
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const trap = (e) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last?.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    };
    modal.addEventListener("keydown", trap);
    return () => modal.removeEventListener("keydown", trap);
  }, [record]);

  useEffect(() => {
    if (!record) return;
    [-1, 1].forEach(offset => {
      const preloadUrl = allUrls[idx + offset];
      if (preloadUrl && detectFileType(allNames[idx + offset] || "", "") === "image") {
        const img = new Image(); img.src = preloadUrl;
      }
    });
  }, [idx, allUrls, allNames, record]);

  if (!record) return null;

  // ─── Renderer dispatch ────────────────────────────────────────────────────

  function renderPreview() {
    if (!hasAttachments) {
      return (
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <FileIcon />
          <p className="text-gray-600 font-medium">No attachments</p>
          {gmailUrl && (
            <a href={gmailUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
              <LinkIcon className="w-4 h-4" /> Open Gmail Thread
            </a>
          )}
        </div>
      );
    }

    if (!url) {
      return (
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <FileIcon />
          <p className="text-gray-600 font-medium">{name}</p>
          <p className="text-sm text-gray-500 mb-1">File URL unavailable. Try resyncing.</p>
          {gmailUrl && (
            <a href={gmailUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
              <LinkIcon className="w-4 h-4" /> Open Gmail Thread
            </a>
          )}
        </div>
      );
    }

    switch (fileType) {
      case "pdf":
        return <PdfPreview url={url} name={name} />;
      case "image":
        return (
          <img src={url} alt={name} className="max-w-full object-contain p-4" style={{ maxHeight: "80vh" }} />
        );
      case "excel":
      case "word":
        return <OfficeOnlinePreview url={url} name={name} />;
      case "csv":
        return <CsvPreview url={url} name={name} />;
      default:
        return <FallbackPreview url={url} name={name} message="Cannot preview this file type" gmailUrl={gmailUrl} />;
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4"
      onClick={() => { onClose(); lastFocusRef?.current?.focus(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Attachment viewer: ${name}`}
    >
      <div ref={ariaLiveRef} aria-live="polite" aria-atomic="true" className="sr-only" />

      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900 truncate text-sm">{name}</h2>
              {allUrls.length > 1 && (
                <p className="text-xs text-gray-500">{idx + 1} of {allUrls.length} attachments</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0 ml-2">
            <button onClick={() => goTo(idx - 1)} disabled={idx === 0}
              className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-30 transition-colors"
              title="Previous (←)" aria-label="Previous attachment">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button onClick={() => goTo(idx + 1)} disabled={idx === allUrls.length - 1 || !hasAttachments}
              className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-30 transition-colors"
              title="Next (→)" aria-label="Next attachment">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
            {url && (
              <>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Open in new tab" aria-label="Open in new tab">
                  <ExternalLink className="w-4 h-4 text-gray-600" />
                </a>
                <a href={url} download={name}
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Download" aria-label="Download file">
                  <Download className="w-4 h-4 text-gray-600" />
                </a>
              </>
            )}
            <button ref={closeRef}
              onClick={() => { onClose(); lastFocusRef?.current?.focus(); }}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors ml-1"
              aria-label="Close (Esc)">
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Preview pane */}
          <div className="flex-1 md:w-[70%] bg-gray-100 overflow-auto flex items-center justify-center relative">
            {renderPreview()}
          </div>

          {/* Attachment rail */}
          {hasAttachments && (
            <div className="md:w-[30%] border-t md:border-t-0 md:border-l border-gray-200 overflow-y-auto bg-white shrink-0 max-h-40 md:max-h-none">
              <div className="p-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100 px-3 py-2">
                Attachments ({allNames.length})
              </div>
              {allNames.map((n, i) => {
                const t = detectFileType(n, allMimes[i] || "");
                const isActive = i === idx;
                return (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors border-b border-gray-50 text-sm
                      ${isActive
                        ? "bg-orange-50 border-l-2 border-l-orange-600 pl-2.5"
                        : "hover:bg-gray-50 border-l-2 border-l-transparent"
                      }`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    <FileTypeBadge type={t} />
                    <span className={`truncate text-xs ${isActive ? "text-orange-700 font-medium" : "text-gray-600"}`}>
                      {n || `File ${i + 1}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}