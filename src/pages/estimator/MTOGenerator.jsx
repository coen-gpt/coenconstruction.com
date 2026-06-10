import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import MTOProjectDetail from "../../components/mto/MTOProjectDetail";
import { Upload, X, FileText, Sparkles, Download, Mail, ChevronDown, ChevronUp, Send, Loader2, CheckSquare, Square, FolderOpen, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jsPDF } from "jspdf";

const TRADE_COLORS = {
  "Lumber & Framing": "bg-amber-50 border-amber-200 text-amber-800",
  "Concrete & Masonry": "bg-stone-50 border-stone-200 text-stone-800",
  "Electrical": "bg-yellow-50 border-yellow-200 text-yellow-800",
  "Plumbing": "bg-blue-50 border-blue-200 text-blue-800",
  "HVAC": "bg-cyan-50 border-cyan-200 text-cyan-800",
  "Roofing": "bg-red-50 border-red-200 text-red-800",
  "Flooring": "bg-emerald-50 border-emerald-200 text-emerald-800",
  "Insulation": "bg-orange-50 border-orange-200 text-orange-800",
  "Drywall & Finishes": "bg-purple-50 border-purple-200 text-purple-800",
  "Hardware & Fasteners": "bg-gray-50 border-gray-200 text-gray-800",
  "Paint & Coatings": "bg-pink-50 border-pink-200 text-pink-800",
  "Doors & Windows": "bg-indigo-50 border-indigo-200 text-indigo-800",
  "Cabinetry & Millwork": "bg-lime-50 border-lime-200 text-lime-800",
  "Deck & Outdoor": "bg-teal-50 border-teal-200 text-teal-800",
  "General Supply": "bg-slate-50 border-slate-200 text-slate-800",
};

function getTradeColor(trade) {
  return TRADE_COLORS[trade] || "bg-slate-50 border-slate-200 text-slate-800";
}

