/**
 * Employee Onboarding Portal — /employee-onboarding?token=...
 *
 * Public, token-secured new-hire packet. The admin sends the link from
 * Employees → Onboarding Packets, choosing W2 employee or 1099 contractor:
 *   W2:         Info → W-4 (federal) + M-4 (Massachusetts) → Photo ID →
 *               Handbook → Review & Sign
 *   Contractor: Info → W-9 → Photo ID → Review & Sign
 * Contractors are synced into Vendors & Subs on submission (server-side).
 * Every step saves through submitEmployeeOnboarding so progress is never lost.
 */
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddressInput from "@/components/AddressInput";
import BrandLogo from "@/components/shared/BrandLogo";
import {
  HardHat, CheckCircle, User, FileText, Camera, BookOpen, PenLine,
  RotateCcw, Upload, Loader2, AlertCircle, ChevronRight, X,
} from "lucide-react";

const BRAND = "#E35235";

/* ── Live camera capture for photo ID ─────────────────────────────────── */
function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } }, audio: false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError("Camera unavailable on this device — please use the upload option instead."));
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(new File([blob], `id-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  };

  return (
    <div className="bg-black rounded-xl overflow-hidden relative">
      {error ? (
        <div className="p-6 text-center text-sm text-white/80">{error}</div>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-72 object-contain" />
      )}
      <div className="flex items-center justify-center gap-3 p-3 bg-black/80">
        {!error && (
          <Button onClick={capture} className="gap-2" style={{ background: BRAND }}>
            <Camera className="w-4 h-4" /> Capture Photo
          </Button>
        )}
        <Button variant="outline" onClick={onCancel} className="bg-white/10 text-white border-white/30">
          <X className="w-4 h-4 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

/* ── Small form helpers ───────────────────────────────────────────────── */
function Field({ label, required, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function CheckRow({ id, checked, onChange, children }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer select-none">
      <input
        type="checkbox"
        id={id}
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-5 h-5 accent-orange-500 cursor-pointer shrink-0"
      />
      <span className="text-sm text-gray-700 leading-5">{children}</span>
    </label>
  );
}

const W9_CLASSIFICATIONS = [
  ["sole_prop", "Individual / Sole proprietor"],
  ["c_corp", "C Corporation"],
  ["s_corp", "S Corporation"],
  ["partnership", "Partnership"],
  ["trust_estate", "Trust / Estate"],
  ["llc_c", "LLC — taxed as C Corp"],
  ["llc_s", "LLC — taxed as S Corp"],
  ["llc_p", "LLC — taxed as Partnership"],
  ["other", "Other"],
];

export default function EmployeeOnboardingPortal() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [record, setRecord] = useState(null);
  const [company, setCompany] = useState({});
  const [step, setStep] = useState("info");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [done, setDone] = useState(false);

  // Step state
  const [personal, setPersonal] = useState({});
  const [w4, setW4] = useState({});
  const [m4, setM4] = useState({});
  const [w9, setW9] = useState({});
  const [idFront, setIdFront] = useState("");
  const [idBack, setIdBack] = useState("");
  const [cameraFor, setCameraFor] = useState(null); // "front" | "back" | null
  const [uploadingId, setUploadingId] = useState(null);
  const [handbookAck, setHandbookAck] = useState(false);
  const [signedName, setSignedName] = useState("");

  // Signature pad
  const canvasRef = useRef(null);
  const [hasSignature, setHasSignature] = useState(false);

  const isContractor = record?.worker_type === "contractor";
  const STEPS = isContractor
    ? [
        { id: "info", label: "Your Info", icon: User },
        { id: "tax", label: "W-9", icon: FileText },
        { id: "id", label: "Photo ID", icon: Camera },
        { id: "sign", label: "Sign", icon: PenLine },
      ]
    : [
        { id: "info", label: "Your Info", icon: User },
        { id: "tax", label: "Tax Forms", icon: FileText },
        { id: "id", label: "Photo ID", icon: Camera },
        { id: "handbook", label: "Handbook", icon: BookOpen },
        { id: "sign", label: "Sign", icon: PenLine },
      ];
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  useEffect(() => {
    if (!token) {
      setLoadError("This onboarding link is missing its token. Please use the link from your email.");
      setLoading(false);
      return;
    }
    base44.functions
      .invoke("getEmployeeOnboarding", { token })
      .then((res) => {
        if (res.data?.error) {
          setLoadError(res.data.error);
          return;
        }
        const ob = res.data.onboarding;
        setRecord(ob);
        setCompany(res.data.company || {});
        setPersonal(ob.personal_info || {});
        setW4(ob.form_w4 || {});
        setM4(ob.form_m4 || {});
        setW9(ob.form_w9 || {});
        setIdFront(ob.id_front_url || "");
        setIdBack(ob.id_back_url || "");
        setHandbookAck(!!ob.handbook_acknowledged);
        setSignedName(ob.signed_name || ob.full_name || "");
        if (ob.status === "submitted" || ob.status === "approved") setDone(true);
      })
      .catch((err) => setLoadError(err?.response?.data?.error || "Could not load your onboarding packet. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  // Signature canvas wiring (sign step only)
  useEffect(() => {
    if (step !== "sign" || done || !canvasRef.current) return;
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
  }, [step, done]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const save = async (stepName, data, nextStep) => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await base44.functions.invoke("submitEmployeeOnboarding", { token, step: stepName, data });
      if (res.data?.error) throw new Error(res.data.error);
      if (nextStep) setStep(nextStep);
      return true;
    } catch (err) {
      setSaveError(err?.response?.data?.error || err.message || "Could not save. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleIdFile = async (file, side) => {
    if (!file) return;
    setUploadingId(side);
    setSaveError("");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (side === "front") setIdFront(file_url);
      else setIdBack(file_url);
      await base44.functions.invoke("submitEmployeeOnboarding", {
        token,
        step: "id",
        data: {
          [side === "front" ? "id_front_url" : "id_back_url"]: file_url,
          id_capture_method: cameraFor ? "camera" : "upload",
        },
      });
    } catch {
      setSaveError("Upload failed — please try again.");
    } finally {
      setUploadingId(null);
      setCameraFor(null);
    }
  };

  const handleFinalSubmit = async () => {
    if (!hasSignature || !signedName.trim()) return;
    const signatureData = canvasRef.current.toDataURL("image/png");
    const ok = await save("submit", { signature_data: signatureData, signed_name: signedName.trim() });
    if (ok) setDone(true);
  };

  const w4Credits = (Number(w4.dependents_children || 0) * 2000) + (Number(w4.dependents_other || 0) * 500);
  const m4Exemptions = (m4.personal_exemption ? 1 : 0) + (m4.spouse_exemption ? 1 : 0) + Number(m4.dependents_count || 0);

  /* ── Frame states ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: BRAND }}>
            <HardHat className="w-7 h-7 text-white" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
          <p className="text-sm text-gray-500 mt-2">Loading your onboarding packet…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-secondary mb-2">Link Problem</h1>
          <p className="text-sm text-gray-600">{loadError}</p>
          <p className="text-xs text-gray-400 mt-4">Need help? Call {company.phone || "(617) 857-COEN"}.</p>
        </div>
      </div>
    );
  }

  if (done) {
    const approved = record?.status === "approved";
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-secondary mb-2">
            {approved ? "Packet Approved" : "Packet Submitted!"}
          </h1>
          <p className="text-sm text-gray-600">
            {approved
              ? "Your onboarding packet has been approved. Welcome aboard!"
              : "Thanks! The office will review your packet and reach out if anything else is needed."}
          </p>
          {!approved && record?.status === "submitted" && (
            <button onClick={() => setDone(false)} className="text-xs text-gray-400 underline mt-4">
              Need to change something? Re-open the packet
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <div className="bg-secondary text-white">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3">
            <BrandLogo onDark className="h-9 shrink-0" />
            <div>
              <h1 className="font-bold leading-tight">{isContractor ? "Contractor" : "New Hire"} Onboarding</h1>
              <p className="text-white/60 text-xs">{record.full_name}{record.position ? ` · ${record.position}` : ""}{record.start_date ? ` · starts ${record.start_date}` : ""}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Changes requested banner */}
      {record.status === "changes_requested" && record.review_notes && (
        <div className="max-w-2xl mx-auto px-4 mt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">The office requested a few updates:</p>
            <p>{record.review_notes}</p>
          </div>
        </div>
      )}

      {/* Stepper */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex gap-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = s.id === step;
              const completed = i < stepIndex;
              return (
                <button
                  key={s.id}
                  onClick={() => setStep(s.id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    active ? "bg-primary/10 text-primary" : completed ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  {completed ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  <span className="hidden sm:block">{s.label}</span>
                  <span className="sm:hidden text-[10px]">{i + 1}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(stepIndex / (STEPS.length - 1)) * 100}%`, background: BRAND }} />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {saveError && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600" role="alert">{saveError}</div>
        )}

        {/* ── STEP: Personal info ── */}
        {step === "info" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <h2 className="font-bold text-secondary text-lg">Your Information</h2>
              <p className="text-sm text-gray-500 mt-1">Used for your employment records{isContractor ? " and your vendor profile" : ""}.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Full Legal Name" required>
                <Input value={record.full_name} disabled className="bg-gray-50" />
              </Field>
              <Field label="Email" required>
                <Input value={record.email} disabled className="bg-gray-50" />
              </Field>
              <Field label="Phone" required>
                <Input type="tel" value={personal.phone || record.phone || ""} onChange={(e) => setPersonal((p) => ({ ...p, phone: e.target.value }))} placeholder="(617) 555-0100" />
              </Field>
              <Field label="Date of Birth">
                <Input type="date" value={personal.dob || ""} onChange={(e) => setPersonal((p) => ({ ...p, dob: e.target.value }))} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Home Address" required>
                  <AddressInput className="h-10 rounded-md" value={personal.address || ""} onChange={(val) => setPersonal((p) => ({ ...p, address: val }))} placeholder="Street, City, State ZIP" />
                </Field>
              </div>
              <Field label="Emergency Contact Name">
                <Input value={personal.emergency_contact_name || ""} onChange={(e) => setPersonal((p) => ({ ...p, emergency_contact_name: e.target.value }))} />
              </Field>
              <Field label="Emergency Contact Phone">
                <Input type="tel" value={personal.emergency_contact_phone || ""} onChange={(e) => setPersonal((p) => ({ ...p, emergency_contact_phone: e.target.value }))} />
              </Field>
            </div>
            <Button
              onClick={() => save("personal", personal, "tax")}
              disabled={saving || !(personal.phone || record.phone) || !personal.address}
              className="w-full gap-2" style={{ background: BRAND }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              Save & Continue
            </Button>
          </div>
        )}

        {/* ── STEP: Tax forms ── */}
        {step === "tax" && !isContractor && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div>
                <h2 className="font-bold text-secondary text-lg">Federal Form W-4 — Employee's Withholding Certificate</h2>
                <p className="text-sm text-gray-500 mt-1">Current IRS layout. Your employer uses this to withhold the correct federal income tax.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Social Security Number" required>
                  <Input value={w4.ssn || ""} onChange={(e) => setW4((f) => ({ ...f, ssn: e.target.value }))} placeholder="XXX-XX-XXXX" inputMode="numeric" />
                </Field>
                <Field label="Filing Status (Step 1c)" required>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white h-10"
                    value={w4.filing_status || ""}
                    onChange={(e) => setW4((f) => ({ ...f, filing_status: e.target.value }))}
                  >
                    <option value="">— Select —</option>
                    <option value="single">Single or Married filing separately</option>
                    <option value="married_jointly">Married filing jointly / Qualifying surviving spouse</option>
                    <option value="head_of_household">Head of household</option>
                  </select>
                </Field>
              </div>
              <CheckRow id="w4-multi" checked={w4.multiple_jobs} onChange={(v) => setW4((f) => ({ ...f, multiple_jobs: v }))}>
                <strong>Step 2(c):</strong> Check if you hold more than one job at a time, or you're married filing jointly and your spouse also works.
              </CheckRow>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Step 3 — Claim Dependents</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Field label="Qualifying children under 17">
                    <Input type="number" min="0" value={w4.dependents_children ?? ""} onChange={(e) => setW4((f) => ({ ...f, dependents_children: e.target.value }))} placeholder="0" />
                  </Field>
                  <Field label="Other dependents">
                    <Input type="number" min="0" value={w4.dependents_other ?? ""} onChange={(e) => setW4((f) => ({ ...f, dependents_other: e.target.value }))} placeholder="0" />
                  </Field>
                  <Field label="Total credits (auto)">
                    <Input value={`$${w4Credits.toLocaleString()}`} disabled className="bg-gray-50" />
                  </Field>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Children × $2,000 + other dependents × $500.</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="4(a) Other income ($)">
                  <Input type="number" min="0" value={w4.other_income ?? ""} onChange={(e) => setW4((f) => ({ ...f, other_income: e.target.value }))} placeholder="0" />
                </Field>
                <Field label="4(b) Deductions ($)">
                  <Input type="number" min="0" value={w4.deductions ?? ""} onChange={(e) => setW4((f) => ({ ...f, deductions: e.target.value }))} placeholder="0" />
                </Field>
                <Field label="4(c) Extra withholding ($/pay)">
                  <Input type="number" min="0" value={w4.extra_withholding ?? ""} onChange={(e) => setW4((f) => ({ ...f, extra_withholding: e.target.value }))} placeholder="0" />
                </Field>
              </div>
              <CheckRow id="w4-exempt" checked={w4.claim_exempt} onChange={(v) => setW4((f) => ({ ...f, claim_exempt: v }))}>
                I claim exemption from withholding (I had no federal tax liability last year and expect none this year).
              </CheckRow>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div>
                <h2 className="font-bold text-secondary text-lg">Massachusetts Form M-4 — Withholding Exemption Certificate</h2>
                <p className="text-sm text-gray-500 mt-1">Determines your Massachusetts state income tax withholding.</p>
              </div>
              <div className="space-y-2">
                <CheckRow id="m4-self" checked={m4.personal_exemption} onChange={(v) => setM4((f) => ({ ...f, personal_exemption: v }))}>
                  Claim your <strong>personal exemption</strong> (line 1).
                </CheckRow>
                <CheckRow id="m4-spouse" checked={m4.spouse_exemption} onChange={(v) => setM4((f) => ({ ...f, spouse_exemption: v }))}>
                  Claim your <strong>spouse's exemption</strong> — only if your spouse is not claiming their own (line 2).
                </CheckRow>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Dependents (line 3)">
                  <Input type="number" min="0" value={m4.dependents_count ?? ""} onChange={(e) => setM4((f) => ({ ...f, dependents_count: e.target.value }))} placeholder="0" />
                </Field>
                <Field label="Total exemptions (auto)">
                  <Input value={m4Exemptions} disabled className="bg-gray-50" />
                </Field>
                <Field label="Additional withholding ($/pay)">
                  <Input type="number" min="0" value={m4.additional_withholding ?? ""} onChange={(e) => setM4((f) => ({ ...f, additional_withholding: e.target.value }))} placeholder="0" />
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <CheckRow id="m4-hoh" checked={m4.head_of_household} onChange={(v) => setM4((f) => ({ ...f, head_of_household: v }))}>
                  Head of household (line 4)
                </CheckRow>
                <CheckRow id="m4-blind" checked={m4.blind} onChange={(v) => setM4((f) => ({ ...f, blind: v }))}>
                  You or your spouse is blind (line 5)
                </CheckRow>
                <CheckRow id="m4-65" checked={m4.age_65_or_over} onChange={(v) => setM4((f) => ({ ...f, age_65_or_over: v }))}>
                  You or your spouse is 65 or over (line 6)
                </CheckRow>
                <CheckRow id="m4-student" checked={m4.full_time_student} onChange={(v) => setM4((f) => ({ ...f, full_time_student: v }))}>
                  Full-time student
                </CheckRow>
              </div>
              <Button
                onClick={() => save("tax_forms", { form_w4: w4, form_m4: m4 }, "id")}
                disabled={saving || !w4.ssn || !w4.filing_status}
                className="w-full gap-2" style={{ background: BRAND }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                Save Tax Forms & Continue
              </Button>
            </div>
          </>
        )}

        {step === "tax" && isContractor && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <h2 className="font-bold text-secondary text-lg">IRS Form W-9 — Request for Taxpayer Identification Number</h2>
              <p className="text-sm text-gray-500 mt-1">Required before we can pay you as a 1099 contractor.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Name (as shown on your tax return)" required>
                <Input value={w9.name || record.full_name} onChange={(e) => setW9((f) => ({ ...f, name: e.target.value }))} />
              </Field>
              <Field label="Business / DBA name (if any)">
                <Input value={w9.business_name || ""} onChange={(e) => setW9((f) => ({ ...f, business_name: e.target.value }))} />
              </Field>
              <Field label="Federal Tax Classification" required>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white h-10"
                  value={w9.tax_classification || ""}
                  onChange={(e) => setW9((f) => ({ ...f, tax_classification: e.target.value }))}
                >
                  <option value="">— Select —</option>
                  {W9_CLASSIFICATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="TIN Type" required>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white h-10"
                  value={w9.tin_type || ""}
                  onChange={(e) => setW9((f) => ({ ...f, tin_type: e.target.value }))}
                >
                  <option value="">— Select —</option>
                  <option value="ssn">Social Security Number</option>
                  <option value="ein">Employer Identification Number</option>
                </select>
              </Field>
              <Field label={w9.tin_type === "ein" ? "EIN" : "SSN / TIN"} required>
                <Input value={w9.tin || ""} onChange={(e) => setW9((f) => ({ ...f, tin: e.target.value }))} placeholder={w9.tin_type === "ein" ? "XX-XXXXXXX" : "XXX-XX-XXXX"} inputMode="numeric" />
              </Field>
              <Field label="Exempt payee code (if any)">
                <Input value={w9.exempt_payee_code || ""} onChange={(e) => setW9((f) => ({ ...f, exempt_payee_code: e.target.value }))} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address" required>
                  <AddressInput className="h-10 rounded-md" value={w9.address || personal.address || ""} onChange={(val) => setW9((f) => ({ ...f, address: val }))} placeholder="Street, City, State ZIP" />
                </Field>
              </div>
            </div>
            <CheckRow id="w9-cert" checked={w9.certified} onChange={(v) => setW9((f) => ({ ...f, certified: v }))}>
              <strong>Certification:</strong> Under penalties of perjury, I certify that the number shown is my correct taxpayer identification number, I am not subject to backup withholding, I am a U.S. citizen or other U.S. person, and the FATCA code (if any) is correct.
            </CheckRow>
            <Button
              onClick={() => save("tax_forms", { form_w9: w9 }, "id")}
              disabled={saving || !(w9.name || record.full_name) || !w9.tax_classification || !w9.tin || !w9.certified}
              className="w-full gap-2" style={{ background: BRAND }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              Save W-9 & Continue
            </Button>
          </div>
        )}

        {/* ── STEP: Photo ID ── */}
        {step === "id" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <h2 className="font-bold text-secondary text-lg">Photo ID Verification</h2>
              <p className="text-sm text-gray-500 mt-1">Take a live photo of your government-issued ID (driver's license, passport, or state ID), or upload an image. The back is optional.</p>
            </div>

            {["front", "back"].map((side) => (
              <div key={side} className="border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-secondary mb-2 capitalize">
                  ID {side} {side === "front" ? <span className="text-red-500">*</span> : <span className="text-gray-400 text-xs font-normal">(optional)</span>}
                </p>
                {cameraFor === side ? (
                  <CameraCapture
                    onCapture={(file) => handleIdFile(file, side)}
                    onCancel={() => setCameraFor(null)}
                  />
                ) : (side === "front" ? idFront : idBack) ? (
                  <div className="flex items-center gap-3">
                    <img src={side === "front" ? idFront : idBack} alt={`ID ${side}`} className="w-32 h-20 object-cover rounded-lg border border-gray-200" />
                    <div className="text-sm">
                      <p className="text-green-600 font-semibold flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Received</p>
                      <button onClick={() => (side === "front" ? setIdFront("") : setIdBack(""))} className="text-xs text-gray-400 underline mt-1">Replace</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => setCameraFor(side)} disabled={uploadingId === side}>
                      <Camera className="w-4 h-4" /> Use Camera
                    </Button>
                    <label className="inline-flex">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleIdFile(e.target.files?.[0], side)} />
                      <span className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-md text-sm font-medium cursor-pointer hover:bg-gray-50">
                        {uploadingId === side ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload Photo
                      </span>
                    </label>
                  </div>
                )}
              </div>
            ))}

            <Button
              onClick={() => setStep(isContractor ? "sign" : "handbook")}
              disabled={!idFront}
              className="w-full gap-2" style={{ background: BRAND }}
            >
              <ChevronRight className="w-4 h-4" /> Continue
            </Button>
          </div>
        )}

        {/* ── STEP: Handbook (W2 only) ── */}
        {step === "handbook" && !isContractor && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <h2 className="font-bold text-secondary text-lg">Employee Handbook</h2>
              <p className="text-sm text-gray-500 mt-1">Please review the handbook, then acknowledge below.</p>
            </div>
            {company.employee_handbook_url ? (
              <>
                <a
                  href={company.employee_handbook_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-primary transition-colors"
                >
                  <BookOpen className="w-6 h-6 text-primary" />
                  <div>
                    <p className="font-semibold text-secondary text-sm">{company.employee_handbook_name || "Employee Handbook"}</p>
                    <p className="text-xs text-gray-400">Opens in a new tab — PDF</p>
                  </div>
                </a>
                <iframe src={company.employee_handbook_url} title="Employee Handbook" className="w-full h-96 border border-gray-200 rounded-xl" />
              </>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                The handbook will be provided to you directly by the office. You can still acknowledge below that you agree to review and follow company policies.
              </div>
            )}
            <CheckRow id="handbook-ack" checked={handbookAck} onChange={setHandbookAck}>
              I acknowledge that I have {company.employee_handbook_url ? "received and reviewed" : "been informed of"} the {company.name || "Coen Construction"} Employee Handbook and agree to follow the policies it describes.
            </CheckRow>
            <Button
              onClick={() => save("handbook", { acknowledged: handbookAck }, "sign")}
              disabled={saving || !handbookAck}
              className="w-full gap-2" style={{ background: BRAND }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              Acknowledge & Continue
            </Button>
          </div>
        )}

        {/* ── STEP: Review & sign ── */}
        {step === "sign" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <h2 className="font-bold text-secondary text-lg">Review & Sign</h2>
              <p className="text-sm text-gray-500 mt-1">Confirm everything is complete, then sign to submit your packet.</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm space-y-1.5">
              <p className="flex items-center gap-2">{personal.address ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />} Personal information</p>
              {isContractor ? (
                <p className="flex items-center gap-2">{w9.tin && w9.certified ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />} Form W-9</p>
              ) : (
                <p className="flex items-center gap-2">{w4.ssn && w4.filing_status ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />} Form W-4 + Massachusetts M-4</p>
              )}
              <p className="flex items-center gap-2">{idFront ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />} Photo ID</p>
              {!isContractor && (
                <p className="flex items-center gap-2">{handbookAck ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />} Handbook acknowledgment</p>
              )}
            </div>
            <Field label="Type your full legal name" required>
              <Input value={signedName} onChange={(e) => setSignedName(e.target.value)} placeholder={record.full_name} />
            </Field>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Signature *</label>
                <button onClick={clearSignature} className="text-xs text-gray-400 flex items-center gap-1 hover:text-gray-600">
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              </div>
              <canvas ref={canvasRef} className="w-full border-2 border-dashed border-gray-300 rounded-xl bg-white touch-none" style={{ height: 160 }} />
              <p className="text-[11px] text-gray-400 mt-1">Sign with your finger or mouse.</p>
            </div>
            <p className="text-xs text-gray-500">
              By signing, I certify that all information provided in this onboarding packet is true and complete to the best of my knowledge{isContractor ? ", including my W-9 certification under penalties of perjury" : ", including my W-4 and M-4 withholding elections"}.
            </p>
            <Button
              onClick={handleFinalSubmit}
              disabled={saving || !hasSignature || !signedName.trim() || !idFront}
              className="w-full gap-2" style={{ background: BRAND }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Sign & Submit Packet
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
