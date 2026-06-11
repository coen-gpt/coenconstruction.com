import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BrandLogo from "@/components/shared/BrandLogo";
import {
  Shield, FileText, CheckCircle2, AlertCircle, Upload,
  HardHat, Phone, Loader2, ExternalLink, Lock
} from "lucide-react";

const DOC_TYPES = [
  {
    key: "workers_comp",
    label: "Workers Compensation Insurance",
    desc: "Certificate of Insurance naming Coen Construction LLC as certificate holder.",
    urlField: "workers_comp_url",
    expiryField: "workers_comp_expiry",
    icon: Shield,
    accept: ".pdf,.jpg,.jpeg,.png",
    needsExpiry: true,
  },
  {
    key: "liability_ins",
    label: "General Liability Insurance",
    desc: "Certificate of Insurance for General Liability coverage.",
    urlField: "liability_ins_url",
    expiryField: "liability_ins_expiry",
    icon: Shield,
    accept: ".pdf,.jpg,.jpeg,.png",
    needsExpiry: true,
  },
  {
    key: "w9",
    label: "W-9 Tax Form",
    desc: "Completed IRS W-9 form required for payment processing.",
    urlField: "w9_url",
    expiryField: null,
    icon: FileText,
    accept: ".pdf",
    needsExpiry: false,
  },
];

