import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HardHat, CheckCircle, Shield, FileText, PenLine, RotateCcw,
  Upload, Loader2, AlertCircle, ChevronRight, ExternalLink, Lock,
  ClipboardCheck
} from "lucide-react";
import AddressInput from "@/components/AddressInput";
import {
  AGREEMENT_VERSION, AGREEMENT_TITLE, AGREEMENT_INTRO, AGREEMENT_SECTIONS, agreementPlainText,
} from "@/components/subportal/subcontractorAgreement";

const STEPS = [
  { id: "info",     label: "Company Info", icon: HardHat },
  { id: "insurance",label: "Insurance",    icon: Shield },
  { id: "w9",       label: "W-9",          icon: FileText },
  { id: "sign",     label: "Sign",         icon: PenLine },
];

const ENTITY_TYPES = [
  { value: "sole_prop",  label: "Sole Proprietor" },
  { value: "llc",        label: "LLC" },
  { value: "s_corp",     label: "S Corporation" },
  { value: "c_corp",     label: "C Corporation" },
  { value: "partnership",label: "Partnership" },
  { value: "trust",      label: "Trust/Estate" },
];

export default function SubFormsTab({ vendor, token, onComplete, toast }) {
  const [step, setStep] = useState("info");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(null);

  const [form, setForm] = useState({
    name: "", company: "", address: "", phone: "", email: "",
    principal_contact: "", alt_phone: "", tax_id: "", entity_type: "llc", title: "",
  });

  const [agreed, setAgreed] = useState(false);
  const [payTermsAgreed, setPayTermsAgreed] = useState(false);
  const [agreementRead, setAgreementRead] = useState(false);

  const [wcUrl, setWcUrl] = useState("");
  const [wcExpiry, setWcExpiry] = useState("");
  const [glUrl, setGlUrl] = useState("");
  const [glExpiry, setGlExpiry] = useState("");
  const [w9Url, setW9Url] = useState("");

  const canvasRef = useRef(null);
  const [hasSignature, setHasSignature] = useState(false);

  // Pre-fill from vendor
  useEffect(() => {
    if (!vendor) return;
    const fd = vendor.packet_form_data || {};
    setForm({
      name: fd.name || vendor.contact_name || "",
      company: fd.company || vendor.company_name || "",
      address: fd.address || vendor.address || "",
      phone: fd.phone || vendor.phone || "",
      email: fd.email || vendor.email || "",
      principal_contact: fd.principal_contact || vendor.contact_name || "",
      alt_phone: fd.alt_phone || "",
      tax_id: fd.tax_id || "",
      entity_type: fd.entity_type || "llc",
      title: fd.title || fd.signed_title || "",
    });
    setWcUrl(vendor.workers_comp_url || "");
    setWcExpiry(vendor.workers_comp_expiry || "");
    setGlUrl(vendor.liability_ins_url || "");
    setGlExpiry(vendor.liability_ins_expiry || "");
    setW9Url(vendor.w9_url || "");
  }, [vendor]);

  // Signature canvas
  useEffect(() => {
    if (step !== "sign" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    let ctx;
    // Re-measure on rotation/reflow — a stale canvas.width misaligns strokes.
    // The drawing is cleared on resize, which is the standard trade-off.
    const sizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = 160;
      ctx = canvas.getContext("2d");
      ctx.strokeStyle = "#1B2B3A"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
      setHasSignature(false);
    };
    sizeCanvas();

    let isDown = false, lastX = 0, lastY = 0;
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      if (e.touches) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const start = (e) => { isDown = true; const p = getPos(e); lastX = p.x; lastY = p.y; };
    const move = (e) => {
      if (!isDown) return; e.preventDefault();
      const p = getPos(e);
      ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.stroke();
      lastX = p.x; lastY = p.y; setHasSignature(true);
    };
    const end = () => { isDown = false; };
    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);
    window.addEventListener("resize", sizeCanvas);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
      window.removeEventListener("resize", sizeCanvas);
    };
  }, [step]);

  const clearSig = () => {
    canvasRef.current.getContext("2d").clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasSignature(false);
  };

  const uploadFile = async (file, key) => {
    setUploading(key);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      toast({ title: "File uploaded ✓" });
      return file_url;
    } catch {
      // Subs upload from job sites on weak signal — a thrown upload used to
      // leave the spinner stuck forever.
      toast({ title: "Upload failed", description: "Please check your connection and try again.", variant: "destructive" });
      return null;
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.company) { toast({ title: "Name and Company are required", variant: "destructive" }); return; }
    if (!form.title?.trim()) { toast({ title: "Please enter your title (e.g., Owner, President)", variant: "destructive" }); return; }
    if (!agreed) { toast({ title: "Please check the box to accept the Subcontractor Agreement", variant: "destructive" }); return; }
    if (!payTermsAgreed) { toast({ title: "Please acknowledge the 30-day payment terms", variant: "destructive" }); return; }
    if (!hasSignature) { toast({ title: "Please sign before submitting", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const sig = canvasRef.current.toDataURL("image/png");
      await base44.functions.invoke("submitSubOnboardingPacket", {
        token,
        vendor_id: vendor?.id,
        form, signature_data: sig,
        wc_url: wcUrl, wc_expiry: wcExpiry,
        gl_url: glUrl, gl_expiry: glExpiry,
        w9_url: w9Url,
        signed_title: form.title.trim(),
        agreement_version: AGREEMENT_VERSION,
        agreement_acknowledged: true,
        payment_terms_acknowledged: true,
        agreement_text: agreementPlainText(),
      });
      onComplete();
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

  // Already completed
  if (["completed", "approved"].includes(vendor?.packet_status)) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <ClipboardCheck className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-xl font-bold text-secondary mb-2">All Forms Submitted</h2>
      <p className="text-gray-500 text-sm mb-4">Your onboarding packet was signed and submitted to Coen Construction.</p>
      <div className="bg-gray-50 rounded-xl p-4 text-left text-xs text-gray-600 space-y-1">
        <p>✅ Company information on file</p>
        <p>{vendor.workers_comp_url ? "✅" : "⚠️"} Workers Compensation {vendor.workers_comp_url ? "on file" : "missing"}</p>
        <p>{vendor.liability_ins_url ? "✅" : "⚠️"} General Liability {vendor.liability_ins_url ? "on file" : "missing"}</p>
        <p>{vendor.w9_url ? "✅" : "⚠️"} W-9 {vendor.w9_url ? "on file" : "missing"}</p>
        <p>✅ Agreement signed {vendor.packet_signed_at ? `on ${new Date(vendor.packet_signed_at).toLocaleDateString()}` : ""}</p>
      </div>
      {(!vendor.workers_comp_url || !vendor.liability_ins_url || !vendor.w9_url) && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
          Some documents are still missing. You can update them by clicking the items in the Compliance tab.
        </div>
      )}
    </div>
  );

  if (!vendor) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
      <p className="text-gray-600 font-medium">Vendor record not found</p>
      <p className="text-gray-400 text-sm mt-1">Contact Coen Construction to set up your vendor profile before completing forms.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Step progress */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex gap-1 mb-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = s.id === step;
            const isDone = i < stepIndex;
            return (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-semibold transition-colors
                  ${active ? "bg-primary/10 text-primary" : isDone ? "text-green-600" : "text-gray-400"}`}
              >
                {isDone ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                <span className="hidden sm:block">{s.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
            );
          })}
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(stepIndex / (STEPS.length - 1)) * 100}%` }} />
        </div>
      </div>

      {/* ── Step 1: Company Info ── */}
      {step === "info" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <h2 className="font-bold text-secondary text-lg">Company Information</h2>
            <p className="text-sm text-gray-500 mt-1">Used for your subcontractor agreement, W-9, and invoice records.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {fld("name", "Legal / Contact Name", "text", true)}
            {fld("company", "Company / DBA Name", "text", true)}
            {fld("title", "Your Title / Role (e.g., Owner, President)", "text", true)}
            {fld("address", "Business Address")}
            {fld("phone", "Phone Number", "tel")}
            {fld("email", "Email Address", "email")}
            {fld("principal_contact", "Principal Contact")}
            {fld("alt_phone", "Alt / Emergency Phone", "tel")}
            {fld("tax_id", "EIN — Employer Identification Number (for W-9)")}
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
          <Button onClick={() => setStep("insurance")} disabled={!form.name || !form.company} className="w-full bg-secondary text-white gap-2">
            Next: Insurance <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* ── Step 2: Insurance ── */}
      {step === "insurance" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-sm">
            <p className="font-bold text-amber-900 mb-2">Insurance Requirements</p>
            <ul className="space-y-1 text-amber-800 text-xs list-disc list-inside">
              <li>Workers Compensation — Statutory Limits + $500K Employers Liability</li>
              <li>Commercial General Liability — $2M Aggregate, $1M Each Occurrence</li>
              <li><strong>Coen Construction LLC must be named Additional Insured</strong> on GL certificate</li>
              <li>30-day cancellation notice required</li>
            </ul>
          </div>
          <InsuranceCard title="Workers Comp Certificate" url={wcUrl} expiry={wcExpiry} uploadKey="wc" uploading={uploading}
            onUpload={async f => { const url = await uploadFile(f, "wc"); if (url) setWcUrl(url); }}
            onExpiry={setWcExpiry}
            hint={form.entity_type === "sole_prop" ? `Include: "${form.name || "[Owner Name]"} is covered by the WC policy"` : null}
          />
          <InsuranceCard title="General Liability Certificate" url={glUrl} expiry={glExpiry} uploadKey="gl" uploading={uploading}
            onUpload={async f => { const url = await uploadFile(f, "gl"); if (url) setGlUrl(url); }}
            onExpiry={setGlExpiry}
            hint='Include: "Coen Construction LLC must be named as additional insured"'
          />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("info")} className="flex-1">← Back</Button>
            <Button onClick={() => setStep("w9")} className="flex-1 bg-secondary text-white gap-2">Next: W-9 <ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {/* ── Step 3: W-9 ── */}
      {step === "w9" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900">
            <p className="font-bold mb-1">W-9 Required</p>
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li>Download the W-9, fill in your info, sign, and upload below</li>
              <li>No payments issued without a W-9 on file</li>
            </ul>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /><span className="font-bold text-secondary">IRS W-9</span></div>
            <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 space-y-1">
              <p className="font-semibold text-secondary text-sm mb-2">Your pre-filled W-9 details:</p>
              <p><strong>Name:</strong> {form.name || "—"}</p>
              <p><strong>Business Name:</strong> {form.company || "—"}</p>
              <p><strong>Entity Type:</strong> {ENTITY_TYPES.find(e => e.value === form.entity_type)?.label}</p>
              <p><strong>Address:</strong> {form.address || "—"}</p>
              <p><strong>EIN:</strong> {form.tax_id || "— (required)"}</p>
            </div>
            <a href="https://www.irs.gov/pub/irs-pdf/fw9.pdf" target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
              <ExternalLink className="w-4 h-4" /> Download blank W-9 from IRS.gov
            </a>
            <FileUploadZone label="Upload Completed W-9" accept=".pdf,image/*" url={w9Url} uploading={uploading === "w9"}
              onFile={async f => { const url = await uploadFile(f, "w9"); if (url) setW9Url(url); }} />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("insurance")} className="flex-1">← Back</Button>
            <Button onClick={() => setStep("sign")} className="flex-1 bg-secondary text-white gap-2">Next: Sign <ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Sign ── */}
      {step === "sign" && (
        <div className="space-y-4">
          {/* Checklist */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-secondary text-lg mb-3">Submission Checklist</h2>
            {[
              { label: "Company Information", ok: !!form.name && !!form.company },
              { label: "Workers Comp Certificate", ok: !!wcUrl },
              { label: "General Liability Certificate", ok: !!glUrl },
              { label: "W-9 Form", ok: !!w9Url },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                {ok ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> : <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                <span className={`text-sm ${ok ? "text-gray-700" : "text-amber-700"}`}>{label}</span>
                {!ok && <span className="text-xs text-amber-400 ml-auto">Recommended</span>}
              </div>
            ))}
          </div>

          {/* Full Agreement */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-gray-100">
              <p className="font-bold text-secondary text-sm">{AGREEMENT_TITLE}</p>
              <p className="text-xs text-gray-400 mt-0.5">Version {AGREEMENT_VERSION} · Please read in full before signing</p>
            </div>
            <div
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setAgreementRead(true);
              }}
              ref={(el) => { if (el && el.scrollHeight <= el.clientHeight + 24 && !agreementRead) setAgreementRead(true); }}
              className="px-5 py-4 text-xs text-gray-600 leading-relaxed max-h-72 overflow-y-auto"
            >
              <p className="mb-3">{AGREEMENT_INTRO}</p>
              {AGREEMENT_SECTIONS.map((s, i) => (
                <div key={s.heading} className="mb-3">
                  <p className="font-semibold text-secondary">{i + 1}. {s.heading}</p>
                  <p>{s.body}</p>
                </div>
              ))}
              <p className="text-gray-400 pt-1">— End of Agreement —</p>
            </div>
            {!agreementRead && (
              <div className="px-5 py-2 bg-amber-50 border-t border-amber-100 text-[11px] text-amber-700 text-center">
                Scroll to the bottom of the agreement to continue
              </div>
            )}
          </div>

          {/* Acknowledgment */}
          <label className={`flex items-start gap-3 bg-white border rounded-2xl p-4 cursor-pointer transition-colors ${agreed ? "border-primary bg-primary/5" : "border-gray-200"} ${!agreementRead ? "opacity-50 pointer-events-none" : ""}`}>
            <input type="checkbox" checked={agreed} disabled={!agreementRead} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-primary shrink-0" />
            <span className="text-xs text-gray-600 leading-relaxed">
              I, <strong>{form.name || "[your name]"}</strong>, as <strong>{form.title || "[your title]"}</strong> of <strong>{form.company || "[your company]"}</strong>, have read and agree to the full Coen Construction LLC Subcontractor Agreement above, including its insurance, payment and invoice requirements. I certify that the information I have provided is true and correct, and I understand that signing electronically is the legal equivalent of my handwritten signature.
            </span>
          </label>

          {/* Explicit payment-terms acknowledgment */}
          <label className={`flex items-start gap-3 bg-white border rounded-2xl p-4 cursor-pointer transition-colors ${payTermsAgreed ? "border-primary bg-primary/5" : "border-gray-200"} ${!agreementRead ? "opacity-50 pointer-events-none" : ""}`}>
            <input type="checkbox" checked={payTermsAgreed} disabled={!agreementRead} onChange={(e) => setPayTermsAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-primary shrink-0" />
            <span className="text-xs text-gray-600 leading-relaxed">
              I specifically acknowledge and agree that <strong>payment terms are 30 days</strong> from review and approval of all invoices (roughly 30–45 days from submission to payment), as stated in the Payment section of the agreement.
            </span>
          </label>

          {/* Signature */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><PenLine className="w-4 h-4 text-primary" /><span className="font-bold text-secondary text-sm">Sign Below</span></div>
              <button onClick={clearSig} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                <RotateCcw className="w-3 h-3" /> Clear
              </button>
            </div>
            <canvas ref={canvasRef} className="w-full border-2 border-gray-200 rounded-xl bg-gray-50 cursor-crosshair touch-none" style={{ height: "160px" }} />
            {!hasSignature && <p className="text-xs text-gray-400 text-center mt-2">Use your finger or mouse to sign above</p>}
            <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-gray-600 bg-gray-50 rounded-xl p-3">
              <div><span className="text-gray-400 block">Name</span><strong>{form.name || "—"}</strong></div>
              <div><span className="text-gray-400 block">Title</span><strong>{form.title || "—"}</strong></div>
              <div><span className="text-gray-400 block">Company</span><strong>{form.company || "—"}</strong></div>
              <div><span className="text-gray-400 block">Date</span><strong>{new Date().toLocaleDateString()}</strong></div>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 text-center px-2">A copy of this signed agreement will be emailed to you for your records.</p>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("w9")} className="flex-1">← Back</Button>
            <Button onClick={handleSubmit} disabled={submitting || !hasSignature || !agreed || !payTermsAgreed || !form.title?.trim()} className="flex-1 bg-primary hover:bg-primary/90 text-white gap-2">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <><CheckCircle className="w-4 h-4" /> Sign & Submit Packet</>}
            </Button>
          </div>
        </div>
      )}

      <div className="text-center text-gray-400 text-xs pb-4">
        Secure · Encrypted · <Lock className="w-3 h-3 inline" /> Protected
      </div>
    </div>
  );
}

