import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import adminEntities from "@/api/adminEntities";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, addDays, startOfWeek, isToday } from "date-fns";
import {
  ChevronLeft, ChevronRight, HardHat, Loader2, X, Plus, Car,
  CalendarDays, AlertTriangle, GripVertical, Trash2, Clock,
} from "lucide-react";

/**
 * Crew Schedule — a drag-and-drop dispatch board with time slots.
 *
 * Rows are job sites, columns are days. Drag a crew chip from the roster into
 * a cell to assign them; a crew member can work multiple sites in a day but
 * never two at once — the crewSchedule backend validates every placement
 * against their other slots INCLUDING an automatic drive-time buffer between
 * consecutive sites (Google Distance Matrix on the project addresses). First
 * stop of a day defaults to 7:00–15:30; extra stops are auto-placed after the
 * previous stop plus the drive over. Click a chip to fine-tune its times.
 *
 * Live status, straight from the time clock: green = clocked in, amber = on
 * break, red = clocked out for the day, gray = not in yet (refreshes every
 * minute).
 *
 * Crew see their day in the field app's Schedule tab: today always, tomorrow
 * from 5pm ET the night before (fieldCrewProjects "mySchedule").
 */

async function crewApi(action, payload = {}) {
  try {
    const res = await base44.functions.invoke("crewSchedule", { action, ...payload });
    if (res?.data?.error) throw new Error(res.data.error);
    return res?.data || {};
  } catch (err) {
    const serverMsg = err?.response?.data?.error || err?.data?.error;
    throw new Error(serverMsg || err?.message || "Request failed — check your connection.");
  }
}

const dstr = (d) => format(d, "yyyy-MM-dd");
const firstName = (name = "") => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] || "?";
};
const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "p" : "a";
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${ampm}` : `${h12}${ampm}`;
};

// Latest time-clock state per crew member → board status
const CLOCK_STATUS = {
  clocked_in: { dot: "bg-green-500", label: "Working" },
  on_break: { dot: "bg-amber-400", label: "On break" },
  clocked_out: { dot: "bg-red-500", label: "Clocked out" },
  none: { dot: "bg-gray-300", label: "Not clocked in" },
};

function StatusDot({ status }) {
  const s = CLOCK_STATUS[status] || CLOCK_STATUS.none;
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${s.dot} ${status === "clocked_in" ? "animate-pulse" : ""}`}
      title={s.label}
    />
  );
}

