import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44, ADMIN_SESSION_KEY } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  MessageSquare, CreditCard, ClipboardCheck, Plus, Settings, RefreshCw, Zap, BarChart2
} from "lucide-react";
import CommunicationQueuePanel from "@/components/comms/CommunicationQueuePanel";
import ReadyForPaymentPanel from "@/components/comms/ReadyForPaymentPanel";
import NeedsApprovalPanel from "@/components/comms/NeedsApprovalPanel";
import StalledProjectsPanel from "@/components/comms/StalledProjectsPanel";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function CommandCenter() {
  const { brandColor } = useCompanyBrand();
  const qc = useQueryClient();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  const [generating, setGenerating] = useState(false);
  const [generatedMsg, setGeneratedMsg] = useState(null);

  const { data: openComms = [], isLoading: commsLoading, refetch: refetchComms } = useQuery({
    queryKey: ["open-comms"],
    queryFn: () => base44.entities.ClientCommunication.filter({ status: "open" }),
    refetchInterval: 60_000,
  });

  const { data: readyInvoices = [], isLoading: invLoading } = useQuery({
    queryKey: ["ready-invoices"],
    queryFn: () => base44.entities.InvoiceRecord.filter({ ready_for_payment: true }),
    refetchInterval: 120_000,
  });

  const { data: pendingEstimates = [] } = useQuery({
    queryKey: ["pending-estimates"],
    queryFn: async () => {
      // Fetch both standard pending_review and change orders awaiting sign-off
      const [standard, changeOrders] = await Promise.all([
        base44.entities.Estimate.filter({ status: "pending_review" }),
        base44.entities.Estimate.filter({ status: "pending_review", type: "change_order" }),
      ]);
      // Dedupe by id
      const seen = new Set();
      return [...standard, ...changeOrders].filter(e => seen.has(e.id) ? false : seen.add(e.id));
    },
    refetchInterval: 120_000,
  });

  const { data: pendingInvoices = [] } = useQuery({
    queryKey: ["pending-inv-review"],
    queryFn: () => base44.entities.InvoiceRecord.filter({ status: "pending_review" }),
    refetchInterval: 120_000,
  });

  // Scope to assigned user unless admin
  const visibleComms = isAdmin
    ? openComms
    : openComms.filter(c => !c.assigned_to || c.assigned_to === currentUser?.email);

  const visibleEstimates = pendingEstimates; // scoping via project.assigned_to is done in panel
  const visibleInvoices = pendingInvoices;

  const handleGenerateBenchmarks = async () => {
    setGenerating(true);
    setGeneratedMsg(null);
    try {
      const res = await base44.functions.invoke("generateCommunications", {});
      setGeneratedMsg(`Generated ${res.data?.created || 0} new communication items.`);
      qc.invalidateQueries(["open-comms"]);
    } catch (e) {
      setGeneratedMsg("Error: " + e.message);
    }
    setGenerating(false);
  };

  const totalUrgent = visibleComms.filter(c => c.urgency === "high").length;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-secondary flex items-center gap-2">
            <Zap className="w-5 h-5" style={{ color: brandColor }} />
            Operations Command Center
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateBenchmarks}
              disabled={generating}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
              Run Benchmarks
            </Button>
          )}
          <Link to="/estimator/comms-performance">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <BarChart2 className="w-3.5 h-3.5" /> Performance
            </Button>
          </Link>
          {isAdmin && (
            <Link to="/estimator/comms-settings">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Settings className="w-3.5 h-3.5" /> Benchmark Settings
              </Button>
            </Link>
          )}
          <Link to="/estimator/walkthrough">
            <Button size="sm" className="gap-1.5 text-xs text-white" style={{ background: brandColor }}>
              <Plus className="w-3.5 h-3.5" /> New Walkthrough
            </Button>
          </Link>
        </div>
      </div>

      {generatedMsg && (
        <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg">
          {generatedMsg}
        </div>
      )}

      {totalUrgent > 0 && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg font-semibold">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          {totalUrgent} high-urgency item{totalUrgent !== 1 ? "s" : ""} need immediate attention
        </div>
      )}

      {/* Panel stack — most urgent first */}
      <div className="space-y-4">
        <CommunicationQueuePanel
          items={visibleComms}
          loading={commsLoading}
          currentUser={currentUser}
          onRefresh={() => qc.invalidateQueries(["open-comms"])}
        />
        <ReadyForPaymentPanel
          invoices={readyInvoices}
          loading={invLoading}
        />
        <NeedsApprovalPanel
          estimates={visibleEstimates}
          invoices={visibleInvoices}
          currentUser={currentUser}
          isAdmin={isAdmin}
        />
        <StalledProjectsPanel />
      </div>
    </div>
  );
}