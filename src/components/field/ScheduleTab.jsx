import { useEffect, useState } from "react";
import { fieldApi } from "@/api/fieldApi";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { Loader2, MapPin, CalendarDays, Lock, Briefcase, StickyNote } from "lucide-react";

// Where am I working? Today's site always shows; tomorrow's unlocks at 5pm
// the night before (enforced server-side in fieldCrewProjects "mySchedule").
export default function ScheduleTab() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fieldApi("mySchedule")
      .then(setData)
      .catch(() => toast({ title: "Couldn't load your schedule", description: "Check your connection and reload.", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const today = data?.today || [];
  const tomorrow = data?.tomorrow || [];
  const unlocked = !!data?.tomorrowUnlocked;

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-gray-800 flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-primary" /> My Schedule
      </h2>

      <div>
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
          Today — {data?.dates?.today ? format(parseLocalDate(data.dates.today), "EEEE, MMM d") : ""}
        </div>
        {today.length ? today.map((a) => <AssignmentCard key={a.id} assignment={a} highlight />) : (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 border border-gray-100">
            <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="font-medium text-sm">Nothing scheduled for today</p>
            <p className="text-xs mt-1">Check with your supervisor if that doesn't look right.</p>
          </div>
        )}
      </div>

      <div>
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
          Tomorrow — {data?.dates?.tomorrow ? format(parseLocalDate(data.dates.tomorrow), "EEEE, MMM d") : ""}
        </div>
        {!unlocked ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 border border-dashed border-gray-200">
            <Lock className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p className="font-medium text-sm">Tomorrow's site unlocks at 5:00 PM</p>
            <p className="text-xs mt-1">Check back tonight or in the morning.</p>
          </div>
        ) : tomorrow.length ? tomorrow.map((a) => <AssignmentCard key={a.id} assignment={a} />) : (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 border border-gray-100">
            <p className="font-medium text-sm">Nothing scheduled for tomorrow yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AssignmentCard({ assignment, highlight = false }) {
  const mapsUrl = assignment.project_address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(assignment.project_address)}`
    : null;
  return (
    <div className={`rounded-2xl p-4 mb-2 ${highlight ? "bg-secondary" : "bg-white border border-gray-100"}`}>
      <div className={`font-bold ${highlight ? "text-white" : "text-gray-800"}`}>{assignment.project_name}</div>
      {assignment.project_address && (
        mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-1.5 text-sm mt-1 underline-offset-2 ${highlight ? "text-primary font-semibold" : "text-primary"}`}
          >
            <MapPin className="w-4 h-4 shrink-0" /> {assignment.project_address}
          </a>
        ) : (
          <div className={`flex items-center gap-1.5 text-sm mt-1 ${highlight ? "text-white/70" : "text-gray-500"}`}>
            <MapPin className="w-4 h-4 shrink-0" /> {assignment.project_address}
          </div>
        )
      )}
      {assignment.note && (
        <div className={`flex items-start gap-1.5 text-xs mt-2 rounded-xl p-2 ${highlight ? "bg-white/10 text-white/80" : "bg-amber-50 text-amber-800"}`}>
          <StickyNote className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {assignment.note}
        </div>
      )}
    </div>
  );
}
