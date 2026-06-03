import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, Building2, Upload, Sparkles, CheckCircle2, Mail, RefreshCw, AlertCircle, WifiOff, MapPin, ExternalLink, Star, ShieldCheck, ShieldOff, MousePointerClick, FileText, Eye, EyeOff, Link2, Calendar, MessageSquareOff } from "lucide-react";
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

  const [qbTokens, setQbTokens] = useState({ refresh_token: "", access_token: "" });
  const [qbSaving, setQbSaving] = useState(false);
  const [qbShowRefresh, setQbShowRefresh] = useState(false);
  const [qbShowAccess, setQbShowAccess] = useState(false);

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

  const saveQbTokens = async () => {
    if (!qbTokens.refresh_token && !qbTokens.access_token) {
      toast({ title: "Enter at least one token to save", variant: "destructive" });
      return;
    }
    setQbSaving(true);
    try {
      await base44.functions.invoke("syncEstimateToQuickBooks", {
        action: "save_tokens",
        refresh_token: qbTokens.refresh_token || undefined,
        access_token: qbTokens.access_token || undefined,
      });
      toast({ title: "QuickBooks tokens saved!", description: "Tokens have been stored securely." });
      setQbTokens({ refresh_token: "", access_token: "" });
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setQbSaving(false);
    }
  };

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

        {/* Contract Template & Deposit */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-secondary mb-1 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Client Contract & Deposit Settings
          </h2>
          <p className="text-xs text-gray-500 mb-4">Upload your contract template PDF — it will be attached to all estimates for client review and e-signature. Set your default deposit percentage.</p>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Default Deposit %</label>
                <Input
                  type="number"
                  min="1" max="100"
                  value={f.deposit_percentage || 33}
                  onChange={(e) => set("deposit_percentage", Number(e.target.value))}
                  placeholder="33"
                />
                <p className="text-xs text-gray-400 mt-1">% of estimate total collected as deposit</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Contract Template PDF</label>
              {f.contract_template_url ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-800 truncate">{f.contract_template_name || "Contract template on file"}</p>
                    <a href={f.contract_template_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">View PDF ↗</a>
                  </div>
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" className="gap-1" disabled={uploadingFile} onClick={() => {}}>
                      <Upload className="w-3.5 h-3.5" /> Replace
                    </Button>
                    <input type="file" accept=".pdf" className="hidden" onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      set("contract_template_url", file_url);
                      set("contract_template_name", file.name);
                    }} />
                  </label>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <div className="flex items-center gap-3 border border-dashed border-gray-300 rounded-xl px-4 py-4 hover:bg-gray-50 transition-colors">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm text-gray-600 font-medium">Upload Contract PDF Template</div>
                      <div className="text-xs text-gray-400">PDF only — will be linked in client estimate portal for review</div>
                    </div>
                  </div>
                  <input type="file" accept=".pdf" className="hidden" onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const { file_url } = await base44.integrations.Core.UploadFile({ file });
                    set("contract_template_url", file_url);
                    set("contract_template_name", file.name);
                  }} />
                </label>
              )}
            </div>
          </div>
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

        {/* Walkthrough Booking Hours */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-secondary mb-1 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Walkthrough Booking Hours
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            When a new lead comes in, they receive an email with a self-scheduling link. Set the days and hours clients can book a walkthrough.
          </p>
          <div className="space-y-4">
            {/* Available Days */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Available Days</label>
              <div className="flex gap-2 flex-wrap">
                {[['Sun',0],['Mon',1],['Tue',2],['Wed',3],['Thu',4],['Fri',5],['Sat',6]].map(([label, val]) => {
                  const days = f.booking_days ?? [1,2,3,4,5];
                  const active = days.includes(val);
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        const current = f.booking_days ?? [1,2,3,4,5];
                        set('booking_days', active ? current.filter(d => d !== val) : [...current, val].sort());
                      }}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold border transition"
                      style={active ? { background: 'hsl(var(--primary))', color: '#fff', borderColor: 'hsl(var(--primary))' } : { background: '#f9f9f9', color: '#555', borderColor: '#e5e5e5' }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Hours + slot config */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Earliest Time</label>
                <select
                  value={f.booking_start_hour ?? 8}
                  onChange={(e) => set('booking_start_hour', Number(e.target.value))}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {Array.from({length: 13}, (_,i) => i+6).map(h => (
                    <option key={h} value={h}>{h <= 12 ? `${h}:00 AM` : `${h-12}:00 PM`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Latest Start Time</label>
                <select
                  value={f.booking_end_hour ?? 17}
                  onChange={(e) => set('booking_end_hour', Number(e.target.value))}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {Array.from({length: 13}, (_,i) => i+10).map(h => (
                    <option key={h} value={h}>{h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h-12}:00 PM`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Slot Duration</label>
                <select
                  value={f.booking_slot_minutes ?? 60}
                  onChange={(e) => set('booking_slot_minutes', Number(e.target.value))}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value={30}>30 min</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>90 min</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Booking Window</label>
                <select
                  value={f.booking_window_days ?? 14}
                  onChange={(e) => set('booking_window_days', Number(e.target.value))}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value={7}>1 week ahead</option>
                  <option value={14}>2 weeks ahead</option>
                  <option value={21}>3 weeks ahead</option>
                  <option value={30}>1 month ahead</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Minimum Lead Time</label>
              <select
                value={f.booking_advance_days ?? 1}
                onChange={(e) => set('booking_advance_days', Number(e.target.value))}
                className="w-48 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value={0}>Same day</option>
                <option value={1}>Next day</option>
                <option value={2}>2 days ahead</option>
                <option value={3}>3 days ahead</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Earliest day a client can self-book from the current date</p>
            </div>
          </div>
        </div>

        {/* Angi Lead Integration */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-secondary mb-1 flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-primary" /> Angi Lead Integration
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Connect Angi to receive leads automatically. Leads are created in the Lead Dashboard and a new project is auto-created in the Estimator.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-sm font-semibold text-green-800">Webhook Ready — SPID: 29783405</span>
            </div>
            <div className="space-y-2 text-xs text-gray-700">
              <p className="font-semibold text-gray-600 uppercase tracking-wide">Setup Instructions:</p>
              <ol className="list-decimal list-inside space-y-1.5 ml-1">
                <li>Log into <a href="https://pro.angi.com" target="_blank" rel="noreferrer" className="text-primary font-semibold hover:underline">Angi Pro Dashboard →</a></li>
                <li>Go to <strong>Settings → Lead Delivery → Lead Delivery API</strong></li>
                <li>Set delivery method to <strong>HTTP POST (Webhook)</strong></li>
                <li>Paste your webhook URL below into the Angi endpoint field</li>
                <li>Set format to <strong>JSON</strong> (XML also supported)</li>
                <li>Save — leads will now flow in automatically</li>
              </ol>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-gray-500 mb-1">Your Webhook URL</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-primary font-mono flex-1 truncate">
                  {window.location.origin}/api/functions/angiWebhook
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/functions/angiWebhook`); toast({ title: "Copied to clipboard!" }); }}
                  className="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/90 shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Leads are deduplicated by Angi Lead ID. Each new lead creates a <strong>Lead record</strong> (visible in Lead Dashboard with "Angi" tag) and a <strong>ContractorProject</strong> (visible in Estimator → Projects) automatically.
            </p>
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
                      const url = await base44.connectors.connectAppUser("69d54a88eda656e7e3d1f856");
                      const popup = window.open(url, '_blank');
                      const timer = setInterval(() => {
                        if (!popup || popup.closed) {
                          clearInterval(timer);
                          checkGmailStatus();
                        }
                      }, 500);
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

        {/* SMS Kill Switch */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-secondary mb-1 flex items-center gap-2">
            <MessageSquareOff className="w-4 h-4 text-primary" /> SMS Text Messaging
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            When disabled, the app sends <strong>NO outbound text messages</strong> to customers, vendors, or staff. Email notifications are unaffected.
          </p>
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-gray-50">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                {f.sms_enabled === false ? "SMS is Disabled" : "SMS is Enabled"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {f.sms_enabled === false
                  ? "No outbound texts will be sent to anyone. Toggle on when ready to go live."
                  : "Outbound SMS texts are active for customers, vendors, and staff."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => set("sms_enabled", f.sms_enabled === false ? true : false)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                f.sms_enabled === false ? "bg-gray-300" : "bg-primary"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  f.sms_enabled === false ? "translate-x-1" : "translate-x-6"
                }`}
              />
            </button>
          </div>
          {f.sms_enabled === false && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <MessageSquareOff className="w-3.5 h-3.5 shrink-0" />
              SMS is currently OFF. Save the profile to persist this setting.
            </div>
          )}
        </div>

        {/* Exit Intent Popup */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-secondary mb-1 flex items-center gap-2">
            <MousePointerClick className="w-4 h-4 text-primary" /> Exit Intent Popup
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            When enabled, a lead capture popup appears when website visitors move their cursor to leave the page (desktop) or after 45 seconds of inactivity (mobile).
          </p>
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-gray-50">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                {f.enable_exit_intent_popup === false ? "Popup is Disabled" : "Popup is Enabled"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {f.enable_exit_intent_popup === false
                  ? "The exit intent popup will not appear on any website pages."
                  : "The exit intent popup is active and capturing leads on your website."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => set("enable_exit_intent_popup", f.enable_exit_intent_popup === false ? true : false)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                f.enable_exit_intent_popup === false ? "bg-gray-300" : "bg-primary"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  f.enable_exit_intent_popup === false ? "translate-x-1" : "translate-x-6"
                }`}
              />
            </button>
          </div>
        </div>

        {/* QuickBooks Integration */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-secondary mb-1 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" /> QuickBooks Integration
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Enter your QuickBooks Online tokens to enable estimate-to-invoice sync. Get these from the{" "}
            <a href="https://developer.intuit.com/app/developer/playground" target="_blank" rel="noreferrer" className="text-primary font-semibold hover:underline">QuickBooks Developer Playground</a> or your OAuth flow. Tokens are stored securely as environment secrets.
          </p>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Refresh Token</label>
              <div className="relative">
                <Input
                  type={qbShowRefresh ? "text" : "password"}
                  value={qbTokens.refresh_token}
                  onChange={(e) => setQbTokens(t => ({ ...t, refresh_token: e.target.value }))}
                  placeholder="Paste your QuickBooks refresh token..."
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setQbShowRefresh(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {qbShowRefresh ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Long-lived token used to obtain new access tokens automatically.</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Access Token</label>
              <div className="relative">
                <Input
                  type={qbShowAccess ? "text" : "password"}
                  value={qbTokens.access_token}
                  onChange={(e) => setQbTokens(t => ({ ...t, access_token: e.target.value }))}
                  placeholder="Paste your QuickBooks access token..."
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setQbShowAccess(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {qbShowAccess ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Short-lived bearer token (expires every hour). The sync function auto-refreshes it using the refresh token.</p>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <span className="font-semibold text-gray-600">Realm ID:</span>{" "}
                <span className="font-mono">{import.meta.env.VITE_QB_REALM_ID || "Set QUICKBOOKS_REALM_ID in app secrets"}</span>
              </div>
              <Button
                onClick={saveQbTokens}
                disabled={qbSaving || (!qbTokens.refresh_token && !qbTokens.access_token)}
                className="gap-2 bg-primary text-white"
              >
                {qbSaving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Tokens</>}
              </Button>
            </div>
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