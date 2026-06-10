import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  FolderKanban, ExternalLink, Check, X, Sparkles, RefreshCw, MapPin, HardHat, Receipt, FileText
} from "lucide-react";

const fmt = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const isHomeDepot = (r) => /homedepot\.com/i.test(r.vendor_email || '') || /home depot/i.test(r.vendor_name || '');
const isMaterial = (r) => r.document_type === 'receipt' || isHomeDepot(r);

export default function ProjectCostsDashboard({ records, projects, onUpdate, onSelectRecord, onRunMatch, matching }) {
  const [acting, setActing] = useState(null); // record id being confirmed/rejected

  // Records that count toward cost (rejected invoices excluded)
  const costRecords = useMemo(() => records.filter(r => r.status !== 'rejected' && r.amount), [records]);

  const suggested = useMemo(
    () => records.filter(r => r.project_match_status === 'suggested' && r.project_id),
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
                {pending > 0 && <span className="text-amber-600 font-medium">{fmt(pending)} pending review</span>}
              </div>
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
