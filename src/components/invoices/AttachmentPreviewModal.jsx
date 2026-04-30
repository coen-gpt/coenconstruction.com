import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import {
  ChevronLeft, ChevronRight, Download, ExternalLink,
  FileText, Loader2, X, Paperclip
} from 'lucide-react';

function base64urlToBlob(data, mimeType) {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function isPreviewable(mimeType, name) {
  if (!mimeType && !name) return false;
  const mime = (mimeType || '').toLowerCase();
  const ext = (name || '').toLowerCase().split('.').pop();
  return (
    mime === 'application/pdf' || ext === 'pdf' ||
    mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)
  );
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Inline previewer — tries stored URL first, falls back to fetching from Gmail
function AttachmentViewer({ invoice, storedUrls, storedNames }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [attList, setAttList] = useState([]);
  const [attMeta, setAttMeta] = useState(null);

  // Reset index when switching invoices
  useEffect(() => { setCurrentIdx(0); }, [invoice?.id]);

  // Prefer stored URLs; fall back to fetching from Gmail
  const useStoredUrls = storedUrls?.length > 0;
  const totalCount = useStoredUrls ? storedUrls.length : (attList.length || 0);

  const loadFromGmail = useCallback(async (idx) => {
    setLoading(true);
    setError(null);
    setBlobUrl(null);
    try {
      const res = await base44.functions.invoke('getInvoiceAttachment', {
        messageId: invoice.gmail_message_id,
        attachmentIndex: idx,
      });
      const d = res.data;
      setAttList(d.attachmentList || []);
      setAttMeta({ name: d.name, mimeType: d.mimeType, size: d.size });
      if (d.data) {
        const blob = base64urlToBlob(d.data, d.mimeType);
        setBlobUrl(URL.createObjectURL(blob));
      } else {
        setError('No data returned for this attachment.');
      }
    } catch (e) {
      setError(e.message || 'Failed to load attachment.');
    }
    setLoading(false);
  }, [invoice.gmail_message_id]);

  useEffect(() => {
    if (!useStoredUrls) {
      loadFromGmail(currentIdx);
    } else {
      // For stored URLs — derive meta from name
      setAttMeta({ name: storedNames?.[currentIdx] || `Attachment ${currentIdx + 1}`, mimeType: null, size: null });
    }
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, useStoredUrls]);

  const goTo = (idx) => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setCurrentIdx(idx);
    if (!useStoredUrls) loadFromGmail(idx);
  };

  const currentUrl = useStoredUrls ? storedUrls[currentIdx] : blobUrl;
  const currentName = useStoredUrls
    ? (storedNames?.[currentIdx] || `Attachment ${currentIdx + 1}`)
    : (attMeta?.name || `Attachment ${currentIdx + 1}`);
  const currentMime = useStoredUrls ? null : attMeta?.mimeType;
  const ext = (currentName || '').toLowerCase().split('.').pop();
  const isPdf = currentMime === 'application/pdf' || ext === 'pdf';
  const isImg = (currentMime?.startsWith('image/')) || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
  const previewing = isPdf || isImg;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-sm font-medium truncate text-gray-700">{currentName}</span>
          {attMeta?.size && <span className="text-xs text-gray-400 shrink-0">{formatBytes(attMeta.size)}</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {currentUrl && (
            <>
              <Button size="sm" variant="ghost" asChild className="h-7 px-2 text-xs">
                <a href={currentUrl} download={currentName} target="_blank" rel="noopener noreferrer">
                  <Download className="w-3.5 h-3.5 mr-1" /> Download
                </a>
              </Button>
              <Button size="sm" variant="ghost" asChild className="h-7 px-2 text-xs">
                <a href={currentUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
                </a>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Attachment tabs if multiple */}
      {totalCount > 1 && (
        <div className="flex items-center gap-1 px-4 py-2 border-b bg-white overflow-x-auto">
          {(useStoredUrls ? storedNames : attList.map(a => a.name)).map((name, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                i === currentIdx ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-3 h-3" />
              {name || `File ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Preview area */}
      <div className="flex-1 overflow-hidden bg-gray-100 flex items-center justify-center min-h-[400px] relative">
        {loading && (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm">Loading attachment…</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 text-center p-6">
            <FileText className="w-12 h-12 text-gray-300" />
            <p className="text-sm text-gray-500">{error}</p>
            {currentUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={currentUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-1" /> Open in new tab
                </a>
              </Button>
            )}
          </div>
        )}

        {!loading && !error && currentUrl && isPdf && (
          <iframe
            key={currentUrl}
            src={currentUrl + '#toolbar=1&view=FitH'}
            className="w-full h-full border-0"
            title={currentName}
          />
        )}

        {!loading && !error && currentUrl && isImg && (
          <img
            key={currentUrl}
            src={currentUrl}
            alt={currentName}
            className="max-w-full max-h-full object-contain p-4"
          />
        )}

        {!loading && !error && currentUrl && !isPdf && !isImg && (
          <div className="flex flex-col items-center gap-3 text-center p-6">
            <FileText className="w-14 h-14 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">{currentName}</p>
            <p className="text-xs text-gray-400">This file type can't be previewed inline.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={currentUrl} download={currentName}>
                  <Download className="w-4 h-4 mr-1" /> Download
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={currentUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-1" /> Open in new tab
                </a>
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && !currentUrl && (
          <div className="flex flex-col items-center gap-3 text-center p-6">
            <FileText className="w-14 h-14 text-gray-300" />
            <p className="text-sm text-gray-500">No preview available</p>
          </div>
        )}

        {/* Prev / Next arrows */}
        {totalCount > 1 && (
          <>
            <button
              disabled={currentIdx === 0}
              onClick={() => goTo(currentIdx - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white border shadow rounded-full p-1.5 disabled:opacity-30 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={currentIdx === totalCount - 1}
              onClick={() => goTo(currentIdx + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white border shadow rounded-full p-1.5 disabled:opacity-30 hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full">
              {currentIdx + 1} / {totalCount}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AttachmentPreviewModal({ invoice, onClose }) {
  if (!invoice) return null;

  const hasAttachments =
    (invoice.attachment_urls?.length > 0) ||
    (invoice.attachment_names?.length > 0) ||
    !!invoice.gmail_message_id;

  return (
    <Dialog open={!!invoice} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold truncate">
                {invoice.email_subject || invoice.vendor_name || 'Invoice'}
              </DialogTitle>
              <div className="flex items-center flex-wrap gap-1.5 mt-1">
                <span className="text-xs text-gray-500">{invoice.vendor_name}</span>
                {invoice.vendor_email && <span className="text-xs text-gray-400">· {invoice.vendor_email}</span>}
                {invoice.document_type && (
                  <Badge variant="outline" className="text-xs capitalize h-4 px-1.5">{invoice.document_type}</Badge>
                )}
                {invoice.amount && (
                  <Badge className="text-xs h-4 px-1.5 bg-green-100 text-green-700 border-green-200">
                    ${invoice.amount.toLocaleString()}
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-7 w-7">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {hasAttachments ? (
            <AttachmentViewer
              invoice={invoice}
              storedUrls={invoice.attachment_urls?.filter(u => u && u.startsWith('http'))}
              storedNames={invoice.attachment_names}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Paperclip className="w-12 h-12 text-gray-200" />
              <p className="text-sm">No attachments for this record.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}