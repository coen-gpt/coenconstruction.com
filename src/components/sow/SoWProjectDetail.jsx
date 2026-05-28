import { useState } from "react";
import { X, FileText, Download, Mail, Send, Loader2, ExternalLink, ChevronDown, ChevronUp, DollarSign, Edit2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { jsPDF } from "jspdf";
import { useQueryClient } from "@tanstack/react-query";

const TRADE_COLORS = {
  "Framing & Rough Carpentry": "bg-amber-50 border-amber-200 text-amber-800",
  "Concrete & Foundation": "bg-stone-50 border-stone-200 text-stone-800",
  "Electrical": "bg-yellow-50 border-yellow-200 text-yellow-800",
  "Plumbing": "bg-blue-50 border-blue-200 text-blue-800",
  "HVAC & Mechanical": "bg-cyan-50 border-cyan-200 text-cyan-800",
  "Roofing": "bg-red-50 border-red-200 text-red-800",
  "Tile & Flooring": "bg-emerald-50 border-emerald-200 text-emerald-800",
  "Insulation": "bg-orange-50 border-orange-200 text-orange-800",
  "Drywall & Plaster": "bg-purple-50 border-purple-200 text-purple-800",
  "General Conditions": "bg-gray-50 border-gray-200 text-gray-800",
  "Painting & Coatings": "bg-pink-50 border-pink-200 text-pink-800",
  "Windows & Doors": "bg-indigo-50 border-indigo-200 text-indigo-800",
  "Cabinetry & Millwork": "bg-lime-50 border-lime-200 text-lime-800",
  "Decking & Outdoor": "bg-teal-50 border-teal-200 text-teal-800",
  "Demolition & Removal": "bg-slate-50 border-slate-200 text-slate-800",
};
function getTradeColor(t) { return TRADE_COLORS[t] || "bg-slate-50 border-slate-200 text-slate-800"; }

function buildPDF(trades, record, companyProfile, logoData) {
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
  doc.text("SCOPE OF WORK", pageW - margin, 13, { align: "right" });
  doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date(record.created_date).toLocaleDateString()}`, pageW - margin, 21, { align: "right" });
  if (companyProfile?.license_number) doc.text(`Lic #${companyProfile.license_number}`, pageW - margin, 28, { align: "right" });
  y = 43;

  doc.setTextColor(51, 51, 51); doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text(`Project: ${record.title}`, margin, y); y += 8;
  const totalItems = trades.reduce((s, t) => s + t.scope_items.length, 0);
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
  doc.text(`${totalItems} scope items across ${trades.length} trade${trades.length !== 1 ? "s" : ""}`, margin, y); y += 8;

  trades.forEach(trade => {
    if (y > 265) { doc.addPage(); y = margin; }
    doc.setFillColor(227, 82, 53); doc.rect(margin, y, cW, 8, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text(trade.trade.toUpperCase(), margin + 4, y + 5.5); y += 11;

    trade.scope_items.forEach((item, idx) => {
      if (y > 272) { doc.addPage(); y = margin; }
      const taskLines = doc.splitTextToSize(`${idx + 1}. ${item.task}`, cW - 6);
      const descLines = item.description ? doc.splitTextToSize(item.description, cW - 10) : [];
      const specLine = item.specification ? doc.splitTextToSize(`Spec: ${item.specification}`, cW - 10) : [];
      const noteLine = item.notes ? doc.splitTextToSize(`Note: ${item.notes}`, cW - 10) : [];
      const h = taskLines.length * 4.5 + descLines.length * 4 + specLine.length * 3.5 + noteLine.length * 3.5 + 6;
      if (idx % 2 === 0) { doc.setFillColor(251, 251, 251); doc.rect(margin, y, cW, h, "F"); }
      doc.setTextColor(30, 30, 30); doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text(taskLines, margin + 3, y + 4.5);
      let iy = y + taskLines.length * 4.5 + 1;
      if (descLines.length) { doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(70, 70, 70); doc.text(descLines.slice(0, 2), margin + 5, iy + 3); iy += descLines.slice(0, 2).length * 4 + 1; }
      if (specLine.length) { doc.setFontSize(7); doc.setFont("helvetica", "italic"); doc.setTextColor(100, 100, 100); doc.text(specLine[0], margin + 5, iy + 2.5); iy += 3.5; }
      if (noteLine.length) { doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(130, 130, 130); doc.text(noteLine[0], margin + 5, iy + 2.5); }
      y += h + 1;
    });
    y += 4;
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(27, 43, 58); doc.rect(0, 290, pageW, 10, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(7);
    const n = companyProfile?.company_name || "Coen Construction";
    const a = [companyProfile?.address, companyProfile?.city, companyProfile?.state, companyProfile?.zipcode].filter(Boolean).join(", ") || "387 Page Street Ste 10B, Stoughton, MA 02072";
    const p = companyProfile?.phone || "(617) 857-COEN";
    doc.text(`${n} · ${a} · ${p}`, pageW / 2, 296, { align: "center" });
    doc.text(`Page ${i} of ${pages}`, pageW - margin, 296, { align: "right" });
  }
  return doc;
}

export default function SoWProjectDetail({ record, vendors = [], companyProfile, onClose }) {
  const qc = useQueryClient();
  const sow = record.sow || {};
  const trades = sow.trades || [];
  const [expandedTrades, setExpandedTrades] = useState({});
  const [emailModal, setEmailModal] = useState(null);
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", message: "", replyTo: record.from_email || "bids@coenconstruction.com" });
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: record.title || "", notes: record.notes || "", from_email: record.from_email || "bids@coenconstruction.com" });
  const [saving, setSaving] = useState(false);

  const saveEdits = async () => {
    setSaving(true);
    await base44.entities.SavedSoW.update(record.id, editForm);
    qc.invalidateQueries({ queryKey: ["savedSoWs"] });
    setSaving(false);
    setEditing(false);
  };

  const toggleTrade = (t) => setExpandedTrades(p => ({ ...p, [t]: !p[t] }));

  const downloadPDF = async () => {
    let logoData = null;
    if (companyProfile?.logo_url) {
      try {
        const res = await fetch(companyProfile.logo_url);
        const blob = await res.blob();
        logoData = await new Promise(resolve => { const r = new FileReader(); r.onloadend = () => resolve(r.result); r.readAsDataURL(blob); });
      } catch (_) {}
    }
    buildPDF(trades, record, companyProfile, logoData).save(`SoW_${record.title}_${new Date().toISOString().slice(0, 10)}.pdf`);
    await base44.entities.SavedSoW.update(record.id, { exported_pdf: true });
    qc.invalidateQueries({ queryKey: ["savedSoWs"] });
  };

  const openEmailModal = (trade) => {
    const ref = ` [SOW-REF:${record.id}]`;
    const subj = trade === "all" ? `Scope of Work — ${record.title}${ref}` : `SoW: ${trade} — ${record.title}${ref}`;
    setEmailForm({ to: "", subject: subj, replyTo: record.from_email || "bids@coenconstruction.com", message: `Please find the Scope of Work for bidding.\n\nProject: ${record.title}\n\nReply with your quote.\n\nThank you,\nCoen Construction` });
    setEmailModal(trade);
  };

  const sendEmail = async () => {
    if (!emailForm.to.trim()) return;
    setSending(true);
    try {
      const emailTrades = emailModal === "all" ? trades : trades.filter(t => t.trade === emailModal);
      const itemsHtml = emailTrades.map(trade => `
        <h3 style="color:#E35235;border-bottom:2px solid #E35235;padding-bottom:4px;margin-top:20px;">${trade.trade}</h3>
        <ol style="padding-left:20px;font-size:13px;line-height:1.7;">
          ${trade.scope_items.map(item => `<li style="margin-bottom:8px;"><strong>${item.task}</strong>${item.description ? `<div style="color:#555;font-size:12px;">${item.description}</div>` : ''}${item.specification ? `<div style="color:#6b7280;font-style:italic;font-size:11px;">Spec: ${item.specification}</div>` : ''}</li>`).join('')}
        </ol>`).join('');

      const body = `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
        <div style="background:#1B2B3A;padding:24px 32px;border-radius:8px 8px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:20px;">Scope of Work — Request for Bid</h1>
          <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px;">${companyProfile?.company_name || 'Coen Construction'}</p>
        </div>
        <div style="padding:24px 32px;border:1px solid #e5e7eb;border-top:none;">
          <p style="white-space:pre-line;font-size:14px;color:#374151;">${emailForm.message}</p>
          ${itemsHtml}
          <div style="background:#fef3f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;margin-top:24px;">
            <p style="font-size:13px;color:#374151;margin:0;"><strong>Reply to:</strong> <a href="mailto:${emailForm.replyTo}">${emailForm.replyTo}</a></p>
            <p style="font-size:11px;color:#9ca3af;margin:4px 0 0;">Reply with a Quick Quote (rough estimate) or Official Bid. Include total price and any exclusions.</p>
          </div>
        </div>
        <div style="background:#f3f4f6;padding:14px 32px;border-radius:0 0 8px 8px;text-align:center;">
          <p style="font-size:11px;color:#9ca3af;margin:0;">${companyProfile?.company_name || 'Coen Construction'}</p>
        </div>
      </div>`;

      await base44.functions.invoke('sendSoWEmail', { to: emailForm.to, subject: emailForm.subject, body, from_email: record.from_email || editForm?.from_email || 'bids@coenconstruction.com' });

      const tradeName = emailModal === "all" ? emailTrades.map(t => t.trade) : [emailModal];
      const existing = record.emailed_trades || [];
      const newEntries = tradeName.map(t => ({ trade: t, to: emailForm.to, sent_at: new Date().toISOString() }));
      await base44.entities.SavedSoW.update(record.id, { emailed_trades: [...existing, ...newEntries] });
      qc.invalidateQueries({ queryKey: ["savedSoWs"] });
      setEmailModal(null);
      alert("Email sent successfully!");
    } finally { setSending(false); }
  };

  const subQuotes = record.sub_quotes || [];
  const lowestQuote = subQuotes.filter(q => q.amount).sort((a, b) => a.amount - b.amount)[0];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-6">
        <div className="bg-secondary px-6 py-4 rounded-t-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="bg-white/10 border border-white/30 text-white font-bold text-lg rounded-lg px-3 py-1 w-full focus:outline-none focus:border-white/60"
                />
              ) : (
                <h2 className="text-white font-bold text-lg">{record.title}</h2>
              )}
              <p className="text-white/60 text-xs mt-0.5">
                {new Date(record.created_date).toLocaleDateString()} · {record.total_items || 0} items · {record.total_trades || 0} trades
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {editing ? (
                <>
                  <Button size="sm" variant="outline" className="gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button size="sm" className="gap-1.5 bg-primary" onClick={saveEdits} disabled={saving}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" className="gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setEditing(true)}>
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={downloadPDF}>
                    <Download className="w-3.5 h-3.5" /> PDF
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={() => openEmailModal("all")}>
                    <Mail className="w-3.5 h-3.5" /> Email All
                  </Button>
                </>
              )}
              <button onClick={onClose} className="text-white/60 hover:text-white ml-1"><X className="w-5 h-5" /></button>
            </div>
          </div>
          {editing && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-white/50 text-xs mb-1 block">Bid Reply Email</label>
                <input value={editForm.from_email} onChange={e => setEditForm(f => ({ ...f, from_email: e.target.value }))}
                  className="bg-white/10 border border-white/20 text-white text-sm rounded-lg px-3 py-1.5 w-full focus:outline-none focus:border-white/50" />
              </div>
              <div className="sm:row-span-1">
                <label className="text-white/50 text-xs mb-1 block">Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="bg-white/10 border border-white/20 text-white text-sm rounded-lg px-3 py-1.5 w-full focus:outline-none focus:border-white/50 resize-none" />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Sub Quotes Received */}
          {subQuotes.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-green-800 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> {subQuotes.length} Bid{subQuotes.length > 1 ? "s" : ""} Received
                </p>
                {lowestQuote && <p className="text-xs text-green-600 font-semibold">Lowest: ${lowestQuote.amount?.toLocaleString()} from {lowestQuote.sub_name}</p>}
              </div>
              <div className="space-y-2">
                {subQuotes.map((q, i) => (
                  <div key={i} className="bg-white border border-green-100 rounded-lg p-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-800">{q.sub_name}</span>
                        <span className="text-xs text-gray-400">{q.sub_email}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.quote_type === 'official_quote' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {q.quote_type === 'official_quote' ? 'Official Bid' : 'Quick Quote'}
                        </span>
                      </div>
                      {q.notes && <p className="text-xs text-gray-500 mt-1">{q.notes}</p>}
                      {q.body_snippet && <p className="text-xs text-gray-400 mt-1 italic truncate">{q.body_snippet.slice(0, 120)}…</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {q.amount ? <p className="font-bold text-green-700">${q.amount.toLocaleString()}</p> : <p className="text-xs text-gray-400">No price</p>}
                      <p className="text-xs text-gray-400">{q.received_date ? new Date(q.received_date).toLocaleDateString() : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity + Details */}
          <div className="flex flex-wrap gap-2">
            {record.exported_pdf && <span className="text-xs bg-green-50 border border-green-200 text-green-700 px-2.5 py-1 rounded-full flex items-center gap-1"><Download className="w-3 h-3" /> PDF Exported</span>}
            {(record.emailed_trades || []).map((e, i) => (
              <span key={i} className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Mail className="w-3 h-3" /> {e.trade} → {e.to}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {record.notes && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Scope / Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{record.notes}</p>
              </div>
            )}
            {(record.uploads || []).length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Original Uploads</p>
                <div className="space-y-1.5">
                  {record.uploads.map((f, i) => (
                    <a key={i} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{f.name}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {sow.project_summary && (
            <div className="bg-secondary/5 border border-secondary/15 rounded-xl p-4">
              <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-1">AI Project Summary</p>
              <p className="text-sm text-gray-700">{sow.project_summary}</p>
            </div>
          )}

          {/* Trade sections */}
          <div className="space-y-3">
            {trades.map(trade => {
              const wasEmailed = (record.emailed_trades || []).some(e => e.trade === trade.trade);
              return (
                <div key={trade.trade} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={() => toggleTrade(trade.trade)}>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getTradeColor(trade.trade)}`}>{trade.trade}</span>
                      <span className="text-sm text-gray-500">{trade.scope_items.length} items</span>
                      {wasEmailed && <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> Emailed</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 px-2" onClick={e => { e.stopPropagation(); openEmailModal(trade.trade); }}>
                        <Send className="w-3 h-3" /> Email
                      </Button>
                      {expandedTrades[trade.trade] ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                  {expandedTrades[trade.trade] && (
                    <div className="border-t border-gray-100 p-4 space-y-2">
                      {trade.scope_items.map((item, idx) => (
                        <div key={idx} className={`border border-gray-100 rounded-lg p-3 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <p className="font-medium text-sm text-gray-900">{idx + 1}. {item.task}</p>
                          {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
                          {item.specification && <p className="text-xs text-gray-400 mt-1 italic">Spec: {item.specification}</p>}
                          <div className="flex flex-wrap gap-3 mt-1">
                            {item.exclusions && <p className="text-xs text-red-400">Excl: {item.exclusions}</p>}
                            {item.notes && <p className="text-xs text-blue-400">Note: {item.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {emailModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-secondary">{emailModal === "all" ? "Email Full SoW for Bidding" : `Email ${emailModal} Scope`}</h3>
              <button onClick={() => setEmailModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Reply-To / Bid Email</label>
                <Input value={emailForm.replyTo} onChange={e => setEmailForm(f => ({ ...f, replyTo: e.target.value }))} placeholder="bids@coenconstruction.com" />
                <p className="text-xs text-gray-400 mt-1">Subs reply here — replies scanned automatically</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Send To</label>
                <Input value={emailForm.to} onChange={e => setEmailForm(f => ({ ...f, to: e.target.value }))} placeholder="sub@contractor.com" />
              </div>
              {vendors.filter(v => v.active && v.email).length > 0 && (
                <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
                  {vendors.filter(v => v.active && v.email).map(v => (
                    <button key={v.id} onClick={() => setEmailForm(f => ({ ...f, to: v.email }))}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${emailForm.to === v.email ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'}`}>
                      {v.company_name}
                    </button>
                  ))}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                <Input value={emailForm.subject} onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
                <textarea value={emailForm.message} onChange={e => setEmailForm(f => ({ ...f, message: e.target.value }))}
                  rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-secondary resize-none" />
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEmailModal(null)}>Cancel</Button>
              <Button onClick={sendEmail} disabled={!emailForm.to.trim() || sending} className="gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Sending…" : "Send for Bidding"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}