import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import adminEntities from "@/api/adminEntities";
import { ADMIN_SESSION_KEY } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { format, addDays, startOfWeek, isToday } from "date-fns";
import {
  ChevronLeft, ChevronRight, HardHat, Loader2, X, Plus,
  CalendarDays, AlertTriangle, GripVertical, Trash2,
} from "lucide-react";

/**
 * Crew Schedule — a simplified drag-and-drop dispatch board.
 *
 * Rows are job sites, columns are the days of the week. Drag a crew chip from
 * the roster strip into a cell to assign them to that site for that day; drag
 * a chip between cells to move it; drag it back onto the roster (or tap its ×)
 * to unassign. One assignment per person per day — dropping someone who is
 * already scheduled that day moves them instead of double-booking.
 *
 * Crew see their assignment in the field app's Schedule tab: today always,
 * tomorrow from 5pm ET the night before (fieldCrewProjects "mySchedule").
 */

function adminSessionEmail() {
  try { return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || "null")?.email || ""; } catch { return ""; }
}

const dstr = (d) => format(d, "yyyy-MM-dd");
const firstName = (name = "") => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] || "?";
};

export default function CrewSchedule() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [extraProjectIds, setExtraProjectIds] = useState([]);
  const [showAddProject, setShowAddProject] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dayStrs = days.map(dstr);

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

  const assignments = useMemo(
    () => allAssignments.filter((a) => dayStrs.includes(a.date)),
    [allAssignments, dayStrs]
  );

  const crewById = useMemo(() => Object.fromEntries(crew.map((u) => [u.id, u])), [crew]);
  const projectsById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  // "date:user_id" → leave status, for the unavailability warnings
  const offMap = useMemo(() => {
    const map = {};
    timeOff
      .filter((r) => r.status !== "denied")
      .forEach((r) => (r.dates || []).forEach((d) => { map[`${d}:${r.user_id}`] = r.status; }));
    return map;
  }, [timeOff]);

  // Rows on the board: every project with an assignment this week + any the
  // scheduler added by hand (so an empty site can receive its first drop)
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

  // One mutation covers assign + move, enforcing one-site-per-person-per-day:
  // any other assignment that crew member has on the target date is absorbed.
  const placeMutation = useMutation({
    mutationFn: async ({ userId, assignmentId, date, projectId }) => {
      const dragged = assignmentId ? allAssignments.find((a) => a.id === assignmentId) : null;
      const uid = userId || dragged?.user_id;
      const user = crewById[uid] || {};
      const project = projectsById[projectId] || {};
      const board = boardProjects.find((p) => p.id === projectId) || {};
      const data = {
        date,
        user_id: uid,
        user_name: user.name || dragged?.user_name || "",
        user_email: user.email || dragged?.user_email || "",
        project_id: projectId,
        project_name: project.client_name || board.name || "Project",
        project_address: project.client_address || board.address || "",
        assigned_by: adminSessionEmail(),
      };
      const other = allAssignments.find(
        (a) => a.user_id === uid && a.date === date && a.id !== assignmentId
      );
      if (dragged) {
        if (other) await adminEntities.CrewAssignment.delete(other.id);
        return adminEntities.CrewAssignment.update(dragged.id, data);
      }
      if (other) return adminEntities.CrewAssignment.update(other.id, data);
      return adminEntities.CrewAssignment.create(data);
    },
    onSuccess: (result) => {
      invalidate();
      if (offMap[`${result?.date}:${result?.user_id}`]) {
        toast({
          title: "Heads up — scheduled on a day off",
          description: `${result.user_name} has time off requested for ${format(new Date(`${result.date}T12:00:00`), "EEE, MMM d")}.`,
        });
      }
    },
    onError: (err) => toast({ title: "Couldn't save assignment", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (id) => adminEntities.CrewAssignment.delete(id),
    onSuccess: invalidate,
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

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" /> Crew Schedule
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Drag crew onto a job site for each day. Crew see today's site in the field app — tomorrow's unlocks at 5pm the night before.
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
          {/* Roster strip — drag a chip into the grid; drop a chip back here to unassign */}
          <Droppable droppableId="roster" direction="horizontal">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`bg-secondary rounded-2xl p-3 mb-4 transition-colors ${snapshot.isDraggingOver ? "ring-2 ring-red-400" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white/60 uppercase tracking-wide flex items-center gap-1.5">
                    <HardHat className="w-3.5 h-3.5" /> Field Crew ({crew.length})
                  </span>
                  <span className="text-[11px] text-white/40 flex items-center gap-1">
                    {snapshot.isDraggingOver ? <><Trash2 className="w-3 h-3" /> Drop to unassign</> : "Drag a name onto the board"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {crew.map((u, i) => (
                    <Draggable key={u.id} draggableId={`roster:${u.id}`} index={i}>
                      {(prov, snap) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          {...prov.dragHandleProps}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-grab select-none ${
                            snap.isDragging ? "bg-primary text-white shadow-lg" : "bg-white/10 text-white hover:bg-white/20"
                          }`}
                          title={u.email}
                        >
                          <GripVertical className="w-3 h-3 opacity-40" />
                          {firstName(u.name)}
                          {assignedCountByUser[u.id] ? (
                            <span className="bg-primary/90 text-white rounded-full px-1.5 text-[10px] font-bold">{assignedCountByUser[u.id]}</span>
                          ) : null}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {!crew.length && <span className="text-white/40 text-sm">No active field crew yet — add them under Team Access & Roles.</span>}
                </div>
              </div>
            )}
          </Droppable>

          {/* The board: job-site rows × day columns */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
            <div className="min-w-[900px]">
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
                    const cellAssignments = assignments.filter((a) => a.date === date && a.project_id === project.id);
                    return (
                      <Droppable key={`${date}:${project.id}`} droppableId={`cell:${date}:${project.id}`}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`border-l border-gray-50 p-1.5 min-h-[52px] space-y-1 transition-colors ${
                              snapshot.isDraggingOver ? "bg-green-50 ring-1 ring-inset ring-green-300" : isToday(new Date(`${date}T12:00:00`)) ? "bg-primary/[0.02]" : ""
                            }`}
                          >
                            {cellAssignments.map((a, i) => {
                              const off = offMap[`${date}:${a.user_id}`];
                              return (
                                <Draggable key={a.id} draggableId={a.id} index={i}>
                                  {(prov, snap) => (
                                    <div
                                      ref={prov.innerRef}
                                      {...prov.draggableProps}
                                      {...prov.dragHandleProps}
                                      className={`group flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold cursor-grab select-none ${
                                        snap.isDragging ? "bg-primary text-white shadow-lg"
                                          : off ? "bg-amber-50 text-amber-800 border border-amber-200"
                                          : "bg-blue-50 text-blue-800 border border-blue-100"
                                      }`}
                                      title={off ? `${a.user_name} — time off ${off} this day` : a.user_name}
                                    >
                                      {off && <AlertTriangle className="w-3 h-3 shrink-0" />}
                                      <span className="truncate flex-1">{firstName(a.user_name)}</span>
                                      <button
                                        onClick={() => removeMutation.mutate(a.id)}
                                        className={`opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${snap.isDragging ? "hidden" : ""}`}
                                        aria-label={`Unassign ${a.user_name}`}
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
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
    </div>
  );
}
