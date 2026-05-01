import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, Building2, Upload, Sparkles, CheckCircle2, Mail, RefreshCw, AlertCircle, WifiOff, MapPin, ExternalLink, Star, ShieldCheck, ShieldOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const EMPTY_PROFILE = {
  company_name: "", address: "", city: "", state: "", zipcode: "",
  phone: "", email: "", license_number: "",
  brand_color: "#E35235", logo_url: "",
  default_markup_pct: 20, default_tax_rate: 0, profitability_threshold_pct: 15,
  ai_system_instructions: "", estimate_terms: "", pm_software_name: "",
  mto_reply_email: "quotes@coenconstruction.com",
  sow_reply_email: "bids@coenconstruction.com",
  lead_notification_email: "scott@coenconstruction.com",
};

export default function CompanyProfilePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [analyzingMapping, setAnalyzingMapping] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [gbpLoading, setGbpLoading] = useState(false);
  const [gbpResult, setGbpResult] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gbpResult') || 'null'); } catch { return null; }
  });
  const [gmailConnected, setGmailConnected] = useState(false);
  const [checkingGmail, setCheckingGmail] = useState(true);

  const { data: profiles = [], isLoading: profileLoading } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => base44.entities.CompanyProfile.list(),
  });

  const profile = profiles[0];

  useEffect(() => {
    if (!form) {
      if (profile) setForm({ ...profile });
      else if (!profileLoading) setForm({ ...EMPTY_PROFILE });
    }
  }, [profile, profileLoading]);

  const saveMutation = useMutation({
    mutationFn: (data) => profile
      ? base44.entities.CompanyProfile.update(profile.id, data)
      : base44.entities.CompanyProfile.create(data),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["company-profile"] });
      // Update form with saved record (gets id, created_date etc)
      setForm({ ...saved });
      toast({ title: "Profile saved!", description: "Company info updated across all tools." });
    },
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, logo_url: file_url }));
      toast({ title: "Logo uploaded", description: "Your company logo has been updated." });
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleImportFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzingMapping(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke("analyzeImportMapping", { file_url, pm_software: form?.pm_software_name });
      if (res.data?.mapping) {
        setForm((f) => ({ ...f, import_field_mapping: res.data.mapping }));
        toast({ title: "Field mapping analyzed!", description: "AI has mapped your import format." });
      }
    } catch (err) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzingMapping(false);
    }
  };

  const [gmailEmail, setGmailEmail] = useState(null);

  const checkGmailStatus = () => {
    setCheckingGmail(true);
    base44.functions.invoke('checkGmailConnection', {})
      .then(res => {
        setGmailConnected(!!res.data?.connected);
        setGmailEmail(res.data?.email || null);
      })
      .catch(() => setGmailConnected(false))
      .finally(() => setCheckingGmail(false));
  };

  useEffect(() => {
    checkGmailStatus();
  }, []);



  const handleDisconnect = () => {
    window.open('https://myaccount.google.com/permissions', '_blank');
  };

  const verifyGBP = async () => {
    setGbpLoading(true);
    setGbpResult(null);
    try {
      const res = await base44.functions.invoke('getGoogleReviews', {});
      if (res.data?.overall_rating !== undefined) {
        const result = { ok: true, rating: res.data.overall_rating, total: res.data.total_reviews, reviews: res.data.reviews?.length };
        setGbpResult(result);
        localStorage.setItem('gbpResult', JSON.stringify(result));
        toast({ title: "GBP Connected!", description: `Found ${res.data.total_reviews} reviews with a ${res.data.overall_rating} star average.` });
      } else {
          setGbpResult({ ok: false, error: res.data?.error || "Could not retrieve profile data." });
        localStorage.removeItem('gbpResult');
      }
    } catch (err) {
      setGbpResult({ ok: false, error: err.message });
      localStorage.removeItem('gbpResult');
    } finally {
      setGbpLoading(false);
    }
  };

  const f = form || {};
  const set = (field, val) => setForm((prev) => ({ ...prev, [field]: val }));

  const runScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await base44.functions.invoke('scanQuoteReplies', {});
      setScanResult(res.data);
      toast({ title: "Scan complete", description: res.data.message || `Processed ${res.data.processed ?? 0} of ${res.data.total_found ?? 0} emails.` });
    } catch (err) {
      setScanResult({ error: err.message });
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  if (profileLoading && !form) return (
    <div className="p-8 text-center text-gray-400">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-primary rounded-full animate-spin mx-auto mb-2" />
      Loading profile...
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Company Profile</h1>
          <p className="text-sm text-gray-500">Configure your company details and AI settings</p>
        </div>
        <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="gap-2 bg-primary text-white">
          {saveMutation.isPending ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Profile</>}
        </Button>
      </div>

      <div className="space-y-6">
         {/* Logo */}
         <div className="bg-white border border-gray-200 rounded-xl p-6">
           <h2 className="font-semibold text-secondary mb-4">Branding</h2>
           <div className="flex flex-col sm:flex-row sm:items-center gap-5">
             <div className="w-20 h-20 rounded-lg border border-gray-200 flex items-center justify-center bg-muted overflow-hidden shrink-0">
               {f.logo_url ? <img src={f.logo_url} alt="Logo" className="w-full h-full object-contain" /> : <Building2 className="w-10 h-10 text-gray-400" />}
             </div>
             <div className="flex-1">
               <div className="mb-3">
                 <input
                   type="file"
                   accept="image/*"
                   id="logo-upload-input"
                   className="hidden"
                   onChange={handleLogoUpload}
                 />
                 <Button
                   variant="outline"
                   size="sm"
                   className="gap-2"
                   disabled={uploadingFile}
                   onClick={() => document.getElementById('logo-upload-input').click()}
                 >
                   <Upload className="w-4 h-4" /> {uploadingFile ? "Uploading..." : "Upload Logo"}
                 </Button>
               </div>
               <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                 <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Brand Color</label>
                   <input type="color" value={f.brand_color || "#E35235"} onChange={(e) => set("brand_color", e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
                   <Input value={f.brand_color || "#E35235"} onChange={(e) => set("brand_color", e.target.value)} className="w-32 h-8 text-xs" />
               </div>
             </div>
           </div>
         </div>

         {/* Company Info */}
         <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-secondary mb-4">Company Information</h2>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             {[["company_name", "Company Name *", "sm:col-span-2"], ["address", "Address", "sm:col-span-2"], ["city", "City", ""], ["state", "State", ""], ["zipcode", "Zipcode", ""], ["phone", "Phone", ""], ["email", "Email", ""], ["license_number", "License #", ""]].map(([field, label, extra]) => (
               <div key={field} className={extra || ""}>
                 <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">{label}</label>
                 <Input value={f[field] || ""} onChange={(e) => set(field, e.target.value)} />
               </div>
             ))}
           </div>
         </div>

         {/* Defaults */}
         <div className="bg-white border border-gray-200 rounded-xl p-6">
           <h2 className="font-semibold text-secondary mb-4">Estimating Defaults</h2>
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Default Markup %</label>
              <Input type="number" value={f.default_markup_pct || 20} onChange={(e) => set("default_markup_pct", Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Default Tax Rate %</label>
              <Input type="number" value={f.default_tax_rate || 0} onChange={(e) => set("default_tax_rate", Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Profitability Threshold %</label>
              <Input type="number" value={f.profitability_threshold_pct || 15} onChange={(e) => set("profitability_threshold_pct", Number(e.target.value))} />
            </div>
          </div>
        </div>

        {/* AI Instructions */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-secondary mb-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> AI Estimate Instructions
          </h2>
          <p className="text-xs text-gray-500 mb-3">These instructions guide the AI when generating estimates and material take-offs for your company.</p>
          <Textarea
            rows={5}
            value={f.ai_system_instructions || ""}
            onChange={(e) => set("ai_system_instructions", e.target.value)}
            placeholder="e.g. Always use Boston union labor rates. Include 10% contingency on all projects over $50k. Default lumber prices are from ABC Supply..."
            className="resize-none text-sm"
          />
        </div>

        {/* Estimate Terms */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-secondary mb-3">Default Estimate Terms & Conditions</h2>
          <Textarea
            rows={4}
            value={f.estimate_terms || ""}
            onChange={(e) => set("estimate_terms", e.target.value)}
            placeholder="This estimate is valid for 30 days. Payment terms: 33% deposit, 33% at framing, 34% at completion..."
            className="resize-none text-sm"
          />
        </div>

        {/* Lead Notifications */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-secondary mb-1 flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" /> Lead Notifications
          </h2>
          <p className="text-xs text-gray-500 mb-4">New lead form submissions will be emailed to this address.</p>
          <div className="max-w-sm">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Notification Email</label>
            <Input
              type="email"
              value={f.lead_notification_email || ""}
              onChange={(e) => set("lead_notification_email", e.target.value)}
              placeholder="scott@coenconstruction.com"
            />
          </div>
        </div>

        {/* Inbox & Quote Scanning */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-secondary mb-1 flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" /> Inbox & Quote Scanning
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Set the reply-to email addresses vendors and subs use when responding to MTO / SoW requests.
            These become the default for all new projects and are scanned automatically for incoming quotes tagged with <code className="bg-gray-100 px-1 rounded">[MTO-REF:id]</code> / <code className="bg-gray-100 px-1 rounded">[SOW-REF:id]</code>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">MTO Quote Reply Email</label>
              <Input
                type="email"
                value={f.mto_reply_email || ""}
                onChange={(e) => set("mto_reply_email", e.target.value)}
                placeholder="quotes@yourcompany.com"
              />
              <p className="text-xs text-gray-400 mt-1">Used as reply-to on all vendor MTO emails</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">SoW Bid Reply Email</label>
              <Input
                type="email"
                value={f.sow_reply_email || ""}
                onChange={(e) => set("sow_reply_email", e.target.value)}
                placeholder="bids@yourcompany.com"
              />
              <p className="text-xs text-gray-400 mt-1">Used as reply-to on all sub SoW bid emails</p>
            </div>
          </div>

          {/* Gmail Connection & Manual Scan */}
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                {checkingGmail ? (
                  <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                ) : gmailConnected ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-orange-400" />
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    {checkingGmail ? 'Checking Gmail…' : gmailConnected ? 'Gmail Connected' : 'Gmail Not Connected'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {gmailConnected
                      ? `${gmailEmail ? gmailEmail + ' · ' : ''}Shared inbox scanning active for all admins.`
                      : 'Connect a Gmail account once — all admins will use this shared connection.'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {gmailConnected ? (
                  <>
                    <Button variant="outline" size="sm" className="gap-2" onClick={runScan} disabled={scanning}>
                      {scanning ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Scanning…</> : <><RefreshCw className="w-3.5 h-3.5" /> Scan Now</>}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 text-red-500 border-red-200 hover:bg-red-50" onClick={handleDisconnect}>
                      Revoke Access
                    </Button>
                  </>
                ) : !checkingGmail && (
                  <Button size="sm" className="gap-2" onClick={async () => {
                    try {
                      const res = await base44.functions.invoke('getGmailConnectUrl', {});
                      if (res.data?.url) {
                        const popup = window.open(res.data.url, '_blank');
                        const timer = setInterval(() => {
                          if (!popup || popup.closed) {
                            clearInterval(timer);
                            checkGmailStatus();
                          }
                        }, 500);
                      }
                    } catch (e) {
                      toast({ title: "Connection failed", description: e.message, variant: "destructive" });
                    }
                  }}>
                    <Mail className="w-3.5 h-3.5" /> Connect Gmail
                  </Button>
                )}
              </div>
            </div>
            {scanResult && !scanResult.error && !scanResult.message && (
              <div className="mt-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Scan complete — {scanResult.processed ?? 0} quote{scanResult.processed !== 1 ? 's' : ''} imported from {scanResult.total_found ?? 0} emails found.
              </div>
            )}
            {scanResult?.error && (
              <div className="mt-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {scanResult.error}
              </div>
            )}
            {scanResult?.message && (
              <div className="mt-3 flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {scanResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Google Business Profile */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-secondary mb-1 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Google Business Profile
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Link your Google Business Profile to power live reviews on your website. Enter your Place ID below, then save it as the <code className="bg-gray-100 px-1 rounded">GOOGLE_PLACE_ID</code> secret in your app settings.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end mb-4">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Google Place ID</label>
              <Input
                value={f.google_place_id || ""}
                onChange={(e) => set("google_place_id", e.target.value)}
                placeholder="ChIJxxxxxxxxxxxxxxxxxx"
                className="font-mono text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={verifyGBP}
              disabled={gbpLoading || !f.google_place_id}
            >
              {gbpLoading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying…</> : <><ShieldCheck className="w-3.5 h-3.5" /> Verify Connection</>}
            </Button>
          </div>

          {gbpResult?.ok && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-800">Google Business Profile Connected</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-green-700 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> {gbpResult.rating} avg rating
                  </span>
                  <span className="text-xs text-green-700">{gbpResult.total?.toLocaleString()} total reviews</span>
                  <span className="text-xs text-green-700">{gbpResult.reviews} recent reviews loaded</span>
                </div>
              </div>
            </div>
          )}

          {gbpResult?.ok === false && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-xs text-red-700">
              <ShieldOff className="w-4 h-4 shrink-0" />
              {gbpResult.error}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Find my Place ID
            </a>
            <a
              href="https://business.google.com"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Manage GBP on Google
            </a>
            <a
              href="https://support.google.com/business/answer/2911778"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Claim your listing
            </a>
          </div>
        </div>

        {/* PM Software Import Mapping */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-secondary mb-1">PM Software Import Mapping</h2>
          <p className="text-xs text-gray-500 mb-4">Upload a sample import file from your PM software so AI can learn how to map our fields to their format.</p>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-3">
            <Input
              value={f.pm_software_name || ""}
              onChange={(e) => set("pm_software_name", e.target.value)}
              placeholder="Software name (e.g. BuilderTrend, Procore)"
              className="flex-1"
            />
          </div>
          <label className="cursor-pointer block">
            <Button variant="outline" className="gap-2">
              <Sparkles className="w-4 h-4" />
              {analyzingMapping ? "Analyzing..." : "Upload Sample File (CSV/XLSX)"}
            </Button>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportFileUpload} />
          </label>
          {f.import_field_mapping && (
            <div className="mt-3 bg-muted rounded-lg p-3">
              <p className="text-xs font-semibold text-secondary mb-2">Mapped Fields:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {Object.entries(f.import_field_mapping).map(([k, v]) => (
                  <div key={k} className="text-xs text-gray-600"><span className="font-medium text-secondary">{k}</span> → {v}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}