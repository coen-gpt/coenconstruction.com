import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  HardHat, CheckCircle2, Clock, MapPin, Calendar,
  ChevronRight, Loader2, ClipboardList
} from "lucide-react";

const STATUS_CONFIG = {
  pending:     { label: "Pending",     color: "bg-amber-100 text-amber-700",  icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700",    icon: HardHat },
  complete:    { label: "Complete",    color: "bg-green-100 text-green-700",  icon: CheckCircle2 },
};

export default function SubProjectsTab({ assignments, token, onRefresh, toast }) {
  const [expandedTask, setExpandedTask] = useState(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(null);

  const handleAction = async (assignment, projectId, action) => {
    setSubmitting(assignment.id);
    try {
      await base44.functions.invoke("updateSubcontractorStatus", {
        token: assignment.token || token,
        project_id: projectId,
        action,
        notes,
      });
      await onRefresh();
      setNotes("");
      setExpandedTask(null);
      toast({ title: action === "start" ? "Task started!" : "Task marked complete!" });
    } catch (err) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  };

  const active = assignments.filter(a => a.assignment.status !== "complete");
  const completed = assignments.filter(a => a.assignment.status === "complete");

  if (assignments.length === 0) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
      <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
      <p className="text-gray-500 font-medium">No assignments yet</p>
      <p className="text-gray-400 text-sm mt-1">Your assigned tasks will appear here once a project manager sends you work.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {active.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Active Tasks</h2>
          <div className="space-y-3">
            {active.map(({ project, milestone, assignment }) => (
              <TaskCard
                key={assignment.id}
                project={project}
                milestone={milestone}
                assignment={assignment}
                expanded={expandedTask === assignment.id}
                onToggle={() => setExpandedTask(expandedTask === assignment.id ? null : assignment.id)}
                notes={expandedTask === assignment.id ? notes : ""}
                onNotesChange={setNotes}
                onAction={(action) => handleAction(assignment, project.id, action)}
                submitting={submitting === assignment.id}
              />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Completed</h2>
          <div className="space-y-3">
            {completed.map(({ project, milestone, assignment }) => (
              <TaskCard
                key={assignment.id}
                project={project}
                milestone={milestone}
                assignment={assignment}
                expanded={expandedTask === assignment.id}
                onToggle={() => setExpandedTask(expandedTask === assignment.id ? null : assignment.id)}
                readOnly
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TaskCard({ project, milestone, assignment, expanded, onToggle, notes, onNotesChange, onAction, submitting, readOnly }) {
  const status = STATUS_CONFIG[assignment.status] || STATUS_CONFIG.pending;
  const StatusIcon = status.icon;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button className="w-full text-left p-4 hover:bg-gray-50 transition-colors" onClick={onToggle}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${status.color}`}>
            <StatusIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-secondary text-sm">{milestone?.label || "Task"}</div>
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{project.client_address}{project.client_city ? `, ${project.client_city}` : ""}</span>
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

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-gray-50 rounded-xl p-3">
            <div><span className="text-gray-400 block">Project Type</span><strong>{project.project_type || "—"}</strong></div>
            <div><span className="text-gray-400 block">Status</span><strong className="capitalize">{project.status?.replace(/_/g, " ") || "—"}</strong></div>
            {assignment.started_at && <div><span className="text-gray-400 block">Started</span><strong>{new Date(assignment.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</strong></div>}
            {assignment.completed_at && <div><span className="text-gray-400 block">Completed</span><strong>{new Date(assignment.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</strong></div>}
          </div>

          {assignment.notes && (
            <div className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
              <span className="font-semibold text-blue-700 block mb-0.5">Notes</span>
              {assignment.notes}
            </div>
          )}

          {!readOnly && assignment.status === "pending" && (
            <Button onClick={() => onAction("start")} disabled={submitting} className="w-full bg-[#E35235] hover:bg-[#c94522] text-white gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardHat className="w-4 h-4" />}
              {submitting ? "Starting…" : "Mark as In Progress"}
            </Button>
          )}

          {!readOnly && assignment.status === "in_progress" && (
            <div className="space-y-2">
              <Textarea value={notes} onChange={e => onNotesChange(e.target.value)} placeholder="Notes about work completed (optional)…" rows={2} className="resize-none text-sm" />
              <Button onClick={() => onAction("complete")} disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 text-white gap-2">
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