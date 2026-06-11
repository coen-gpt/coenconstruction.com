import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { PenLine, RotateCcw, CheckCircle, Loader2, FileText, CreditCard } from "lucide-react";
import {
  CONTRACT_VERSION,
  contractTitle,
  contractIntro,
  buildContractSections,
  contractPlainText,
  scheduleLinesFromMilestones,
} from "@/lib/customerContract";

/**
 * Full digital contract review + e-signature. The customer reads the complete
 * Construction Agreement (the same legal text as the paper contract, with
 * their name, address, price and payment schedule merged in), confirms their
 * printed name, acknowledges, and signs. The exact text displayed is sent to
 * the server and archived on the SignedContract record.
 */
export default function ContractSignModal({ project, estimate, company, token, paymentSchedule, open, onClose, onSigned }) {
  const { toast } = useToast();
  // Callback-ref state (not useRef): the dialog renders in a portal, so the
  // canvas mounts a render AFTER `open` flips. A plain ref leaves the init
  // effect running against null and the pad never gets its draw listeners.
  const [canvasEl, setCanvasEl] = useState(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [signedName, setSignedName] = useState(project?.client_name || "");

  useEffect(() => {
    if (open) setSignedName(project?.client_name || "");
  }, [open, project?.client_name]);

  useEffect(() => {
    if (!open || !canvasEl) return;
    const canvas = canvasEl;
    canvas.width = canvas.offsetWidth || canvas.parentElement?.offsetWidth || 448;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#1B2B3A";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    setHasSignature(false);

    let isDown = false;
    let lastX = 0, lastY = 0;

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
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
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
  }, [open, canvasEl]);

  const clear = () => {
    if (!canvasEl) return;
    canvasEl.getContext("2d").clearRect(0, 0, canvasEl.width, canvasEl.height);
    setHasSignature(false);
  };

  const clientAddress = [project?.client_address, project?.client_city, project?.client_zipcode]
    .filter(Boolean).join(", ") || project?.client_address || "";
  const scheduleLines = scheduleLinesFromMilestones(paymentSchedule);
  const contractCtx = {
    company,
    clientName: project?.client_name,
    clientAddress,
    contractPrice: estimate?.grand_total || 0,
    paymentScheduleLines: scheduleLines,
  };
  const sections = buildContractSections(contractCtx);

  const depositPct = company?.deposit_percentage || 33;
  const depositAmount = Math.round((estimate?.grand_total || 0) * depositPct / 100);
  // With a payment schedule, the amount due at signing is the schedule's first
  // milestone; otherwise the company's standard deposit percentage.
  const firstPaymentDue = scheduleLines.length > 0
    ? Math.round(paymentSchedule?.[0]?.amount || depositAmount)
    : depositAmount;
  const companyName = company?.company_name || "Coen Construction LLC";

  const handleSign = async () => {
    if (!hasSignature || !agreed || !canvasEl || !signedName.trim()) return;
    setSaving(true);
    const sigData = canvasEl.toDataURL("image/png");

    try {
      // Token-validated backend call — the public portal can't write entities
      // directly. Marks the estimate approved, stores the signature on the
      // project, and archives the executed contract text + signature as a
      // SignedContract record.
      await base44.functions.invoke("processApproval", {
        token,
        action: "approve",
        estimate_id: estimate?.id,
        signature_data: sigData,
        signed_name: signedName.trim(),
        contract_version: CONTRACT_VERSION,
        contract_text: contractPlainText(contractCtx),
        deposit_amount: firstPaymentDue,
        notes: "Contract signed electronically via customer portal",
      });
      toast({ title: "Contract signed!", description: "Your project has been approved. Please complete your deposit payment." });
      onSigned(firstPaymentDue, sigData);
      onClose();
    } catch (err) {
      toast({
        title: "Signing failed",
        description: err?.response?.data?.error || err.message || "Please try again or call us at (617) 857-COEN.",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Review & Sign Contract
          </DialogTitle>
        </DialogHeader>

        {/* Contract Summary */}
        <div className="bg-secondary rounded-xl p-5 text-white">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Project Contract</div>
          <div className="font-bold text-lg">{project?.client_name}</div>
          <div className="text-sm text-gray-300">{project?.project_type} · {project?.client_address}</div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-gray-400">Contract Total</span>
            <span className="text-2xl font-bold text-primary">${(estimate?.grand_total || 0).toLocaleString()}</span>
          </div>
          <div className="mt-2 flex items-center justify-between bg-white/10 rounded-lg px-3 py-2">
            <span className="text-sm text-gray-300">
              {scheduleLines.length > 0 ? "Due at Signing (per Schedule)" : `Deposit Required (${depositPct}%)`}
            </span>
            <span className="text-lg font-bold">${firstPaymentDue.toLocaleString()}</span>
          </div>
        </div>

        {/* The full Construction Agreement */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 leading-relaxed max-h-72 overflow-y-auto">
          <p className="font-semibold text-secondary text-sm">{contractTitle(company)}</p>
          <p className="text-[10px] text-gray-400 mb-3">Version {CONTRACT_VERSION}</p>
          <p className="mb-3">{contractIntro(contractCtx)}</p>
          <div className="space-y-3">
            {sections.map((s, i) => (
              <div key={s.heading}>
                <p className="font-semibold text-secondary">{i + 1}. {s.heading}</p>
                <p className="whitespace-pre-wrap mt-0.5">{s.body}</p>
              </div>
            ))}
          </div>

          {/* Exhibit B — Schedule of Payments */}
          {scheduleLines.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="font-semibold text-secondary flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Exhibit B — Schedule of Payments
              </p>
              <ul className="mt-1.5 space-y-1">
                {scheduleLines.map((line, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-primary font-bold">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Company-customized additional terms, if configured */}
          {company?.estimate_terms && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="font-semibold text-secondary">Additional Terms</p>
              <p className="whitespace-pre-wrap mt-0.5">{company.estimate_terms}</p>
            </div>
          )}
        </div>

        {/* Agreement checkbox */}
        <label className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-primary" />
          <span className="text-sm text-blue-800">
            I have read and agree to the Construction Agreement above, including all exhibits. I authorize {companyName} to proceed with the project and understand the first payment of <strong>${firstPaymentDue.toLocaleString()}</strong> is due upon signing.
          </span>
        </label>

        {/* Signature */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <PenLine className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-secondary">Your Signature</span>
            </div>
            <button onClick={clear} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          </div>
          <canvas
            ref={setCanvasEl}
            className="w-full border border-gray-200 rounded-lg bg-gray-50 cursor-crosshair touch-none"
            style={{ height: "160px" }}
          />
          {!hasSignature && (
            <p className="text-xs text-gray-400 text-center mt-1">Use your mouse or finger to sign</p>
          )}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-500 block mb-1">Printed Name</label>
              <Input
                value={signedName}
                onChange={e => setSignedName(e.target.value)}
                placeholder="Your full name"
                className="h-8 text-sm"
              />
            </div>
            <div className="text-xs text-gray-500 pt-5">Date: {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <Button
          onClick={handleSign}
          disabled={!hasSignature || !agreed || !signedName.trim() || saving}
          className="w-full py-3 text-base font-bold bg-primary hover:bg-[#c94522] text-white gap-2"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4" /> Sign Contract & Proceed to Deposit</>}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