export default function MTOGenerator() {
  const qc = useQueryClient();
  const [uploads, setUploads] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [mto, setMto] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [savedRecordId, setSavedRecordId] = useState(null);
  const [expandedTrades, setExpandedTrades] = useState({});
  const [selectedItems, setSelectedItems] = useState({}); // { tradeName: Set<idx> }
  const [emailModal, setEmailModal] = useState(null); // { trade, items } or 'all'
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const fileRef = useRef();

  const [fromEmail, setFromEmail] = useState("quotes@coenconstruction.com");

  const { data: companyProfiles = [] } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => base44.entities.CompanyProfile.list(),
  });

  const companyProfile = companyProfiles[0];

  // Pre-fill reply email once the company profile loads
  useEffect(() => {
    if (companyProfile?.mto_reply_email) setFromEmail(companyProfile.mto_reply_email);
  }, [companyProfile]);

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => adminEntities.Vendor.list(),
  });

  const { data: savedMTOs = [] } = useQuery({
    queryKey: ["savedMTOs"],
    queryFn: () => base44.entities.SavedMTO.list("-created_date", 50),
  });

  const handleFiles = async (files) => {
    setUploading(true);
    const results = [];
    for (const file of Array.from(files)) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      results.push({ name: file.name, url: file_url, type: file.type });
    }
    setUploads(prev => [...prev, ...results]);
    setUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const removeUpload = (i) => setUploads(prev => prev.filter((_, idx) => idx !== i));

  const generate = async () => {
    if (uploads.length === 0 && !notes.trim()) return;
    setGenerating(true);
    setMto(null);
    try {
      const res = await base44.functions.invoke("generateMTOFromUploads", {
        uploads,
        notes,
        projectName,
      });
      const mtoData = res.data.mto;
      setMto(mtoData);
      const initial = {};
      const initSelected = {};
      (mtoData?.trades || []).forEach(t => {
        initial[t.trade] = true;
        initSelected[t.trade] = new Set(t.items.map((_, i) => i));
      });
      setExpandedTrades(initial);
      setSelectedItems(initSelected);

      // Auto-save
      const totalCost = (mtoData?.trades || []).reduce((s, t) => s + t.items.reduce((ss, i) => ss + (i.total_cost || 0), 0), 0);
      const totalItems = (mtoData?.trades || []).reduce((s, t) => s + t.items.length, 0);
      const saved = await base44.entities.SavedMTO.create({
        title: projectName || `MTO ${new Date().toLocaleDateString()}`,
        notes,
        uploads,
        mto: mtoData,
        total_cost: totalCost,
        total_items: totalItems,
        from_email: fromEmail,
      });
      setSavedRecordId(saved.id);
      qc.invalidateQueries({ queryKey: ["savedMTOs"] });
    } finally {
      setGenerating(false);
    }
  };

  const toggleTrade = (trade) => setExpandedTrades(prev => ({ ...prev, [trade]: !prev[trade] }));

  const toggleItem = (trade, idx) => {
    setSelectedItems(prev => {
      const set = new Set(prev[trade] || []);
      if (set.has(idx)) set.delete(idx); else set.add(idx);
      return { ...prev, [trade]: set };
    });
  };

  const toggleAllInTrade = (trade, items) => {
    setSelectedItems(prev => {
      const set = prev[trade] || new Set();
      const allSelected = items.every((_, i) => set.has(i));
      return { ...prev, [trade]: allSelected ? new Set() : new Set(items.map((_, i) => i)) };
    });
  };

  const getSelectedTrades = () => {
    return (mto?.trades || []).map(t => ({
      ...t,
      items: t.items.filter((_, i) => (selectedItems[t.trade] || new Set()).has(i))
    })).filter(t => t.items.length > 0);
  };

  const totalSelectedItems = Object.values(selectedItems).reduce((s, set) => s + set.size, 0);

  const totalItems = mto?.trades?.reduce((s, t) => s + t.items.length, 0) || 0;
  const totalCost = mto?.trades?.reduce((s, t) => s + t.items.reduce((ss, i) => ss + (i.total_cost || 0), 0), 0) || 0;

  const buildPDF = (trades, companyProfile, logoData) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210, margin = 15, cW = pageW - margin * 2;
    let y = margin;

    doc.setFillColor(27, 43, 58);
    doc.rect(0, 0, pageW, 35, "F");
    if (logoData) {
      try { doc.addImage(logoData, "JPEG", margin, 5, 26, 22); } catch (_) {}
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text(companyProfile?.company_name || "Coen Construction", margin + 31, 13);
      doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
      const addr = [companyProfile?.address, companyProfile?.city, companyProfile?.state, companyProfile?.zipcode].filter(Boolean).join(", ");
      if (addr) doc.text(addr, margin + 31, 20);
      if (companyProfile?.phone) doc.text(companyProfile.phone, margin + 31, 27);
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15); doc.setFont("helvetica", "bold");
      doc.text(companyProfile?.company_name || "Coen Construction", margin, 13);
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      const addr = [companyProfile?.address, companyProfile?.city, companyProfile?.state].filter(Boolean).join(", ");
      if (addr) doc.text(addr, margin, 21);
      if (companyProfile?.phone) doc.text(companyProfile.phone, margin, 28);
    }
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.setTextColor(227, 82, 53);
    doc.text("MATERIAL TAKE-OFF", pageW - margin, 13, { align: "right" });
    doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageW - margin, 21, { align: "right" });
    if (companyProfile?.license_number) doc.text(`Lic #${companyProfile.license_number}`, pageW - margin, 28, { align: "right" });
    y = 43;

    if (projectName) {
      doc.setTextColor(51, 51, 51); doc.setFontSize(12); doc.setFont("helvetica", "bold");
      doc.text(`Project: ${projectName}`, margin, y); y += 10;
    }

    const pdfTotal = trades.reduce((s, t) => s + t.items.reduce((ss, i) => ss + (i.total_cost || 0), 0), 0);
    const pdfItemCount = trades.reduce((s, t) => s + t.items.length, 0);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Total Items: ${pdfItemCount}   |   Estimated Total: $${pdfTotal.toLocaleString()}`, margin, y); y += 8;

    trades.forEach(trade => {
      if (y > 260) { doc.addPage(); y = margin; }
      doc.setFillColor(227, 82, 53);
      doc.rect(margin, y, cW, 8, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text(trade.trade.toUpperCase(), margin + 4, y + 5.5);
      y += 10;

      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, cW, 6, "F");
      doc.setTextColor(80, 80, 80); doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("MATERIAL", margin + 2, y + 4);
      doc.text("DESC", margin + 60, y + 4);
      doc.text("QTY", margin + 110, y + 4);
      doc.text("UNIT", margin + 125, y + 4);
      doc.text("UNIT $", margin + 140, y + 4);
      doc.text("TOTAL", margin + 160, y + 4);
      doc.text("SUPPLIER", margin + 178, y + 4);
      y += 7;

      trade.items.forEach((item, idx) => {
        if (y > 272) { doc.addPage(); y = margin; }
        if (idx % 2 === 0) { doc.setFillColor(252, 252, 252); doc.rect(margin, y, cW, 6.5, "F"); }
        doc.setTextColor(40, 40, 40); doc.setFontSize(7); doc.setFont("helvetica", "normal");
        const name = doc.splitTextToSize(item.material_name || "", 55);
        doc.text(name[0], margin + 2, y + 4.5);
        const desc = doc.splitTextToSize(item.description || "", 48);
        doc.text(desc[0], margin + 60, y + 4.5);
        doc.text(String(item.quantity || ""), margin + 110, y + 4.5);
        doc.text(item.unit || "", margin + 125, y + 4.5);
        doc.text(item.unit_cost ? `$${Number(item.unit_cost).toLocaleString()}` : "", margin + 140, y + 4.5);
        doc.text(item.total_cost ? `$${Number(item.total_cost).toLocaleString()}` : "", margin + 160, y + 4.5);
        doc.text(doc.splitTextToSize(item.suggested_supplier || "", 28)[0], margin + 178, y + 4.5);
        y += 7;
      });

      const tradeCost = trade.items.reduce((s, i) => s + (i.total_cost || 0), 0);
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y, cW, 6, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
      doc.setTextColor(227, 82, 53);
      doc.text(`Trade Subtotal: $${tradeCost.toLocaleString()}`, pageW - margin - 2, y + 4, { align: "right" });
      y += 10;
    });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFillColor(27, 43, 58);
      doc.rect(0, 290, pageW, 10, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(7);
      const n = companyProfile?.company_name || "Coen Construction";
      const a = [companyProfile?.address, companyProfile?.city, companyProfile?.state, companyProfile?.zipcode].filter(Boolean).join(", ") || "387 Page Street Ste 10B, Stoughton, MA 02072";
      const p = companyProfile?.phone || "(617) 857-COEN";
      doc.text(`${n} · ${a} · ${p}`, pageW / 2, 296, { align: "center" });
      doc.text(`Page ${i} of ${pages}`, pageW - margin, 296, { align: "right" });
    }

    return doc;
  };

  const downloadPDF = async (savedId) => {
    const profiles = await base44.entities.CompanyProfile.list();
    const cp = profiles[0] || null;
    let logoData = null;
    if (cp?.logo_url) {
      try {
        const res = await fetch(cp.logo_url);
        const blob = await res.blob();
        logoData = await new Promise(resolve => { const r = new FileReader(); r.onloadend = () => resolve(r.result); r.readAsDataURL(blob); });
      } catch (_) {}
    }
    const doc = buildPDF(getSelectedTrades(), cp, logoData);
    doc.save(`MTO_${projectName || "Project"}_${new Date().toISOString().slice(0, 10)}.pdf`);
    if (savedId) {
      await base44.entities.SavedMTO.update(savedId, { exported_pdf: true });
      qc.invalidateQueries({ queryKey: ["savedMTOs"] });
    }
  };

  const deleteRecord = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Delete this saved MTO?")) return;
    await base44.entities.SavedMTO.delete(id);
    qc.invalidateQueries({ queryKey: ["savedMTOs"] });
  };

  const applyFromEmail = async () => {
    if (!savedRecordId) return;
    await base44.entities.SavedMTO.update(savedRecordId, { from_email: fromEmail });
    qc.invalidateQueries({ queryKey: ["savedMTOs"] });
  };

  const openEmailModal = (trade) => {
    const ref = savedRecordId ? ` [MTO-REF:${savedRecordId}]` : '';
    const subj = trade === "all"
      ? `Material Take-Off — ${projectName || "Project"}${ref}`
      : `Material Take-Off: ${trade} — ${projectName || "Project"}${ref}`;
    setEmailForm({ to: "", subject: subj, message: `Please find the attached material take-off for your review.\n\nProject: ${projectName || "TBD"}\n\nPlease provide pricing and availability at your earliest convenience.\n\nThank you,\nCoen Construction` });
    setEmailModal(trade);
  };

  const sendEmail = async () => {
    if (!emailForm.to.trim()) return;
    setSending(true);
    try {
      const allTrades = emailModal === "all" ? getSelectedTrades() : mto.trades.filter(t => t.trade === emailModal).map(t => ({ ...t, items: t.items.filter((_, i) => (selectedItems[t.trade] || new Set()).has(i)) }));
      const trades = allTrades.filter(t => t.items.length > 0);
      const itemsHtml = trades.map(trade => `
        <h3 style="color:#E35235;border-bottom:2px solid #E35235;padding-bottom:4px;margin-top:20px;">${trade.trade}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:6px 10px;text-align:left;">Material</th>
            <th style="padding:6px 10px;text-align:left;">Description</th>
            <th style="padding:6px;text-align:right;">Qty</th>
            <th style="padding:6px;text-align:left;">Unit</th>
            <th style="padding:6px;text-align:left;">Supplier</th>
          </tr></thead>
          <tbody>${trade.items.map((item, i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'};border-bottom:1px solid #e5e7eb;">
              <td style="padding:6px 10px;font-weight:600;">${item.material_name}</td>
              <td style="padding:6px 10px;color:#555;">${item.description || ''}</td>
              <td style="padding:6px;text-align:right;">${item.quantity} ${item.unit || ''}</td>
              <td style="padding:6px;">${item.unit || ''}</td>
              <td style="padding:6px;color:#6b7280;">${item.suggested_supplier || ''}</td>
            </tr>`).join('')}
          </tbody>
        </table>`).join('');

      const body = `
        <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
          <div style="background:#1B2B3A;padding:24px 32px;border-radius:8px 8px 0 0;">
            <h1 style="color:#fff;margin:0;font-size:20px;">Material Take-Off Request</h1>
            <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px;">Coen Construction</p>
          </div>
          <div style="padding:24px 32px;border:1px solid #e5e7eb;border-top:none;">
            <p style="white-space:pre-line;font-size:14px;color:#374151;">${emailForm.message}</p>
            ${itemsHtml}
          </div>
          <div style="background:#f3f4f6;padding:14px 32px;border-radius:0 0 8px 8px;text-align:center;">
            <p style="font-size:11px;color:#9ca3af;margin:0;">Coen Construction · 387 Page Street Ste 10B, Stoughton, MA 02072 · (617) 857-COEN</p>
          </div>
        </div>`;

      await base44.functions.invoke('sendMTOEmail', {
        to: emailForm.to,
        subject: emailForm.subject,
        body,
        from_email: fromEmail,
      });
      setEmailModal(null);
      alert("Email sent successfully!");
      // Track on latest saved record
      const latest = savedMTOs.find(r => r.title === (projectName || `MTO ${new Date().toLocaleDateString()}`));
      if (latest) {
        const tradeName = emailModal === "all" ? trades.map(t => t.trade) : [emailModal];
        const updated = [...new Set([...(latest.emailed_trades || []), ...tradeName])];
        await base44.entities.SavedMTO.update(latest.id, { emailed_trades: updated });
        qc.invalidateQueries({ queryKey: ["savedMTOs"] });
      }
    } finally {
      setSending(false);
    }
  };

  const filteredSavedMTOs = savedMTOs.filter(r =>
    r.title?.toLowerCase().includes(projectSearch.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {selectedRecordId && (() => {
        const liveRecord = savedMTOs.find(r => r.id === selectedRecordId);
        return liveRecord ? <MTOProjectDetail record={liveRecord} vendors={vendors} onClose={() => setSelectedRecordId(null)} /> : null;
      })()}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">Material Take-Off Generator</h1>
        <p className="text-gray-500 text-sm mt-1">Upload drawings, SOW, estimates, or proposals — AI generates a complete MTO broken down by trade.</p>
      </div>

      {/* Input Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Upload Zone */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer bg-white"
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current.click()}
          >
            <input ref={fileRef} type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.docx,.doc,.txt" />
            {uploading ? (
               <div className="flex flex-col items-center gap-2 text-gray-500">
                 <Loader2 className="w-8 h-8 animate-spin text-primary" />
                 <span className="text-sm">Uploading files…</span>
               </div>
             ) : (
               <div className="flex flex-col items-center gap-2 text-gray-500">
                 <Upload className="w-8 h-8 text-gray-400" />
                 <p className="font-medium text-gray-700">Drop files here or click to upload</p>
                 <p className="text-xs text-gray-400">Supports PDF, images, Excel, Word, CSV — drawings, SOW, estimates, proposals</p>
               </div>
             )}
          </div>

          {uploads.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {uploads.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                  <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-gray-700 max-w-[180px] truncate">{f.name}</span>
                  <button onClick={() => removeUpload(i)} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Additional Notes / Scope Details</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Paste scope of work, project description, special requirements, dimensions, or any details not in the uploaded files…"
              rows={5}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-secondary resize-none"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Name</label>
            <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. Smith Home Addition" />
          </div>


          <div className="bg-secondary/5 border border-secondary/15 rounded-xl p-4 text-sm text-gray-600 space-y-2">
            <p className="font-semibold text-secondary text-xs uppercase tracking-wide">What AI will generate</p>
            <ul className="space-y-1 text-xs">
              <li>. Full material list by trade / supply type</li>
              <li>. Quantities, units, unit costs & totals</li>
              <li>. Suggested suppliers per material</li>
              <li>. SKU notes where applicable</li>
              <li>. Downloadable PDF & email to vendor</li>
            </ul>
          </div>

          <Button
            className="w-full gap-2"
            size="lg"
            onClick={generate}
            disabled={generating || (uploads.length === 0 && !notes.trim())}
          >
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating MTO…</> : <><Sparkles className="w-4 h-4" /> Generate Take-Off</>}
          </Button>
        </div>
      </div>

      {/* MTO Results */}
      {generating && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-gray-500 text-sm">AI is reading your documents and building the material list…</p>
        </div>
      )}

      {mto && !generating && (
        <div className="space-y-4">
           {/* Summary bar */}
           <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-4 items-center justify-between">
             <div className="flex gap-6">
               <div>
                 <p className="text-xs text-gray-400">Total Line Items</p>
                 <p className="text-xl font-bold text-secondary">{totalItems}</p>
               </div>
               <div>
                 <p className="text-xs text-gray-400">Estimated Cost</p>
                 <p className="text-xl font-bold text-primary">${totalCost.toLocaleString()}</p>
               </div>
               <div>
                 <p className="text-xs text-gray-400">Trades</p>
                 <p className="text-xl font-bold text-secondary">{mto.trades?.length}</p>
               </div>
             </div>
            <div className="flex flex-col items-end gap-2">
              {totalSelectedItems < totalItems && (
                <p className="text-xs text-primary font-medium">{totalSelectedItems} of {totalItems} items selected</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadPDF}>
                  <Download className="w-3.5 h-3.5" /> {totalSelectedItems < totalItems ? `PDF (${totalSelectedItems})` : "Download PDF"}
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => openEmailModal("all")}>
                  <Mail className="w-3.5 h-3.5" /> {totalSelectedItems < totalItems ? `Email (${totalSelectedItems})` : "Email All Trades"}
                </Button>
              </div>
            </div>
          </div>

          {/* Trade sections */}
          {mto.trades?.map(trade => {
            const tradeCost = trade.items.reduce((s, i) => s + (i.total_cost || 0), 0);
            const colorClass = getTradeColor(trade.trade);
            return (
              <div key={trade.trade} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleTrade(trade.trade)}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={e => { e.stopPropagation(); toggleAllInTrade(trade.trade, trade.items); }}
                      className="text-gray-400 hover:text-primary transition-colors shrink-0"
                      title="Toggle all items in this trade"
                    >
                      {trade.items.every((_, i) => (selectedItems[trade.trade] || new Set()).has(i))
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : trade.items.some((_, i) => (selectedItems[trade.trade] || new Set()).has(i))
                          ? <CheckSquare className="w-4 h-4 text-primary/50" />
                          : <Square className="w-4 h-4" />}
                    </button>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${colorClass}`}>{trade.trade}</span>
                    <span className="text-sm text-gray-500">
                      {(selectedItems[trade.trade] || new Set()).size}/{trade.items.length} items
                    </span>
                    <span className="text-sm font-semibold text-gray-700">${tradeCost.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost" size="sm" className="gap-1.5 text-xs h-7 px-2"
                      onClick={e => { e.stopPropagation(); openEmailModal(trade.trade); }}
                    >
                      <Send className="w-3 h-3" /> Email
                    </Button>
                    {expandedTrades[trade.trade] ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {expandedTrades[trade.trade] && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                           <tr>
                                <th className="px-3 py-2.5 w-8"></th>
                             <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Material</th>
                             <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Description</th>
                             <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">Qty</th>
                             <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Unit</th>
                             <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">Unit Cost</th>
                             <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">Total</th>
                             <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Supplier</th>
                             <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">SKU / Notes</th>
                           </tr>
                         </thead>
                      <tbody>
                        {trade.items.map((item, idx) => {
                          const isChecked = (selectedItems[trade.trade] || new Set()).has(idx);
                          return (
                         <tr key={idx} className={`border-b border-gray-50 ${!isChecked ? 'opacity-40' : idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                             <td className="px-3 py-2.5">
                               <button onClick={() => toggleItem(trade.trade, idx)} className="text-gray-400 hover:text-primary transition-colors">
                                 {isChecked ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                               </button>
                             </td>
                             <td className="px-4 py-2.5 font-medium text-gray-900">{item.material_name}</td>
                              <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[200px]">{item.description}</td>
                              <td className="px-3 py-2.5 text-right font-medium">{item.quantity}</td>
                              <td className="px-3 py-2.5 text-gray-500">{item.unit}</td>
                              <td className="px-3 py-2.5 text-right text-gray-600">{item.unit_cost ? `$${Number(item.unit_cost).toLocaleString()}` : "—"}</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{item.total_cost ? `$${Number(item.total_cost).toLocaleString()}` : "—"}</td>
                              <td className="px-3 py-2.5 text-xs text-gray-500">{item.suggested_supplier}</td>
                              <td className="px-3 py-2.5 text-xs text-gray-400">{item.sku || item.notes}</td>
                            </tr>
                            );
                            })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Saved MTOs */}
      {savedMTOs.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-secondary">Saved MTO Projects</h2>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{savedMTOs.length}</span>
            </div>
            <div className="relative w-56">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input
                value={projectSearch}
                onChange={e => setProjectSearch(e.target.value)}
                placeholder="Search projects…"
                className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-secondary"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSavedMTOs.map(r => (
              <div key={r.id}
                className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-primary hover:shadow-sm transition-all group"
                onClick={() => setSelectedRecordId(r.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-secondary truncate">{r.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(r.created_date).toLocaleDateString()}</p>
                  </div>
                  <button onClick={e => deleteRecord(r.id, e)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-3 mt-3 text-xs">
                  <span className="text-gray-500">{r.total_items} items</span>
                  <span className="font-semibold text-primary">${(r.total_cost || 0).toLocaleString()}</span>
                  <span className="text-gray-400">{(r.mto?.trades || []).length} trades</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {r.exported_pdf && (
                    <span className="text-[10px] bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Download className="w-2.5 h-2.5" /> PDF
                    </span>
                  )}
                  {(r.emailed_trades || []).length > 0 && (
                    <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Mail className="w-2.5 h-2.5" /> {(r.emailed_trades || []).length} trade{(r.emailed_trades || []).length > 1 ? 's' : ''} emailed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-secondary">
                {emailModal === "all" ? "Email Full MTO to Vendor" : `Email ${emailModal} MTO`}
              </h3>
              <button onClick={() => setEmailModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Vendor Email (BCC)</label>
                <Input value={emailForm.to} onChange={e => setEmailForm(f => ({ ...f, to: e.target.value }))} placeholder="vendor@supplyhouseexample.com" />
                <p className="text-xs text-gray-400 mt-1">Recipient will be BCC'd for privacy.</p>
                </div>
                {vendors.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Or select from vendors</label>
                  <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                    {vendors.filter(v => v.active && v.email).map(v => (
                      <button
                        key={v.id}
                        onClick={() => setEmailForm(f => ({ ...f, to: v.email }))}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${emailForm.to === v.email ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'}`}
                      >
                        {v.company_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                <Input value={emailForm.subject} onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
                <textarea
                  value={emailForm.message}
                  onChange={e => setEmailForm(f => ({ ...f, message: e.target.value }))}
                  rows={5}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-secondary resize-none"
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEmailModal(null)}>Cancel</Button>
              <Button onClick={sendEmail} disabled={!emailForm.to.trim() || sending} className="gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Sending…" : "Send Email"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}