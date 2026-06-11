import { useState, useEffect } from "react";
import { fieldApi } from "@/api/fieldApi";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format, addDays, startOfToday, parseISO } from "date-fns";
import { Calendar, Clock, X, Plus, Loader2 } from "lucide-react";

const LEAVE_TYPES = [
  { value: "pto", label: "PTO" },
  { value: "sick", label: "Sick Day" },
  { value: "personal", label: "Personal" },
  { value: "unpaid", label: "Unpaid Leave" },
  { value: "other", label: "Other" },
];

const STATUS_STYLES = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  denied: "bg-red-100 text-red-700",
};

export default function TimeOffTab({ user, isFieldCrew = false }) {
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [reason, setReason] = useState("");
  const [leaveType, setLeaveType] = useState("pto");
  const [submitting, setSubmitting] = useState(false);

  // Build 2-week lookahead calendar (starting tomorrow)
  const today = startOfToday();
  const calendarStart = addDays(today, 1);
  const calendarDays = Array.from({ length: 14 }, (_, i) => addDays(calendarStart, i));

  useEffect(() => { loadRequests(); }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const d = await fieldApi("listTimeOff");
      const r = d.requests || [];
      setRequests(r.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch {
      toast({ title: "Couldn't load requests", description: "Check your connection.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleDate = (day) => {
    const key = format(day, "yyyy-MM-dd");
    setSelectedDates(prev =>
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]
    );
  };

  const submitRequest = async () => {
    if (!selectedDates.length) {
      toast({ title: "Select at least one date", variant: "destructive" });
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      await fieldApi("createTimeOff", {
        dates: [...selectedDates].sort(),
        leave_type: leaveType,
        reason,
        is_field_crew: isFieldCrew,
      });
      toast({ title: "✅ Request submitted!" });
      setShowForm(false);
      setSelectedDates([]);
      setReason("");
      setLeaveType("pto");
      await loadRequests();
    } catch (err) {
      toast({ title: "Couldn't submit request", description: err.message || "Your selections are still here — try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Get already-requested dates to grey them out
  const requestedDates = new Set(
    requests.filter(r => r.status !== "denied")
      .flatMap(r => r.dates || [])
  );

  if (loading) return (
    <div className="flex justify-center py-10">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">
          {isFieldCrew ? "Availability" : "Time Off"}
        </h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-primary text-white gap-1">
          <Plus className="w-4 h-4" />
          {isFieldCrew ? "Mark Unavailable" : "Request Time Off"}
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Select dates (next 2 weeks)
          </p>

          {/* 2-week calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
              <div key={d} className="text-center text-xs text-gray-400 font-semibold pb-1">{d}</div>
            ))}
            {/* Offset for first day */}
            {Array.from({ length: calendarStart.getDay() }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {calendarDays.map(day => {
              const key = format(day, "yyyy-MM-dd");
              const selected = selectedDates.includes(key);
              const alreadyRequested = requestedDates.has(key);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <button
                  key={key}
                  onClick={() => !alreadyRequested && toggleDate(day)}
                  disabled={alreadyRequested}
                  className={`
                    aspect-square rounded-xl text-xs font-semibold flex items-center justify-center transition-all
                    ${selected ? "bg-primary text-white" : ""}
                    ${alreadyRequested ? "bg-gray-100 text-gray-300 cursor-not-allowed" : ""}
                    ${!selected && !alreadyRequested && isWeekend ? "text-gray-400 hover:bg-gray-100" : ""}
                    ${!selected && !alreadyRequested && !isWeekend ? "text-gray-700 hover:bg-primary/10" : ""}
                  `}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          {selectedDates.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {[...selectedDates].sort().map(d => (
                <span key={d} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  {format(parseISO(d), "MMM d")}
                  <button onClick={() => setSelectedDates(prev => prev.filter(x => x !== d))}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}

          {!isFieldCrew && (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Leave Type</label>
              <div className="flex flex-wrap gap-2">
                {LEAVE_TYPES.map(lt => (
                  <button key={lt.value} onClick={() => setLeaveType(lt.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${leaveType === lt.value ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-600 hover:border-primary"}`}>
                    {lt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={isFieldCrew ? "Reason (optional)..." : "Reason / notes..."}
            className="resize-none text-sm"
            rows={2}
          />

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setShowForm(false); setSelectedDates([]); }} className="flex-1 text-sm">Cancel</Button>
            <Button onClick={submitRequest} disabled={submitting || !selectedDates.length} className="flex-1 bg-primary text-white text-sm">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
            </Button>
          </div>
        </div>
      )}

      {/* Past Requests */}
      <div className="space-y-3">
        {requests.length === 0 && !showForm && (
          <div className="bg-white rounded-2xl p-10 text-center text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="font-medium">No requests yet</p>
          </div>
        )}
        {requests.map(r => (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-gray-800 text-sm">
                    {r.dates?.length > 1
                      ? `${r.dates.length} days`
                      : r.start_date === r.end_date
                        ? format(parseISO(r.start_date), "MMM d, yyyy")
                        : `${format(parseISO(r.start_date), "MMM d")} – ${format(parseISO(r.end_date), "MMM d, yyyy")}`
                    }
                  </span>
                  {!isFieldCrew && r.leave_type && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold capitalize">
                      {r.leave_type.replace("_", " ")}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[r.status] || "bg-gray-100 text-gray-600"}`}>
                    {r.status}
                  </span>
                </div>
                {r.reason && <p className="text-xs text-gray-500">{r.reason}</p>}
                {r.admin_notes && (
                  <p className="text-xs text-gray-400 mt-1 italic">Admin: {r.admin_notes}</p>
                )}
              </div>
              <Clock className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}