function InsuranceCard({ title, url, expiry, uploadKey, uploading, onUpload, onExpiry, hint }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        <span className="font-bold text-secondary text-sm">{title}</span>
        {url && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
      </div>
      {hint && <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800"><strong>Required wording:</strong> {hint}</div>}
      <FileUploadZone label={`Upload ${title}`} accept=".pdf,image/*" url={url} uploading={uploading === uploadKey} onFile={onUpload} />
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Policy Expiration Date</label>
        <Input type="date" value={expiry} onChange={e => onExpiry(e.target.value)} />
      </div>
    </div>
  );
}

function FileUploadZone({ label, accept, url, uploading, onFile }) {
  if (url) return (
    <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
      <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
      <div className="flex-1">
        <div className="text-sm font-semibold text-green-800">Uploaded</div>
        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">View file</a>
      </div>
      <label className="text-xs text-gray-400 cursor-pointer hover:text-primary">
        Replace
        <input type="file" accept={accept} className="hidden" onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); }} />
      </label>
    </div>
  );
  return (
    <label className={`flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${uploading ? "border-primary bg-primary/5" : "border-gray-300"}`}>
      {uploading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <Upload className="w-5 h-5 text-gray-400" />}
      <div>
        <div className="text-sm font-semibold text-gray-700">{uploading ? "Uploading…" : label}</div>
        <div className="text-xs text-gray-400">PDF or image</div>
      </div>
      <input type="file" accept={accept} className="hidden" onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); }} />
    </label>
  );
}