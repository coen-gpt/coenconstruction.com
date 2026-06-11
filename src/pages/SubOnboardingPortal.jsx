import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HardHat, CheckCircle, Shield, FileText, PenLine, RotateCcw,
  Upload, Loader2, AlertCircle, ChevronRight, ExternalLink, Lock
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import AddressInput from "@/components/AddressInput";

const STEPS = [
  { id: "info", label: "Company Info", icon: HardHat },
  { id: "insurance", label: "Insurance", icon: Shield },
  { id: "w9", label: "W-9", icon: FileText },
  { id: "contract", label: "Review & Sign", icon: PenLine },
];

const ENTITY_TYPES = [
  { value: "sole_prop", label: "Sole Proprietor" },
  { value: "llc", label: "LLC" },
  { value: "s_corp", label: "S Corporation" },
  { value: "c_corp", label: "C Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "trust", label: "Trust/Estate" },
];

export default function SubOnboardingPortal() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("info");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "", company: "", address: "", phone: "", email: "",
    principal_contact: "", alt_phone: "", tax_id: "", entity_type: "llc",
  });

  // Insurance
  const [wcFile, setWcFile] = useState(null);
  const [wcExpiry, setWcExpiry] = useState("");
  const [glFile, setGlFile] = useState(null);
  const [glExpiry, setGlExpiry] = useState("");
  const [wcUrl, setWcUrl] = useState("");
  const [glUrl, setGlUrl] = useState("");

  // W-9
  const [w9File, setW9File] = useState(null);
  const [w9Url, setW9Url] = useState("");
  const [uploading, setUploading] = useState(null); // "wc" | "gl" | "w9" | null

  // Signature
  const canvasRef = useRef(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureData, setSignatureData] = useState(null);

  const token = searchParams.get("token");
  const vendorId = searchParams.get("vendor");

  useEffect(() => {
    if (!token || !vendorId) { setError("invalid_link"); setLoading(false); return; }
    base44.functions.invoke("getSubOnboardingPortal", { token, vendor_id: vendorId })
      .then(res => {
        const v = res.data.vendor;
        setVendor(v);
        const fd = v.packet_form_data || {};
        setForm({
          name: fd.name || v.contact_name || "",
          company: fd.company || v.company_name || "",
          address: fd.address || v.address || "",
          phone: fd.phone || v.phone || "",
          email: fd.email || v.email || "",
          principal_contact: fd.principal_contact || v.contact_name || "",
          alt_phone: fd.alt_phone || "",
          tax_id: fd.tax_id || "",
          entity_type: fd.entity_type || "llc",
        });
        setWcExpiry(v.workers_comp_expiry || "");
        setGlExpiry(v.liability_ins_expiry || "");
        setWcUrl(v.workers_comp_url || "");
        setGlUrl(v.liability_ins_url || "");
        setW9Url(v.w9_url || "");
        if (["completed", "approved"].includes(v.packet_status)) setDone(true);
        setLoading(false);
      })
      .catch(() => { setError("invalid"); setLoading(false); });
  }, [token, vendorId]);

  // Signature canvas setup
  useEffect(() => {
    if (step !== "contract" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#1B2B3A";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    let isDown = false, lastX = 0, lastY = 0;
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      if (e.touches) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const start = (e) => { isDown = true; const p = getPos(e); lastX = p.x; lastY = p.y; };
    const move = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const p = getPos(e);
      ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.stroke();
      lastX = p.x; lastY = p.y;
      setHasSignature(true);
    };
    const end = () => { isDown = false; };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
  }, [step]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSignatureData(null);
  };

  const uploadFile = async (file, key) => {
    setUploading(key);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploading(null);
    return file_url;
  };

  const handleUpload = async (file, type) => {
    const url = await uploadFile(file, type);
    if (type === "wc") setWcUrl(url);
    if (type === "gl") setGlUrl(url);
    if (type === "w9") setW9Url(url);
    toast({ title: "File uploaded ✓" });
  };

  const handleSubmit = async () => {
    if (!hasSignature) {
      toast({ title: "Please draw your signature before submitting", variant: "destructive" });
      return;
    }
    if (!form.name || !form.company) {
      toast({ title: "Name and Company are required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const sig = canvasRef.current.toDataURL("image/png");
      await base44.functions.invoke("submitSubOnboardingPacket", {
        token, vendor_id: vendorId,
        form, signature_data: sig,
        wc_url: wcUrl, wc_expiry: wcExpiry,
        gl_url: glUrl, gl_expiry: glExpiry,
        w9_url: w9Url,
      });
      setDone(true);
    } catch (err) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const stepIndex = STEPS.findIndex(s => s.id === step);
  const fld = (f, label, type = "text", required = false) => (
    <div key={f}>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {f === "address" ? (
        <AddressInput className="h-10 rounded-md" value={form[f] || ""} onChange={val => setForm(p => ({ ...p, [f]: val }))} placeholder="Business address" />
      ) : (
        <Input type={type} value={form[f] || ""} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} />
      )}
    </div>
  );

  // ── Loading ──
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center mx-auto mb-4">
          <HardHat className="w-7 h-7 text-white" />
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />
      </div>
    </div>
  );

  // ── Error ──
  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow p-10 max-w-sm w-full text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          {error === "invalid_link" ? "Invalid Link" : "Link Expired or Invalid"}
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          {error === "invalid_link"
            ? "This link is missing required information."
            : "This onboarding link may have expired or already been used. Contact Coen Construction for a new link."}
        </p>
        <a href="mailto:coenconstruction@gmail.com" className="text-primary underline text-sm">coenconstruction@gmail.com</a>
      </div>
    </div>
  );

  // ── Done ──
  if (done) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow p-10 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-9 h-9 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-secondary mb-2">Packet Complete!</h2>
        <p className="text-gray-500 text-sm mb-4">
          Thank you, <strong>{vendor?.contact_name}</strong>. Your subcontractor packet has been submitted to Coen Construction.
        </p>
        <div className="bg-gray-50 rounded-xl p-4 text-left text-xs text-gray-600 space-y-1 mb-6">
          <p>✅ Company info on file</p>
          <p>{wcUrl ? "✅" : "⚠️"} Workers Compensation {wcUrl ? "uploaded" : "missing — submit ASAP"}</p>
          <p>{glUrl ? "✅" : "⚠️"} General Liability {glUrl ? "uploaded" : "missing — submit ASAP"}</p>
          <p>{w9Url ? "✅" : "⚠️"} W-9 {w9Url ? "on file" : "missing — submit ASAP"}</p>
          <p>✅ Agreement signed</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          <Lock className="w-3.5 h-3.5 inline mr-1" />
          You will receive access to bids and payments once your documents are reviewed.
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-secondary px-4 py-5">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <HardHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Subcontractor Onboarding</h1>
            <p className="text-white/60 text-xs">Coen Construction LLC — Required before bids & payments</p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex gap-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = s.id === step;
              const done = i < stepIndex;
              return (
                <button
                  key={s.id}
                  onClick={() => setStep(s.id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-semibold transition-colors
                    ${active ? "bg-primary/10 text-primary" : done ? "text-green-600" : "text-gray-400"}`}
                >
                  {done ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  <span className="hidden sm:block">{s.label}</span>
                  <span className="sm:hidden text-[10px]">{i + 1}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${((stepIndex) / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* ── STEP 1: Company Info ── */}
        {step === "info" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <h2 className="font-bold text-secondary text-lg">Company Information</h2>
              <p className="text-sm text-gray-500 mt-1">This information will be used for your subcontractor agreement, W-9, and invoice records.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {fld("name", "Legal / Contact Name", "text", true)}
              {fld("company", "Company / DBA Name", "text", true)}
              {fld("address", "Business Address")}
              {fld("phone", "Phone Number", "tel")}
              {fld("email", "Email Address", "email")}
              {fld("principal_contact", "Principal Contact")}
              {fld("alt_phone", "Alternate / Emergency Phone", "tel")}
              {fld("tax_id", "Tax ID / EIN (for W-9)")}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Entity Type</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
                  value={form.entity_type}
                  onChange={e => setForm(p => ({ ...p, entity_type: e.target.value }))}
                >
                  {ENTITY_TYPES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
            </div>

            <Button
              onClick={() => setStep("insurance")}
              disabled={!form.name || !form.company}
              className="w-full bg-secondary text-white gap-2"
            >
              Next: Insurance Documents <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* ── STEP 2: Insurance ── */}
        {step === "insurance" && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-sm">
              <p className="font-bold text-amber-900 mb-2">Insurance Requirements</p>
              <ul className="space-y-1 text-amber-800 text-xs list-disc list-inside">
                <li>Workers Compensation — Statutory Limits + $500,000 Employers Liability</li>
                <li>Commercial General Liability — $2M General Aggregate, $1M Each Occurrence</li>
                <li><strong>Coen Construction LLC must be named as Additional Insured</strong> on the GL certificate</li>
                <li>30-day cancellation written notice required</li>
                <li>No work or payments until certificates are received</li>
              </ul>
            </div>

            {/* Workers Comp */}
            <InsuranceUploadCard
              title="Workers Compensation Certificate"
              existingUrl={vendor?.workers_comp_url}
              existingExpiry={vendor?.workers_comp_expiry}
              file={wcFile}
              expiry={wcExpiry}
              uploadKey="wc"
              uploading={uploading}
              onFileChange={f => { setWcFile(f); handleUpload(f, "wc"); }}
              onExpiryChange={setWcExpiry}
              uploadedUrl={wcUrl}
              hint={
                form.entity_type === "sole_prop"
                  ? `Include in description: "${form.name || "[Owner Name]"} is covered by the workers compensation policy"`
                  : form.entity_type === "partnership"
                  ? 'Include in description: "All partners are covered by the workers\' compensation policy"'
                  : null
              }
            />

            {/* General Liability */}
            <InsuranceUploadCard
              title="General Liability Certificate"
              existingUrl={vendor?.liability_ins_url}
              existingExpiry={vendor?.liability_ins_expiry}
              file={glFile}
              expiry={glExpiry}
              uploadKey="gl"
              uploading={uploading}
              onFileChange={f => { setGlFile(f); handleUpload(f, "gl"); }}
              onExpiryChange={setGlExpiry}
              uploadedUrl={glUrl}
              hint='Description must include: "Coen Construction LLC, its affiliates and subsidiaries, must be named as additional insured with respects to General Liability"'
            />

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("info")} className="flex-1">← Back</Button>
              <Button onClick={() => setStep("w9")} className="flex-1 bg-secondary text-white gap-2">
                Next: W-9 <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: W-9 ── */}
        {step === "w9" && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900">
              <p className="font-bold mb-2">W-9 Required</p>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li>Complete the IRS W-9 form with your Tax ID (SSN or EIN)</li>
                <li>Check the appropriate entity type box</li>
                <li>Sign and date the form before uploading</li>
                <li>No payments will be issued without a W-9 on file</li>
              </ul>
            </div>

            {/* W-9 Preview / Download */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-5 h-5 text-primary" />
                <span className="font-bold text-secondary">IRS W-9 Form</span>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs text-gray-600 space-y-1">
                <p className="font-semibold text-secondary text-sm">Pre-filled information for your W-9:</p>
                <p><strong>Name:</strong> {form.name || "—"}</p>
                <p><strong>Business Name:</strong> {form.company !== form.name ? form.company : "—"}</p>
                <p><strong>Entity Type:</strong> {ENTITY_TYPES.find(e => e.value === form.entity_type)?.label}</p>
                <p><strong>Address:</strong> {form.address || "—"}</p>
                <p><strong>Tax ID (TIN):</strong> {form.tax_id || "— (required)"}</p>
              </div>
              <a
                href="https://www.irs.gov/pub/irs-pdf/fw9.pdf"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <ExternalLink className="w-4 h-4" /> Download blank W-9 from IRS.gov
              </a>
              <div className="text-xs text-gray-500">Download, fill in your information using the details above, sign, and upload below.</div>

              {/* Upload */}
              <div>
                {w9Url ? (
                  <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-green-800">W-9 Uploaded</div>
                      <a href={w9Url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">View uploaded W-9</a>
                    </div>
                    <label className="text-xs text-gray-500 cursor-pointer hover:text-primary">
                      Replace
                      <input type="file" accept=".pdf,image/*" className="hidden"
                        onChange={e => { const f = e.target.files[0]; if (f) { setW9File(f); handleUpload(f, "w9"); } }} />
                    </label>
                  </div>
                ) : (
                  <label className={`flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-4 cursor-pointer hover:bg-gray-50 transition-colors
                    ${uploading === "w9" ? "border-primary bg-primary/5" : "border-gray-300"}`}>
                    {uploading === "w9" ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <Upload className="w-5 h-5 text-gray-400" />}
                    <div>
                      <div className="text-sm font-semibold text-gray-700">
                        {uploading === "w9" ? "Uploading…" : w9File ? w9File.name : "Upload Completed W-9"}
                      </div>
                      <div className="text-xs text-gray-400">PDF preferred</div>
                    </div>
                    <input type="file" accept=".pdf,image/*" className="hidden"
                      onChange={e => { const f = e.target.files[0]; if (f) { setW9File(f); handleUpload(f, "w9"); } }} />
                  </label>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("insurance")} className="flex-1">← Back</Button>
              <Button onClick={() => setStep("contract")} className="flex-1 bg-secondary text-white gap-2">
                Next: Review & Sign <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Contract & Sign ── */}
        {step === "contract" && (
          <div className="space-y-4">
            {/* Checklist summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-bold text-secondary text-lg mb-3">Submission Checklist</h2>
              {[
                { label: "Company Information", ok: !!form.name && !!form.company },
                { label: "Workers Compensation Certificate", ok: !!wcUrl },
                { label: "General Liability Certificate", ok: !!glUrl },
                { label: "W-9 Form", ok: !!w9Url },
              ].map(({ label, ok }) => (
                <div key={label} className={`flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0`}>
                  {ok
                    ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    : <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                  <span className={`text-sm ${ok ? "text-gray-700" : "text-amber-700"}`}>{label}</span>
                  {!ok && <span className="text-xs text-amber-500 ml-auto">Optional but recommended</span>}
                </div>
              ))}
            </div>

            {/* Agreement Text */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-xs text-gray-600 leading-relaxed max-h-64 overflow-y-auto">
              <p className="font-bold text-secondary text-sm mb-2">Coen Construction LLC — Subcontractor Agreement Summary</p>
              <p className="mb-2">This agreement is between Coen Construction LLC ("Contractor") and the undersigned ("Subcontractor") and shall remain in force for fifteen (15) years.</p>
              <p className="font-semibold mt-3 mb-1">Key Terms:</p>
              <p className="mb-1"><strong>General Performance:</strong> All work shall be performed in a good and workmanlike manner per Contractor's standards, in compliance with all Federal and State laws.</p>
              <p className="mb-1"><strong>Independent Contractor:</strong> Subcontractor is not an employee of Coen Construction LLC.</p>
              <p className="mb-1"><strong>Insurance:</strong> Subcontractor must maintain Workers Compensation, Commercial General Liability ($2M aggregate), Automobile Liability, and Umbrella coverage. Coen Construction LLC must be named Additional Insured.</p>
              <p className="mb-1"><strong>Payment:</strong> Invoices must include PO#, job name/address, invoice #, dollar amount, and description of work. Payment terms are 30 days from approval. Submit electronically to coenconstruction@gmail.com.</p>
              <p className="mb-1"><strong>Clean-Up:</strong> Subcontractor shall clean up debris at the end of each day.</p>
              <p className="mb-1"><strong>Hold Harmless:</strong> Subcontractor agrees to indemnify and hold harmless Coen Construction LLC against all claims arising from Subcontractor's work.</p>
              <p className="mb-1"><strong>No work shall begin and no payments will be issued until insurance certificates are received by Coen Construction.</strong></p>
              <p className="mt-3 text-gray-500">By signing, you confirm you have read and agree to all terms set forth in the full Coen Construction LLC Subcontractor Agreement.</p>
            </div>

            {/* Signature */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PenLine className="w-4 h-4 text-primary" />
                  <span className="font-bold text-secondary text-sm">Sign Below</span>
                </div>
                <button onClick={clearSignature} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              </div>
              <canvas
                ref={canvasRef}
                className="w-full border-2 border-gray-200 rounded-xl bg-gray-50 cursor-crosshair touch-none"
                style={{ height: "160px" }}
              />
              {!hasSignature && <p className="text-xs text-gray-400 text-center mt-2">Use your finger or mouse to sign above</p>}

              <div className="grid grid-cols-2 gap-2 mt-4 text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
                <div><span className="text-xs text-gray-400 block">Name</span><strong>{form.name || "—"}</strong></div>
                <div><span className="text-xs text-gray-400 block">Date</span><strong>{new Date().toLocaleDateString()}</strong></div>
                <div className="col-span-2"><span className="text-xs text-gray-400 block">Company</span><strong>{form.company || "—"}</strong></div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("w9")} className="flex-1">← Back</Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !hasSignature}
                className="flex-1 bg-primary hover:bg-[#c94522] text-white gap-2"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                  : <><CheckCircle className="w-4 h-4" /> Submit Packet</>}
              </Button>
            </div>
          </div>
        )}

        <div className="text-center text-gray-400 text-xs pb-8">
          Questions? <a href="mailto:coenconstruction@gmail.com" className="underline">coenconstruction@gmail.com</a> · (617) 412-6046
        </div>
      </div>
    </div>
  );
}

// ── Reusable insurance upload card ──
function InsuranceUploadCard({ title, existingUrl, existingExpiry, file, expiry, uploadKey, uploading, onFileChange, onExpiryChange, uploadedUrl, hint }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        <span className="font-bold text-secondary text-sm">{title}</span>
        {uploadedUrl && <CheckCircle className="w-4 h-4 text-green-500" />}
      </div>

      {hint && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
          <strong>Required wording:</strong> {hint}
        </div>
      )}

      {existingUrl && !file && (
        <div className="flex items-center gap-2 text-xs">
          <FileText className="w-3 h-3 text-gray-400" />
          <a href={existingUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Current certificate on file</a>
          {existingExpiry && <span className={`${new Date(existingExpiry) < new Date() ? "text-red-500 font-bold" : "text-gray-400"}`}>· Expires {new Date(existingExpiry).toLocaleDateString()}</span>}
        </div>
      )}

      {uploadedUrl && !existingUrl ? (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <div className="flex-1">
            <div className="text-xs font-semibold text-green-800">Uploaded</div>
            <a href={uploadedUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">View file</a>
          </div>
          <label className="text-xs text-gray-400 cursor-pointer hover:text-primary">
            Replace
            <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => { if (e.target.files[0]) onFileChange(e.target.files[0]); }} />
          </label>
        </div>
      ) : (
        <label className={`flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-4 cursor-pointer hover:bg-gray-50 transition-colors
          ${uploading === uploadKey ? "border-primary bg-primary/5" : "border-gray-300"}`}>
          {uploading === uploadKey ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Upload className="w-4 h-4 text-gray-400" />}
          <div>
            <div className="text-sm font-medium text-gray-700">
              {uploading === uploadKey ? "Uploading…" : file ? file.name : `Upload ${title}`}
            </div>
            <div className="text-xs text-gray-400">PDF or image</div>
          </div>
          <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => { if (e.target.files[0]) onFileChange(e.target.files[0]); }} />
        </label>
      )}

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Policy Expiration Date</label>
        <Input type="date" value={expiry} onChange={e => onExpiryChange(e.target.value)} />
      </div>
    </div>
  );
}