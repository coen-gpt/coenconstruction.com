import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format, parseISO, addDays, startOfToday } from "date-fns";
import { Calendar, Users, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";

const STATUS_STYLES = {
  pending: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  approved: "bg-green-100 text-green-800 border border-green-200",
  denied: "bg-red-100 text-red-800 border border-red-200",
};

const LEAVE_LABELS = {
  pto: "PTO",
  sick: "Sick",
  personal: "Personal",
  unpaid: "Unpaid",
  other: "Other",
  "": "—",
};

export default function TimeOffManagement() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const [activeTab, setActiveTab] = useState("requests");
  const [expandedId, setExpandedId] = useState(null);
  const [adminNote, setAdminNote] = useState({});

  const { data: allRequests = [], isLoading } = useQuery({
    queryKey: ["time-off-all"],
    queryFn: () => base44.entities.TimeOffRequest.list("-created_date", 200),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, notes }) =>
      base44.entities.TimeOffRequest.update(id, {
        status,
        admin_notes: notes || "",
        reviewed_at: new Date().toISOString(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["time-off-all"] }),
  });

  const filtered = allRequests.filter(r => filter === "all" ? true : r.status === filter);

  // Build 2-week availability grid
  const today = startOfToday();
  const calDays = Array.from({ length: 14 }, (_, i) => addDays(today, i + 1));

  // Group unavailability by date
  const unavailByDate = {};
  allRequests
    .filter(r => r.status !== "denied")
    .forEach(r => {
      (r.dates || []).forEach(d => {
        if (!unavailByDate[d]) unavailByDate[d] = [];
        unavailByDate[d].push({ name: r.user_name, role: r.user_role, leave_type: r.leave_type, status: r.status });
      });
    });

  const uniqueEmployees = [...new Map(allRequests.map(r => [r.user_id, { id: r.user_id, name: r.user_name, role: r.user_role }])).values()];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Time Off & Availability</h1>
        <p className="text-sm text-gray-500 mt-1">Review employee leave requests and team availability calendar</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Pending Review", value: allRequests.filter(r => r.status === "pending").length, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
          { label: "Approved This Month", value: allRequests.filter(r => r.status === "approved" && r.created_date?.startsWith(format(new Date(), "yyyy-MM"))).length, color: "text-green-600", bg: "bg-green-50 border-green-200" },
          { label: "Total Employees", value: uniqueEmployees.length, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1 mb-6 w-fit">
        {[["requests", "Leave Requests", Clock], ["availability", "2-Week Availability", Calendar]].map(([id, label, TabIcon]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === id ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <TabIcon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {activeTab === "requests" && (
        <>
          {/* Filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {[["pending", "Pending"], ["approved", "Approved"], ["denied", "Denied"], ["all", "All"]].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${filter === val ? "bg-[#E35235] text-white border-[#E35235]" : "border-gray-200 text-gray-600 hover:border-[#E35235]"}`}>
                {label}
                {val === "pending" && allRequests.filter(r => r.status === "pending").length > 0 && (
                  <span className="ml-1.5 bg-white text-[#E35235] rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                    {allRequests.filter(r => r.status === "pending").length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center text-gray-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>No {filter === "all" ? "" : filter} requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(r => {
                const isExpanded = expandedId === r.id;
                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-gray-800">{r.user_name}</span>
                            <span className="text-xs text-gray-400 capitalize">{r.user_role?.replace(/_/g, " ")}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[r.status]}`}>
                              {r.status}
                            </span>
                            {r.leave_type && r.leave_type !== "other" && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                                {LEAVE_LABELS[r.leave_type]}
                              </span>
                            )}
                            {r.is_field_crew && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">Field</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {r.dates?.length > 1
                              ? `${r.dates.length} days selected`
                              : r.start_date === r.end_date
                                ? format(parseISO(r.start_date), "EEEE, MMMM d, yyyy")
                                : `${format(parseISO(r.start_date), "MMM d")} – ${format(parseISO(r.end_date), "MMM d, yyyy")}`
                            }
                          </div>
                          {r.reason && <p className="text-xs text-gray-400 mt-1">{r.reason}</p>}
                          {r.dates?.length > 1 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {r.dates.sort().map(d => (
                                <span key={d} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md">
                                  {format(parseISO(d), "MMM d")}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.status === "pending" && (
                            <>
                              <Button size="sm" onClick={() => reviewMutation.mutate({ id: r.id, status: "approved", notes: adminNote[r.id] })}
                                className="bg-green-500 hover:bg-green-600 text-white text-xs h-8 gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => reviewMutation.mutate({ id: r.id, status: "denied", notes: adminNote[r.id] })}
                                className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-8 gap-1">
                                <XCircle className="w-3.5 h-3.5" /> Deny
                              </Button>
                            </>
                          )}
                          <button onClick={() => setExpandedId(isExpanded ? null : r.id)} className="text-gray-400 hover:text-gray-600">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-gray-50 space-y-3">
                        <Textarea
                          placeholder="Add admin notes (optional)..."
                          value={adminNote[r.id] || ""}
                          onChange={e => setAdminNote(prev => ({ ...prev, [r.id]: e.target.value }))}
                          className="resize-none text-sm"
                          rows={2}
                        />
                        {r.admin_notes && <p className="text-xs text-gray-500 italic">Previous note: {r.admin_notes}</p>}
                        {r.reviewed_at && <p className="text-xs text-gray-400">Reviewed {format(new Date(r.reviewed_at), "MMM d, h:mm a")}</p>}
                        {r.status !== "pending" && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => reviewMutation.mutate({ id: r.id, status: "approved", notes: adminNote[r.id] })}
                              className="bg-green-500 text-white text-xs h-7">Approve</Button>
                            <Button size="sm" variant="outline" onClick={() => reviewMutation.mutate({ id: r.id, status: "denied", notes: adminNote[r.id] })}
                              className="border-red-200 text-red-600 text-xs h-7">Deny</Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "availability" && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#E35235]" /> Team Availability — Next 2 Weeks
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Red = approved leave · Yellow = pending · Blank = available</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 w-40">Employee</th>
                  {calDays.map(d => (
                    <th key={format(d, "yyyy-MM-dd")} className={`px-1 py-3 text-center font-semibold min-w-[42px] ${d.getDay() === 0 || d.getDay() === 6 ? "text-gray-300" : "text-gray-500"}`}>
                      <div>{format(d, "EEE")}</div>
                      <div className="font-bold">{format(d, "d")}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uniqueEmployees.map(emp => (
                  <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-gray-800">{emp.name}</div>
                      <div className="text-gray-400 capitalize text-[10px]">{emp.role?.replace(/_/g, " ")}</div>
                    </td>
                    {calDays.map(d => {
                      const key = format(d, "yyyy-MM-dd");
                      const dayOff = unavailByDate[key]?.find(u => u.name === emp.name);
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <td key={key} className={`text-center px-1 py-2.5 ${isWeekend ? "bg-gray-50/50" : ""}`}>
                          {dayOff ? (
                            <div className={`w-7 h-7 rounded-lg mx-auto flex items-center justify-center text-[9px] font-bold
                              ${dayOff.status === "approved" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}
                              title={`${dayOff.status} — ${LEAVE_LABELS[dayOff.leave_type] || "Off"}`}
                            >
                              {dayOff.status === "approved" ? "OFF" : "?"}
                            </div>
                          ) : isWeekend ? (
                            <div className="w-7 h-7 rounded-lg mx-auto flex items-center justify-center text-[9px] text-gray-200">—</div>
                          ) : (
                            <div className="w-7 h-7 rounded-lg mx-auto flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-green-200" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {uniqueEmployees.length === 0 && (
                  <tr><td colSpan={15} className="text-center py-12 text-gray-400">No employees have submitted requests yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-red-100 text-red-700 flex items-center justify-center text-[8px] font-bold">OFF</div> Approved Leave</div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-yellow-100 flex items-center justify-center text-yellow-700 text-[8px] font-bold">?</div> Pending Approval</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-200" /> Available</div>
          </div>
        </div>
      )}
    </div>
  );
}