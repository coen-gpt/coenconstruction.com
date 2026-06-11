import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import adminEntities from "@/api/adminEntities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FolderKanban, ExternalLink, Check, X, Sparkles, RefreshCw, MapPin, HardHat, Receipt, FileText,
  Eye, PiggyBank, Plus, Trash2
} from "lucide-react";

const fmt = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const isHomeDepot = (r) => /homedepot\.com/i.test(r.vendor_email || '') || /home depot/i.test(r.vendor_name || '');
const isMaterial = (r) => r.document_type === 'receipt' || isHomeDepot(r);

function AllowanceManager({ project, recs, onProjectsRefresh }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", amount: "" });
  const [saving, setSaving] = useState(false);
  const allowances = project.allowances || [];

  const save = async (next) => {
    setSaving(true);
    try {
      await adminEntities.ContractorProject.update(project.id, { allowances: next });
      await onProjectsRefresh?.();
    } catch { /* surfaced by missing refresh */ }
    setSaving(false);
  };

  const addAllowance = async () => {
    if (!draft.name.trim() || !Number(draft.amount)) return;
    await save([...allowances, {
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)),
      name: draft.name.trim(),
      amount: Number(draft.amount),
      created_at: new Date().toISOString(),
    }]);
    setDraft({ name: "", amount: "" });
    setAdding(false);
  };

  if (allowances.length === 0 && !adding) {
    return (
      <button onClick={() => setAdding(true)} className="text-[11px] text-primary hover:underline flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add allowance budget
      </button>
    );
  }

  return (
    <div className="space-y-2 pt-2 border-t border-gray-100">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
          <PiggyBank className="w-3 h-3" /> Allowances
        </span>
        {!adding && (
          <button onClick={() => setAdding(true)} className="text-[11px] text-primary hover:underline flex items-center gap-0.5">
            <Plus className="w-3 h-3" /> Add
          </button>
        )}
      </div>
      {allowances.map(a => {
        const linked = recs.filter(r => r.allowance_id === a.id);
        const internalSpend = linked.reduce((s, r) => s + (r.amount || 0), 0);
        const customerUsed = linked.filter(r => r.portal_visible).reduce((s, r) => s + (r.customer_display_amount || 0), 0);
        const pct = a.amount > 0 ? Math.min(100, Math.round((customerUsed / a.amount) * 100)) : 0;
        const over = customerUsed > (a.amount || 0);
        return (
          <div key={a.id} className="group">
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="font-medium text-gray-700 flex items-center gap-1">
                {a.name}
                <button
                  title="Remove allowance"
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                  disabled={saving}
                  onClick={() => save(allowances.filter(x => x.id !== a.id))}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
              <span className={over ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                {fmt(customerUsed)} / {fmt(a.amount)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full ${over ? 'bg-red-500' : pct > 85 ? 'bg-amber-400' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              Our cost: {fmt(internalSpend)} · customer-facing used: {fmt(customerUsed)}{over ? ' · OVER BUDGET' : ''}
            </div>
          </div>
        );
      })}
      {adding && (
        <div className="flex gap-1.5 items-center">
          <Input className="h-7 text-xs flex-1" placeholder="e.g. Flooring allowance" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          <Input className="h-7 text-xs w-24" type="number" placeholder="$" value={draft.amount} onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))} />
          <Button size="sm" className="h-7 text-xs px-2" onClick={addAllowance} disabled={saving}>Add</Button>
          <button onClick={() => setAdding(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );
}

export function MatchConfidencePill({ value }) {
  if (value == null) return null;
  const tier = value >= 80
    ? { label: 'High', cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' }
    : value >= 50
      ? { label: 'Medium', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' }
      : { label: 'Low', cls: 'bg-red-100 text-red-600', dot: 'bg-red-500' };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${tier.cls}`}
      title={`Auto-match confidence: ${value}% — based on whether the job address was in the PO field (strongest), an address in the email, or just a name word (weakest)`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tier.dot}`} />
      {tier.label} {value}%
    </span>
  );
}

export default function ProjectCostsDashboard({ records, projects, onUpdate, onSelectRecord, onRunMatch, matching, onProjectsRefresh }) {
  const [acting, setActing] = useState(null); // record id being confirmed/rejected

  // Records that count toward cost (rejected invoices excluded)
  const costRecords = useMemo(() => records.filter(r => r.status !== 'rejected' && r.amount), [records]);

  // Highest-confidence matches first so quick Confirms come easy
  const suggested = useMemo(
    () => records
      .filter(r => r.project_match_status === 'suggested' && r.project_id)
      .sort((a, b) => (b.project_match_confidence ?? -1) - (a.project_match_confidence ?? -1)),
    [records]
  );

  const byProject = useMemo(() => {
    const map = new Map();
    for (const r of costRecords) {
      if (!r.project_id) continue;
      if (!map.has(r.project_id)) map.set(r.project_id, []);
      map.get(r.project_id).push(r);
    }
    const rows = [];
    for (const [projectId, recs] of map.entries()) {
      const project = projects.find(p => p.id === projectId);
      if (!project) continue;
      const total = recs.reduce((s, r) => s + (r.amount || 0), 0);
      const homeDepot = recs.filter(isHomeDepot).reduce((s, r) => s + (r.amount || 0), 0);
      const materials = recs.filter(isMaterial).reduce((s, r) => s + (r.amount || 0), 0);
      const pending = recs.filter(r => r.project_match_status === 'suggested').reduce((s, r) => s + (r.amount || 0), 0);
      rows.push({ project, recs, total, homeDepot, materials, other: total - materials, pending });
    }
    return rows.sort((a, b) => b.total - a.total);
  }, [costRecords, projects]);

  const unassigned = useMemo(() => costRecords.filter(r => !r.project_id), [costRecords]);
  const unassignedTotal = unassigned.reduce((s, r) => s + (r.amount || 0), 0);

  const handleReview = async (record, approve) => {
    setActing(record.id);
    if (approve) {
      await onUpdate(record.id, { project_match_status: 'confirmed' }, `Project match confirmed: ${record.project_match_reason || ''}`);
    } else {
      await onUpdate(record.id, { project_match_status: 'rejected', project_id: null }, 'Auto project match rejected');
    }
    setActing(null);
  };

  const projectName = (id) => projects.find(p => p.id === id)?.client_name || 'Unknown project';

  return (
    <div className="space-y-4">
      {/* Review queue — auto-matched receipts awaiting confirmation */}
      {suggested.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <h3 className="font-bold text-sm text-amber-900">
              {suggested.length} auto-matched item{suggested.length !== 1 ? 's' : ''} awaiting review
            </h3>
          </div>
          <div className="divide-y divide-amber-100">
            {suggested.map(r => (
              <div key={r.id} className="px-4 py-3 flex items-center gap-3 flex-wrap bg-white/60">
                <button onClick={() => onSelectRecord(r)} className="flex-1 min-w-[200px] text-left group">
                  <div className="flex items-center gap-2 flex-wrap">
                    <MatchConfidencePill value={r.project_match_confidence} />
                    <span className="font-medium text-sm text-gray-900 group-hover:text-primary">{r.vendor_name || r.vendor_email}</span>
                    <span className="text-sm font-semibold text-gray-700">{r.amount ? fmt(r.amount) : '—'}</span>
                    {r.po_name && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">PO: {r.po_name}</span>}
                  </div>
                  <div className="text-xs text-amber-800 mt-0.5">
                    → <span className="font-semibold">{projectName(r.project_id)}</span>
                    {r.project_match_reason && <span className="text-amber-600"> · {r.project_match_reason}</span>}
                  </div>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700" disabled={acting === r.id} onClick={() => handleReview(r, true)}>
                    <Check className="w-3 h-3" /> Confirm
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50" disabled={acting === r.id} onClick={() => handleReview(r, false)}>
                    <X className="w-3 h-3" /> Wrong
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-project cost cards */}
      {byProject.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400 space-y-2">
          <FolderKanban className="w-8 h-8 mx-auto text-gray-200" />
          <p>No invoices are tagged to projects yet.</p>
          <p className="text-xs">Run the match scan below, or tag invoices from their detail view.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {byProject.map(({ project, recs, total, homeDepot, materials, other, pending }) => (
            <div key={project.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-sm text-gray-900 truncate">{project.client_name}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {[project.client_address, project.client_city].filter(Boolean).join(', ') || project.project_type || '—'}
                  </div>
                </div>
                <Link
                  to={`/estimator/projects/${project.id}`}
                  className="shrink-0 inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                >
                  Open Project <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <div className="text-2xl font-bold text-gray-900 tabular-nums">{fmt(total)}</div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-orange-700"><Receipt className="w-3 h-3" /> Home Depot materials</span>
                  <span className="font-semibold tabular-nums">{fmt(homeDepot)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-600"><HardHat className="w-3 h-3" /> All materials & receipts</span>
                  <span className="font-semibold tabular-nums">{fmt(materials)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-600"><FileText className="w-3 h-3" /> Invoices & bills</span>
                  <span className="font-semibold tabular-nums">{fmt(other)}</span>
                </div>
              </div>

              {/* Material share bar */}
              {total > 0 && (
                <div className="flex rounded-full overflow-hidden h-1.5 bg-gray-100">
                  <div className="bg-orange-400 h-full" style={{ width: `${Math.round((materials / total) * 100)}%` }} title={`Materials ${fmt(materials)}`} />
                  <div className="bg-blue-400 h-full" style={{ width: `${Math.round((other / total) * 100)}%` }} title={`Other ${fmt(other)}`} />
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>{recs.length} item{recs.length !== 1 ? 's' : ''}</span>
                <span className="flex items-center gap-2">
                  {recs.some(r => r.portal_visible) && (
                    <span className="flex items-center gap-0.5 text-green-600 font-medium" title="Items approved for the customer portal (shown at marked-up price)">
                      <Eye className="w-3 h-3" />
                      {recs.filter(r => r.portal_visible).length} in portal · {fmt(recs.filter(r => r.portal_visible).reduce((s, r) => s + (r.customer_display_amount || 0), 0))}
                    </span>
                  )}
                  {pending > 0 && <span className="text-amber-600 font-medium">{fmt(pending)} pending review</span>}
                </span>
              </div>

              <AllowanceManager project={project} recs={recs} onProjectsRefresh={onProjectsRefresh} />
            </div>
          ))}
        </div>
      )}

      {/* Unassigned bucket + match scan */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-semibold text-sm text-gray-900">Unassigned costs</div>
          <div className="text-xs text-gray-500">
            {unassigned.length} item{unassigned.length !== 1 ? 's' : ''} · {fmt(unassignedTotal)} not tagged to any project
          </div>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={onRunMatch} disabled={matching}>
          {matching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {matching ? 'Scanning receipts…' : 'Scan for PO / address matches'}
        </Button>
      </div>
    </div>
  );
}
