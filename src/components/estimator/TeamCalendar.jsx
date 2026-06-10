import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Link } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, CalendarDays
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, isSameMonth, parseISO, isValid
} from "date-fns";

// Event type config
const EVENT_TYPES = {
  walkthrough:  { label: "Walkthrough",   color: "bg-blue-100 text-blue-700 border-blue-200",   dot: "bg-blue-500" },
  milestone:    { label: "Milestone",     color: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  field_task:   { label: "Task Due",      color: "bg-amber-100 text-amber-700 border-amber-200",  dot: "bg-amber-500" },
  time_entry:   { label: "Crew On-Site",  color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
};

function safeDate(val) {
  if (!val) return null;
  const d = typeof val === "string" ? parseISO(val) : new Date(val);
  return isValid(d) ? d : null;
}

function buildEvents(projects, fieldTasks, timeEntries) {
  const events = [];

  // Walkthroughs
  projects.forEach(p => {
    const d = safeDate(p.walkthrough_date);
    if (d) events.push({ type: "walkthrough", date: d, label: p.client_name, sub: p.project_type, link: `/estimator/projects/${p.id}` });
  });

  // Workflow milestones with due dates
  projects.forEach(p => {
    (p.workflow_stages || []).forEach(stage => {
      (stage.milestones || []).forEach(m => {
        if (!m.due_date || m.done) return;
        const d = safeDate(m.due_date);
        if (d) events.push({ type: "milestone", date: d, label: m.label, sub: `${p.client_name} · ${stage.name}`, link: `/estimator/projects/${p.id}` });
      });
    });
    // Key dates from workflow_schedule
    (p.workflow_schedule?.key_dates || []).forEach(kd => {
      if (!kd.date || kd.done) return;
      const d = safeDate(kd.date);
      if (d) events.push({ type: "milestone", date: d, label: kd.label, sub: p.client_name, link: `/estimator/projects/${p.id}` });
    });
  });

  // Field tasks
  fieldTasks.forEach(t => {
    const d = safeDate(t.due_date);
    if (d) events.push({ type: "field_task", date: d, label: t.title, sub: `${t.assigned_to_name || "Unassigned"} · ${t.project_name || ""}`.trim().replace(/·\s*$/, ""), link: null });
  });

  // Time entries — show unique crew days per project
  const seenDays = new Set();
  timeEntries.forEach(e => {
    const d = safeDate(e.date || e.clock_in);
    if (!d) return;
    const key = `${format(d, "yyyy-MM-dd")}|${e.user_email}`;
    if (seenDays.has(key)) return;
    seenDays.add(key);
    events.push({ type: "time_entry", date: d, label: e.user_name || e.user_email || "Crew", sub: e.project_name || "", link: null });
  });

  return events;
}

function DayCell({ day, events, isCurrentMonth, brandColor }) {
  const isToday = isSameDay(day, new Date());
  const dayEvents = events.filter(e => isSameDay(e.date, day));
  const MAX_SHOW = 3;
  const overflow = dayEvents.length - MAX_SHOW;

  return (
    <div className={`min-h-[90px] p-1.5 rounded-lg border text-xs transition-colors ${
      isToday ? "border-primary bg-primary/5 ring-1 ring-primary/20" :
      isCurrentMonth ? "border-gray-100 bg-white hover:border-gray-200" :
      "border-gray-50 bg-gray-50/50"
    }`}>
      <div className={`font-semibold mb-1 text-[11px] w-5 h-5 flex items-center justify-center rounded-full ${
        isToday ? "bg-primary text-white" : isCurrentMonth ? "text-slate-600" : "text-slate-300"
      }`}>
        {format(day, "d")}
      </div>
      <div className="space-y-0.5">
        {dayEvents.slice(0, MAX_SHOW).map((ev, i) => {
          const cfg = EVENT_TYPES[ev.type];
          const inner = (
            <div className={`px-1 py-0.5 rounded border truncate leading-tight ${cfg.color} cursor-pointer`} title={`${ev.label}${ev.sub ? ` — ${ev.sub}` : ""}`}>
              {ev.label}
            </div>
          );
          return ev.link ? <Link key={i} to={ev.link}>{inner}</Link> : <div key={i}>{inner}</div>;
        })}
        {overflow > 0 && (
          <div className="text-[10px] text-slate-400 pl-1">+{overflow} more</div>
        )}
      </div>
    </div>
  );
}

function AgendaList({ events, brandColor }) {
  const upcoming = events
    .filter(e => e.date >= new Date(new Date().setHours(0,0,0,0)))
    .sort((a, b) => a.date - b.date)
    .slice(0, 40);

  if (upcoming.length === 0) return (
    <div className="text-center py-16 text-slate-400">
      <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">No upcoming events.</p>
    </div>
  );

  let lastDate = null;
  return (
    <div className="space-y-1">
      {upcoming.map((ev, i) => {
        const dateStr = format(ev.date, "EEEE, MMMM d");
        const showHeader = dateStr !== lastDate;
        lastDate = dateStr;
        const cfg = EVENT_TYPES[ev.type];
        const row = (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
            <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm text-slate-700 truncate">{ev.label}</div>
              {ev.sub && <div className="text-xs text-slate-400 truncate">{ev.sub}</div>}
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${cfg.color}`}>{cfg.label}</span>
          </div>
        );
        return (
          <div key={i}>
            {showHeader && (
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide px-4 pt-4 pb-1">{dateStr}</div>
            )}
            {ev.link ? <Link to={ev.link}>{row}</Link> : row}
          </div>
        );
      })}
    </div>
  );
}

export default function TeamCalendar({ brandColor = "#E35235" }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month"); // "month" | "agenda"

  const { data: projects = [] } = useQuery({
    queryKey: ["team-cal-projects"],
    queryFn: () => adminEntities.ContractorProject.list("-updated_date", 500),
  });
  const { data: fieldTasks = [] } = useQuery({
    queryKey: ["team-cal-tasks"],
    queryFn: () => base44.entities.FieldTask.filter({ status: ["assigned", "in_progress"] }),
  });
  const { data: timeEntries = [] } = useQuery({
    queryKey: ["team-cal-time"],
    queryFn: () => base44.entities.TimeEntry.list("-clock_in", 200),
  });

  const allEvents = buildEvents(projects, fieldTasks, timeEntries);

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  const firstDayOffset = startOfMonth(currentDate).getDay();
  const emptyCells = Array(firstDayOffset).fill(null);
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const thisMonthEvents = allEvents.filter(e => isSameMonth(e.date, currentDate));
  const typeCounts = Object.entries(EVENT_TYPES).map(([type, cfg]) => ({
    ...cfg,
    type,
    count: thisMonthEvents.filter(e => e.type === type).length,
  })).filter(t => t.count > 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-700 text-sm">Team Calendar</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
              {["month", "agenda"].map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1 rounded-md font-semibold capitalize transition-all ${view === v ? "bg-white shadow text-slate-700" : "text-slate-500 hover:text-slate-700"}`}>
                  {v}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setCurrentDate(new Date())}>Today</Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Month title + counts */}
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50/50 border-b border-gray-50">
          <span className="font-bold text-slate-700">{format(currentDate, "MMMM yyyy")}</span>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {typeCounts.map(({ type, dot, label, count }) => (
              <div key={type} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                {label} <span className="font-bold text-slate-700">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar body */}
        <div className="p-4">
          {view === "month" ? (
            <>
              <div className="grid grid-cols-7 mb-2">
                {weekDays.map(d => (
                  <div key={d} className="text-center text-[11px] font-semibold text-slate-400 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {emptyCells.map((_, i) => <div key={`e${i}`} />)}
                {daysInMonth.map(day => (
                  <DayCell
                    key={day.toString()}
                    day={day}
                    events={allEvents}
                    isCurrentMonth={isSameMonth(day, currentDate)}
                    brandColor={brandColor}
                  />
                ))}
              </div>
            </>
          ) : (
            <AgendaList events={allEvents} brandColor={brandColor} />
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(EVENT_TYPES).map(([type, { label, color, dot }]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}