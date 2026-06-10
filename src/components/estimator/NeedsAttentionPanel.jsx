import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, FileWarning, ChevronRight, ShieldAlert } from "lucide-react";
import { differenceInDays } from "date-fns";

function isoToDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

export default function NeedsAttentionPanel({ brandColor }) {
  const today = new Date();

  const { data: projects = [] } = useQuery({
    queryKey: ["contractor-projects-attention"],
    queryFn: () => adminEntities.ContractorProject.list("-created_date", 300),
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-attention"],
    queryFn: () => adminEntities.Vendor.list("-created_date", 200),
  });

  // ── Overdue workflow phases ─────────────────────────────────────────────────
  // A phase is overdue if it has an incomplete milestone whose due_date < today,
  // AND the project is still active.
  const activeStatuses = ["approved", "in_progress", "walkthrough", "draft", "pending_review", "sent", "modify"];

  const overduePhases = [];
  for (const project of projects) {
    if (!activeStatuses.includes(project.status)) continue;
    for (const stage of (project.workflow_stages || [])) {
      for (const milestone of (stage.milestones || [])) {
        if (milestone.done) continue;
        const due = isoToDate(milestone.due_date);
        if (!due) continue;
        const daysOver = differenceInDays(today, due);
        if (daysOver > 0) {
          overduePhases.push({
            key: `${project.id}-${stage.id}-${milestone.id}`,
            projectId: project.id,
            clientName: project.client_name,
            projectType: project.project_type,
            stageName: stage.name,
            milestoneLabel: milestone.label,
            daysOver,
          });
        }
      }
    }
    // Also check key_dates
    for (const kd of (project.workflow_schedule?.key_dates || [])) {
      if (kd.done) continue;
      const due = isoToDate(kd.date);
      if (!due) continue;
      const daysOver = differenceInDays(today, due);
      if (daysOver > 0) {
        overduePhases.push({
          key: `${project.id}-kd-${kd.id}`,
          projectId: project.id,
          clientName: project.client_name,
          projectType: project.project_type,
          stageName: "Key Date",
          milestoneLabel: kd.label || "Unnamed key date",
          daysOver,
        });
      }
    }
  }

  // Sort most overdue first
  overduePhases.sort((a, b) => b.daysOver - a.daysOver);

  // ── Overdue subcontractor documents ─────────────────────────────────────────
  const overdueSubDocs = [];
  for (const vendor of vendors) {
    if (!vendor.is_subcontractor) continue;

    const checks = [
      { field: vendor.workers_comp_expiry, label: "Workers Comp", url: vendor.workers_comp_url },
      { field: vendor.liability_ins_expiry, label: "General Liability", url: vendor.liability_ins_url },
    ];

    for (const check of checks) {
      if (!check.field) continue; // Missing = handled by compliance, not overdue
      const expiry = isoToDate(check.field);
      if (!expiry) continue;
      const daysOver = differenceInDays(today, expiry);
      if (daysOver > 0) {
        overdueSubDocs.push({
          key: `${vendor.id}-${check.label}`,
          vendorId: vendor.id,
          companyName: vendor.company_name,
          docType: check.label,
          daysOver,
          hasDoc: !!check.url,
        });
      }
    }
  }

  overdueSubDocs.sort((a, b) => b.daysOver - a.daysOver);

  const totalIssues = overduePhases.length + overdueSubDocs.length;

  if (totalIssues === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-red-50 bg-red-50/60">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <h2 className="font-semibold text-red-800 text-sm">Needs Attention</h2>
        <span className="ml-auto text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
          {totalIssues} overdue item{totalIssues !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="divide-y divide-gray-50">
        {/* Overdue Phases */}
        {overduePhases.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50/50">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                Overdue Project Milestones ({overduePhases.length})
              </span>
            </div>
            {overduePhases.slice(0, 8).map(item => (
              <Link
                key={item.key}
                to={`/estimator/projects/${item.projectId}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/80 transition-colors group"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-slate-700 truncate">{item.clientName}</div>
                  <div className="text-xs text-slate-400 truncate">
                    {item.stageName} · <span className="text-slate-500">{item.milestoneLabel}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    {item.daysOver}d overdue
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            ))}
            {overduePhases.length > 8 && (
              <Link to="/estimator/projects" className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-amber-600 hover:text-amber-700 bg-amber-50/30 hover:bg-amber-50 transition-colors">
                View {overduePhases.length - 8} more overdue milestones <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        )}

        {/* Overdue Sub Docs */}
        {overdueSubDocs.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-5 py-2.5 bg-red-50/50">
              <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
              <span className="text-xs font-bold text-red-700 uppercase tracking-wide">
                Expired Subcontractor Documents ({overdueSubDocs.length})
              </span>
            </div>
            {overdueSubDocs.slice(0, 6).map(item => (
              <Link
                key={item.key}
                to="/estimator/vendors"
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/80 transition-colors group"
              >
                <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                  <FileWarning className="w-3.5 h-3.5 text-red-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-slate-700 truncate">{item.companyName}</div>
                  <div className="text-xs text-slate-400">{item.docType} certificate expired</div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    {item.daysOver}d expired
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            ))}
            {overdueSubDocs.length > 6 && (
              <Link to="/estimator/vendors" className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50/30 hover:bg-red-50 transition-colors">
                View {overdueSubDocs.length - 6} more expired documents <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}