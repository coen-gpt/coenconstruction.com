import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO, isValid
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, MapPin, HardHat, Users, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Event type config
const EVENT_TYPES = {
  site_visit:   { label: "Site Visit",        color: "bg-blue-100 text-blue-700 border-blue-200",   dot: "bg-blue-500" },
  sub_deadline: { label: "Sub Deadline",       color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  client_meeting:{ label: "Client Meeting",   color: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" },
  task_due:     { label: "Task Due",           color: "bg-red-100 text-red-700 border-red-200",      dot: "bg-red-500" },
};

function parseDate(str) {
  if (!str) return null;
  try {
    const d = parseISO(str);
    return isValid(d) ? d : null;
  } catch { return null; }
}

function buildEvents(projects, tasks) {
  const events = [];

  for (const p of projects) {
    // Walkthrough / site visits
    if (p.walkthrough_date) {
      const d = parseDate(p.walkthrough_date);
      if (d) events.push({
        date: d,
        type: "site_visit",
        label: `📍 ${p.client_name}`,
        sublabel: p.project_type,
        projectId: p.id,
        clientName: p.client_name,
      });
    }

    // Key dates from workflow_schedule
    for (const kd of (p.workflow_schedule?.key_dates || [])) {
      const d = parseDate(kd.date);
      if (!d || kd.done) continue;
      const lc = (kd.label || "").toLowerCase();
      const type = lc.includes("meeting") || lc.includes("client") ? "client_meeting"
        : lc.includes("sub") || lc.includes("contractor") ? "sub_deadline"
        : "site_visit";
      events.push({
        date: d,
        type,
        label: `${type === "client_meeting" ? "🤝" : type === "sub_deadline" ? "🔧" : "📋"} ${kd.label}`,
        sublabel: p.client_name,
        projectId: p.id,
        clientName: p.client_name,
      });
    }

    // Subcontractor assignments with pending status — use assigned_at + 7d as rough deadline
    for (const sa of (p.subcontractor_assignments || [])) {
      if (sa.status !== "pending") continue;
      const assignedDate = parseDate(sa.assigned_at);
      if (!assignedDate) continue;
      const deadline = new Date(assignedDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      events.push({
        date: deadline,
        type: "sub_deadline",
        label: `🔧 ${sa.subcontractor_name || "Sub"} due`,
        sublabel: p.client_name,
        projectId: p.id,
        clientName: p.client_name,
      });
    }
  }

  // Task due dates
  for (const t of tasks) {
    if (!t.due_date || t.status === "done" || t.status === "skipped") continue;
    const d = parseDate(t.due_date);
    if (d) events.push({
      date: d,
      type: "task_due",
      label: `✅ ${t.title}`,
      sublabel: t.assigned_role?.replace("_", " "),
      taskId: t.id,
      projectId: t.project_id,
    });
  }

  return events;
}

export default function AdminCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: projects = [] } = useQuery({
    queryKey: ["admin-cal-projects"],
    queryFn: () => base44.entities.ContractorProject.list("-updated_date", 500),
    staleTime: 60_000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["admin-cal-tasks"],
    queryFn: () => base44.entities.ProjectTask.list("-created_date", 1000),
    staleTime: 60_000,
  });

  const allEvents = useMemo(() => buildEvents(projects, tasks), [projects, tasks]);

  const filtered = useMemo(() =>
    typeFilter === "all" ? allEvents : allEvents.filter(e => e.type === typeFilter),
    [allEvents, typeFilter]
  );

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });
  const firstDayOfWeek = startOfMonth(currentDate).getDay();
  const emptyDays = Array(firstDayOfWeek).fill(null);
  const allDays = [...emptyDays, ...daysInMonth];

  const getEventsForDay = (day) =>
    filtered.filter(e => isSameDay(e.date, day));

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  // Upcoming events for next 30 days
  const upcoming = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return filtered
      .filter(e => e.date >= now && e.date <= end)
      .sort((a, b) => a.date - b.date)
      .slice(0, 15);
  }, [filtered]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-secondary flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" /> Project Calendar
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Site visits, sub deadlines & client meetings across all jobs</p>
        </div>

        {/* Type filter pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTypeFilter("all")}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-colors ${
              typeFilter === "all" ? "bg-secondary text-white border-secondary" : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >All</button>
          {Object.entries(EVENT_TYPES).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-colors ${
                typeFilter === key ? `${cfg.color} border-current` : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="xl:col-span-2">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-secondary">{format(currentDate, "MMMM yyyy")}</h2>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d} className="text-center text-[11px] font-bold text-gray-400 py-2.5 uppercase tracking-wide">{d}</div>
              ))}
            </div>

            {/* Grid cells */}
            <div className="grid grid-cols-7">
              {allDays.map((day, idx) => {
                if (!day) return <div key={`e-${idx}`} className="border-b border-r border-gray-50 min-h-[80px]" />;

                const dayEvents = getEventsForDay(day);
                const todayDay = isToday(day);
                const inMonth = isSameMonth(day, currentDate);
                const isSelected = selectedDay && isSameDay(day, selectedDay);

                return (
                  <div
                    key={day.toString()}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`border-b border-r border-gray-50 min-h-[80px] p-1.5 cursor-pointer transition-colors ${
                      isSelected ? "bg-secondary/5" :
                      todayDay ? "bg-primary/5" :
                      "hover:bg-gray-50"
                    }`}
                  >
                    <div className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                      todayDay ? "bg-primary text-white" :
                      !inMonth ? "text-gray-300" :
                      "text-gray-700"
                    }`}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev, i) => {
                        const cfg = EVENT_TYPES[ev.type];
                        return (
                          <div key={i} className={`text-[10px] px-1 py-0.5 rounded truncate font-medium border ${cfg.color}`}>
                            {ev.label}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="font-bold text-secondary mb-3 text-sm">
                {format(selectedDay, "EEEE, MMMM d")} — {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? "s" : ""}
              </h3>
              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-gray-400">Nothing scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map((ev, i) => {
                    const cfg = EVENT_TYPES[ev.type];
                    return (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.color}`}>
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{ev.label}</div>
                          {ev.sublabel && <div className="text-xs opacity-70 mt-0.5">{ev.sublabel}</div>}
                          {ev.projectId && (
                            <a
                              href={`/estimator/projects/${ev.projectId}`}
                              className="text-xs underline opacity-70 hover:opacity-100 mt-0.5 block"
                            >
                              View project →
                            </a>
                          )}
                        </div>
                        <span className="text-[10px] font-bold ml-auto shrink-0 opacity-60 uppercase">{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: upcoming + legend */}
        <div className="space-y-4">
          {/* Legend */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Legend</h3>
            <div className="space-y-2">
              {Object.entries(EVENT_TYPES).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                  <span className="text-sm text-gray-600">{cfg.label}</span>
                  <span className="ml-auto text-xs text-gray-400 font-semibold">
                    {allEvents.filter(e => e.type === key).length}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming 30 days */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Next 30 Days</h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-400">Nothing coming up.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((ev, i) => {
                  const cfg = EVENT_TYPES[ev.type];
                  return (
                    <div key={i} className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-gray-700 truncate">{ev.label}</div>
                        <div className="text-[11px] text-gray-400">{ev.sublabel}</div>
                      </div>
                      <div className="text-[11px] font-bold text-gray-500 whitespace-nowrap shrink-0">
                        {format(ev.date, "MMM d")}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}