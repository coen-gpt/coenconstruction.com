import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HardHat, CheckCircle2, Clock, AlertCircle, Phone, MapPin, Calendar } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function SubcontractorPortal() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    const projectId = searchParams.get("project");

    if (!token || !projectId) {
      setError("invalid_link");
      setLoading(false);
      return;
    }

    base44.functions.invoke("getSubcontractorPortal", { token, project_id: projectId })
      .then(res => {
        setData(res.data);
        setNotes(res.data?.assignment?.notes || "");
        setLoading(false);
      })
      .catch(() => {
        setError("invalid");
        setLoading(false);
      });
  }, [searchParams]);

  const handleAction = async (action) => {
    const token = searchParams.get("token");
    const projectId = searchParams.get("project");

    if (!token || !projectId) return;

    setSubmitting(true);
    try {
      await base44.functions.invoke("updateSubcontractorStatus", {
        token,
        project_id: projectId,
        action,
        notes,
      });
      
      // Refresh data
      const res = await base44.functions.invoke("getSubcontractorPortal", { token, project_id: projectId });
      setData(res.data);
      setNotes(res.data?.assignment?.notes || "");
      
      toast({
        title: action === "start" ? "Task started!" : "Task completed!",
        description: "Status updated successfully.",
      });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#E35235] flex items-center justify-center">
          <HardHat className="w-6 h-6 text-white" />
        </div>
        <p className="text-gray-500 font-medium">Loading your task…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-sm w-full">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid Link</h2>
          <p className="text-gray-500 mb-6">
            {error === "invalid_link"
              ? "This link is missing required information. Please check your email or text message."
              : "This link may have expired or is invalid. Please contact the project manager."}
          </p>
          <a href="tel:+17819995400" className="flex items-center justify-center gap-2 bg-[#E35235] text-white font-semibold rounded-xl py-3 px-6 hover:bg-[#c94522] transition-colors">
            <Phone className="w-4 h-4" /> Call Us: (781) 999-5400
          </a>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { project, milestone, assignment } = data;
  const statusConfig = {
    pending: { label: "Not Started", color: "bg-gray-100 text-gray-700", icon: Clock },
    in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700", icon: HardHat },
    complete: { label: "Complete", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  };

  const StatusIcon = statusConfig[assignment.status]?.icon || Clock;
  const statusInfo = statusConfig[assignment.status];

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-[#1B2B3A] rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#E35235] flex items-center justify-center">
              <HardHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">Task Portal</h1>
              <p className="text-gray-400 text-sm">Coen Construction</p>
            </div>
          </div>

          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-white/90 text-sm mb-1">Your Task</div>
            <div className="text-white font-bold text-xl">{milestone.label}</div>
          </div>
        </div>

        {/* Project Info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-secondary mb-4">Project Details</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#E35235] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Location</div>
                <div className="text-sm font-medium text-secondary">
                  {project.client_address}
                  {project.client_city && `, ${project.client_city}`}
                </div>
              </div>
            </div>
            {milestone.due_date && (
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[#E35235] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Due Date</div>
                  <div className="text-sm font-medium text-secondary">
                    {new Date(milestone.due_date).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-secondary mb-4">Task Status</h2>
          
          <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl ${statusInfo.color} mb-4`}>
            <StatusIcon className="w-5 h-5" />
            <span className="font-semibold">{statusInfo.label}</span>
          </div>

          {assignment.started_at && (
            <div className="text-sm text-gray-500 mb-2">
              Started: {new Date(assignment.started_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          )}

          {assignment.completed_at && (
            <div className="text-sm text-green-600 font-medium">
              Completed: {new Date(assignment.completed_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {assignment.status === "pending" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <h2 className="font-semibold text-secondary mb-4">Start Work</h2>
            <Button
              onClick={() => handleAction("start")}
              disabled={submitting}
              className="w-full bg-[#E35235] hover:bg-[#c94522] text-white font-semibold py-6 text-lg"
            >
              <HardHat className="w-5 h-5 mr-2" />
              {submitting ? "Starting…" : "Mark as In Progress"}
            </Button>
          </div>
        )}

        {assignment.status === "in_progress" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <h2 className="font-semibold text-secondary mb-4">Complete Task</h2>
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Notes (optional)
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about the work completed..."
                rows={3}
                className="resize-none"
              />
            </div>
            <Button
              onClick={() => handleAction("complete")}
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-lg"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              {submitting ? "Saving…" : "Mark as Complete"}
            </Button>
          </div>
        )}

        {assignment.status === "complete" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h2 className="font-bold text-green-800 text-lg mb-2">Task Complete!</h2>
            <p className="text-green-700 text-sm">
              Thank you for updating the status. The project manager has been notified.
            </p>
            {assignment.completed_at && (
              <p className="text-green-600 text-xs mt-3">
                Completed on {new Date(assignment.completed_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-gray-400 text-sm mt-6">
          <p>Questions? Contact us at (781) 999-5400</p>
        </div>
      </div>
    </div>
  );
}