import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle, Upload, PenLine, RotateCcw, Loader2, Shield, FileText } from "lucide-react";
import AddressInput from "@/components/AddressInput";

const TABS = ["packet", "insurance", "w9", "sign"];

export default function SubContractorPacketModal({ vendor, open, onClose, onSaved }) {
  const { toast } = useToast();
  const canvasRef = useRef(null);
  const [tab, setTab] = useState("packet");
  const [saving, setSaving] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const [form, setForm] = useState({
    name: vendor?.contact_name || "",
    company: vendor?.company_name || "",
    address: vendor?.address || "",
    phone: vendor?.phone || "",
    email: vendor?.email || "",
    principal_contact: vendor?.contact_name || "",
    alt_phone: "",
    tax_id: "",
    entity_type: "llc",
  });

  const [wcFile, setWcFile] = useState(null);
  const [glFile, setGlFile] = useState(null);
  const [w9File, setW9File] = useState(null);
  const [wcExpiry, setWcExpiry] = useState(vendor?.workers_comp_expiry || "");
  const [glExpiry, setGlExpiry] = useState(vendor?.liability_ins_expiry || "");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setTab("packet");
      setHasSignature(false);
      setForm({
        name: vendor?.contact_name || "",
        company: vendor?.company_name || "",
        address: vendor?.address || "",
        phone: vendor?.phone || "",
        email: vendor?.email || "",
        principal_contact: vendor?.contact_name || "",
        alt_phone: "",
        tax_id: vendor?.packet_form_data?.tax_id || "",
        entity_type: vendor?.packet_form_data?.entity_type || "llc",
      });
    }
  }, [open, vendor]);

  // Canvas drawing
  useEffect(() => {
    if (tab === "sign" && canvasRef.current) {
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
  }, [tab]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const uploadFile = async (file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  };

  const handleSave = async () => {
    if (!hasSignature) { toast({ title: "Please sign the packet before submitting", variant: "destructive" }); return; }
    setSaving(true);
    setUploading(true);
    try {
      const updates = {
        is_subcontractor: true,
        packet_status: "completed",
        packet_signed_name: form.name,
        packet_signed_at: new Date().toISOString(),
        packet_form_data: form,
      };

      // Upload signature
      const canvas = canvasRef.current;
      updates.packet_signature_data = canvas.toDataURL("image/png");

      // Upload insurance docs
      if (wcFile) {
        updates.workers_comp_url = await uploadFile(wcFile);
        updates.workers_comp_expiry = wcExpiry;
      }
      if (glFile) {
        updates.liability_ins_url = await uploadFile(glFile);
        updates.liability_ins_expiry = glExpiry;
      }
      if (w9File) {
        updates.w9_url = await uploadFile(w9File);
      }

      // Determine insurance status
      const now = new Date();
      const wcExp = wcExpiry ? new Date(wcExpiry) : null;
      const glExp = glExpiry ? new Date(glExpiry) : null;
      const soonThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      if ((wcExp && wcExp < now) || (glExp && glExp < now)) {
        updates.insurance_status = "expired";
      } else if ((wcExp && wcExp < soonThreshold) || (glExp && glExp < soonThreshold)) {
        updates.insurance_status = "expiring_soon";
      } else if (wcExp && glExp) {
        updates.insurance_status = "valid";
      } else {
        updates.insurance_status = "pending";
      }

      await adminEntities.Vendor.update(vendor.id, updates);
      toast({ title: "Subcontractor packet saved!", description: "Documents have been uploaded and saved to their profile." });
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: "Error saving packet", description: err.message, variant: "destructive" });
    }
    setSaving(false);
    setUploading(false);
  };

  const tabStyle = (t) => `px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === t ? "bg-secondary text-white" : "text-gray-500 hover:bg-gray-100"}`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Subcontractor Packet — {vendor?.company_name}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap mb-4">
          <button className={tabStyle("packet")} onClick={() => setTab("packet")}>1. Company Info</button>
          <button className={tabStyle("insurance")} onClick={() => setTab("insurance")}>2. Insurance</button>
          <button className={tabStyle("w9")} onClick={() => setTab("w9")}>3. W-9</button>
          <button className={tabStyle("sign")} onClick={() => setTab("sign")}>4. Sign</button>
        </div>

        {/* ── PACKET ── */}
        {tab === "packet" && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 border border-gray-200">
              <p className="font-semibold text-secondary mb-1">Coen Construction LLC — Subcontractor Agreement</p>
              <p>By completing this packet you confirm you have read and agree to: the Coen Construction Subcontractor Agreement, Invoicing & Payment Procedures, Insurance Requirements, and W-9 submission requirements.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                ["name", "Legal Name *"],
                ["company", "Company / DBA Name *"],
                ["address", "Business Address *"],
                ["phone", "Phone Number *"],
                ["email", "Email Address *"],
                ["principal_contact", "Principal Contact"],
                ["alt_phone", "Alternate / Emergency Phone"],
                ["tax_id", "Tax ID / EIN"],
              ].map(([f, label]) => (
                <div key={f}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">{label}</label>
                  {f === "address" ? (
                    <AddressInput className="h-10 rounded-md" value={form[f]} onChange={val => setForm(p => ({ ...p, [f]: val }))} placeholder="Business address" />
                  ) : (
                    <Input value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} />
                  )}
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Entity Type</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" value={form.entity_type} onChange={e => setForm(p => ({ ...p, entity_type: e.target.value }))}>
                  <option value="sole_prop">Sole Proprietor</option>
                  <option value="llc">LLC</option>
                  <option value="s_corp">S Corporation</option>
                  <option value="c_corp">C Corporation</option>
                  <option value="partnership">Partnership</option>
                </select>
              </div>
            </div>
            <Button onClick={() => setTab("insurance")} className="w-full bg-secondary text-white">Next: Insurance Documents →</Button>
          </div>
        )}

        {/* ── INSURANCE ── */}
        {tab === "insurance" && (
          <div className="space-y-5">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">Insurance Requirements</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Workers Compensation — Statutory Limits, $500,000 Employers Liability</li>
                <li>Commercial General Liability — $2M General Aggregate, $1M Each Occurrence</li>
                <li>Coen Construction LLC must be named as Additional Insured on GL policy</li>
                <li>30-day cancellation notice required</li>
              </ul>
            </div>

            {/* Workers Comp */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="font-semibold text-secondary text-sm">Workers Compensation Certificate</span>
                {(vendor?.workers_comp_url || wcFile) && <CheckCircle className="w-4 h-4 text-green-500" />}
              </div>
              {vendor?.workers_comp_url && !wcFile && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <FileText className="w-3 h-3" />
                  <a href={vendor.workers_comp_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Current certificate on file</a>
                  <span className="text-gray-400">— Expires: {vendor.workers_comp_expiry || "unknown"}</span>
                </div>
              )}
              <label className="flex items-center gap-3 border border-dashed border-gray-300 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-50">
                <Upload className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-600 font-medium">{wcFile ? wcFile.name : "Upload Workers Comp Certificate"}</div>
                  <div className="text-xs text-gray-400">PDF or image</div>
                </div>
                <input type="file" accept=".pdf,image/*" onChange={e => setWcFile(e.target.files[0])} className="hidden" />
              </label>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Policy Expiration Date</label>
                <Input type="date" value={wcExpiry} onChange={e => setWcExpiry(e.target.value)} />
              </div>
            </div>

            {/* General Liability */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="font-semibold text-secondary text-sm">General Liability Certificate</span>
                {(vendor?.liability_ins_url || glFile) && <CheckCircle className="w-4 h-4 text-green-500" />}
              </div>
              {vendor?.liability_ins_url && !glFile && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <FileText className="w-3 h-3" />
                  <a href={vendor.liability_ins_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Current certificate on file</a>
                  <span className="text-gray-400">— Expires: {vendor.liability_ins_expiry || "unknown"}</span>
                </div>
              )}
              <label className="flex items-center gap-3 border border-dashed border-gray-300 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-50">
                <Upload className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-600 font-medium">{glFile ? glFile.name : "Upload General Liability Certificate"}</div>
                  <div className="text-xs text-gray-400">PDF or image — must show Coen Construction as Additional Insured</div>
                </div>
                <input type="file" accept=".pdf,image/*" onChange={e => setGlFile(e.target.files[0])} className="hidden" />
              </label>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Policy Expiration Date</label>
                <Input type="date" value={glExpiry} onChange={e => setGlExpiry(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTab("packet")} className="flex-1">← Back</Button>
              <Button onClick={() => setTab("w9")} className="flex-1 bg-secondary text-white">Next: W-9 →</Button>
            </div>
          </div>
        )}

        {/* ── W-9 ── */}
        {tab === "w9" && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">W-9 Required</p>
              <p>A completed W-9 form with your Tax ID is required before any payments can be issued. Ensure your entity type is checked and your TIN matches your legal name.</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="font-semibold text-secondary text-sm">W-9 Form</span>
                {(vendor?.w9_url || w9File) && <CheckCircle className="w-4 h-4 text-green-500" />}
              </div>
              {vendor?.w9_url && !w9File && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <FileText className="w-3 h-3" />
                  <a href={vendor.w9_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">W-9 on file</a>
                </div>
              )}
              <label className="flex items-center gap-3 border border-dashed border-gray-300 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-50">
                <Upload className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-600 font-medium">{w9File ? w9File.name : "Upload Completed W-9"}</div>
                  <div className="text-xs text-gray-400">PDF preferred</div>
                </div>
                <input type="file" accept=".pdf,image/*" onChange={e => setW9File(e.target.files[0])} className="hidden" />
              </label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTab("insurance")} className="flex-1">← Back</Button>
              <Button onClick={() => setTab("sign")} className="flex-1 bg-secondary text-white">Next: Sign →</Button>
            </div>
          </div>
        )}

        {/* ── SIGN ── */}
        {tab === "sign" && (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 leading-relaxed">
              <p className="font-semibold text-secondary text-sm mb-2">Subcontractor Agreement Acknowledgment</p>
              <p>By signing below, <strong>{form.name || "the undersigned"}</strong> on behalf of <strong>{form.company || form.name}</strong> acknowledges they have read, understand, and agree to the Coen Construction LLC Subcontractor Agreement including: General Performance standards, Insurance requirements (Workers Comp & General Liability with Coen Construction as Additional Insured), Payment terms (30 days from approval), Clean-up obligations, Hold Harmless provisions, and all other terms set forth in the Subcontractor Agreement.</p>
              <p className="mt-2">This agreement shall remain in force from the date hereof for a period of fifteen (15) years.</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PenLine className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-secondary">Draw Your Signature Below</span>
                </div>
                <button onClick={clearSignature} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              </div>
              <canvas
                ref={canvasRef}
                className="w-full border border-gray-200 rounded-lg bg-gray-50 cursor-crosshair touch-none"
                style={{ height: "160px" }}
              />
              {!hasSignature && (
                <p className="text-xs text-gray-400 text-center mt-2">Use your mouse or finger to sign above</p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-600">
              <div><span className="font-semibold">Name:</span> {form.name || "—"}</div>
              <div><span className="font-semibold">Date:</span> {new Date().toLocaleDateString()}</div>
              <div><span className="font-semibold">Company:</span> {form.company || "—"}</div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTab("w9")} className="flex-1">← Back</Button>
              <Button
                onClick={handleSave}
                disabled={saving || !hasSignature}
                className="flex-1 bg-primary text-white gap-2"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4" /> Submit Packet</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}