import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, MessageCircle, Users, CheckCircle2, Clock, HardHat, Send } from "lucide-react";

export default function SubcontractorScheduler({ project, onUpdate }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [subEmail, setSubEmail] = useState("");
  const [subPhone, setSubPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMethod, setSendMethod] = useState("email"); // email or sms

  const assignments = project?.subcontractor_assignments || [];
  const allMilestones = (project?.workflow_stages || []).flatMap(s => s.milestones || []);

  const handleSend = async () => {
    if (!selectedMilestone || !subEmail || !subPhone) {
      toast({ title: "Missing info", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      if (sendMethod === "email") {
        await base44.functions.invoke("sendSubcontractorAssignment", {
          milestone_id: selectedMilestone,
          subcontractor_email: subEmail,
          project_id: project.id,
          message,
        });
      } else {
        await base44.functions.invoke("sendSubcontractorSmsAssignment", {
          milestone_id: selectedMilestone,
          subcontractor_phone: subPhone,
          project_id: project.id,
          message,
        });
      }

      toast({
        title: "Assignment sent!",
        description: `Subcontractor notified via ${sendMethod}.`,
      });

      setOpen(false);
      setSubEmail("");
      setSubPhone("");
      setMessage("");
      setSelectedMilestone(null);
      if (onUpdate) onUpdate();
    } catch (err) {
      toast({
        title: "Failed to send",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const getAssignmentForMilestone = (milestoneId) => {
    return assignments.find(a => a.milestone_id === milestoneId);
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { label: "Pending", color: "bg-gray-100 text-gray-700" },
      in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700" },
      complete: { label: "Complete", color: "bg-green-100 text-green-700" },
    };
    const { label, color } = config[status] || config.pending;
    return <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${color}`}>{label}</span>;
  };

  return (
    <>
      {/* Assignments List */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-secondary flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Subcontractor Assignments
          </h2>
          <Button onClick={() => setOpen(true)} size="sm" className="gap-2 bg-primary text-white">
            <Send className="w-3.5 h-3.5" /> Assign Task
          </Button>
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-xl">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No assignments yet</p>
            <p className="text-sm mt-1">Assign milestones to subcontractors via email or SMS.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assign) => {
              const milestone = allMilestones.find(m => m.id === assign.milestone_id);
              return (
                <div key={assign.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-secondary text-sm">{milestone?.label || "Unknown Milestone"}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Assigned to: {assign.subcontractor_email || assign.subcontractor_phone}
                      </div>
                    </div>
                    {getStatusBadge(assign.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(assign.assigned_at).toLocaleDateString()}
                    </span>
                    {assign.started_at && (
                      <span className="flex items-center gap-1 text-blue-600">
                        <HardHat className="w-3 h-3" />
                        Started {new Date(assign.started_at).toLocaleDateString()}
                      </span>
                    )}
                    {assign.completed_at && (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed {new Date(assign.completed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assignment Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Task to Subcontractor</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Milestone Selection */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Select Milestone *
              </label>
              <Select value={selectedMilestone || ""} onValueChange={setSelectedMilestone}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a milestone..." />
                </SelectTrigger>
                <SelectContent>
                  {allMilestones
                    .filter(m => !getAssignmentForMilestone(m.id))
                    .map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {allMilestones.filter(m => !getAssignmentForMilestone(m.id)).length === 0 && (
                <p className="text-xs text-gray-500 mt-1">All milestones are already assigned.</p>
              )}
            </div>

            {/* Send Method */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Send Via *
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSendMethod("email")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                    sendMethod === "email"
                      ? "border-[#E35235] bg-[#E35235]/5 text-[#E35235]"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <Mail className="w-4 h-4" /> Email
                </button>
                <button
                  onClick={() => setSendMethod("sms")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                    sendMethod === "sms"
                      ? "border-[#E35235] bg-[#E35235]/5 text-[#E35235]"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <MessageCircle className="w-4 h-4" /> SMS
                </button>
              </div>
            </div>

            {/* Contact Info */}
            {sendMethod === "email" ? (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Subcontractor Email *
                </label>
                <Input
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  placeholder="sub@company.com"
                  type="email"
                />
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Subcontractor Phone *
                </label>
                <Input
                  value={subPhone}
                  onChange={(e) => setSubPhone(e.target.value)}
                  placeholder="+17819995400"
                  type="tel"
                />
              </div>
            )}

            {/* Message */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Message (optional)
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add any special instructions or details..."
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || !selectedMilestone || (!subEmail && !subPhone)}
                className="flex-1 bg-[#E35235] text-white"
              >
                {sending ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span> Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-2" /> Send Assignment
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}