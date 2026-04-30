import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, X, FileText, Sparkles, Download, Mail, Send, Loader2, CheckSquare, Square, FolderOpen, Search, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SoWProjectDetail from "../../components/sow/SoWProjectDetail";

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

export default function SoWGenerator() {
  const qc = useQueryClient();
  const [uploads, setUploads] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sow, setSow] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [expandedTrades, setExpandedTrades] = useState({});
  const [selectedItems, setSelectedItems] = useState({});
  const [emailModal, setEmailModal] = useState(null);
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", message: "", replyTo: "bids@coenconstruction.com" });
  const [sending, setSending] = useState(false);
  const [fromEmail, setFromEmail] = useState("bids@coenconstruction.com");
  const [savedRecordId, setSavedRecordId] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [projectSearch, setProjectSearch] = useState("");
  const fileRef = useRef();

  const { data: vendors = [] } = useQuery({ queryKey: ["vendors"], queryFn: () => base44.entities.Vendor.list() });
  const { data: savedSoWs = [] } = useQuery({ queryKey: ["savedSoWs"], queryFn: () => base44.entities.SavedSoW.list("-created_date", 50) });
  const { data: companyProfiles = [] } = useQuery({ queryKey: ["company-profile"], queryFn: () => base44.entities.CompanyProfile.list() });
  const companyProfile = companyProfiles[0] || null;

  // Pre-fill reply email from company profile
  useState(() => {
    if (companyProfile?.sow_reply_email) setFromEmail(companyProfile.sow_reply_email);
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
  const handleDrop = (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); };
  const removeUpload = (i) => setUploads(prev => prev.filter((_, idx) => idx !== i));

  const generate = async () => {
    if (uploads.length === 0 && !notes.trim()) return;
    setGenerating(true); setSow(null);
    try {
      const res = await base44.functions.invoke("generateSoWFromUploads", { uploads, notes, projectName });
      const sowData = res.data.sow;
      setSow(sowData);
      const initial = {}, initSelected = {};
      (sowData?.trades || []).forEach(t => { initial[t.trade] = true; initSelected[t.trade] = new Set(t.scope_items.map((_, i) => i)); });
      setExpandedTrades(initial); setSelectedItems(initSelected);
      const totalItems = (sowData?.trades || []).reduce((s, t) => s + t.scope_items.length, 0);
      const saved = await base44.entities.SavedSoW.create({
        title: projectName || `SoW ${new Date().toLocaleDateString()}`,
        notes, uploads, sow: sowData,
        total_trades: sowData?.trades?.length || 0,
        total_items: totalItems,
        from_email: fromEmail,
      });
      setSavedRecordId(saved.id);
      qc.invalidateQueries({ queryKey: ["savedSoWs"] });
    } finally { setGenerating(false); }
  };

  const toggleTrade = (t) => setExpandedTrades(p => ({ ...p, [t]: !p[t] }));
  const toggleItem = (trade, idx) => setSelectedItems(prev => { const s = new Set(prev[trade] || []); s.has(idx) ? s.delete(idx) : s.add(idx); return { ...prev, [trade]: s }; });
  const toggleAllInTrade = (trade, items) => setSelectedItems(prev => { const s = prev[trade] || new Set(); const all = items.every((_, i) => s.has(i)); return { ...prev, [trade]: all ? new Set() : new Set(items.map((_, i) => i)) }; });
  const getSelectedTrades = () => (sow?.trades || []).map(t => ({ ...t, scope_items: t.scope_items.filter((_, i) => (selectedItems[t.trade] || new Set()).has(i)) })).filter(t => t.scope_items.length > 0);
  const totalSelectedItems = Object.values(selectedItems).reduce((s, set) => s + set.size, 0);
  const totalItems = sow?.trades?.reduce((s, t) => s + t.scope_items.length, 0) || 0;

  const openEmailModal = (trade) => {
    const ref = savedRecordId ? ` [SOW-REF:${savedRecordId}]` : '';
    const subj = trade === "all" ? `Scope of Work — ${projectName || "Project"}${ref}` : `SoW: ${trade} — ${projectName || "Project"}${ref}`;
    setEmailForm({ to: "", subject: subj, replyTo: fromEmail, message: `Please find the Scope of Work for bidding.\n\nProject: ${projectName || "TBD"}\n\nPlease reply with your quote.\n\nThank you,\nCoen Construction` });
    setEmailModal(trade);
  };

  const sendEmail = async () => {
    if (!emailForm.to.trim()) return;
    setSending(true);
    try {
      const emailTrades = emailModal === "all" ? getSelectedTrades() : (sow?.trades || []).filter(t => t.trade === emailModal).map(t => ({ ...t, scope_items: t.scope_items.filter((_, i) => (selectedItems[t.trade] || new Set()).has(i)) }));
      const trades = emailTrades.filter(t => t.scope_items.length > 0);
      const itemsHtml = trades.map(trade => `
        <h3 style="color:#E35235;border-bottom:2px solid #E35235;padding-bottom:4px;margin-top:20px;">${trade.trade}</h3>
        <ol style="padding-left:20px;font-size:13px;line-height:1.7;">
          ${trade.scope_items.map(item => `<li style="margin-bottom:8px;"><strong>${item.task}</strong>${item.description ? `<div style="color:#555;font-size:12px;">${item.description}</div>` : ''}</li>`).join('')}
        </ol>`).join('');

      const body = `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
        <div style="background:#1B2B3A;padding:24px 32px;border-radius:8px 8px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:20px;">Scope of Work — Request for Bid</h1>
          <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px;">Coen Construction</p>
        </div>
        <div style="padding:24px 32px;border:1px solid #e5e7eb;border-top:none;">
          <p style="white-space:pre-line;font-size:14px;color:#374151;">${emailForm.message}</p>
          ${itemsHtml}
          <div style="background:#fef3f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;margin-top:24px;">
            <p style="font-size:13px;color:#374151;margin:0;"><strong>Reply to:</strong> <a href="mailto:${emailForm.replyTo}">${emailForm.replyTo}</a></p>
            <p style="font-size:11px;color:#9ca3af;margin:4px 0 0;">Reply with a Quick Quote (rough estimate) or Official Bid.</p>
          </div>
        </div>
        <div style="background:#f3f4f6;padding:14px 32px;border-radius:0 0 8px 8px;text-align:center;">
          <p style="font-size:11px;color:#9ca3af;margin:0;">Coen Construction · 387 Page Street Ste 10B, Stoughton, MA 02072 · (617) 857-COEN</p>
        </div>
      </div>`;

      await base44.functions.invoke('sendMTOEmail', { to: emailForm.to, subject: emailForm.subject, body, from_email: fromEmail });

      if (savedRecordId) {
        const tradeName = emailModal === "all" ? trades.map(t => t.trade) : [emailModal];
        const records = await base44.entities.SavedSoW.filter({ id: savedRecordId });
        if (records.length > 0) {
          const existing = records[0].emailed_trades || [];
          await base44.entities.SavedSoW.update(savedRecordId, { emailed_trades: [...existing, ...tradeName.map(t => ({ trade: t, to: emailForm.to, sent_at: new Date().toISOString() }))] });
          qc.invalidateQueries({ queryKey: ["savedSoWs"] });
        }
      }
      setEmailModal(null);
      alert("Email sent successfully!");
    } finally { setSending(false); }
  };

  const deleteRecord = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Delete this saved SoW?")) return;
    await base44.entities.SavedSoW.delete(id);
    qc.invalidateQueries({ queryKey: ["savedSoWs"] });
  };

  const filteredSaved = savedSoWs.filter(r => r.title?.toLowerCase().includes(projectSearch.toLowerCase()));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {selectedRecordId && (() => {
        const liveRecord = savedSoWs.find(r => r.id === selectedRecordId);
        return liveRecord ? <SoWProjectDetail record={liveRecord} vendors={vendors} companyProfile={companyProfile} onClose={() => setSelectedRecordId(null)} /> : null;
      })()}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">Scope of Work Generator</h1>
        <p className="text-gray-500 text-sm mt-1">Upload drawings, estimates, or notes — AI generates a comprehensive SoW by trade for subcontractor bidding.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer bg-white"
            onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => fileRef.current.click()}>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.docx,.doc,.txt" />
            {uploading ? (
              <div className="flex flex-col items-center gap-2"><Loader2 className="w-8 h-8 animate-spin text-primary" /><span className="text-sm text-gray-500">Uploading…</span></div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <Upload className="w-8 h-8 text-gray-400" />
                <p className="font-medium text-gray-700">Drop files here or click to upload</p>
                <p className="text-xs text-gray-400">PDF, images, Excel, Word, CSV</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Scope / Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Describe the project scope, special requirements, or paste existing notes…"
              rows={5} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-secondary resize-none" />
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Name</label>
            <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. Smith Home Addition" />
          </div>

          <div className="bg-secondary/5 border border-secondary/15 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-secondary text-xs uppercase tracking-wide">What AI will generate</p>
            <ul className="space-y-1 text-xs text-gray-600">
              <li>. Scope items by trade / CSI division</li>
              <li>. Task descriptions &amp; specifications</li>
              <li>. Exclusions &amp; allowances noted</li>
              <li>. Branded PDF for bidding packages</li>
              <li>. Email directly to subs for quotes</li>
              <li>. Auto-captures bid replies</li>
            </ul>
          </div>
          <Button className="w-full gap-2" size="lg" onClick={generate} disabled={generating || (uploads.length === 0 && !notes.trim())}>
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating SoW…</> : <><Sparkles className="w-4 h-4" /> Generate Scope of Work</>}
          </Button>
        </div>
      </div>

      {generating && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-gray-500 text-sm">AI is analyzing your documents and building the scope of work…</p>
        </div>
      )}

      {sow && !generating && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-6">
              <div><p className="text-xs text-gray-400">Scope Items</p><p className="text-xl font-bold text-secondary">{totalItems}</p></div>
              <div><p className="text-xs text-gray-400">Trades</p><p className="text-xl font-bold text-primary">{sow.trades?.length}</p></div>
              {totalSelectedItems < totalItems && <div><p className="text-xs text-gray-400">Selected</p><p className="text-xl font-bold text-secondary">{totalSelectedItems}</p></div>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => openEmailModal("all")}><Mail className="w-3.5 h-3.5" /> Email All Trades</Button>
            </div>
          </div>

          {sow.project_summary && (
            <div className="bg-secondary/5 border border-secondary/15 rounded-xl p-4">
              <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-1">AI Project Summary</p>
              <p className="text-sm text-gray-700">{sow.project_summary}</p>
            </div>
          )}

          {sow.trades?.map(trade => (
            <div key={trade.trade} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggleTrade(trade.trade)}>
                <div className="flex items-center gap-3">
                  <button onClick={e => { e.stopPropagation(); toggleAllInTrade(trade.trade, trade.scope_items); }} className="text-gray-400 hover:text-primary shrink-0">
                    {trade.scope_items.every((_, i) => (selectedItems[trade.trade] || new Set()).has(i)) ? <CheckSquare className="w-4 h-4 text-primary" /> : trade.scope_items.some((_, i) => (selectedItems[trade.trade] || new Set()).has(i)) ? <CheckSquare className="w-4 h-4 text-primary/50" /> : <Square className="w-4 h-4" />}
                  </button>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getTradeColor(trade.trade)}`}>{trade.trade}</span>
                  <span className="text-sm text-gray-500">{(selectedItems[trade.trade] || new Set()).size}/{trade.scope_items.length} items</span>
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
                  {trade.scope_items.map((item, idx) => {
                    const isChecked = (selectedItems[trade.trade] || new Set()).has(idx);
                    return (
                      <div key={idx} className={`border rounded-lg p-3 transition-opacity ${!isChecked ? 'opacity-40 border-gray-100' : 'border-gray-200'}`}>
                        <div className="flex items-start gap-3">
                          <button onClick={() => toggleItem(trade.trade, idx)} className="mt-0.5 text-gray-400 hover:text-primary shrink-0">
                            {isChecked ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm">{item.task}</p>
                            {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
                            {item.specification && <p className="text-xs text-gray-400 mt-1 italic">Spec: {item.specification}</p>}
                            <div className="flex flex-wrap gap-3 mt-1">
                              {item.exclusions && <p className="text-xs text-red-400 dark:text-red-400">Excl: {item.exclusions}</p>}
                              {item.notes && <p className="text-xs text-blue-400 dark:text-blue-400">Note: {item.notes}</p>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {savedSoWs.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-secondary">Saved Scope of Work Projects</h2>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{savedSoWs.length}</span>
            </div>
            <div className="relative w-56">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input value={projectSearch} onChange={e => setProjectSearch(e.target.value)} placeholder="Search projects…"
                className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-secondary" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSaved.map(r => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-primary hover:shadow-sm transition-all group" onClick={() => setSelectedRecordId(r.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-secondary truncate">{r.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(r.created_date).toLocaleDateString()}</p>
                  </div>
                  <button onClick={e => deleteRecord(r.id, e)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="flex gap-3 mt-3 text-xs">
                  <span className="text-gray-500">{r.total_items || 0} items</span>
                  <span className="text-gray-400">{r.total_trades || 0} trades</span>
                  {(r.sub_quotes || []).length > 0 && <span className="text-green-600 font-semibold">{(r.sub_quotes || []).length} bid{(r.sub_quotes || []).length > 1 ? 's' : ''} received</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {r.exported_pdf && <span className="text-[10px] bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Download className="w-2.5 h-2.5" /> PDF</span>}
                  {(r.emailed_trades || []).length > 0 && <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> {(r.emailed_trades || []).length} emailed</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {emailModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-secondary">{emailModal === "all" ? "Email Full SoW for Bidding" : `Email ${emailModal} Scope`}</h3>
              <button onClick={() => setEmailModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bid Reply Email</label>
                <Input value={emailForm.replyTo} onChange={e => setEmailForm(f => ({ ...f, replyTo: e.target.value }))} placeholder="bids@coenconstruction.com" />
                <p className="text-xs text-gray-400 mt-1">Subs reply here — scanned automatically</p>
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
                  rows={4} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-secondary resize-none" />
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