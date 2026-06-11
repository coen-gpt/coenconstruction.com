import { base44 } from "@/api/base44Client";
import { parseLocalDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Trash2, Wrench, CheckSquare, Truck, Users, Clock, MapPin, ChevronRight } from "lucide-react";

// chip = the category badge; iconWrap = the round icon holder. Kept as whole
// class strings — composing Tailwind classes via string replace produced
// classes that don't exist.
const CATEGORY_CONFIG = {
  "tear-off": { label: "Tear-Off / Demolition", chip: "bg-red-100 text-red-700 border-red-200", iconWrap: "bg-red-50 text-red-600 border-red-200", icon: Trash2 },
  "installation": { label: "Installation / Construction", chip: "bg-blue-100 text-blue-700 border-blue-200", iconWrap: "bg-blue-50 text-blue-600 border-blue-200", icon: Wrench },
  "walkthrough": { label: "Walkthrough / Inspection", chip: "bg-green-100 text-green-700 border-green-200", iconWrap: "bg-green-50 text-green-600 border-green-200", icon: CheckSquare },
  "delivery": { label: "Material Delivery", chip: "bg-amber-100 text-amber-700 border-amber-200", iconWrap: "bg-amber-50 text-amber-600 border-amber-200", icon: Truck },
  "meeting": { label: "Meeting / Consultation", chip: "bg-purple-100 text-purple-700 border-purple-200", iconWrap: "bg-purple-50 text-purple-600 border-purple-200", icon: Users },
  "other": { label: "Scheduled", chip: "bg-gray-100 text-gray-700 border-gray-200", iconWrap: "bg-gray-50 text-gray-600 border-gray-200", icon: CalendarDays },
};

const MILESTONE_UPCOMING = { chip: null, iconWrap: "bg-gray-50 text-gray-500 border-gray-200" };
const MILESTONE_PAST = { chip: null, iconWrap: "bg-green-50 text-green-600 border-green-200" };

export default function ProjectTimeline({ project, token }) {
  const { data: calendarEvents, isLoading } = useQuery({
    queryKey: ["project-calendar", token],
    queryFn: async () => {
      const res = await base44.functions.invoke("getProjectCalendarEvents", { token });
      return res.data.events || [];
    },
    enabled: !!token,
    refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes
  });

  const workflowStages = project?.workflow_stages || [];
  const schedule = project?.workflow_schedule || {};

  const allMilestones = workflowStages.flatMap(s =>
    (s.milestones || []).map(m => ({ ...m, stageName: s.name, stageColor: s.color || "#E35235" }))
  );

  const done = allMilestones.filter(m => m.done).length;
  const total = allMilestones.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Combine calendar events and milestones
  const combinedEvents = [
    ...(calendarEvents || []).map(e => ({
      ...e,
      type: "calendar",
      date: e.start_date,
    })),
    ...allMilestones.filter(m => m.due_date).map(m => ({
      ...m,
      type: "milestone",
      date: m.due_date,
      title: m.label,
      category: "other",
    })),
  ].sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));

  // A milestone due today counts as upcoming until the day ends
  const endOfDate = (d) => { const dt = parseLocalDate(d); if (/^\d{4}-\d{2}-\d{2}$/.test(String(d))) dt.setHours(23, 59, 59); return dt; };
  const upcomingEvents = combinedEvents.filter(e => endOfDate(e.date) >= new Date());
  const pastEvents = combinedEvents.filter(e => endOfDate(e.date) < new Date());

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      <Card className="border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-gray-800">Project Schedule</CardTitle>
          {schedule.start_date && (
            <p className="text-sm text-gray-500 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-primary" />
              Started {parseLocalDate(schedule.start_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              {schedule.estimated_duration_weeks && ` · Est. ${schedule.estimated_duration_weeks} week${schedule.estimated_duration_weeks !== 1 ? "s" : ""}`}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: "#E35235" }}
              />
            </div>
            <span className="text-sm font-bold text-gray-700 shrink-0">{pct}%</span>
          </div>
          <p className="text-xs text-gray-400">{done} of {total} milestones complete</p>
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <Card className="border-gray-100 shadow-sm">
          <CardHeader className="pb-3 bg-blue-50/50 border-b border-blue-100">
            <CardTitle className="text-sm font-bold text-blue-800 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Upcoming Schedule ({upcomingEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-50">
              {upcomingEvents.slice(0, 5).map((event, idx) => {
                const EventIcon = event.type === "calendar"
                  ? (CATEGORY_CONFIG[event.category]?.icon || CalendarDays)
                  : (event.done ? CheckSquare : Clock);

                const config = event.type === "calendar"
                  ? (CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.other)
                  : MILESTONE_UPCOMING;

                const eventDate = parseLocalDate(event.date);
                const isToday = new Date().toDateString() === eventDate.toDateString();
                const isTomorrow = new Date(Date.now() + 86400000).toDateString() === eventDate.toDateString();

                return (
                  <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${config.iconWrap}`}>
                        <EventIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-gray-800 text-sm">{event.title}</span>
                          {config.label && (
                            <Badge className={`text-xs ${config.chip} border`}>
                              {config.label}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className={`font-semibold ${isToday ? "text-blue-600" : ""}`}>
                            {isToday ? "Today" : isTomorrow ? "Tomorrow" : eventDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </span>
                          {!event.all_day && event.start_date && (
                            <span>· {eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</span>
                          )}
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.location}
                            </span>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-xs text-gray-600 mt-2 line-clamp-2">{event.description}</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <Card className="border-gray-100 shadow-sm">
          <CardHeader className="pb-3 bg-gray-50/50 border-b border-gray-100">
            <CardTitle className="text-sm font-bold text-gray-600 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Completed ({pastEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-50">
              {pastEvents.slice(0, 5).map((event, idx) => {
                const EventIcon = event.type === "calendar"
                  ? (CATEGORY_CONFIG[event.category]?.icon || CalendarDays)
                  : CheckSquare;

                const config = event.type === "calendar"
                  ? (CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.other)
                  : MILESTONE_PAST;

                const eventDate = parseLocalDate(event.date);

                return (
                  <div key={idx} className="p-4 opacity-75 hover:opacity-100 transition-opacity">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${config.iconWrap}`}>
                        <EventIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-gray-700 text-sm line-through">{event.title}</span>
                          {config.label && (
                            <Badge className={`text-xs ${config.chip} border opacity-50`}>
                              {config.label}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {eventDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading / empty states — never shown alongside real events */}
      {isLoading && combinedEvents.length === 0 && (
        <Card className="border-gray-100 shadow-sm">
          <CardContent className="p-10 text-center">
            <CalendarDays className="w-10 h-10 text-gray-200 mx-auto mb-3 animate-pulse" />
            <p className="text-gray-500 font-medium">Loading schedule…</p>
          </CardContent>
        </Card>
      )}
      {!isLoading && combinedEvents.length === 0 && (
        <Card className="border-gray-100 shadow-sm">
          <CardContent className="p-10 text-center">
            <CalendarDays className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No scheduled events yet</p>
            <p className="text-gray-400 text-sm mt-1">
              Your project schedule will appear here once events are added to the calendar.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}