import { useState } from "react";
import { X, Download, ExternalLink, ChevronLeft, ChevronRight, Paperclip } from "lucide-react";

export default function AttachmentPreviewModal({ attachment, onClose }) {
  const [idx, setIdx] = useState(0);

  if (!attachment) return null;

  const allUrls = attachment.allUrls || [attachment.url];
  const allNames = attachment.allNames?.length ? attachment.allNames : allUrls.map((_, i) => attachment.name || `attachment-${i + 1}`);

  const url = allUrls[idx];
  const name = allNames[idx] || `attachment-${idx + 1}`;
  const isPdf = name?.toLowerCase().endsWith('.pdf');
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].some(ext => name?.toLowerCase().endsWith(`.${ext}`));
  const hasMultiple = allUrls.length > 1;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 min-w-0">
            <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate text-sm">{name}</h3>
              {hasMultiple && (
                <p className="text-xs text-gray-500">{idx + 1} of {allUrls.length} attachments</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-4">
            {hasMultiple && (
              <>
                <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <button onClick={() => setIdx(i => Math.min(allUrls.length - 1, i + 1))} disabled={idx === allUrls.length - 1} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition-colors">
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </>
            )}
            <a href={url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Open in new tab">
              <ExternalLink className="w-4 h-4 text-gray-600" />
            </a>
            <a href={url} download={name} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Download">
              <Download className="w-4 h-4 text-gray-600" />
            </a>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Attachment tab strip (if multiple) */}
        {hasMultiple && (
          <div className="flex gap-1 px-3 py-2 bg-gray-50 border-b border-gray-100 overflow-x-auto">
            {allUrls.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${i === idx ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {allNames[i] || `File ${i + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center min-h-[400px]">
          {!url ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📄</span>
              </div>
              <p className="text-gray-600 font-medium">{name}</p>
              <p className="text-sm text-gray-500">This attachment was recorded but the file URL is unavailable. Re-sync to fetch it.</p>
            </div>
          ) : isPdf ? (
            <iframe
              src={`${url}#toolbar=1`}
              className="w-full h-full border-0 min-h-[500px]"
              title={name}
            />
          ) : isImage ? (
            <img src={url} alt={name} className="max-w-full max-h-full object-contain p-4" />
          ) : (
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📄</span>
              </div>
              <div>
                <p className="text-gray-600 font-medium mb-2">{name}</p>
                <p className="text-sm text-gray-500 mb-4">Preview not available for this file type</p>
                <div className="flex gap-2 justify-center">
                  <a href={url} download={name} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium">
                    <Download className="w-4 h-4" /> Download
                  </a>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                    <ExternalLink className="w-4 h-4" /> Open
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}