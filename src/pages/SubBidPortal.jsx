import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, FileText, Upload, CheckCircle, DollarSign, Loader2, Shield, PenLine, RotateCcw, AlertTriangle, X, Plus, File } from "lucide-react";

const PACKET_STEPS = ["info", "insurance", "w9", "sign", "bid"];

function MultiFileUpload({ label, icon, files, onAdd, onRemove, dragKey, dragOver, setDragOver, accept, hint, extraField }) {
  const handleFiles = (incoming) => {
    const arr = Array.from(incoming);
    if (arr.length) onAdd(arr);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-semibold text-secondary text-sm">{label}</span>
        {files.length > 0 && <CheckCircle className="w-4 h-4 text-green-500" />}
        {files.length > 0 && <span className="text-xs text-green-600 font-semibold">{files.length} file{files.length !== 1 ? "s" : ""}</span>}
      </div>

      {/* Uploaded files list */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg px-3 py-1.5">
              <File className="w-3.5 h-3.5 text-green-500 shrink-0" />
              <span className="text-xs font-medium text-green-800 flex-1 truncate">{f.name}</span>
              <span className="text-[10px] text-green-600">{(f.size / 1024).toFixed(0)} KB</span>
              <button onClick={() => onRemove(i)} className="text-green-300 hover:text-red-400 transition-colors shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <label
        className={`flex items-center gap-3 border border-dashed rounded-xl px-4 py-3 cursor-pointer transition-colors ${dragOver === dragKey ? "border-primary bg-primary/5" : "border-gray-300 hover:bg-gray-50"}`}
        onDragOver={e => { e.preventDefault(); setDragOver(dragKey); }}
        onDragLeave={() => setDragOver(null)}
        onDrop={e => { e.preventDefault(); setDragOver(null); handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="w-4 h-4 text-gray-400 shrink-0" />
        <div>
          <div className="text-sm text-gray-600 font-medium">{files.length > 0 ? "Add more files" : `Upload ${label}`}</div>
          <div className="text-xs text-gray-400">{hint || "Drag & drop or click to select multiple files"}</div>
        </div>
        <input type="file" accept={accept} multiple onChange={e => handleFiles(e.target.files)} className="hidden" />
      </label>

      {extraField}
    </div>
  );
}

export default function SubBidPortal() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const [state, setState] = useState("loading");
  const [subBid, setSubBid] = useState(null);
  const [project, setProject] = useState(null);
  const [company, setCompany] = useState(null);
  const [vendor, setVendor] = useState(null);

  const [packetStep, setPacketStep] = useState("info");
  const [packetDone, setPacketDone] = useState(false);

  const [form, setForm] = useState({ name: "", company: "", address: "", phone: "", email: "", principal_contact: "", alt_phone: "", tax_id: "", entity_type: "llc" });
  // Insurance: support multiple files per cert type
  const [wcFiles, setWcFiles] = useState([]);
  const [glFiles, setGlFiles] = useState([]);
  const [w9File, setW9File] = useState(null);
  // Additional docs (licenses, etc.)
  const [extraDocs, setExtraDocs] = useState([]); // [{file, label}]
  const [wcExpiry, setWcExpiry] = useState("");
  const [glExpiry, setGlExpiry] = useState("");
  const [dragOver, setDragOver] = useState(null); // "wc" | "gl" | "extra"
  const [hasSignature, setHasSignature] = useState(false);
  const [savingPacket, setSavingPacket] = useState(false);

  const [bidAmount, setBidAmount] = useState("");
  const [bidNotes, setBidNotes] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef(null);

  useEffect(() => {
    if (!token) { setState("error"); return; }
    loadData();
  }, [token]);

  const loadData = async () => {
    const bids = await base44.entities.SubBid.filter({ invite_token: token });
    if (!bids.length) { setState("error"); return; }
    const bid = bids[0];
    setSubBid(bid);

    const [projects, profiles] = await Promise.all([
      base44.entities.ContractorProject.filter({ id: bid.project_id }),
      base44.entities.CompanyProfile.list(),
    ]);
    setProject(projects[0] || null);
    setCompany(profiles[0] || null);

    // Try to find existing vendor record
    let existingVendor = null;
    if (bid.vendor_email) {
      const vendors = await base44.entities.Vendor.filter({ email: bid.vendor_email });
      existingVendor = vendors[0] || null;
    }
    setVendor(existingVendor);

    // Pre-fill form from vendor or bid data
    setForm({
      name: existingVendor?.contact_name || bid.vendor_name || "",
      company: existingVendor?.company_name || bid.vendor_company || "",
      address: existingVendor?.address || "",
      phone: existingVendor?.phone || "",
      email: bid.vendor_email || "",
      principal_contact: existingVendor?.contact_name || bid.vendor_name || "",
      alt_phone: "",
      tax_id: existingVendor?.packet_form_data?.tax_id || "",
      entity_type: existingVendor?.packet_form_data?.entity_type || "llc",
    });
    setWcExpiry(existingVendor?.workers_comp_expiry || "");
    setGlExpiry(existingVendor?.liability_ins_expiry || "");
    // wcFiles/glFiles start empty — sub uploads fresh copies

    if (bid.status === "submitted" || bid.status === "selected") {
      setState("submitted");
    } else {
      if (bid.status === "invited") {
        await base44.entities.SubBid.update(bid.id, { status: "viewed" });
      }
      // Check if they already completed the packet
      if (existingVendor?.packet_status === "completed") {
        // Check insurance status
        const now = new Date();
        const wcExp = existingVendor.workers_comp_expiry ? new Date(existingVendor.workers_comp_expiry) : null;
        const glExp = existingVendor.liability_ins_expiry ? new Date(existingVendor.liability_ins_expiry) : null;
        const isExpired = (wcExp && wcExp < now) || (glExp && glExp < now);
        if (isExpired) {
          setState("insurance_expired");
        } else {
          setPacketDone(true);
          setState("ready");
        }
      } else {
        setState("ready");
      }
    }
  };

  // Setup signature canvas
  useEffect(() => {
    if (state === "ready" && !packetDone && packetStep === "sign" && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.offsetWidth || 500;
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
      canvas.addEventListener("mousedown", start); canvas.addEventListener("mousemove", move); canvas.addEventListener("mouseup", end);
      canvas.addEventListener("touchstart", start, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); canvas.addEventListener("touchend", end);
      return () => {
        canvas.removeEventListener("mousedown", start); canvas.removeEventListener("mousemove", move); canvas.removeEventListener("mouseup", end);
        canvas.removeEventListener("touchstart", start); canvas.removeEventListener("touchmove", move); canvas.removeEventListener("touchend", end);
      };
    }
  }, [state, packetDone, packetStep]);

  const clearSig = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasSignature(false);
  };

  const savePacket = async () => {
    if (!hasSignature) return;
    setSavingPacket(true);
    try {
      const updates = {
        is_subcontractor: true,
        packet_status: "completed",
        packet_signed_name: form.name,
        packet_signed_at: new Date().toISOString(),
        packet_form_data: form,
        packet_signature_data: canvasRef.current?.toDataURL("image/png"),
        contact_name: form.name,
        company_name: form.company,
        address: form.address,
        phone: form.phone,
        email: form.email,
      };
      // Upload all WC files (use first as primary URL, rest stored in packet_form_data)
      if (wcFiles.length > 0) {
        const uploaded = await Promise.all(wcFiles.map(f => base44.integrations.Core.UploadFile({ file: f })));
        updates.workers_comp_url = uploaded[0].file_url;
        updates.workers_comp_expiry = wcExpiry;
        if (uploaded.length > 1) updates.packet_form_data = { ...updates.packet_form_data, wc_extra_urls: uploaded.slice(1).map(u => u.file_url) };
      }
      // Upload all GL files
      if (glFiles.length > 0) {
        const uploaded = await Promise.all(glFiles.map(f => base44.integrations.Core.UploadFile({ file: f })));
        updates.liability_ins_url = uploaded[0].file_url;
        updates.liability_ins_expiry = glExpiry;
        if (uploaded.length > 1) updates.packet_form_data = { ...updates.packet_form_data, gl_extra_urls: uploaded.slice(1).map(u => u.file_url) };
      }
      if (w9File) { updates.w9_url = (await base44.integrations.Core.UploadFile({ file: w9File })).file_url; }
      // Upload extra docs (licenses etc.)
      if (extraDocs.length > 0) {
        const uploaded = await Promise.all(extraDocs.map(d => base44.integrations.Core.UploadFile({ file: d.file }).then(r => ({ url: r.file_url, label: d.label }))));
        updates.packet_form_data = { ...updates.packet_form_data, extra_docs: uploaded };
      }

      const now = new Date();
      const wcExp = wcExpiry ? new Date(wcExpiry) : null;
      const glExp = glExpiry ? new Date(glExpiry) : null;
      const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      updates.insurance_status = (wcExp && wcExp < now) || (glExp && glExp < now) ? "expired" : (wcExp && wcExp < soon) || (glExp && glExp < soon) ? "expiring_soon" : wcExp && glExp ? "valid" : "pending";

      if (vendor) {
        await base44.entities.Vendor.update(vendor.id, updates);
      } else {
        const newVendor = await base44.entities.Vendor.create({ ...updates, active: true });
        setVendor(newVendor);
      }
      setPacketDone(true);
    } catch (err) {
      console.error(err);
    }
    setSavingPacket(false);
  };

  const handleSubmit = async () => {
    if (!bidAmount || isNaN(parseFloat(bidAmount))) return;
    setSubmitting(true);
    let pdfUrl = null;
    if (pdfFile) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });
      pdfUrl = file_url;
    }
    await base44.entities.SubBid.update(subBid.id, {
      bid_amount: parseFloat(bidAmount),
      bid_notes: bidNotes,
      quote_pdf_url: pdfUrl,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    });
    setState("submitted");
    setSubmitting(false);
  };

  const brandColor = company?.brand_color || "#E35235";
  const companyName = company?.company_name || "General Contractor";

  if (state === "loading") return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;

  if (state === "error") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-sm">
        <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <h1 className="text-xl font-bold text-gray-700 mb-2">Invalid or Expired Link</h1>
        <p className="text-gray-500 text-sm">This bid invitation link is invalid. Please contact the general contractor.</p>
      </div>
    </div>
  );

  if (state === "insurance_expired") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Insurance Expired</h1>
        <p className="text-gray-500 text-sm mb-4">Your insurance documents on file have expired. You cannot submit bids until updated certificates are received.</p>
        <p className="text-sm text-gray-500">Please contact <a href="mailto:coenconstruction@gmail.com" className="text-blue-600 underline">coenconstruction@gmail.com</a> to submit updated certificates.</p>
      </div>
    </div>
  );

  if (state === "submitted") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: brandColor + "20" }}>
          <CheckCircle className="w-8 h-8" style={{ color: brandColor }} />
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Bid Submitted!</h1>
        <p className="text-gray-500 text-sm">Your bid has been received by {companyName}. You'll be notified of their decision.</p>
        {subBid?.bid_amount && (
          <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">Your submitted bid</div>
            <div className="text-2xl font-bold" style={{ color: brandColor }}>${parseFloat(subBid.bid_amount).toLocaleString()}</div>
          </div>
        )}
      </div>
    </div>
  );

  const stepIdx = PACKET_STEPS.indexOf(packetStep);
  const stepLabel = (s) => ({ info: "Company Info", insurance: "Insurance", w9: "W-9", sign: "Sign", bid: "Submit Bid" }[s]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white py-5 px-6" style={{ background: "#1B2B3A" }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {company?.logo_url ? <img src={company.logo_url} alt={companyName} className="h-8 object-contain" /> : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: brandColor }}>{companyName.charAt(0)}</div>
            )}
            <div>
              <div className="font-bold text-sm">{companyName}</div>
              <div className="text-white/50 text-xs">Subcontractor Bid Portal</div>
            </div>
          </div>
          {packetDone && (
            <div className="flex items-center gap-1.5 bg-green-500/20 text-green-300 text-xs px-3 py-1.5 rounded-full">
              <Shield className="w-3 h-3" /> Documents Verified
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-5">
        {/* Project Info */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-gray-400" />
            <span className="font-semibold text-secondary">Project Details</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-gray-400 mb-0.5">Client / Project</div><div className="font-medium text-secondary">{project?.client_name}</div></div>
            <div><div className="text-xs text-gray-400 mb-0.5">Project Type</div><div className="font-medium text-secondary">{project?.project_type}</div></div>
            <div><div className="text-xs text-gray-400 mb-0.5">Location</div><div className="font-medium text-secondary">{project?.client_address}{project?.client_city ? `, ${project.client_city}` : ""}</div></div>
            <div><div className="text-xs text-gray-400 mb-0.5">Trade Requested</div><div className="font-bold" style={{ color: brandColor }}>{subBid?.trade}</div></div>
          </div>
        </div>

        {/* SoW: show structured items if available, fall back to raw scope text */}
        {subBid?.sow_trade_items?.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-secondary">Scope of Work — {subBid.trade}</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{subBid.sow_trade_items.length} items</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Item</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide w-20">Qty / Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {subBid.sow_trade_items.map((it, i) => (
                    <tr key={i} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                      <td className="py-2.5 px-3 font-semibold text-secondary align-top">{it.item}</td>
                      <td className="py-2.5 px-3 text-gray-600 align-top">{it.description || it.notes || '—'}</td>
                      <td className="py-2.5 px-3 text-gray-500 text-center align-top text-xs">{it.quantity ? `${it.quantity} ${it.unit || ''}`.trim() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : project?.scope_of_work ? (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3"><FileText className="w-4 h-4 text-gray-400" /><span className="font-semibold text-secondary">Scope of Work</span></div>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{project.scope_of_work}</div>
          </div>
        ) : null}

        {/* PACKET — Required before bidding */}
        {!packetDone ? (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-4 flex items-center gap-3">
              <Shield className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <div className="font-bold text-amber-800 text-sm">Required: Complete Subcontractor Packet</div>
                <div className="text-amber-700 text-xs mt-0.5">You must complete and sign the onboarding packet before submitting a bid.</div>
              </div>
            </div>

            {/* Progress steps */}
            <div className="flex gap-1 px-5 pt-4 pb-2 overflow-x-auto">
              {["info", "insurance", "w9", "sign"].map((s, i) => (
                <div key={s} className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setPacketStep(s)} className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-colors ${packetStep === s ? "bg-secondary text-white border-secondary" : i < PACKET_STEPS.indexOf(packetStep) ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                    {i < PACKET_STEPS.indexOf(packetStep) ? "✓ " : ""}{stepLabel(s)}
                  </button>
                  {i < 3 && <div className="w-4 h-px bg-gray-200" />}
                </div>
              ))}
            </div>

            <div className="p-5 space-y-4">
              {/* INFO */}
              {packetStep === "info" && (
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 border border-gray-200">
                    <p className="font-semibold text-secondary mb-1">Coen Construction LLC — Subcontractor Onboarding</p>
                    <p>Complete this packet to become an approved subcontractor. By signing you acknowledge the Subcontractor Agreement, Payment Terms (30 days), Insurance Requirements, and Clean-up/Conduct obligations.</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[["name", "Legal Name *"], ["company", "Company Name *"], ["address", "Address *"], ["phone", "Phone *"], ["principal_contact", "Principal Contact"], ["alt_phone", "Alt / Emergency Phone"], ["tax_id", "Tax ID / EIN"]].map(([f, label]) => (
                      <div key={f}><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">{label}</label><Input value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} /></div>
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
                  <Button onClick={() => setPacketStep("insurance")} className="w-full" style={{ background: brandColor }}>Next: Insurance Documents →</Button>
                </div>
              )}

              {/* INSURANCE */}
              {packetStep === "insurance" && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
                    <p className="font-semibold mb-1">Required Insurance</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Workers Compensation — Statutory Limits, $500K Employers Liability</li>
                      <li>General Liability — $2M Aggregate, $1M Each Occurrence</li>
                      <li>Coen Construction LLC must be named as Additional Insured</li>
                    </ul>
                  </div>

                  {/* Workers Comp */}
                  <MultiFileUpload
                    label="Workers Compensation Certificate"
                    icon={<Shield className="w-4 h-4 text-primary" />}
                    files={wcFiles}
                    onAdd={(newFiles) => setWcFiles(prev => [...prev, ...newFiles])}
                    onRemove={(i) => setWcFiles(prev => prev.filter((_, idx) => idx !== i))}
                    dragKey="wc"
                    dragOver={dragOver}
                    setDragOver={setDragOver}
                    accept=".pdf,image/*"
                    hint="PDF or image — you can attach multiple pages"
                    extraField={
                      <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Expiration Date</label><Input type="date" value={wcExpiry} onChange={e => setWcExpiry(e.target.value)} /></div>
                    }
                  />

                  {/* General Liability */}
                  <MultiFileUpload
                    label="General Liability Certificate"
                    icon={<Shield className="w-4 h-4 text-primary" />}
                    files={glFiles}
                    onAdd={(newFiles) => setGlFiles(prev => [...prev, ...newFiles])}
                    onRemove={(i) => setGlFiles(prev => prev.filter((_, idx) => idx !== i))}
                    dragKey="gl"
                    dragOver={dragOver}
                    setDragOver={setDragOver}
                    accept=".pdf,image/*"
                    hint="PDF or image — you can attach multiple pages"
                    extraField={
                      <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Expiration Date</label><Input type="date" value={glExpiry} onChange={e => setGlExpiry(e.target.value)} /></div>
                    }
                  />

                  {/* Extra docs: licenses, certs, etc. */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-secondary text-sm">Additional Documents</span>
                      <span className="text-xs text-gray-400">(licenses, other certs — optional)</span>
                    </div>
                    {extraDocs.map((doc, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <File className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <Input
                          value={doc.label}
                          onChange={e => setExtraDocs(prev => prev.map((d, idx) => idx === i ? { ...d, label: e.target.value } : d))}
                          placeholder="Label (e.g. Contractor License)"
                          className="flex-1 h-7 text-xs border-0 bg-transparent focus:ring-0 px-1"
                        />
                        <span className="text-xs text-gray-500 truncate max-w-[120px]">{doc.file.name}</span>
                        <button onClick={() => setExtraDocs(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <label
                      className={`flex items-center gap-3 border border-dashed rounded-xl px-4 py-3 cursor-pointer transition-colors ${dragOver === "extra" ? "border-primary bg-primary/5" : "border-gray-300 hover:bg-gray-50"}`}
                      onDragOver={e => { e.preventDefault(); setDragOver("extra"); }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={e => {
                        e.preventDefault(); setDragOver(null);
                        const newFiles = Array.from(e.dataTransfer.files);
                        setExtraDocs(prev => [...prev, ...newFiles.map(f => ({ file: f, label: "" }))]);
                      }}
                    >
                      <Plus className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-sm text-gray-600 font-medium">Add license or certificate</div>
                        <div className="text-xs text-gray-400">Drag & drop or click — any file type</div>
                      </div>
                      <input type="file" multiple onChange={e => {
                        const newFiles = Array.from(e.target.files);
                        setExtraDocs(prev => [...prev, ...newFiles.map(f => ({ file: f, label: "" }))]);
                      }} className="hidden" />
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setPacketStep("info")} className="flex-1">← Back</Button>
                    <Button onClick={() => setPacketStep("w9")} className="flex-1 bg-secondary text-white">Next: W-9 →</Button>
                  </div>
                </div>
              )}

              {/* W-9 */}
              {packetStep === "w9" && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                    <p className="font-semibold mb-1">W-9 Required</p>
                    <p>A completed W-9 with your Tax ID is required before any payments can be issued. Ensure your entity type is checked and TIN matches your legal name.</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-secondary text-sm">W-9 Form</span>
                      {w9File && <CheckCircle className="w-4 h-4 text-green-500" />}
                    </div>
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
                    <Button variant="outline" onClick={() => setPacketStep("insurance")} className="flex-1">← Back</Button>
                    <Button onClick={() => setPacketStep("sign")} className="flex-1 bg-secondary text-white">Next: Sign →</Button>
                  </div>
                </div>
              )}

              {/* SIGN */}
              {packetStep === "sign" && (
                <div className="space-y-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 leading-relaxed max-h-40 overflow-y-auto">
                    <p className="font-semibold text-secondary text-sm mb-2">Subcontractor Agreement Acknowledgment</p>
                    <p>By signing below, <strong>{form.name || "the undersigned"}</strong> on behalf of <strong>{form.company}</strong> agrees to the Coen Construction LLC Subcontractor Agreement including: General Performance, Insurance requirements with Coen Construction as Additional Insured, Payment terms (30 days from approval), Clean-up obligations, Hold Harmless provisions, Health & Safety compliance, and all other terms. This agreement is in force for 15 years from signing date.</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2"><PenLine className="w-4 h-4 text-primary" /><span className="text-sm font-semibold text-secondary">Draw Your Signature</span></div>
                      <button onClick={clearSig} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"><RotateCcw className="w-3 h-3" /> Clear</button>
                    </div>
                    <canvas ref={canvasRef} className="w-full border border-gray-200 rounded-lg bg-gray-50 cursor-crosshair touch-none" style={{ height: "160px" }} />
                    {!hasSignature && <p className="text-xs text-gray-400 text-center mt-1">Use your mouse or finger to sign</p>}
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>Name: {form.name}</span>
                      <span>Date: {new Date().toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setPacketStep("w9")} className="flex-1">← Back</Button>
                    <Button onClick={savePacket} disabled={!hasSignature || savingPacket} className="flex-1 text-white gap-2" style={{ background: brandColor }}>
                      {savingPacket ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4" /> Submit Packet & Continue</>}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* BID FORM — shown after packet is complete */
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-green-50 border-b border-green-200 px-5 py-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-green-800 text-sm font-semibold">Subcontractor packet complete — you may now submit your bid</span>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-secondary">Submit Your Bid — {subBid?.trade}</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Your Bid Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                  <Input type="number" value={bidAmount} onChange={e => setBidAmount(e.target.value)} placeholder="0.00" className="pl-7 text-lg font-bold" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Notes / Inclusions / Exclusions</label>
                <textarea value={bidNotes} onChange={e => setBidNotes(e.target.value)} placeholder="Describe what's included/excluded, timeline, payment terms..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-28 resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Upload Quote PDF (Optional)</label>
                <label className="flex items-center gap-3 border border-dashed border-gray-300 rounded-xl px-4 py-4 cursor-pointer hover:bg-gray-50">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-600 font-medium">{pdfFile ? pdfFile.name : "Click to upload PDF"}</div>
                    <div className="text-xs text-gray-400">PDF, Word, or image files</div>
                  </div>
                  <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={e => setPdfFile(e.target.files[0])} className="hidden" />
                </label>
              </div>
              <Button onClick={handleSubmit} disabled={!bidAmount || submitting} className="w-full py-3 text-base font-bold gap-2" style={{ background: brandColor }}>
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><CheckCircle className="w-4 h-4" /> Submit Bid</>}
              </Button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          This portal is secured with a unique link. Your submission is sent directly to {companyName}.
        </p>
      </div>
    </div>
  );
}