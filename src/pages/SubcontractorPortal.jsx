import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  HardHat, CheckCircle2, Clock, AlertCircle, Phone, MapPin, Calendar,
  Shield, FileText, ClipboardList, ChevronRight, Loader2, Lock, ExternalLink,
  CheckCircle, XCircle, ArrowRight
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const STATUS_CONFIG = {
  pending:     { label: "Pending",     color: "bg-amber-100 text-amber-700",   icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700",     icon: HardHat },
  complete:    { label: "Complete",    color: "bg-green-100 text-green-700",   icon: CheckCircle2 },
};

const INS_STATUS = {
  valid:          { label: "Valid",          color: "text-green-600", bg: "bg-green-50 border-green-200" },
  expiring_soon:  { label: "Expiring Soon",  color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  expired:        { label: "Expired",        color: "text-red-600",   bg: "bg-red-50 border-red-200" },
  pending:        { label: "Pending Review", color: "text-gray-500",  bg: "bg-gray-50 border-gray-200" },
};

export default function SubcontractorPortal() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("projects");
  const [expandedTask, setExpandedTask] = useState(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const token = searchParams.get("token");
  const projectId = searchParams.get("project"); // legacy single-task link support

  useEffect(() => {
    if (!token) { setError("invalid_link"); setLoading(false); return; }

    // Try the new dashboard endpoint first
    base44.functions.invoke("getSubDashboard", { token })
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(() => {
        // Fallback to old single-task portal if project_id is present
        if (projectId) {
          base44.functions.invoke("getSubcontractorPortal", { token, project_id: projectId })
            .then(res => {
              // Wrap old response in dashboard shape
              setData({
                sub_name: res.data?.assignment?.subcontractor_name || "",
                sub_email: res.data?.assignment?.subcontractor_email || "",
                vendor: null,
                assignments: [{
                  project: res.data.project,
                  milestone: res.data.milestone,
                  assignment: { ...res.data.assignment, token },
                }],
              });
              setLoading(false);
            })
            .catch(() => { setError("invalid"); setLoading(false); });
        } else {
          setError("invalid");
          setLoading(false);
        }
      });
  }, [token, projectId]);

  const handleAction = async (assignment, action) => {
    setSubmitting(assignment.id);
    try {
      await base44.functions.invoke("updateSubcontractorStatus", {
        token: assignment.token || token,
        project_id: assignment.project_id || data.assignments.find(a => a.assignment.id === assignment.id)?.project?.id,
        action,
        notes,
      });
      // Refresh
      const res = await base44.functions.invoke("getSubDashboard", { token });
      setData(res.data);
      setNotes("");
      toast({ title: action === "start" ? "Task started!" : "Task marked complete!" });
    } catch (err) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 rounded-full bg-[#E35235] flex items-center justify-center">
        <HardHat className="w-7 h-7 text-white" />
      </div>
      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      <p className="text-gray-500 text-sm">Loading your portal…</p>
    </div>
  );

  // ── Error ──
  if (error) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-sm w-full">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid Link</h2>
        <p className="text-gray-500 mb-6 text-sm">
          {error === "invalid_link"
            ? "This link is missing required information. Please check your email or SMS."
            : "This link may have expired or is invalid. Please contact Coen Construction for a new link."}
        </p>
        <a href="tel:+17819995400" className="flex items-center justify-center gap-2 bg-[#E35235] text-white font-semibold rounded-xl py-3 px-6">
          <Phone className="w-4 h-4" /> Call: (781) 999-5400
        </a>
      </div>
    </div>
  );

  const { sub_name, vendor, assignments = [] } = data;
  const activeAssignments = assignments.filter(a => a.assignment.status !== "complete");
  const completedAssignments = assignments.filter(a => a.assignment.status === "complete");
  const packetDone = vendor?.packet_status === "completed";
  const insStatus = INS_STATUS[vendor?.insurance_status] || INS_STATUS.pending;

  // Compliance checklist items
  const complianceItems = [
    { label: "Subcontractor Packet Signed", done: packetDone, key: "packet" },
    { label: "Workers Comp Insurance", done: !!vendor?.workers_comp_url, expiry: vendor?.workers_comp_expiry, key: "wc" },
    { label: "General Liability Insurance", done: !!vendor?.liability_ins_url, expiry: vendor?.liability_ins_expiry, key: "gl" },
    { label: "W-9 Form", done: !!vendor?.w9_url, key: "w9" },
  ];
  const complianceScore = complianceItems.filter(i => i.done).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-[#1B2B3A] px-4 py-5">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#E35235] flex items-center justify-center shrink-0">
            <HardHat className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-lg leading-tight">Subcontractor Portal</h1>
            <p className="text-white/60 text-xs">Coen Construction LLC</p>
          </div>
          {sub_name && (
            <div className="text-right">
              <div className="text-white/80 text-xs">Welcome,</div>
              <div className="text-white font-semibold text-sm truncate max-w-[130px]">{sub_name}</div>
            </div>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex gap-6 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-[#E35235]">{activeAssignments.length}</div>
            <div className="text-gray-400 text-xs">Active Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{completedAssignments.length}</div>
            <div className="text-gray-400 text-xs">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-secondary">{complianceScore}/4</div>
            <div className="text-gray-400 text-xs">Compliance</div>
          </div>
          {!packetDone && vendor && (
            <a
              href={`/sub-onboarding?token=${vendor.id}&vendor=${vendor.id}`}
              className="ml-auto flex items-center gap-1 text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-semibold self-center hover:bg-amber-600 transition-colors"
            >
              <Lock className="w-3 h-3" /> Complete Packet
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 flex gap-1 py-1">
          {[
            { id: "projects", label: "My Projects", icon: ClipboardList, count: assignments.length },
            { id: "compliance", label: "Compliance", icon: Shield, count: null },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex-1 justify-center
                  ${active ? "bg-[#E35235]/10 text-[#E35235]" : "text-gray-500 hover:text-gray-700"}`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== null && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-[#E35235] text-white" : "bg-gray-100 text-gray-600"}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── PROJECTS TAB ── */}
        {activeTab === "projects" && (
          <>
            {assignments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No assignments yet</p>
                <p className="text-gray-400 text-sm mt-1">You'll see your assigned tasks here once a project manager sends you work.</p>
              </div>
            ) : (
              <>
                {activeAssignments.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Active Tasks</h2>
                    <div className="space-y-3">
                      {activeAssignments.map(({ project, milestone, assignment }) => (
                        <TaskCard
                          key={assignment.id}
                          project={project}
                          milestone={milestone}
                          assignment={assignment}
                          expanded={expandedTask === assignment.id}
                          onToggle={() => setExpandedTask(expandedTask === assignment.id ? null : assignment.id)}
                          notes={expandedTask === assignment.id ? notes : ""}
                          onNotesChange={setNotes}
                          onAction={handleAction}
                          submitting={submitting === assignment.id}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {completedAssignments.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Completed</h2>
                    <div className="space-y-3">
                      {completedAssignments.map(({ project, milestone, assignment }) => (
                        <TaskCard
                          key={assignment.id}
                          project={project}
                          milestone={milestone}
                          assignment={assignment}
                          expanded={expandedTask === assignment.id}
                          onToggle={() => setExpandedTask(expandedTask === assignment.id ? null : assignment.id)}
                          notes={expandedTask === assignment.id ? notes : ""}
                          onNotesChange={setNotes}
                          onAction={handleAction}
                          submitting={submitting === assignment.id}
                          readOnly
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── COMPLIANCE TAB ── */}
        {activeTab === "compliance" && (
          <div className="space-y-4">
            {/* Overall status */}
            {vendor ? (
              <>
                <div className={`rounded-2xl border p-4 flex items-center gap-4 ${packetDone ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-300"}`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${packetDone ? "bg-green-100" : "bg-amber-100"}`}>
                    {packetDone
                      ? <CheckCircle className="w-6 h-6 text-green-600" />
                      : <Lock className="w-6 h-6 text-amber-600" />
                    }
                  </div>
                  <div className="flex-1">
                    <div className={`font-bold text-sm ${packetDone ? "text-green-800" : "text-amber-900"}`}>
                      {packetDone ? "Onboarding Complete" : "Packet Not Submitted"}
                    </div>
                    <div className={`text-xs mt-0.5 ${packetDone ? "text-green-700" : "text-amber-700"}`}>
                      {packetDone
                        ? `Signed ${vendor.packet_signed_at ? new Date(vendor.packet_signed_at).toLocaleDateString() : ""}`
                        : "You cannot receive bids or payments until your packet is complete."}
                    </div>
                  </div>
                  {!packetDone && (
                    <a
                      href={`/sub-onboarding?token=${vendor.id}&vendor=${vendor.id}`}
                      className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Start Now <ArrowRight className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Insurance status */}
                <div className={`rounded-2xl border p-4 ${insStatus.bg}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4" />
                    <span className="font-semibold text-sm text-secondary">Insurance Status</span>
                    <span className={`text-xs font-bold ml-auto ${insStatus.color}`}>{insStatus.label}</span>
                  </div>
                  <div className="text-xs text-gray-500">Combined Workers Comp + General Liability review</div>
                </div>

                {/* Document checklist */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-secondary">Document Checklist</h2>
                    <span className="text-sm font-bold text-[#E35235]">{complianceScore}/4</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
                    <div
                      className="h-full bg-[#E35235] rounded-full transition-all"
                      style={{ width: `${(complianceScore / 4) * 100}%` }}
                    />
                  </div>

                  <div className="space-y-3">
                    {complianceItems.map(item => (
                      <div key={item.key} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                        {item.done
                          ? <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                          : <XCircle className="w-5 h-5 text-gray-300 shrink-0" />
                        }
                        <div className="flex-1">
                          <div className={`text-sm font-medium ${item.done ? "text-gray-800" : "text-gray-500"}`}>{item.label}</div>
                          {item.expiry && (
                            <div className={`text-xs ${new Date(item.expiry) < new Date() ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                              Expires {new Date(item.expiry).toLocaleDateString()}
                              {new Date(item.expiry) < new Date() ? " — EXPIRED" : ""}
                            </div>
                          )}
                        </div>
                        {item.done && item.key !== "packet" && (
                          <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">On file</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {!packetDone && (
                    <a
                      href={`/sub-onboarding?token=${vendor.id}&vendor=${vendor.id}`}
                      className="mt-4 flex items-center justify-center gap-2 w-full bg-[#1B2B3A] text-white font-semibold py-3 rounded-xl text-sm hover:bg-[#1B2B3A]/90 transition-colors"
                    >
                      Complete Onboarding Packet <ChevronRight className="w-4 h-4" />
                    </a>
                  )}
                </div>

                {/* Quick links */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h2 className="font-bold text-secondary mb-3">Useful Links</h2>
                  <a
                    href="https://www.irs.gov/pub/irs-pdf/fw9.pdf"
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 py-2.5 border-b border-gray-50 text-sm text-blue-600 hover:underline"
                  >
                    <FileText className="w-4 h-4 text-gray-400" /> Download IRS W-9 Form <ExternalLink className="w-3 h-3 ml-auto" />
                  </a>
                  <a
                    href="mailto:coenconstruction@gmail.com"
                    className="flex items-center gap-3 py-2.5 text-sm text-blue-600 hover:underline"
                  >
                    <Phone className="w-4 h-4 text-gray-400" /> coenconstruction@gmail.com <ExternalLink className="w-3 h-3 ml-auto" />
                  </a>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Compliance info not available</p>
                <p className="text-gray-400 text-sm mt-1">Contact Coen Construction to update your vendor record.</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-gray-400 text-xs pb-8 pt-2">
          Questions? <a href="tel:+17819995400" className="underline">(781) 999-5400</a> ·{" "}
          <a href="mailto:coenconstruction@gmail.com" className="underline">coenconstruction@gmail.com</a>
        </div>
      </div>
    </div>
  );
}

// ── Task Card component ──
function TaskCard({ project, milestone, assignment, expanded, onToggle, notes, onNotesChange, onAction, submitting, readOnly }) {
  const status = STATUS_CONFIG[assignment.status] || STATUS_CONFIG.pending;
  const StatusIcon = status.icon;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Card header — always visible */}
      <button className="w-full text-left p-4 hover:bg-gray-50 transition-colors" onClick={onToggle}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${status.color}`}>
            <StatusIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-secondary text-sm truncate">{milestone?.label || "Task"}</div>
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
              <MapPin className="w-3 h-3" />
              {project.client_address}{project.client_city ? `, ${project.client_city}` : ""}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
              {milestone?.due_date && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Due {new Date(milestone.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className={`w-4 h-4 text-gray-400 shrink-0 mt-1 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          {/* Project info */}
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-gray-50 rounded-xl p-3">
            <div>
              <span className="text-gray-400 block">Project Type</span>
              <strong>{project.project_type || "—"}</strong>
            </div>
            <div>
              <span className="text-gray-400 block">Project Status</span>
              <strong className="capitalize">{project.status?.replace(/_/g, " ") || "—"}</strong>
            </div>
            {assignment.started_at && (
              <div>
                <span className="text-gray-400 block">Started</span>
                <strong>{new Date(assignment.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</strong>
              </div>
            )}
            {assignment.completed_at && (
              <div>
                <span className="text-gray-400 block">Completed</span>
                <strong>{new Date(assignment.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</strong>
              </div>
            )}
          </div>

          {assignment.notes && (
            <div className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
              <span className="font-semibold text-blue-700 block mb-0.5">Notes</span>
              {assignment.notes}
            </div>
          )}

          {/* Actions */}
          {!readOnly && assignment.status === "pending" && (
            <Button
              onClick={() => onAction(assignment, "start")}
              disabled={submitting}
              className="w-full bg-[#E35235] hover:bg-[#c94522] text-white gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardHat className="w-4 h-4" />}
              {submitting ? "Starting…" : "Mark as In Progress"}
            </Button>
          )}

          {!readOnly && assignment.status === "in_progress" && (
            <div className="space-y-2">
              <Textarea
                value={notes}
                onChange={e => onNotesChange(e.target.value)}
                placeholder="Notes about work completed (optional)…"
                rows={2}
                className="resize-none text-sm"
              />
              <Button
                onClick={() => onAction(assignment, "complete")}
                disabled={submitting}
                className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {submitting ? "Saving…" : "Mark as Complete"}
              </Button>
            </div>
          )}

          {readOnly && assignment.status === "complete" && (
            <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Task complete — thank you!
            </div>
          )}
        </div>
      )}
    </div>
  );
}