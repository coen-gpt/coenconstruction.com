import { useState, useEffect, useRef, useCallback } from "react";
import { X, Download, ExternalLink, ChevronLeft, ChevronRight, Paperclip, FileText, ExternalLink as LinkIcon } from "lucide-react";

function FileIcon() {
  return (
    <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center">
      <FileText className="w-8 h-8 text-gray-400" />
    </div>
  );
}

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

  const handleLoad = () => {
    setLoading(false);
    clearTimeout(timerRef.current);
  };

  if (timedOut) {
    return (
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        <FileIcon />
        <p className="text-gray-600 font-medium">{name}</p>
        <p className="text-sm text-gray-500">Preview timed out</p>
        <div className="flex gap-2">
          <a href={url} download={name} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
            <Download className="w-4 h-4" /> Download
          </a>
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
            <ExternalLink className="w-4 h-4" /> Open
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[500px]">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50 z-10">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading {name}…</p>
          <button
            onClick={() => setTimedOut(true)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Cancel
          </button>
        </div>
      )}
      <iframe
        src={`${url}#toolbar=1`}
        className="w-full h-full border-0 min-h-[500px]"
        title={name}
        onLoad={handleLoad}
      />
    </div>
  );
}

export default function AttachmentViewerModal({ record, onClose, lastFocusRef }) {
  const [idx, setIdx] = useState(0);
  const modalRef = useRef(null);
  const closeRef = useRef(null);
  const ariaLiveRef = useRef(null);

  // Derive data (safe defaults when record is null)
  const allUrls = record?.attachment_urls || [];
  const allNames = record?.attachment_names || allUrls.map((_, i) => `attachment-${i + 1}`);
  const hasAttachments = allNames.length > 0;
  const url = allUrls[idx] || null;
  const name = allNames[idx] || `attachment-${idx + 1}`;
  const ext = (name || "").toLowerCase().split(".").pop();
  const isPdf = ext === "pdf";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
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

  // Keyboard handler
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

  // Focus trap
  useEffect(() => {
    if (!record) return;
    closeRef.current?.focus();
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
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

  // Preload idx±1
  useEffect(() => {
    if (!record) return;
    [-1, 1].forEach(offset => {
      const preloadUrl = allUrls[idx + offset];
      if (preloadUrl) { const img = new Image(); img.src = preloadUrl; }
    });
  }, [idx, allUrls, record]);

  if (!record) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4"
      onClick={() => { onClose(); lastFocusRef?.current?.focus(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Attachment viewer: ${name}`}
    >
      {/* aria-live region */}
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

          {/* Floating toolbar */}
          <div className="flex items-center gap-0.5 shrink-0 ml-2">
            <button
              onClick={() => goTo(idx - 1)}
              disabled={idx === 0}
              className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-30 transition-colors"
              title="Previous (←)"
              aria-label="Previous attachment"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => goTo(idx + 1)}
              disabled={idx === allUrls.length - 1 || !hasAttachments}
              className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-30 transition-colors"
              title="Next (→)"
              aria-label="Next attachment"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
            {url && (
              <>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Open in new tab"
                  aria-label="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4 text-gray-600" />
                </a>
                <a
                  href={url}
                  download={name}
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Download"
                  aria-label="Download file"
                >
                  <Download className="w-4 h-4 text-gray-600" />
                </a>
              </>
            )}
            <button
              ref={closeRef}
              onClick={() => { onClose(); lastFocusRef?.current?.focus(); }}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors ml-1"
              aria-label="Close (Esc)"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Body: 70/30 split (stacked on mobile) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Preview pane (70%) */}
          <div className="flex-1 md:w-[70%] bg-gray-100 overflow-auto flex items-center justify-center relative">
            {!hasAttachments ? (
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <FileIcon />
                <p className="text-gray-600 font-medium">No attachments</p>
                {gmailUrl && (
                  <a
                    href={gmailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium"
                  >
                    <LinkIcon className="w-4 h-4" /> Open Gmail Thread
                  </a>
                )}
              </div>
            ) : !url ? (
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <FileIcon />
                <p className="text-gray-600 font-medium">{name}</p>
                <p className="text-sm text-gray-500 mb-1">File URL unavailable. Try resyncing.</p>
                {gmailUrl && (
                  <a
                    href={gmailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    <LinkIcon className="w-4 h-4" /> Open Gmail Thread
                  </a>
                )}
              </div>
            ) : isPdf ? (
              <PdfPreview url={url} name={name} />
            ) : isImage ? (
              <img
                src={url}
                alt={name}
                className="max-w-full object-contain p-4"
                style={{ maxHeight: "80vh" }}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <FileIcon />
                <p className="text-gray-600 font-medium mb-1">{name}</p>
                <p className="text-sm text-gray-500 mb-3">Cannot preview this file type</p>
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
            )}
          </div>

          {/* Attachment rail (30%) */}
          {hasAttachments && (
            <div className="md:w-[30%] border-t md:border-t-0 md:border-l border-gray-200 overflow-y-auto bg-white shrink-0 max-h-40 md:max-h-none">
              <div className="p-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100 px-3 py-2">
                Attachments ({allNames.length})
              </div>
              {allNames.map((n, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors border-b border-gray-50 text-sm
                    ${i === idx
                      ? "bg-orange-50 border-l-2 border-l-orange-600 pl-2.5"
                      : "hover:bg-gray-50 border-l-2 border-l-transparent"
                    }`}
                  aria-current={i === idx ? "true" : undefined}
                >
                  <Paperclip className={`w-3.5 h-3.5 shrink-0 ${i === idx ? "text-orange-600" : "text-gray-400"}`} />
                  <span className={`truncate ${i === idx ? "text-orange-700 font-medium" : "text-gray-600"}`}>
                    {n || `File ${i + 1}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}