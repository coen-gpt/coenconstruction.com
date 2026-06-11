import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import TimeOffTab from "@/components/field/TimeOffTab";
import { Loader2, CalendarOff } from "lucide-react";

const OFFICE_ROLES = [
  "project_manager", "assistant_project_manager", "site_superintendent",
  "office_admin", "operations_manager", "office_manager", "admin"
];

export default function StaffTimeOff() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me()
      .then(u => { setUser(u); setLoading(false); })
      .catch(() => base44.auth.redirectToLogin());
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-secondary flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-secondary px-4 pt-8 pb-5">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <CalendarOff className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-base">Time Off Requests</div>
            <div className="text-white/60 text-xs">{user?.full_name || user?.email}</div>
          </div>
        </div>
      </div>
      <div className="max-w-lg mx-auto p-4">
        <TimeOffTab user={user} isFieldCrew={false} />
      </div>
    </div>
  );
}