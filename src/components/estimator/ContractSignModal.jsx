import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { PenLine, RotateCcw, CheckCircle, Loader2, FileText, ExternalLink } from "lucide-react";

export default function ContractSignModal({ project, estimate, company, token, open, onClose, onSigned }) {
  const { toast } = useToast();
  const canvasRef = useRef(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (open && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.offsetWidth;
      canvas.height = 160;
      const ctx = canvas.getContext("2d");
      ctx.strokeStyle = "#1B2B3A";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";

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
    }
  }, [open]);

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSign = async () => {
    if (!hasSignature || !agreed) return;
    setSaving(true);
    const canvas = canvasRef.current;
    const sigData = canvas.toDataURL("image/png");
    const depositPct = company?.deposit_percentage || 33;
    const depositAmount = Math.round((estimate?.grand_total || 0) * depositPct / 100);

    try {
      // Token-validated backend call — the public portal can't write entities
      // directly. Marks the estimate approved, stores the signature on the
      // project, and sets the deposit amount.
      await base44.functions.invoke("processApproval", {
        token,
        action: "approve",
        estimate_id: estimate?.id,
        signature_data: sigData,
        deposit_amount: depositAmount,
        notes: "Contract signed electronically via customer portal",
      });
      toast({ title: "Contract signed!", description: "Your project has been approved. Please complete your deposit payment." });
      onSigned(depositAmount, sigData);
      onClose();
    } catch (err) {
      toast({
        title: "Signing failed",
        description: err?.response?.data?.error || err.message || "Please try again or call us at (781) 999-5400.",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const depositPct = company?.deposit_percentage || 33;
  const depositAmount = Math.round((estimate?.grand_total || 0) * depositPct / 100);

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
            <span className="text-sm text-gray-300">Deposit Required ({depositPct}%)</span>
            <span className="text-lg font-bold">${depositAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Contract Terms */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 leading-relaxed max-h-48 overflow-y-auto">
          <p className="font-semibold text-secondary text-sm mb-2">Contract Terms & Conditions</p>
          {company?.estimate_terms ? (
            <p className="whitespace-pre-wrap">{company.estimate_terms}</p>
          ) : (
            <div className="space-y-2">
              <p>This agreement is between Coen Construction LLC and the client for the scope of work outlined in the project estimate above.</p>
              <p><strong>Payment Terms:</strong> A deposit of {depositPct}% is due upon signing. Progress payments will be outlined in the project schedule. Final payment is due upon project completion.</p>
              <p><strong>Scope Changes:</strong> Any changes to the scope of work must be agreed upon in writing via a change order. Additional costs will be quoted and approved before proceeding.</p>
              <p><strong>Timeline:</strong> Project start and completion dates are estimates and subject to weather, material availability, and permit timelines.</p>
              <p><strong>Warranty:</strong> Coen Construction warrants all workmanship for one (1) year from project completion.</p>
            </div>
          )}
          {company?.contract_template_url && (
            <a href={company.contract_template_url} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-1 text-blue-600 hover:underline font-medium">
              <ExternalLink className="w-3 h-3" /> View Full Contract PDF
            </a>
          )}
        </div>

        {/* Agreement checkbox */}
        <label className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-primary" />
          <span className="text-sm text-blue-800">
            I have read and agree to the contract terms and conditions above. I authorize Coen Construction LLC to proceed with the project and understand a deposit of <strong>${depositAmount.toLocaleString()}</strong> is due upon signing.
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
            ref={canvasRef}
            className="w-full border border-gray-200 rounded-lg bg-gray-50 cursor-crosshair touch-none"
            style={{ height: "160px" }}
          />
          {!hasSignature && (
            <p className="text-xs text-gray-400 text-center mt-1">Use your mouse or finger to sign</p>
          )}
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Name: {project?.client_name}</span>
            <span>Date: {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        <Button
          onClick={handleSign}
          disabled={!hasSignature || !agreed || saving}
          className="w-full py-3 text-base font-bold bg-primary hover:bg-[#c94522] text-white gap-2"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4" /> Sign Contract & Proceed to Deposit</>}
        </Button>
      </DialogContent>
    </Dialog>
  );
}