import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Link } from "react-router-dom";
import { ClipboardCheck, ChevronDown, ChevronUp, ArrowUpRight, CheckCircle2, FileText, Receipt } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function NeedsApprovalPanel({ estimates, invoices, currentUser, isAdmin }) {
  const [collapsed, setCollapsed] = useState(false);

  // Fetch projects to get assigned_to for scoping
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-approval"],
    queryFn: () => adminEntities.ContractorProject.list("-updated_date", 300),
    staleTime: 60_000,
  });
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  // Scope estimates to current user's projects if not admin
  const allEstimates = estimates; // includes both original and change_order types
  const visibleEstimates = isAdmin
    ? allEstimates
    : allEstimates.filter(e => {
        const proj = projectMap[e.project_id];
        return !proj?.assigned_to || proj.assigned_to === currentUser?.email;
      });

  // Split into standard estimates vs change orders for display
  const standardEstimates = visibleEstimates.filter(e => e.type !== "change_order");
  const changeOrders = visibleEstimates.filter(e => e.type === "change_order");

  const visibleInvoices = isAdmin
    ? invoices
    : invoices.filter(i => {
        const proj = projectMap[i.project_id];
        return !proj?.assigned_to || proj.assigned_to === currentUser?.email;
      });

  const total = visibleEstimates.length + visibleInvoices.length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
          <ClipboardCheck className="w-4 h-4 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-secondary text-sm">Needs Your Approval</h2>
            {total > 0 && (
              <span className="text-xs font-bold bg-purple-600 text-white rounded-full px-2 py-0.5">{total}</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Estimates and invoices awaiting sign-off</p>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {!collapsed && (
        <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
          {total === 0 && (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <p className="text-sm text-green-700 font-medium">Nothing pending approval</p>
            </div>
          )}

          {standardEstimates.map(est => {
            const project = projectMap[est.project_id];
            return (
              <div key={est.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-l-4 border-l-purple-300">
                <FileText className="w-4 h-4 text-purple-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-secondary">
                    {project?.client_name || "Unknown Client"}
                  </div>
                  <div className="text-xs text-gray-500">
                    Estimate {est.version ? `v${est.version}` : ""} · {est.title || "Pending Review"}
                    {est.grand_total > 0 ? ` · $${Number(est.grand_total).toLocaleString()}` : ""}
                  </div>
                  {est.updated_date && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      Updated {formatDistanceToNow(new Date(est.updated_date), { addSuffix: true })}
                    </div>
                  )}
                </div>
                <Link
                  to={project ? `/estimator/projects/${est.project_id}` : "/estimator/projects"}
                  className="shrink-0 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                >
                  Review <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            );
          })}

          {changeOrders.map(est => {
            const project = projectMap[est.project_id];
            return (
              <div key={est.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-l-4 border-l-orange-400">
                <FileText className="w-4 h-4 text-orange-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-secondary flex items-center gap-1.5">
                    {project?.client_name || "Unknown Client"}
                    <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-semibold">Change Order</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    CO #{est.change_order_number || est.version} · {est.title || "Pending Approval"}
                    {est.grand_total > 0 ? ` · $${Number(est.grand_total).toLocaleString()}` : ""}
                  </div>
                  {est.scope_change_description && (
                    <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{est.scope_change_description}</div>
                  )}
                </div>
                <Link
                  to={project ? `/estimator/projects/${est.project_id}` : "/estimator/projects"}
                  className="shrink-0 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                >
                  Review <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            );
          })}

          {visibleInvoices.map(inv => {
            return (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-l-4 border-l-amber-300">
                <Receipt className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-secondary">{inv.vendor_name || "Unknown Vendor"}</div>
                  <div className="text-xs text-gray-500">
                    Invoice {inv.invoice_number ? `#${inv.invoice_number}` : ""}
                    {inv.amount ? ` · $${Number(inv.amount).toLocaleString()}` : ""}
                    {inv.document_type ? ` · ${inv.document_type}` : ""}
                  </div>
                  {inv.pm_approval_status && inv.pm_approval_status !== "not_submitted" && (
                    <div className="text-xs text-amber-600 font-medium mt-0.5 capitalize">
                      PM Approval: {inv.pm_approval_status.replace(/_/g, " ")}
                    </div>
                  )}
                </div>
                <Link
                  to="/admin/invoices"
                  className="shrink-0 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                >
                  Review <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}