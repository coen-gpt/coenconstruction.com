import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { XCircle, RefreshCw, Clock, Send, ChevronDown, AlertCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

// ── Gate logic ────────────────────────────────────────────────────────────────

function checkPreconGate(project) {
  const checklist = project.precon_checklist;
  if (!checklist) return [];
  const allItems = [
    ...(checklist.materials || []),
    ...(checklist.subs || []),
    ...(checklist.general || []),
  ];
  return allItems.filter(i => !i.done).map(i => i.label);
}

function checkInProgressGate(project, estimates) {
  const missing = [];
  if (!project.client_signed) missing.push("Contract not signed by client");
  if (!project.deposit_paid) missing.push("Deposit not collected");
  const hasApprovedEstimate = (estimates || []).some(e => e.status === "approved");
  if (!hasApprovedEstimate) missing.push("No approved estimate on file");
  // Pre-con checklist gate
  const preconIncomplete = checkPreconGate(project);
  if (preconIncomplete.length > 0) {
    missing.push(`Pre-Con Checklist: ${preconIncomplete.length} item(s) not complete (e.g. "${preconIncomplete[0]}")`);
  }
  return missing;
}

function checkCompletedGate(project) {
  const stages = project.workflow_stages || [];
  if (stages.length === 0) return [];
  const lastStage = stages[stages.length - 1];
  const milestones = lastStage.milestones || [];
  return milestones
    .filter(m => !m.done)
    .map(m => `"${m.label}" not yet complete`);
}

const STATUS_CONFIG = {
  walkthrough:    { label: "Walkthrough",     color: "bg-yellow-100 text-yellow-800 border-yellow-200", dot: "bg-yellow-500" },
  draft:          { label: "Draft",           color: "bg-blue-100 text-blue-800 border-blue-200",       dot: "bg-blue-500" },
  sent:           { label: "Quote Sent",      color: "bg-sky-100 text-sky-800 border-sky-200",          dot: "bg-sky-500" },
  pending_review: { label: "Pending Review",  color: "bg-purple-100 text-purple-800 border-purple-200", dot: "bg-purple-500" },
  approved:       { label: "Approved",        color: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  denied:         { label: "Denied",          color: "bg-red-100 text-red-800 border-red-200",          dot: "bg-red-500" },
  modify:         { label: "Modify",          color: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
  in_progress:    { label: "In Progress",     color: "bg-indigo-100 text-indigo-800 border-indigo-200", dot: "bg-indigo-500" },
  completed:      { label: "Completed",       color: "bg-gray-100 text-gray-800 border-gray-200",       dot: "bg-gray-500" },
  on_hold:        { label: "On Hold",         color: "bg-amber-100 text-amber-800 border-amber-200",    dot: "bg-amber-500" },
  cancelled:      { label: "Cancelled",       color: "bg-red-100 text-red-800 border-red-200",          dot: "bg-red-400" },
  imported:       { label: "Imported",        color: "bg-teal-100 text-teal-800 border-teal-200",       dot: "bg-teal-500" },
};

const QUICK_STATUSES = ["draft", "sent", "pending_review", "approved", "denied", "modify", "in_progress", "on_hold", "completed", "cancelled", "imported"];

export default function ProjectStatusBar({ project, onStatusChanged }) {
  const { toast } = useToast();
  const [showSendReview, setShowSendReview] = useState(false);
  const [approverEmail, setApproverEmail] = useState(project.approver_email || project.client_email || "");
  const [sending, setSending] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [gateErrors, setGateErrors] = useState([]);

  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates-for-gate", project.id],
    queryFn: () => base44.entities.Estimate.filter({ project_id: project.id }),
    staleTime: 30_000,
  });

  const cfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.draft;

  const handleQuickStatus = async (newStatus) => {
    if (newStatus === project.status) return;
    if (newStatus === "pending_review") {
      setShowSendReview(true);
      return;
    }

    // Gate: in_progress
    if (newStatus === "in_progress") {
      const missing = checkInProgressGate(project, estimates);
      if (missing.length > 0) {
        setGateErrors(missing);
        return;
      }
    }

    // Gate: completed
    if (newStatus === "completed") {
      const missing = checkCompletedGate(project);
      if (missing.length > 0) {
        setGateErrors(missing);
        return;
      }
    }

    setGateErrors([]);
    setChangingStatus(true);
    await base44.entities.ContractorProject.update(project.id, { status: newStatus });
    onStatusChanged(newStatus);
    toast({ title: `Status updated to "${STATUS_CONFIG[newStatus]?.label || newStatus}"` });
    setChangingStatus(false);
  };

  const handleSendForReview = async () => {
    if (!approverEmail.trim()) {
      toast({ title: "Enter approver email", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      await base44.functions.invoke("sendApprovalEmail", {
        project_id: project.id,
        approver_email: approverEmail.trim(),
      });
      toast({ title: "Approval email sent!", description: `Sent to ${approverEmail}` });
      setShowSendReview(false);
      onStatusChanged("pending_review");
    } catch (err) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 space-y-3">
      {/* Status display + quick-change */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${cfg.color}`}>
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Send for Review shortcut */}
          {(project.status === "draft" || project.status === "modify") && (
            <Button
              size="sm"
              className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs h-8"
              onClick={() => setShowSendReview(true)}
            >
              <Send className="w-3.5 h-3.5" /> Send for Review
            </Button>
          )}

          {/* Status dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-xs h-8" disabled={changingStatus}>
                Change Status <ChevronDown className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-gray-400">Set Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {QUICK_STATUSES.map(s => {
                const c = STATUS_CONFIG[s];
                return (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => handleQuickStatus(s)}
                    className={`gap-2 text-sm ${s === project.status ? "font-semibold" : ""}`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                    {c.label}
                    {s === project.status && <span className="ml-auto text-xs text-gray-400">current</span>}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Gate block banner */}
      {gateErrors.length > 0 && (
        <div className="rounded-lg px-4 py-3 text-sm border bg-red-50 border-red-200 text-red-900">
          <div className="font-semibold mb-1 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Cannot change status — prerequisites not met:
          </div>
          <ul className="list-disc list-inside space-y-0.5">
            {gateErrors.map((e, i) => <li key={i} className="text-sm">{e}</li>)}
          </ul>
        </div>
      )}

      {/* Approver notes banner (if modify/denied) */}
      {(project.status === "modify" || project.status === "denied") && project.approver_notes && (
        <div className={`rounded-lg px-4 py-3 text-sm border ${project.status === "modify" ? "bg-orange-50 border-orange-200 text-orange-900" : "bg-red-50 border-red-200 text-red-900"}`}>
          <div className="font-semibold mb-1 flex items-center gap-1.5">
            {project.status === "modify" ? <RefreshCw className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            Approver Notes:
          </div>
          <p className="leading-relaxed">{project.approver_notes}</p>
        </div>
      )}

      {/* Pending review info */}
      {project.status === "pending_review" && project.approver_email && (
        <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Awaiting response from <strong>{project.approver_email}</strong>
          <button
            className="ml-auto text-purple-600 hover:underline font-medium"
            onClick={() => setShowSendReview(true)}
          >
            Resend
          </button>
        </div>
      )}

      {/* Send for review form */}
      {showSendReview && (
        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-purple-900">
            <Send className="w-4 h-4" />
            Send Estimate for Approval
          </div>
          <p className="text-xs text-purple-700">
            An email will be sent with a link to Approve, Deny, or Request Modifications.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Approver email address..."
              value={approverEmail}
              onChange={e => setApproverEmail(e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <Button
              size="sm"
              className="h-8 bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1"
              onClick={handleSendForReview}
              disabled={sending}
            >
              {sending ? "Sending…" : <><Send className="w-3 h-3" /> Send</>}
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowSendReview(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}