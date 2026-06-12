import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import adminEntities from "@/api/adminEntities";
import { Link } from "react-router-dom";
import {
  UserPlus, ChevronDown, ChevronUp, CheckCircle2, ArrowUpRight,
  Phone, Mail, CalendarCheck, Send, AlertTriangle, Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const SOURCE_STYLES = {
  "Email Campaign": "bg-purple-100 text-purple-700",
  "Contact Form": "bg-blue-100 text-blue-700",
  "Design Preview": "bg-pink-100 text-pink-700",
  "Budget Estimator": "bg-teal-100 text-teal-700",
  Angi: "bg-orange-100 text-orange-700",
  Phone: "bg-green-100 text-green-700",
  Referral: "bg-indigo-100 text-indigo-700",
};

// One chip summarizing where the lead is in the self-booking funnel. The
// amber "link not sent" state is the one that needs action: the automation
// fires the booking email exactly once, so a transient failure there leaves
// the lead stranded until someone resends.
function BookingChip({ lead, onResend, resending }) {
  if (lead.booking_event_id) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-green-100 text-green-700 rounded-full px-2 py-0.5">
        <CalendarCheck className="w-3 h-3" /> Walkthrough booked
      </span>
    );
  }
  if (lead.booking_sent_at) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-sky-100 text-sky-700 rounded-full px-2 py-0.5">
        <Send className="w-3 h-3" /> Booking link sent
      </span>
    );
  }
  if (!lead.email) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
        No email — call to schedule
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
        <AlertTriangle className="w-3 h-3" /> Booking link not sent
      </span>
      <button
        onClick={onResend}
        disabled={resending}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline disabled:opacity-50"
      >
        {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
        Send link
      </button>
    </span>
  );
}

export default function NewLeadsPanel() {
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [resendingId, setResendingId] = useState(null);
  const [resendMsg, setResendMsg] = useState(null);

  const { data: newLeads = [], isLoading } = useQuery({
    queryKey: ["new-leads"],
    queryFn: () => adminEntities.Lead.filter({ status: "New" }, "-created_date", 100),
    refetchInterval: 60_000,
  });

  const handleResend = async (lead) => {
    setResendingId(lead.id);
    setResendMsg(null);
    try {
      const res = await base44.functions.invoke("scheduleLeadWalkthrough", {
        full_name: lead.full_name,
        email: lead.email,
        phone: lead.phone || "",
        project_type: lead.project_type,
        address: lead.address || "",
        source: lead.source || "Website",
        contractor_project_id: lead.contractor_project_id || null,
        lead_id: lead.id,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      setResendMsg({ ok: true, text: `Booking link emailed to ${lead.full_name}.` });
      qc.invalidateQueries({ queryKey: ["new-leads"] });
    } catch (e) {
      setResendMsg({ ok: false, text: `Could not send booking link: ${e.message}` });
    }
    setResendingId(null);
  };

  const count = newLeads.length;
  const unsent = newLeads.filter(l => l.email && !l.booking_sent_at && !l.booking_event_id).length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${count > 0 ? "bg-blue-100" : "bg-gray-100"}`}>
          <UserPlus className={`w-4 h-4 ${count > 0 ? "text-blue-600" : "text-gray-400"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-secondary text-sm">New Leads</h2>
            {count > 0 && (
              <span className="text-xs font-bold bg-blue-600 text-white rounded-full px-2 py-0.5">{count}</span>
            )}
            {unsent > 0 && (
              <span className="text-xs font-bold bg-amber-500 text-white rounded-full px-2 py-0.5">
                {unsent} missing booking link
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Fresh inquiries awaiting first contact or a walkthrough booking</p>
        </div>
        <Link
          to="/admin/leads"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
        >
          All leads <ArrowUpRight className="w-3 h-3" />
        </Link>
        {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {!collapsed && (
        <>
          {resendMsg && (
            <div className={`px-5 py-2 text-xs font-medium ${resendMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {resendMsg.text}
            </div>
          )}
          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {isLoading && (
              <div className="py-10 text-center text-sm text-gray-400 animate-pulse">Loading leads…</div>
            )}
            {!isLoading && count === 0 && (
              <div className="py-10 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p className="text-sm text-green-700 font-medium">No new leads waiting — inbox zero</p>
              </div>
            )}
            {newLeads.map((lead) => (
              <div key={lead.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-secondary truncate">{lead.full_name}</span>
                    <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${SOURCE_STYLES[lead.source] || "bg-gray-100 text-gray-600"}`}>
                      {lead.source || "Other"}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {lead.created_date ? formatDistanceToNow(new Date(lead.created_date), { addSuffix: true }) : ""}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {lead.project_type || "General Inquiry"}
                    {lead.address ? ` · ${lead.address}` : ""}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                    <BookingChip
                      lead={lead}
                      onResend={() => handleResend(lead)}
                      resending={resendingId === lead.id}
                    />
                    {lead.phone && lead.phone !== "Not provided" && (
                      <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-indigo-600">
                        <Phone className="w-3 h-3" /> {lead.phone}
                      </a>
                    )}
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-indigo-600 truncate max-w-[220px]">
                        <Mail className="w-3 h-3 shrink-0" /> {lead.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
