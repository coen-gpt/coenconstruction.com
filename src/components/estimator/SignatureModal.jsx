import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, PenTool } from "lucide-react";

export default function SignatureModal({ open, onClose, onSign, projectTitle, amount, estimateTitle }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const contextRef = useRef(null);
  const [dpi, setDpi] = useState(1);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    setDpi(dpr);

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1B2B3A";
    contextRef.current = ctx;

    return () => {
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [open]);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    contextRef.current?.beginPath();
    contextRef.current?.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    contextRef.current?.lineTo(x, y);
    contextRef.current?.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      contextRef.current?.closePath();
      setIsDrawing(false);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSign = async () => {
    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL("image/png");
    setSaving(true);
    await onSign(signatureData);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="w-5 h-5 text-primary" />
            Sign Change Order
          </DialogTitle>
          <DialogDescription>
            {estimateTitle && <div className="font-semibold text-gray-700 mt-1">{estimateTitle}</div>}
            {projectTitle && <div className="text-sm text-gray-600 mt-0.5">{projectTitle}</div>}
            {amount && (
              <div className="mt-2 bg-slate-50 border border-gray-200 rounded-lg px-3 py-2">
                <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Amount</div>
                <div className="text-lg font-bold text-primary">${amount.toLocaleString()}</div>
              </div>
            )}
            <div className="mt-3 text-sm">Draw your signature in the box below using your mouse, trackpad, or finger (on mobile).</div>
          </DialogDescription>
        </DialogHeader>

        <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            className="w-full h-48 touch-none cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={clearSignature} className="flex-1">
            <X className="w-4 h-4 mr-2" /> Clear
          </Button>
          <Button
            onClick={handleSign}
            disabled={!hasSignature || saving}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            {saving ? "Processing…" : "Sign & Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}