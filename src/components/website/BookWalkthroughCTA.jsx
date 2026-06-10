import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, CalendarCheck, Loader2, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * Post-submit success step for every lead form (contact form, design builder…).
 * Asks the new lead whether they want to lock in their free walkthrough time
 * right now (self-scheduling on the shared walkthrough calendar) or just leave
 * the request with us.
 *
 * Fetches the lead's booking link via scheduleLeadWalkthrough with
 * skip_email=true — the function is idempotent, so the backup email the
 * Lead-create hook sends uses the SAME token and nothing is duplicated.
 */
export default function BookWalkthroughCTA({ lead, title = "Thank You!", subtitle = "We'll be in touch within 1 business day." }) {
  const navigate = useNavigate();
  const [bookingUrl, setBookingUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lead?.id) { setLoading(false); return; }
    base44.functions.invoke("scheduleLeadWalkthrough", {
      lead_id: lead.id,
      full_name: lead.full_name,
      email: lead.email || "",
      phone: lead.phone || "",
      project_type: lead.project_type,
      address: lead.address || "",
      source: lead.source || "Website",
      contractor_project_id: lead.contractor_project_id || null,
      skip_email: true,
    })
      .then((res) => {
        const token = res.data?.booking_token;
        if (token) setBookingUrl(`/book-walkthrough?token=${token}`);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lead?.id]);  

  return (
    <div className="text-center py-8">
      <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
      <h3 className="text-xl font-bold text-secondary mb-2">{title}</h3>
      <p className="text-gray-600 mb-6">{subtitle}</p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking walkthrough availability…
        </div>
      ) : bookingUrl ? (
        <div className="max-w-sm mx-auto space-y-3">
          <p className="text-sm font-semibold text-secondary">
            Want to lock in your free walkthrough right now?
          </p>
          <button
            type="button"
            onClick={() => navigate(bookingUrl)}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl px-6 py-3.5 transition-colors"
          >
            <CalendarCheck className="w-5 h-5" /> Book My Walkthrough Time Now
          </button>
          <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Takes 30 seconds — or skip it and we'll call you to schedule.
          </p>
        </div>
      ) : null}
    </div>
  );
}
