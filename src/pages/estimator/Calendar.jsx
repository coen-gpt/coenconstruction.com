import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Calendar, MapPin, Phone, Mail, RefreshCw } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

export default function ScheduleCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState("month");
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ["contractor-projects-calendar"],
    queryFn: () => base44.entities.ContractorProject.list(),
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncGoogleCalendar', {});
      const d = res.data;
      toast({ title: "Sync complete", description: `Pulled ${d.pulled} updates from Google Calendar, pushed ${d.pushed} new events.` });
      qc.invalidateQueries(["contractor-projects-calendar"]);
    } catch (e) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    }
    setSyncing(false);
  };

  // Filter projects with scheduled walkthroughs
  const scheduledWalkthroughs = projects
    .filter((p) => p.walkthrough_date)
    .sort((a, b) => new Date(a.walkthrough_date) - new Date(b.walkthrough_date));

  const upcomingWalkthroughs = scheduledWalkthroughs.filter(
    (p) => new Date(p.walkthrough_date) >= new Date()
  );

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const getWalkthroughsForDay = (day) => {
    return scheduledWalkthroughs.filter((p) =>
      isSameDay(new Date(p.walkthrough_date), day)
    );
  };

  const renderMonthGrid = () => {
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const firstDayOfWeek = startOfMonth(currentDate).getDay();
    const emptyDays = Array(firstDayOfWeek).fill(null);
    const allDays = [...emptyDays, ...daysInMonth];

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {allDays.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;

            const dayWalkthroughs = getWalkthroughsForDay(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, currentDate);

            return (
              <div
                key={day.toString()}
                className={`aspect-square p-1 rounded-lg border ${
                  isToday
                    ? "border-primary bg-primary/5"
                    : isCurrentMonth
                    ? "border-gray-200 bg-white"
                    : "border-gray-100 bg-gray-50"
                } hover:border-primary transition-colors`}
              >
                <div className={`text-xs font-semibold mb-0.5 ${!isCurrentMonth ? "text-gray-300" : "text-gray-700"}`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {dayWalkthroughs.slice(0, 2).map((project) => (
                    <a
                      key={project.id}
                      href={`/estimator/projects/${project.id}`}
                      className={`block text-xs px-1 py-0.5 rounded truncate transition-colors ${
                        project.google_calendar_event_id
                          ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                          : "bg-primary/10 text-primary hover:bg-primary/20"
                      }`}
                      title={`${project.client_name}${project.google_calendar_event_id ? " (GCal)" : ""}`}
                    >
                      {project.client_name}
                    </a>
                  ))}
                  {dayWalkthroughs.length > 2 && (
                    <div className="text-xs text-gray-500 px-1">+{dayWalkthroughs.length - 2} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderUpcomingList = () => {
    return (
      <div className="space-y-3">
        {upcomingWalkthroughs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No upcoming walkthroughs scheduled.
          </div>
        ) : (
          upcomingWalkthroughs.map((project) => (
            <a
              key={project.id}
              href={`/estimator/projects/${project.id}`}
              className="block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{project.client_name}</h3>
                  {project.google_calendar_event_id && (
                    <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">GCal</span>
                  )}
                </div>
                <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                  {format(new Date(project.walkthrough_date), "MMM d, yyyy")}
                </span>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                {project.client_address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> {project.client_address}
                  </div>
                )}
                {project.client_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />{" "}
                    <a href={`tel:${project.client_phone}`} className="hover:underline">
                      {project.client_phone}
                    </a>
                  </div>
                )}
                {project.client_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />{" "}
                    <a href={`mailto:${project.client_email}`} className="hover:underline">
                      {project.client_email}
                    </a>
                  </div>
                )}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Project Type: <span className="font-medium">{project.project_type}</span>
              </div>
            </a>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-primary" /> Walkthrough Schedule
        </h1>
        <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync Google Calendar"}
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-primary/20"></span> App-only</div>
        <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-blue-200"></span> Synced with Google Calendar</div>
      </div>

      {/* View Tabs */}
      <Tabs value={viewType} onValueChange={setViewType} className="mb-6">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="month">Month View</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
        </TabsList>

        {/* Month View */}
        <TabsContent value="month" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {format(currentDate, "MMMM yyyy")}
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {renderMonthGrid()}

          {/* Scheduled visits for this month */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              Scheduled Visits ({scheduledWalkthroughs.filter((p) => isSameMonth(new Date(p.walkthrough_date), currentDate)).length})
            </h3>
            <div className="space-y-2">
              {scheduledWalkthroughs
                .filter((p) => isSameMonth(new Date(p.walkthrough_date), currentDate))
                .map((project) => (
                  <a
                    key={project.id}
                    href={`/estimator/projects/${project.id}`}
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{project.client_name}</div>
                      <div className="text-sm text-gray-500">{project.project_type}</div>
                    </div>
                    <div className="text-sm font-semibold text-primary whitespace-nowrap ml-2">
                      {format(new Date(project.walkthrough_date), "MMM d, h:mm a")}
                    </div>
                  </a>
                ))}
            </div>
          </div>
        </TabsContent>

        {/* Upcoming View */}
        <TabsContent value="upcoming">
          {renderUpcomingList()}
        </TabsContent>
      </Tabs>
    </div>
  );
}