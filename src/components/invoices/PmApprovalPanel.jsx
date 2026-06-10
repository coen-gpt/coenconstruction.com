/**
 * PM Approval Panel — shown inside InvoiceDetailDrawer for sub invoices.
 * Enforces: Gate 1 & Gate 2 must pass before Approve button is enabled.
 * Captures pm_approved_by, pm_approved_at, optional drawn signature.
 * On approval, calls computeInvoiceGates backend to flip ready_for_payment.
 */
import { useState, useRef, useEffect } from "react";
import { base44, ADMIN_SESSION_KEY } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle2, PenLine, RotateCcw, ShieldCheck, ShieldX, Info } from "lucide-react";
import GateStatusBadges from "./GateStatusBadges";

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function PmApprovalPanel({ invoice, vendor, onRefresh }) {
  const { toast } = useToast();
  const canvasRef = useRef(null);
  const [showSignature, setShowSignature] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [note, setNote] = useState("");
  const [approving, setApproving] = useState(false);

  const reasons = invoice.gate_blocked_reasons || [];
  const gate1Fail = reasons.some(r =>
    r.includes("packet not completed") ||
    r.includes("Insurance expired") ||
    r.includes("certificate not on file") ||
    r.includes("Vendor record not linked")
  );
  const gate2Fail = reasons.some(r =>
    r.includes("No invoice document") || r.includes("amount is $0")
  );
  const hardBlocked = gate1Fail || gate2Fail;
  const alreadyApproved = invoice.pm_approval_status === "approved";

  // Canvas signature
  useEffect(() => {
    if (showSignature && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.offsetWidth;
      canvas.height = 120;
      const ctx = canvas.getContext("2d");
      ctx.strokeStyle = "#1B2B3A";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
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
      canvas.addEventListener("mousedown", start); canvas.addEventListener("mousemove", move);
      canvas.addEventListener("mouseup", end); canvas.addEventListener("touchstart", start, { passive: false });
      canvas.addEventListener("touchmove", move, { passive: false }); canvas.addEventListener("touchend", end);
      return () => {
        canvas.removeEventListener("mousedown", start); canvas.removeEventListener("mousemove", move);
        canvas.removeEventListener("mouseup", end); canvas.removeEventListener("touchstart", start);
        canvas.removeEventListener("touchmove", move); canvas.removeEventListener("touchend", end);
      };
    }
  }, [showSignature]);

  const clearSig = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasSignature(false);
  };

  const handleApprove = async () => {
    if (hardBlocked) return;
    setApproving(true);
    const user = getCurrentUser();
    let sigData = null;
    if (showSignature && hasSignature && canvasRef.current) {
      sigData = canvasRef.current.toDataURL("image/png");
    }
    try {
      const res = await base44.functions.invoke("computeInvoiceGates", {
        invoice_id: invoice.id,
        pm_approve: true,
        pm_user_email: user?.email || "admin",
        pm_signature: sigData,
      });
      if (res.data?.error) {
        toast({ title: "Cannot approve", description: res.data.error, variant: "destructive" });
      } else {
        toast({ title: "Invoice approved for payment ✓", description: "Gates recomputed and SubPayable updated." });
        onRefresh();
      }
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setApproving(false);
  };

  if (alreadyApproved) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
          <ShieldCheck className="w-4 h-4" /> PM Approved for Payment
        </div>
        <p className="text-xs text-emerald-600">
          Approved by <strong>{invoice.pm_approved_by}</strong>
          {invoice.pm_approved_at ? ` on ${new Date(invoice.pm_approved_at).toLocaleDateString()}` : ""}
        </p>
        {invoice.pm_approval_signature && (
          <img src={invoice.pm_approval_signature} alt="PM Signature" className="h-12 border border-emerald-200 rounded bg-white" />
        )}
        <GateStatusBadges invoice={invoice} vendor={vendor} />
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-4 border space-y-3 ${hardBlocked ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
      <div className="flex items-center gap-2 font-semibold text-sm text-secondary">
        {hardBlocked ? <ShieldX className="w-4 h-4 text-red-500" /> : <ShieldCheck className="w-4 h-4 text-amber-600" />}
        PM Approval — Gate 3
      </div>

      <GateStatusBadges invoice={invoice} vendor={vendor} />

      {/* Blocked reasons */}
      {reasons.length > 0 && (
        <ul className="space-y-1">
          {reasons.map((r, i) => (
            <li key={i} className={`text-xs flex items-start gap-1.5 ${r.includes("expiring soon") ? "text-yellow-700" : r.includes("still payable") ? "text-yellow-600" : "text-red-700"}`}>
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              {r}
            </li>
          ))}
        </ul>
      )}

      {/* Signature toggle */}
      {!hardBlocked && (
        <div className="space-y-2">
          <button
            onClick={() => setShowSignature(s => !s)}
            className="text-xs text-indigo-600 hover:underline"
          >
            {showSignature ? "− Hide signature" : "+ Add optional PM signature"}
          </button>
          {showSignature && (
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                  <PenLine className="w-3 h-3" /> PM Signature
                </div>
                <button onClick={clearSig} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              </div>
              <canvas
                ref={canvasRef}
                className="w-full border border-gray-200 rounded bg-gray-50 cursor-crosshair touch-none"
                style={{ height: "120px" }}
              />
            </div>
          )}
        </div>
      )}

      <div
        title={hardBlocked ? "Gate 1 or Gate 2 not satisfied — resolve packet/insurance/invoice issues first" : ""}
        className="inline-block w-full"
      >
        <Button
          className={`w-full gap-1.5 text-sm font-semibold ${hardBlocked ? "opacity-40 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
          onClick={handleApprove}
          disabled={hardBlocked || approving}
        >
          <CheckCircle2 className="w-4 h-4" />
          {approving ? "Approving…" : hardBlocked ? "Blocked — Fix Gates 1 & 2 First" : "Approve for Payment"}
        </Button>
      </div>
    </div>
  );
}