export default function CrewSchedule() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [extraProjectIds, setExtraProjectIds] = useState([]);
  const [showAddProject, setShowAddProject] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [editing, setEditing] = useState(null); // assignment being time-edited

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dayStrs = days.map(dstr);
  const todayStr = dstr(new Date());

  const { data: crew = [], isLoading: crewLoading } = useQuery({
    queryKey: ["crew-schedule-crew"],
    queryFn: async () =>
      (await adminEntities.AdminUser.list()).filter((u) => u.role === "field_crew" && u.active !== false),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["crew-schedule-projects"],
    queryFn: () => adminEntities.ContractorProject.filter({ status: "in_progress" }, "-created_date", 200),
  });

  const { data: allAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["crew-assignments"],
    queryFn: () => adminEntities.CrewAssignment.list("-date", 1000),
  });

  const { data: timeOff = [] } = useQuery({
    queryKey: ["crew-schedule-timeoff"],
    queryFn: () => adminEntities.TimeOffRequest.list("-created_date", 300),
  });

  // Live clock states — who's on site right now, straight from the time clock
  const { data: todayEntries = [] } = useQuery({
    queryKey: ["crew-schedule-clock"],
    queryFn: () => adminEntities.TimeEntry.filter({ date: todayStr }, "-clock_in", 200),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const clockStatusByUser = useMemo(() => {
    const m = {};
    // entries come newest-first; first one seen per user is their current state
    todayEntries.forEach((e) => {
      if (!m[e.user_id]) m[e.user_id] = e.status === "clocked_in" || e.status === "on_break" ? e.status : "clocked_out";
    });
    return m;
  }, [todayEntries]);

  const assignments = useMemo(
    () => allAssignments.filter((a) => dayStrs.includes(a.date)),
    [allAssignments, dayStrs]
  );

  const projectsById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  const offMap = useMemo(() => {
    const map = {};
    timeOff
      .filter((r) => r.status !== "denied")
      .forEach((r) => (r.dates || []).forEach((d) => { map[`${d}:${r.user_id}`] = r.status; }));
    return map;
  }, [timeOff]);

  const boardProjects = useMemo(() => {
    const ids = [...new Set([...assignments.map((a) => a.project_id), ...extraProjectIds])];
    return ids.map((id) => {
      const p = projectsById[id];
      const fromAssignment = assignments.find((a) => a.project_id === id);
      return {
        id,
        name: p?.client_name || fromAssignment?.project_name || "Project",
        address: p?.client_address || fromAssignment?.project_address || "",
        active: !!p,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [assignments, extraProjectIds, projectsById]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["crew-assignments"] });

  const placeMutation = useMutation({
    mutationFn: ({ userId, assignmentId, date, projectId }) =>
      crewApi("place", { user_id: userId, assignment_id: assignmentId, date, project_id: projectId }),
    onSuccess: ({ assignment }) => {
      invalidate();
      if (assignment && offMap[`${assignment.date}:${assignment.user_id}`]) {
        toast({
          title: "Heads up — scheduled on a day off",
          description: `${assignment.user_name} has time off requested for ${format(new Date(`${assignment.date}T12:00:00`), "EEE, MMM d")}.`,
        });
      }
    },
    onError: (err) => toast({ title: "Couldn't place assignment", description: err.message, variant: "destructive" }),
  });

  const timesMutation = useMutation({
    mutationFn: ({ id, start_time, end_time, note }) => crewApi("updateTimes", { id, start_time, end_time, note }),
    onSuccess: () => { invalidate(); setEditing(null); },
    onError: (err) => toast({ title: "Couldn't update times", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (id) => crewApi("remove", { id }),
    onSuccess: () => { invalidate(); setEditing(null); },
    onError: (err) => toast({ title: "Couldn't remove assignment", description: err.message, variant: "destructive" }),
  });

  const onDragEnd = ({ draggableId, destination }) => {
    if (!destination) return;
    const dest = destination.droppableId;
    if (draggableId.startsWith("roster:")) {
      if (!dest.startsWith("cell:")) return;
      const [, date, projectId] = dest.split(":");
      placeMutation.mutate({ userId: draggableId.slice(7), date, projectId });
    } else {
      if (dest === "roster") { removeMutation.mutate(draggableId); return; }
      if (!dest.startsWith("cell:")) return;
      const [, date, projectId] = dest.split(":");
      const dragged = allAssignments.find((a) => a.id === draggableId);
      if (dragged && dragged.date === date && dragged.project_id === projectId) return;
      placeMutation.mutate({ assignmentId: draggableId, date, projectId });
    }
  };

  const availableToAdd = projects
    .filter((p) => !boardProjects.some((b) => b.id === p.id))
    .filter((p) =>
      `${p.client_name || ""} ${p.client_address || ""}`.toLowerCase().includes(projectSearch.toLowerCase())
    );

  const assignedCountByUser = useMemo(() => {
    const m = {};
    assignments.forEach((a) => { m[a.user_id] = (m[a.user_id] || 0) + 1; });
    return m;
  }, [assignments]);

  const loading = crewLoading || assignmentsLoading;
  const busy = placeMutation.isPending || removeMutation.isPending;

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" /> Crew Schedule
            {busy && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Drag crew onto job sites — several stops a day are fine, double-booking isn't. Drive-time buffers between sites are automatic. Click a chip to adjust its hours.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addDays(w, -7))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="text-sm font-semibold">
            Week of {format(weekStart, "MMM d")}
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addDays(w, 7))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          {/* Roster strip — live clock status on every chip */}
          <Droppable droppableId="roster" direction="horizontal">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`bg-secondary rounded-2xl p-3 mb-4 transition-colors ${snapshot.isDraggingOver ? "ring-2 ring-red-400" : ""}`}
              >
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <span className="text-xs font-bold text-white/60 uppercase tracking-wide flex items-center gap-1.5">
                    <HardHat className="w-3.5 h-3.5" /> Field Crew ({crew.length})
                  </span>
                  <span className="text-[11px] text-white/40 flex items-center gap-3">
                    {snapshot.isDraggingOver ? (
                      <span className="flex items-center gap-1 text-red-300 font-semibold"><Trash2 className="w-3 h-3" /> Drop to unassign</span>
                    ) : (
                      <>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Working</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Break</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Clocked out</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Not in</span>
                      </>
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {crew.map((u, i) => {
                    const status = clockStatusByUser[u.id] || "none";
                    return (
                      <Draggable key={u.id} draggableId={`roster:${u.id}`} index={i}>
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-grab select-none ${
                              snap.isDragging ? "bg-primary text-white shadow-lg" : "bg-white/10 text-white hover:bg-white/20"
                            }`}
                            title={`${u.email} — ${CLOCK_STATUS[status].label}`}
                          >
                            <GripVertical className="w-3 h-3 opacity-40" />
                            <StatusDot status={status} />
                            {firstName(u.name)}
                            {assignedCountByUser[u.id] ? (
                              <span className="bg-primary/90 text-white rounded-full px-1.5 text-[10px] font-bold">{assignedCountByUser[u.id]}</span>
                            ) : null}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                  {!crew.length && <span className="text-white/40 text-sm">No active field crew yet — add them under Team Access & Roles.</span>}
                </div>
              </div>
            )}
          </Droppable>

          {/* The board: job-site rows × day columns */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: "200px repeat(7, 1fr)" }}>
                <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wide">Job Site</div>
                {days.map((d) => (
                  <div key={dstr(d)} className={`px-2 py-2 text-center border-l border-gray-50 ${isToday(d) ? "bg-primary/5" : ""}`}>
                    <div className={`text-xs font-bold ${isToday(d) ? "text-primary" : "text-gray-600"}`}>{format(d, "EEE")}</div>
                    <div className={`text-[11px] ${isToday(d) ? "text-primary/80 font-semibold" : "text-gray-400"}`}>{format(d, "MMM d")}</div>
                  </div>
                ))}
              </div>

              {boardProjects.map((project) => (
                <div key={project.id} className="grid border-b border-gray-50 last:border-0" style={{ gridTemplateColumns: "200px repeat(7, 1fr)" }}>
                  <div className="px-3 py-2.5">
                    <div className="text-sm font-semibold text-gray-800 leading-tight">{project.name}</div>
                    {project.address && <div className="text-[11px] text-gray-400 truncate" title={project.address}>{project.address}</div>}
                    {!project.active && <div className="text-[10px] text-amber-600 font-semibold">no longer active</div>}
                  </div>
                  {dayStrs.map((date) => {
                    const cellAssignments = assignments
                      .filter((a) => a.date === date && a.project_id === project.id)
                      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
                    return (
                      <Droppable key={`${date}:${project.id}`} droppableId={`cell:${date}:${project.id}`}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`border-l border-gray-50 p-1.5 min-h-[56px] space-y-1 transition-colors ${
                              snapshot.isDraggingOver ? "bg-green-50 ring-1 ring-inset ring-green-300" : date === todayStr ? "bg-primary/[0.02]" : ""
                            }`}
                          >
                            {cellAssignments.map((a, i) => {
                              const off = offMap[`${date}:${a.user_id}`];
                              const status = date === todayStr ? (clockStatusByUser[a.user_id] || "none") : null;
                              return (
                                <Draggable key={a.id} draggableId={a.id} index={i}>
                                  {(prov, snap) => (
                                    <div
                                      ref={prov.innerRef}
                                      {...prov.draggableProps}
                                      {...prov.dragHandleProps}
                                      onClick={() => setEditing({ ...a })}
                                      className={`group px-2 py-1 rounded-lg text-[11px] font-semibold cursor-grab select-none ${
                                        snap.isDragging ? "bg-primary text-white shadow-lg"
                                          : off ? "bg-amber-50 text-amber-800 border border-amber-200"
                                          : "bg-blue-50 text-blue-800 border border-blue-100 hover:border-blue-300"
                                      }`}
                                      title={`${a.user_name} · ${fmtTime(a.start_time)}–${fmtTime(a.end_time)}${a.travel_minutes_before ? ` · ${a.travel_minutes_before} min drive from ${a.travel_from_name}` : ""}${off ? ` · time off ${off}` : ""} — click to edit`}
                                    >
                                      <div className="flex items-center gap-1">
                                        {status && <StatusDot status={status} />}
                                        {off && <AlertTriangle className="w-3 h-3 shrink-0" />}
                                        <span className="truncate flex-1">{firstName(a.user_name)}</span>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); removeMutation.mutate(a.id); }}
                                          className={`opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${snap.isDragging ? "hidden" : ""}`}
                                          aria-label={`Unassign ${a.user_name}`}
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <div className={`flex items-center gap-1.5 text-[10px] font-medium ${snap.isDragging ? "text-white/80" : "opacity-70"}`}>
                                        <span>{fmtTime(a.start_time)}–{fmtTime(a.end_time)}</span>
                                        {a.travel_minutes_before > 0 && (
                                          <span className="flex items-center gap-0.5" title={`${a.travel_minutes_before} min drive from ${a.travel_from_name}`}>
                                            <Car className="w-2.5 h-2.5" />{a.travel_minutes_before}m
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    );
                  })}
                </div>
              ))}

              {!boardProjects.length && (
                <div className="py-14 text-center text-gray-400">
                  <HardHat className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="font-medium">No job sites on the board this week</p>
                  <p className="text-xs mt-1">Add a job site below, then drag crew onto its days.</p>
                </div>
              )}

              {/* Add a job-site row so it can receive its first assignment */}
              <div className="p-3 border-t border-gray-100">
                {showAddProject ? (
                  <div className="max-w-md">
                    <input
                      autoFocus
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      placeholder="Search active projects..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                      {availableToAdd.slice(0, 30).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setExtraProjectIds((ids) => [...ids, p.id]); setShowAddProject(false); setProjectSearch(""); }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                        >
                          <div className="text-sm font-semibold text-gray-800">{p.client_name}</div>
                          <div className="text-xs text-gray-400">{p.client_address}</div>
                        </button>
                      ))}
                      {!availableToAdd.length && <div className="px-3 py-3 text-sm text-gray-400">No matching active projects</div>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setShowAddProject(false); setProjectSearch(""); }} className="mt-1 text-xs text-gray-500">
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setShowAddProject(true)} className="gap-1.5 text-sm">
                    <Plus className="w-4 h-4" /> Add Job Site
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DragDropContext>
      )}

      {/* Slot editor — adjust hours / note, or remove */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="font-bold text-gray-900">{editing.user_name}</div>
              <div className="text-sm text-gray-500">
                {editing.project_name} · {format(new Date(`${editing.date}T12:00:00`), "EEE, MMM d")}
              </div>
              {editing.travel_minutes_before > 0 && (
                <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Car className="w-3 h-3" /> {editing.travel_minutes_before} min drive from {editing.travel_from_name}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3" /> Start
                </label>
                <Input type="time" value={editing.start_time || ""} onChange={(e) => setEditing((s) => ({ ...s, start_time: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3" /> End
                </label>
                <Input type="time" value={editing.end_time || ""} onChange={(e) => setEditing((s) => ({ ...s, end_time: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Note for the crew member</label>
              <Input value={editing.note || ""} onChange={(e) => setEditing((s) => ({ ...s, note: e.target.value }))} placeholder="Gate code, scope, who to see..." />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => removeMutation.mutate(editing.id)}
                disabled={removeMutation.isPending}
                className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
              >
                <Trash2 className="w-4 h-4" /> Remove
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                onClick={() => timesMutation.mutate({ id: editing.id, start_time: editing.start_time, end_time: editing.end_time, note: editing.note })}
                disabled={timesMutation.isPending}
                className="bg-primary text-white"
              >
                {timesMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
