import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO, isValid, isPast
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, ExternalLink, RefreshCw, CalendarCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";

// ── Event type config ──────────────────────────────────────────────────────────
const EVENT_TYPES = {
  site_visit:     { label: "Site Visit",         color: "bg-blue-100 text-blue-700 border-blue-200",    dot: "bg-blue-500",   icon: "📍" },
  milestone:      { label: "Milestone",           color: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500", icon: "🏁" },
  key_date:       { label: "Key Date",            color: "bg-green-100 text-green-700 border-green-200",  dot: "bg-green-500",  icon: "📋" },
  sub_deadline:   { label: "Sub Deadline",        color: "bg-amber-100 text-amber-700 border-amber-200",  dot: "bg-amber-500",  icon: "🔧" },
  task_due:       { label: "Task Due",            color: "bg-red-100 text-red-700 border-red-200",        dot: "bg-red-500",    icon: "✅" },
  project_start:  { label: "Project Start",       color: "bg-teal-100 text-teal-700 border-teal-200",     dot: "bg-teal-500",   icon: "🚀" },
};

const ACTIVE_STATUSES = new Set(["approved", "in_progress", "walkthrough", "draft", "pending_review", "sent", "modify", "imported"]);

function parseDate(str) {
  if (!str) return null;
  try { const d = parseISO(str); return isValid(d) ? d : null; } catch { return null; }
}

function buildEvents(projects, tasks) {
  const events = [];

  for (const p of projects) {
    if (!ACTIVE_STATUSES.has(p.status)) continue;

    // ① Walkthrough / site visit
    const wtDate = parseDate(p.walkthrough_date);
    if (wtDate) {
      events.push({
        id: `wt-${p.id}`, date: wtDate, type: "site_visit",
        label: p.client_name, sublabel: p.project_type || "Site Visit",
        projectId: p.id, clientName: p.client_name,
      });
    }

    // ② Project start date
    const startDate = parseDate(p.workflow_schedule?.start_date);
    if (startDate) {
      events.push({
        id: `start-${p.id}`, date: startDate, type: "project_start",
        label: p.client_name, sublabel: p.project_type || "Project Start",
        projectId: p.id, clientName: p.client_name,
      });
    }

    // ③ Workflow stage milestones with due dates
    for (const stage of (p.workflow_stages || [])) {
      for (const m of (stage.milestones || [])) {
        if (m.done) continue;
        const d = parseDate(m.due_date);
        if (!d) continue;
        events.push({
          id: `ms-${p.id}-${stage.id}-${m.id}`,
          date: d, type: "milestone",
          label: m.label || "Milestone",
          sublabel: `${p.client_name} · ${stage.name}`,
          projectId: p.id, clientName: p.client_name,
          overdue: isPast(d),
        });
      }
    }

    // ④ Key dates from workflow_schedule
    for (const kd of (p.workflow_schedule?.key_dates || [])) {
      if (kd.done) continue;
      const d = parseDate(kd.date);
      if (!d) continue;
      const lc = (kd.label || "").toLowerCase();
      const type = lc.includes("sub") || lc.includes("contractor") ? "sub_deadline" : "key_date";
      events.push({
        id: `kd-${p.id}-${kd.id}`,
        date: d, type,
        label: kd.label || "Key Date",
        sublabel: p.client_name,
        projectId: p.id, clientName: p.client_name,
        overdue: isPast(d),
      });
    }

    // ⑤ Pending subcontractor assignments (estimated deadline = assigned + 7d)
    for (const sa of (p.subcontractor_assignments || [])) {
      if (sa.status !== "pending") continue;
      const assignedDate = parseDate(sa.assigned_at);
      if (!assignedDate) continue;
      const deadline = new Date(assignedDate.getTime() + 7 * 86400_000);
      events.push({
        id: `sa-${p.id}-${sa.id}`,
        date: deadline, type: "sub_deadline",
        label: sa.subcontractor_name || "Subcontractor",
        sublabel: `${p.client_name} · pending`,
        projectId: p.id, clientName: p.client_name,
        overdue: isPast(deadline),
      });
    }
  }

  // ⑥ Open ProjectTask due dates
  for (const t of tasks) {
    if (!t.due_date || t.status === "done" || t.status === "skipped") continue;
    const d = parseDate(t.due_date);
    if (!d) continue;
    events.push({
      id: `task-${t.id}`,
      date: d, type: "task_due",
      label: t.title,
      sublabel: t.assigned_role?.replace(/_/g, " "),
      projectId: t.project_id,
      overdue: isPast(d),
    });
  }

  return events;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EventChip({ ev, compact = false }) {
  const cfg = EVENT_TYPES[ev.type];
  return (
    <div className={`text-[10px] px-1 py-0.5 rounded truncate font-medium border ${cfg.color} ${ev.overdue ? "opacity-60" : ""}`}>
      {cfg.icon} {ev.label}
    </div>
  );
}

function EventRow({ ev, showDate = false }) {
  const cfg = EVENT_TYPES[ev.type];
  return (
    <div className={`flex items-start gap-2.5 py-2.5 border-b border-gray-50 last:border-0 ${ev.overdue ? "opacity-60" : ""}`}>
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-gray-700 truncate">{ev.label}</div>
        <div className="text-[11px] text-gray-400 truncate">{ev.sublabel}</div>
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${cfg.color} inline-block mt-0.5`}>{cfg.label}</span>
      </div>
      {showDate && (
        <div className="text-[11px] font-bold text-gray-500 whitespace-nowrap shrink-0 mt-0.5">
          {format(ev.date, "MMM d")}
        </div>
      )}
      {ev.projectId && (
        <Link
          to={`/estimator/projects/${ev.projectId}`}
          className="shrink-0 text-gray-300 hover:text-primary transition-colors mt-0.5"
          title="View project"
        >
          <ExternalLink className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

// ── Office Calendar review & sync ──────────────────────────────────────────────
// The shared Google "Office Calendar" holds walkthroughs from two directions:
// lead self-scheduling (already linked via booking_event_id) and events the
// office adds by hand. This dialog reviews both and syncs the manual ones into
// Leads, plus heals dates when a linked event was moved on the calendar.
const SYNC_STATUS = {
  synced:      { label: "In sync",        cls: "bg-green-100 text-green-700" },
  updated:     { label: "Date updated",   cls: "bg-green-100 text-green-700" },
  linked:      { label: "Linked to lead", cls: "bg-green-100 text-green-700" },
  created:     { label: "Lead created",   cls: "bg-green-100 text-green-700" },
  drifted:     { label: "Date moved",     cls: "bg-amber-100 text-amber-700" },
  link_lead:   { label: "Will link lead", cls: "bg-amber-100 text-amber-700" },
  create_lead: { label: "Will create lead", cls: "bg-amber-100 text-amber-700" },
  skipped:     { label: "Skipped",        cls: "bg-gray-100 text-gray-500" },
};

function OfficeCalendarSync({ onSynced }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [report, setReport] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("syncWalkthroughCalendar", {});
      setReport(res.data);
    } catch (e) {
      toast({ title: "Could not load the Office Calendar", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const applySync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("syncWalkthroughCalendar", { apply: true });
      toast({
        title: "Office Calendar synced",
        description: `${res.data?.applied || 0} walkthrough${res.data?.applied === 1 ? "" : "s"} synced into the app.`,
      });
      setReport(res.data);
      onSynced?.();
    } catch (e) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    }
    setSyncing(false);
  };

  const openDialog = () => { setOpen(true); setReport(null); load(); };
  const needsSync = report?.events?.filter(e => ["drifted", "link_lead", "create_lead"].includes(e.status)) || [];
  const inSync = report?.events?.filter(e => ["synced", "updated", "linked", "created"].includes(e.status)) || [];
  const skipped = report?.events?.filter(e => e.status === "skipped") || [];

  const EventList = ({ title, items }) => items.length > 0 && (
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">{title} ({items.length})</p>
      <div className="space-y-1.5">
        {items.map(ev => {
          const cfg = SYNC_STATUS[ev.status] || SYNC_STATUS.skipped;
          return (
            <div key={ev.event_id} className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-700 truncate">{ev.summary}</div>
                <div className="text-[11px] text-gray-400">
                  {(() => { try { return format(parseISO(ev.start), ev.all_day ? "EEE, MMM d" : "EEE, MMM d · h:mm a"); } catch { return ev.start; } })()}
                  {ev.detail ? ` — ${ev.detail}` : ""}
                </div>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0 ${cfg.cls}`}>{cfg.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={openDialog}>
        <CalendarCheck className="w-3.5 h-3.5" /> Office Calendar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-primary" /> Office Calendar — Walkthroughs
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500 -mt-1">
            Reviews the shared walkthrough calendar (last 2 weeks → next 90 days). Self-scheduled bookings are
            checked for moved dates; events added by hand are matched to a lead or imported as a new lead.
            Manual events must include "Walkthrough" in the title to sync.
          </p>
          {loading && (
            <div className="py-10 text-center text-gray-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Reading the Office Calendar…
            </div>
          )}
          {!loading && report && (
            <div className="space-y-4 mt-1">
              {needsSync.length > 0 && (
                <Button onClick={applySync} disabled={syncing} className="w-full gap-2 bg-primary text-white">
                  {syncing
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</>
                    : <><RefreshCw className="w-4 h-4" /> Sync {needsSync.length} walkthrough{needsSync.length !== 1 ? "s" : ""} into the app</>}
                </Button>
              )}
              {needsSync.length === 0 && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg p-2.5 text-center">
                  Everything on the Office Calendar is already synced ✓
                </p>
              )}
              <EventList title="Needs sync" items={needsSync} />
              <EventList title="Synced" items={inSync} />
              <EventList title="Skipped (not labeled as walkthroughs)" items={skipped} />
              {report.events?.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No events on the Office Calendar in this window.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminCalendar() {
  const qc = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["admin-cal-projects"],
    queryFn: () => adminEntities.ContractorProject.list("-updated_date", 500),
    staleTime: 60_000,
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["admin-cal-tasks"],
    queryFn: () => base44.entities.ProjectTask.list("-created_date", 1000),
    staleTime: 60_000,
  });

  const allEvents = useMemo(() => buildEvents(projects, tasks), [projects, tasks]);

  const filtered = useMemo(() =>
    typeFilter === "all" ? allEvents : allEvents.filter(e => e.type === typeFilter),
    [allEvents, typeFilter]
  );

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  const firstDayOfWeek = startOfMonth(currentDate).getDay();
  const allDays = [...Array(firstDayOfWeek).fill(null), ...daysInMonth];

  const getEventsForDay = (day) => filtered.filter(e => isSameDay(e.date, day));
  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const upcoming = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 86400_000);
    return filtered
      .filter(e => e.date >= now && e.date <= end)
      .sort((a, b) => a.date - b.date)
      .slice(0, 20);
  }, [filtered]);

  const isLoading = loadingProjects || loadingTasks;
  const totalEventsThisMonth = useMemo(() =>
    filtered.filter(e => isSameMonth(e.date, currentDate)).length,
    [filtered, currentDate]
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-gray-500 mt-0.5">
            Site visits, milestones, sub deadlines & tasks across all active jobs
            {!isLoading && <span className="ml-2 font-semibold text-secondary">{allEvents.length} total events</span>}
          </p>
        </div>

        {/* Type filter pills */}
        <div className="flex flex-wrap items-center gap-2">
          <OfficeCalendarSync onSynced={() => qc.invalidateQueries({ queryKey: ["admin-cal-projects"] })} />
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
              {cfg.icon} {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Calendar grid */}
          <div className="xl:col-span-2 space-y-4">
            {/* Month nav */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-secondary">{format(currentDate, "MMMM yyyy")}</h2>
                <p className="text-xs text-gray-400">{totalEventsThisMonth} event{totalEventsThisMonth !== 1 ? "s" : ""} this month</p>
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" onClick={() => { setCurrentDate(subMonths(currentDate, 1)); setSelectedDay(null); }}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setCurrentDate(new Date()); setSelectedDay(null); }}>Today</Button>
                <Button variant="outline" size="sm" onClick={() => { setCurrentDate(addMonths(currentDate, 1)); setSelectedDay(null); }}>
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
                  if (!day) return <div key={`e-${idx}`} className="border-b border-r border-gray-50 min-h-[88px]" />;

                  const dayEvents = getEventsForDay(day);
                  const todayDay = isToday(day);
                  const inMonth = isSameMonth(day, currentDate);
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  const hasOverdue = dayEvents.some(e => e.overdue);

                  return (
                    <div
                      key={day.toString()}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={`border-b border-r border-gray-50 min-h-[88px] p-1.5 cursor-pointer transition-colors ${
                        isSelected ? "bg-secondary/5 ring-1 ring-secondary/20" :
                        todayDay ? "bg-primary/5" :
                        "hover:bg-gray-50/80"
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <div className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                          todayDay ? "bg-primary text-white" :
                          !inMonth ? "text-gray-300" :
                          "text-gray-700"
                        }`}>
                          {format(day, "d")}
                        </div>
                        {hasOverdue && <div className="w-1.5 h-1.5 rounded-full bg-red-400" title="Overdue items" />}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <EventChip key={ev.id} ev={ev} />
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-gray-400 px-1 font-medium">+{dayEvents.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected day detail */}
            {selectedDay && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="font-bold text-secondary mb-3 text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  {format(selectedDay, "EEEE, MMMM d, yyyy")}
                  <span className="text-gray-400 font-normal">· {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? "s" : ""}</span>
                </h3>
                {selectedDayEvents.length === 0 ? (
                  <p className="text-sm text-gray-400">Nothing scheduled for this day.</p>
                ) : (
                  <div className="space-y-0">
                    {selectedDayEvents.map((ev) => (
                      <EventRow key={ev.id} ev={ev} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Legend + counts */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Event Types</h3>
              <div className="space-y-2">
                {Object.entries(EVENT_TYPES).map(([key, cfg]) => {
                  const count = allEvents.filter(e => e.type === key).length;
                  const overdueCount = allEvents.filter(e => e.type === key && e.overdue).length;
                  return (
                    <button
                      key={key}
                      onClick={() => setTypeFilter(typeFilter === key ? "all" : key)}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors text-left ${
                        typeFilter === key ? "bg-gray-100" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <span className="text-sm text-gray-600 flex-1">{cfg.label}</span>
                      <div className="flex items-center gap-1">
                        {overdueCount > 0 && (
                          <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">
                            {overdueCount} overdue
                          </span>
                        )}
                        <span className="text-xs font-bold text-gray-400">{count}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Upcoming 30 days */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                Next 30 Days
                {upcoming.length > 0 && <span className="ml-1 text-primary">{upcoming.length}</span>}
              </h3>
              {upcoming.length === 0 ? (
                <p className="text-sm text-gray-400">Nothing coming up.</p>
              ) : (
                <div className="space-y-0 max-h-[480px] overflow-y-auto">
                  {upcoming.map((ev) => (
                    <EventRow key={ev.id} ev={ev} showDate />
                  ))}
                </div>
              )}
            </div>

            {/* Overdue summary */}
            {allEvents.some(e => e.overdue) && (
              <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
                <h3 className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                  Overdue ({allEvents.filter(e => e.overdue).length})
                </h3>
                <div className="space-y-0 max-h-56 overflow-y-auto">
                  {allEvents
                    .filter(e => e.overdue)
                    .sort((a, b) => a.date - b.date)
                    .slice(0, 10)
                    .map(ev => (
                      <EventRow key={ev.id} ev={ev} showDate />
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}