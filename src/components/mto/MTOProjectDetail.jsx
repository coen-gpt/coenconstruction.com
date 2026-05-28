import { useState } from "react";
import { X, FileText, Download, Mail, ChevronDown, ChevronUp, Send, Loader2, ExternalLink, DollarSign, Edit2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { jsPDF } from "jspdf";
import { useQueryClient } from "@tanstack/react-query";

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

function getTradeColor(t) { return TRADE_COLORS[t] || "bg-slate-50 border-slate-200 text-slate-800"; }

export default function MTOProjectDetail({ record, vendors = [], onClose }) {
  const qc = useQueryClient();
  const mto = record.mto || {};
  const trades = mto.trades || [];
  const [expandedTrades, setExpandedTrades] = useState({});
  const [emailModal, setEmailModal] = useState(null);
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: record.title || "", notes: record.notes || "", from_email: record.from_email || "quotes@coenconstruction.com" });
  const [saving, setSaving] = useState(false);

  const saveEdits = async () => {
    setSaving(true);
    await base44.entities.SavedMTO.update(record.id, editForm);
    qc.invalidateQueries({ queryKey: ["savedMTOs"] });
    setSaving(false);
    setEditing(false);
  };

  const totalCost = record.total_cost || 0;
  const totalItems = record.total_items || 0;

  const toggleTrade = (t) => setExpandedTrades(p => ({ ...p, [t]: !p[t] }));

  const buildPDF = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210, margin = 15, cW = pageW - margin * 2;
    let y = margin;
    doc.setFillColor(27, 43, 58); doc.rect(0, 0, pageW, 28, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("Coen Construction", margin, 11);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text("Material Take-Off", margin, 19);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date(record.created_date).toLocaleDateString()}`, pageW - margin, 19, { align: "right" });
    y = 36;
    doc.setTextColor(51, 51, 51); doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text(`Project: ${record.title}`, margin, y); y += 10;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
    doc.text(`Total Items: ${totalItems}   |   Estimated Total: $${totalCost.toLocaleString()}`, margin, y); y += 8;

    trades.forEach(trade => {
      if (y > 260) { doc.addPage(); y = margin; }
      doc.setFillColor(227, 82, 53); doc.rect(margin, y, cW, 8, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text(trade.trade.toUpperCase(), margin + 4, y + 5.5); y += 10;
      doc.setFillColor(245, 245, 245); doc.rect(margin, y, cW, 6, "F");
      doc.setTextColor(80, 80, 80); doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("MATERIAL", margin + 2, y + 4); doc.text("DESC", margin + 60, y + 4);
      doc.text("QTY", margin + 110, y + 4); doc.text("UNIT", margin + 125, y + 4);
      doc.text("UNIT $", margin + 140, y + 4); doc.text("TOTAL", margin + 160, y + 4);
      doc.text("SUPPLIER", margin + 178, y + 4); y += 7;
      trade.items.forEach((item, idx) => {
        if (y > 272) { doc.addPage(); y = margin; }
        if (idx % 2 === 0) { doc.setFillColor(252, 252, 252); doc.rect(margin, y, cW, 6.5, "F"); }
        doc.setTextColor(40, 40, 40); doc.setFontSize(7); doc.setFont("helvetica", "normal");
        doc.text(doc.splitTextToSize(item.material_name || "", 55)[0], margin + 2, y + 4.5);
        doc.text(doc.splitTextToSize(item.description || "", 48)[0], margin + 60, y + 4.5);
        doc.text(String(item.quantity || ""), margin + 110, y + 4.5);
        doc.text(item.unit || "", margin + 125, y + 4.5);
        doc.text(item.unit_cost ? `$${Number(item.unit_cost).toLocaleString()}` : "", margin + 140, y + 4.5);
        doc.text(item.total_cost ? `$${Number(item.total_cost).toLocaleString()}` : "", margin + 160, y + 4.5);
        doc.text(doc.splitTextToSize(item.suggested_supplier || "", 28)[0], margin + 178, y + 4.5);
        y += 7;
      });
      const tradeCost = trade.items.reduce((s, i) => s + (i.total_cost || 0), 0);
      doc.setFillColor(240, 240, 240); doc.rect(margin, y, cW, 6, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(227, 82, 53);
      doc.text(`Trade Subtotal: $${tradeCost.toLocaleString()}`, pageW - margin - 2, y + 4, { align: "right" });
      y += 10;
    });
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFillColor(27, 43, 58); doc.rect(0, 290, pageW, 10, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(7);
      doc.text("Coen Construction · 387 Page Street Ste 10B, Stoughton, MA 02072 · (617) 857-COEN", pageW / 2, 296, { align: "center" });
      doc.text(`Page ${i} of ${pages}`, pageW - margin, 296, { align: "right" });
    }
    return doc;
  };

  const downloadPDF = async () => {
    buildPDF().save(`MTO_${record.title}_${new Date().toISOString().slice(0, 10)}.pdf`);
    await base44.entities.SavedMTO.update(record.id, { exported_pdf: true });
    qc.invalidateQueries({ queryKey: ["savedMTOs"] });
  };

  const openEmailModal = (trade) => {
    const ref = ` [MTO-REF:${record.id}]`;
    const subj = trade === "all"
      ? `Material Take-Off — ${record.title}${ref}`
      : `Material Take-Off: ${trade} — ${record.title}${ref}`;
    setEmailForm({ to: "", subject: subj, message: `Please find the material take-off for your review.\n\nProject: ${record.title}\n\nPlease provide pricing and availability at your earliest convenience.\n\nThank you,\nCoen Construction` });
    setEmailModal(trade);
  };

  const sendEmail = async () => {
    if (!emailForm.to.trim()) return;
    setSending(true);
    try {
      const emailTrades = emailModal === "all" ? trades : trades.filter(t => t.trade === emailModal);
      const itemsHtml = emailTrades.map(trade => `
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

      const body = `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
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

      await base44.functions.invoke('sendMTOEmail', { to: emailForm.to, subject: emailForm.subject, body, from_email: record.from_email || editForm.from_email || 'quotes@coenconstruction.com' });

      const tradeName = emailModal === "all" ? emailTrades.map(t => t.trade) : [emailModal];
      const existing = record.emailed_trades || [];
      const updated = [...new Set([...existing, ...tradeName])];
      await base44.entities.SavedMTO.update(record.id, { emailed_trades: updated });
      qc.invalidateQueries({ queryKey: ["savedMTOs"] });

      setEmailModal(null);
      alert("Email sent successfully!");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-6">
        {/* Header */}
        <div className="bg-secondary px-6 py-4 rounded-t-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {editing ? (
                <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="bg-white/10 border border-white/30 text-white font-bold text-lg rounded-lg px-3 py-1 w-full focus:outline-none focus:border-white/60" />
              ) : (
                <h2 className="text-white font-bold text-lg">{record.title}</h2>
              )}
              <p className="text-white/60 text-xs mt-0.5">
                Created {new Date(record.created_date).toLocaleDateString()} · {totalItems} items · ${totalCost.toLocaleString()}
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
                <label className="text-white/50 text-xs mb-1 block">Quote Reply Email</label>
                <input value={editForm.from_email} onChange={e => setEditForm(f => ({ ...f, from_email: e.target.value }))}
                  className="bg-white/10 border border-white/20 text-white text-sm rounded-lg px-3 py-1.5 w-full focus:outline-none focus:border-white/50" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="bg-white/10 border border-white/20 text-white text-sm rounded-lg px-3 py-1.5 w-full focus:outline-none focus:border-white/50 resize-none" />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">

          {/* Vendor Quotes Received */}
          {(record.vendor_quotes || []).length > 0 && (() => {
            const quotes = record.vendor_quotes || [];
            const lowest = quotes.filter(q => q.amount).sort((a, b) => a.amount - b.amount)[0];
            return (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-green-800 flex items-center gap-2"><DollarSign className="w-4 h-4" /> {quotes.length} Vendor Quote{quotes.length > 1 ? "s" : ""} Received</p>
                  {lowest && <p className="text-xs text-green-600 font-semibold">Lowest: ${lowest.amount?.toLocaleString()} from {lowest.vendor_name}</p>}
                </div>
                <div className="space-y-2">
                  {quotes.map((q, i) => (
                    <div key={i} className="bg-white border border-green-100 rounded-lg p-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-800">{q.vendor_name}</span>
                          <span className="text-xs text-gray-400">{q.vendor_email}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.quote_type === 'official_quote' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {q.quote_type === 'official_quote' ? 'Official Quote' : 'Quick Quote'}
                          </span>
                        </div>
                        {q.notes && <p className="text-xs text-gray-500 mt-1">{q.notes}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        {q.amount ? <p className="font-bold text-green-700">${q.amount.toLocaleString()}</p> : <p className="text-xs text-gray-400">No price</p>}
                        <p className="text-xs text-gray-400">{q.received_date ? new Date(q.received_date).toLocaleDateString() : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Activity badges */}
          <div className="flex flex-wrap gap-2">
            {record.exported_pdf && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-green-50 border border-green-200 text-green-700 px-2.5 py-1 rounded-full">
                <Download className="w-3 h-3" /> PDF Exported
              </span>
            )}
            {(record.emailed_trades || []).map(t => (
              <span key={t} className="inline-flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-full">
                <Mail className="w-3 h-3" /> Emailed: {t}
              </span>
            ))}
          </div>

          {/* Details row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scope / Notes */}
            {record.notes && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Scope / Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{record.notes}</p>
              </div>
            )}

            {/* Original uploads */}
            {(record.uploads || []).length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Original Uploads</p>
                <div className="space-y-1.5">
                  {record.uploads.map((f, i) => (
                    <a key={i} href={f.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{f.name}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI summary */}
          {mto.project_summary && (
            <div className="bg-secondary/5 border border-secondary/15 rounded-xl p-4">
              <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-1">AI Project Summary</p>
              <p className="text-sm text-gray-700">{mto.project_summary}</p>
            </div>
          )}

          {/* Trade sections */}
          <div className="space-y-3">
            {trades.map(trade => {
              const tradeCost = trade.items.reduce((s, i) => s + (i.total_cost || 0), 0);
              const wasEmailed = (record.emailed_trades || []).includes(trade.trade);
              return (
                <div key={trade.trade} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleTrade(trade.trade)}>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getTradeColor(trade.trade)}`}>{trade.trade}</span>
                      <span className="text-sm text-gray-500">{trade.items.length} items</span>
                      <span className="text-sm font-semibold text-gray-700">${tradeCost.toLocaleString()}</span>
                      {wasEmailed && <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> Emailed</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 px-2"
                        onClick={e => { e.stopPropagation(); openEmailModal(trade.trade); }}>
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
                          {trade.items.map((item, idx) => (
                            <tr key={idx} className={`border-b border-gray-50 ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                              <td className="px-4 py-2.5 font-medium text-gray-900">{item.material_name}</td>
                              <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[200px]">{item.description}</td>
                              <td className="px-3 py-2.5 text-right font-medium">{item.quantity}</td>
                              <td className="px-3 py-2.5 text-gray-500">{item.unit}</td>
                              <td className="px-3 py-2.5 text-right text-gray-600">{item.unit_cost ? `$${Number(item.unit_cost).toLocaleString()}` : "—"}</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{item.total_cost ? `$${Number(item.total_cost).toLocaleString()}` : "—"}</td>
                              <td className="px-3 py-2.5 text-xs text-gray-500">{item.suggested_supplier}</td>
                              <td className="px-3 py-2.5 text-xs text-gray-400">{item.sku || item.notes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-secondary">
                {emailModal === "all" ? "Email Full MTO to Vendor" : `Email ${emailModal} MTO`}
              </h3>
              <button onClick={() => setEmailModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Vendor Email</label>
                <Input value={emailForm.to} onChange={e => setEmailForm(f => ({ ...f, to: e.target.value }))} placeholder="vendor@example.com" />
              </div>
              {vendors.filter(v => v.active && v.email).length > 0 && (
                <div className="flex flex-wrap gap-2">
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
                  rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-secondary resize-none" />
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