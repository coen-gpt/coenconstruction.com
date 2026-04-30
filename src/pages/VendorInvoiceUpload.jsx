import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle, Upload, AlertCircle, FileText, Loader2, ChevronRight } from "lucide-react";

const PAYMENT_STAGES = ["Initial Deposit", "2nd Payment", "3rd Payment", "Final"];

export default function VendorInvoiceUpload() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  const [status, setStatus] = useState("loading"); // loading | ready | uploading | success | error
  const [invoice, setInvoice] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No access token found. Please use the link from your email or SMS.");
      return;
    }
    loadInvoice();
  }, [token]);

  const loadInvoice = async () => {
    setStatus("loading");
    const res = await base44.functions.invoke("vendorInvoiceUpload", { action: "get", token });
    if (res.data?.success) {
      setInvoice(res.data.invoice);
      setStatus("ready");
    } else {
      setStatus("error");
      setErrorMsg(res.data?.error || "Could not load invoice. The link may be expired or invalid.");
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    setSelectedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setStatus("uploading");

    const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
    const res = await base44.functions.invoke("vendorInvoiceUpload", {
      action: "upload",
      token,
      file_url,
      file_name: selectedFile.name,
    });

    if (res.data?.success) {
      setStatus("success");
    } else {
      setStatus("error");
      setErrorMsg(res.data?.error || "Upload failed. Please try again.");
    }
  };

  const stageIndex = invoice ? PAYMENT_STAGES.indexOf(invoice.payment_stage) : -1;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {/* Brand header */}
      <div className="w-full max-w-lg mb-6 text-center">
        <div className="inline-flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-xl text-sm font-bold">
          <span style={{ color: "#E35235" }}>▐</span> Coen Construction
        </div>
        <p className="text-xs text-gray-400 mt-2">Secure Vendor Invoice Portal</p>
      </div>

      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Loading */}
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-gray-500">Loading your invoice details…</p>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="flex flex-col items-center justify-center py-20 px-8 gap-4 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="font-bold text-gray-900 text-lg">Link Invalid or Expired</h2>
            <p className="text-sm text-gray-500">{errorMsg}</p>
            <p className="text-xs text-gray-400">Please contact Coen Construction at <a href="tel:6178572636" className="text-primary font-medium">(617) 857-2636</a> for a new link.</p>
          </div>
        )}

        {/* Success */}
        {status === "success" && (
          <div className="flex flex-col items-center justify-center py-20 px-8 gap-4 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle className="w-9 h-9 text-green-500" />
            </div>
            <h2 className="font-bold text-gray-900 text-xl">Invoice Submitted!</h2>
            <p className="text-sm text-gray-500">Thank you. We've received your <strong>{invoice?.payment_stage}</strong> invoice and will process it shortly.</p>
            <p className="text-xs text-gray-400 mt-2">You'll be contacted if we have any questions. No further action is needed.</p>
          </div>
        )}

        {/* Ready — main upload UI */}
        {(status === "ready" || status === "uploading") && invoice && (
          <>
            {/* Header */}
            <div className="bg-secondary px-6 py-5">
              <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">Invoice Requested</p>
              <h1 className="text-white font-bold text-xl">{invoice.payment_stage || "Invoice Upload"}</h1>
              {invoice.vendor_name && (
                <p className="text-white/60 text-sm mt-1">For: {invoice.vendor_name}</p>
              )}
            </div>

            {/* Payment stage pipeline */}
            {stageIndex >= 0 && (
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment Progress</p>
                <div className="flex items-center gap-1">
                  {PAYMENT_STAGES.map((stage, i) => (
                    <div key={stage} className="flex items-center flex-1 min-w-0">
                      <div className={`flex-1 flex flex-col items-center gap-1`}>
                        <div className={`w-full h-1.5 rounded-full ${
                          i < stageIndex ? "bg-green-400" :
                          i === stageIndex ? "bg-primary" :
                          "bg-gray-200"
                        }`} />
                        <span className={`text-[10px] font-medium text-center leading-tight ${
                          i === stageIndex ? "text-primary" :
                          i < stageIndex ? "text-green-600" :
                          "text-gray-300"
                        }`}>{stage}</span>
                      </div>
                      {i < PAYMENT_STAGES.length - 1 && (
                        <ChevronRight className="w-3 h-3 text-gray-200 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invoice details */}
            <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-2 gap-3 text-sm">
              {invoice.invoice_number && (
                <div>
                  <p className="text-xs text-gray-400">Invoice #</p>
                  <p className="font-medium text-gray-800">{invoice.invoice_number}</p>
                </div>
              )}
              {invoice.amount && (
                <div>
                  <p className="text-xs text-gray-400">Amount</p>
                  <p className="font-medium text-gray-800">${Number(invoice.amount).toLocaleString()}</p>
                </div>
              )}
              {invoice.due_date && (
                <div>
                  <p className="text-xs text-gray-400">Due Date</p>
                  <p className="font-medium text-gray-800">{new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
              )}
            </div>

            {/* Previous versions */}
            {invoice.all_attachment_versions?.length > 0 && (
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Previously Submitted</p>
                <div className="space-y-1.5">
                  {invoice.all_attachment_versions.map((v, i) => (
                    <a key={i} href={v.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 hover:bg-blue-100 transition-colors">
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="flex-1 truncate">{v.file_name || v.stage}</span>
                      <span className="text-blue-400 shrink-0">{v.stage}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Upload area */}
            <div className="px-6 py-5">
              <p className="text-sm font-semibold text-gray-700 mb-3">
                Upload Your <span className="text-primary">{invoice.payment_stage || "Invoice"}</span>
              </p>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragging ? "border-primary bg-primary/5" :
                  selectedFile ? "border-green-400 bg-green-50" :
                  "border-gray-200 hover:border-primary hover:bg-gray-50"
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-green-500" />
                    <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
                    <p className="text-xs text-gray-400">{(selectedFile.size / 1024).toFixed(0)} KB — click to change</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-gray-300" />
                    <p className="text-sm font-medium text-gray-600">Drop file here or click to browse</p>
                    <p className="text-xs text-gray-400">PDF, Word, Excel, or image files accepted</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleUpload}
                disabled={!selectedFile || status === "uploading"}
                className="w-full mt-4 bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === "uploading" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                ) : (
                  <><Upload className="w-4 h-4" /> Submit Invoice</>
                )}
              </button>

              <p className="text-xs text-gray-400 text-center mt-3">
                Your file is transmitted securely. Questions? Call us at <a href="tel:6178572636" className="text-primary">(617) 857-2636</a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}