function DocCard({ doc, vendor, onUploaded }) {
  const [file, setFile] = useState(null);
  const [expiry, setExpiry] = useState("");
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const currentUrl = vendor?.[doc.urlField];
  const currentExpiry = vendor?.[doc.expiryField];
  const Icon = doc.icon;

  const hasDoc = !!currentUrl;
  const isExpired = currentExpiry && new Date(currentExpiry) < new Date();
  const isExpiringSoon = currentExpiry && !isExpired &&
    new Date(currentExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const updates = { [doc.urlField]: file_url };
      if (doc.needsExpiry && expiry) updates[doc.expiryField] = expiry;

      // Notify backend to update vendor record via function
      await base44.functions.invoke("updateVendorDoc", {
        vendor_id: vendor.id,
        updates,
      });

      setDone(true);
      onUploaded(updates);
    } catch (e) {
      setError("Upload failed. Please try again or email the document directly.");
    }
    setUploading(false);
  };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
      isExpired ? "border-red-200" : isExpiringSoon ? "border-amber-200" : hasDoc ? "border-green-200" : "border-gray-100"
    }`}>
      <div className={`px-5 py-4 flex items-start gap-3 ${
        isExpired ? "bg-red-50" : isExpiringSoon ? "bg-amber-50" : hasDoc ? "bg-green-50" : "bg-white"
      }`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isExpired ? "bg-red-500" : isExpiringSoon ? "bg-amber-500" : hasDoc ? "bg-green-500" : "bg-secondary"
        }`}>
          {done || (hasDoc && !isExpired && !isExpiringSoon)
            ? <CheckCircle2 className="w-5 h-5 text-white" />
            : <Icon className="w-5 h-5 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-800 text-sm">{doc.label}</div>
          <div className="text-xs text-gray-500 mt-0.5">{doc.desc}</div>
          {currentExpiry && (
            <div className={`text-xs font-semibold mt-1 ${isExpired ? "text-red-600" : isExpiringSoon ? "text-amber-600" : "text-green-600"}`}>
              {isExpired ? "⚠ Expired" : isExpiringSoon ? "⚠ Expiring soon"  : "✓ On file"} · {new Date(currentExpiry).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
          )}
          {hasDoc && !currentExpiry && <div className="text-xs text-green-600 font-semibold mt-1">✓ On file</div>}
        </div>
        {currentUrl && (
          <a href={currentUrl} target="_blank" rel="noreferrer" className="shrink-0">
            <ExternalLink className="w-4 h-4 text-gray-400 hover:text-gray-700 transition-colors" />
          </a>
        )}
      </div>

      {/* Upload section */}
      {!done && (
        <div className="px-5 py-4 space-y-3 border-t border-gray-100">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {hasDoc && !isExpired ? "Replace Document" : "Upload Document"}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex-1 cursor-pointer">
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed text-sm transition-colors ${
                file ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-400 hover:border-gray-300"
              }`}>
                <Upload className="w-4 h-4 shrink-0" />
                <span className="truncate">{file ? file.name : "Choose file…"}</span>
              </div>
              <input type="file" accept={doc.accept} className="hidden" onChange={e => setFile(e.target.files[0])} />
            </label>
          </div>

          {doc.needsExpiry && (
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Expiration Date</label>
              <Input
                type="date"
                value={expiry}
                onChange={e => setExpiry(e.target.value)}
                className="text-sm"
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-xs rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || uploading || (doc.needsExpiry && !expiry)}
            className="w-full bg-primary hover:bg-[#c94522] text-white font-bold rounded-xl"
          >
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Uploading…</> : "Upload Document"}
          </Button>
        </div>
      )}

      {done && (
        <div className="px-5 py-3 bg-green-50 border-t border-green-100 flex items-center gap-2 text-green-700 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4" /> Uploaded successfully — your file has been saved.
        </div>
      )}
    </div>
  );
}

export default function SubDocUpload() {
  const urlParams = new URLSearchParams(window.location.search);
  const vendorId = urlParams.get("vendor");
  const token = urlParams.get("token");

  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!vendorId && !token) { setError("no_id"); setLoading(false); return; }
    const load = async () => {
      try {
        if (vendorId) {
          // Direct vendor ID access (from admin-generated links) — Vendor is
          // RLS-locked, so doc status comes from the server-side function
          const res = await base44.functions.invoke("subDocVendor", { vendor_id: vendorId });
          if (!res.data?.vendor) { setError("not_found"); setLoading(false); return; }
          setVendor(res.data.vendor);
        } else {
          // Token-based access from sub portal
          const res = await base44.functions.invoke("getSubOnboardingPortal", { token });
          setVendor(res.data?.vendor);
        }
      } catch {
        setError("invalid");
      }
      setLoading(false);
    };
    load();
  }, [vendorId, token]);

  const handleDocUploaded = (updates) => {
    setVendor(prev => ({ ...prev, ...updates }));
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
        <HardHat className="w-6 h-6 text-white" />
      </div>
      <p className="text-gray-500 font-medium">Loading your portal…</p>
    </div>
  );

  if (error || !vendor) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-sm w-full text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Portal Not Found</h2>
        <p className="text-gray-500 mb-6 text-sm">This link may be invalid or expired. Please contact us for a new link.</p>
        <a href="tel:6178572636" className="flex items-center justify-center gap-2 bg-primary text-white font-semibold rounded-xl py-3 px-6 hover:bg-[#c94522] transition-colors">
          <Phone className="w-4 h-4" /> Call (617) 857-COEN
        </a>
      </div>
    </div>
  );

  const completedCount = DOC_TYPES.filter(d => vendor[d.urlField]).length;
  const pct = Math.round((completedCount / DOC_TYPES.length) * 100);

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="bg-secondary">
        <div className="max-w-lg mx-auto px-5 pt-8 pb-6">
          <div className="flex items-center gap-2 mb-5">
            <BrandLogo onDark className="h-9" />
          </div>
          <h1 className="text-white text-xl font-bold">Document Upload Portal</h1>
          <p className="text-gray-400 text-sm mt-1">{vendor.company_name}</p>

          {/* Progress */}
          <div className="mt-4 bg-white/10 rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300 text-sm">Documents on file</span>
              <span className="text-white font-bold">{completedCount} / {DOC_TYPES.length}</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-2 rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-white/50 text-xs">
            <Lock className="w-3.5 h-3.5" /> Files are securely stored and only accessible to Coen Construction staff.
          </div>
        </div>
      </div>

      {/* Doc cards */}
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {DOC_TYPES.map(doc => (
          <DocCard key={doc.key} doc={doc} vendor={vendor} onUploaded={handleDocUploaded} />
        ))}

        {/* W-9 download link */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-700">Need a blank W-9?</div>
            <div className="text-xs text-gray-400 mt-0.5">Download directly from the IRS website</div>
          </div>
          <a href="https://www.irs.gov/pub/irs-pdf/fw9.pdf" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
            Download <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Contact */}
        <div className="bg-secondary rounded-2xl p-4 text-center">
          <p className="text-gray-300 text-sm mb-1">Questions or need help?</p>
          <a href="mailto:subs@coenconstruction.com" className="text-primary font-semibold text-sm hover:underline">subs@coenconstruction.com</a>
          <span className="text-gray-500 mx-2">·</span>
          <a href="tel:6178572636" className="text-primary font-semibold text-sm hover:underline">(617) 857-COEN</a>
        </div>
      </div>
    </div>
  );
}