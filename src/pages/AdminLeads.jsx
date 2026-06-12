import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { format, formatDistanceToNow } from "date-fns";
import {
  Phone, Mail, MessageSquare, ChevronDown, Search, Filter, ArrowRightCircle,
  Trash2, MapPin, CalendarCheck, Send, FileText, StickyNote,
  History, ExternalLink, Sparkles, UserPlus, Loader2,
} from "lucide-react";

function effectiveDate(lead) {
  return lead.lead_received_date
    ? new Date(lead.lead_received_date + "T00:00:00")
    : new Date(lead.created_date);
}

function formatLeadDate(lead) {
  return format(effectiveDate(lead), "MMM d, yyyy");
}

// Compact relative date for the lead list, like Angi's "7 hours" / "June 10".
function listDate(lead) {
  const d = effectiveDate(lead);
  const ageMs = Date.now() - d.getTime();
  if (ageMs < 24 * 60 * 60 * 1000 && ageMs >= 0) {
    return formatDistanceToNow(d, { addSuffix: true });
  }
  return format(d, "MMM d");
}

// Map raw lead project types onto the walkthrough's ContractorProject enum.
const PROJECT_TYPE_MAP = {
  "Home Addition": "Home Addition",
  "Kitchen Remodel": "Kitchen Remodel",
  "kitchen_remodel": "Kitchen Remodel",
  "Bathroom Remodel": "Bathroom Remodel",
  "bathroom_remodel": "Bathroom Remodel",
  "Deck / Porch / Pergola": "Deck / Porch / Pergola",
  "deck_porch_pergola": "Deck / Porch / Pergola",
  "Siding": "Siding",
  "siding": "Siding",
  "Custom Carpentry": "Custom Carpentry",
  "custom_carpentry": "Custom Carpentry",
  "Snow Removal": "Snow Removal",
  "snow_removal": "Snow Removal",
  "Full Home Renovation": "Full Home Renovation",
  "full_home_renovation": "Full Home Renovation",
  "General Inquiry": "Other",
  "general_inquiry": "Other",
};

// Best-effort parse of a free-form address into street / city / zipcode.
// Common formats: "341 Main St, Worcester, MA 02072" or "341 Main St, Worcester, MA".
function parseAddress(raw) {
  let street = raw || "";
  let city = "";
  let zipcode = "";
  if (street) {
    const parts = street.split(",").map(p => p.trim());
    if (parts.length >= 3) {
      street = parts[0];
      city = parts[1];
      const stateZip = parts[parts.length - 1].trim();
      const zipMatch = stateZip.match(/(\d{5}(-\d{4})?)/);
      if (zipMatch) zipcode = zipMatch[1];
    } else if (parts.length === 2) {
      street = parts[0];
      const stateZip = parts[1].trim();
      const zipMatch = stateZip.match(/(\d{5}(-\d{4})?)/);
      if (zipMatch) {
        zipcode = zipMatch[1];
        city = stateZip.replace(zipMatch[0], "").replace(/,/g, "").trim();
      } else {
        city = stateZip;
      }
    }
  }
  return { street, city, zipcode };
}

// Build the "Convert to Customer Quote" URL: opens the walkthrough (the canonical
// New Quote flow) pre-filled from the lead. Passing lead_id lets the walkthrough
// link the resulting ContractorProject back to this lead on submit, so the quote
// shows up attributed to its origin in Customer Quotes.
function buildConvertToQuoteUrl(lead) {
  let scope = lead.message || "";
  if (lead.project_id) {
    const designUrl = `${window.location.origin}/project?id=${lead.project_id}`;
    scope += `\n\n--- DESIGN PREVIEW ---\nCustomer used the AI Design Preview tool. View AI-generated design photos here: ${designUrl}`;
  }
  const { street, city, zipcode } = parseAddress(lead.address);
  const params = new URLSearchParams({
    lead_id: lead.id || "",
    lead_name: lead.full_name || "",
    lead_phone: lead.phone || "",
    lead_email: lead.email || "",
    lead_address: street,
    lead_city: city,
    lead_zipcode: zipcode,
    lead_project_type: PROJECT_TYPE_MAP[lead.project_type] || lead.project_type || "",
    lead_scope: scope,
  });
  return `/estimator/walkthrough?${params.toString()}`;
}

const STATUS_STYLES = {
  New: "bg-blue-100 text-blue-700",
  Contacted: "bg-yellow-100 text-yellow-700",
  Won: "bg-green-100 text-green-700",
  Lost: "bg-gray-100 text-gray-500",
  Imported: "bg-purple-100 text-purple-700",
};

// Angi-style solid status dot colors, used in the pipeline dropdown.
const STATUS_DOTS = {
  New: "bg-blue-500",
  Contacted: "bg-amber-500",
  Won: "bg-green-500",
  Lost: "bg-gray-700",
  Imported: "bg-purple-500",
};

const SOURCE_STYLES = {
  "Contact Form": "bg-purple-100 text-purple-700",
  "Design Preview": "bg-orange-100 text-orange-700",
  "Budget Estimator": "bg-blue-100 text-blue-700",
  Phone: "bg-teal-100 text-teal-700",
  Referral: "bg-pink-100 text-pink-700",
  Angi: "bg-green-100 text-green-800 border border-green-300",
  "Email Campaign": "bg-indigo-100 text-indigo-700",
  Other: "bg-gray-100 text-gray-600",
};

const STATUSES = ["New", "Contacted", "Won", "Lost", "Imported"];

// "Schedule a Walkthrough" quick action — opens the same self-scheduling slot
// picker the customer gets by email, pre-linked to this lead, so the office
// admin can book a time while on the phone. scheduleLeadWalkthrough is
// idempotent (reuses the lead's existing booking token) and skip_email keeps
// it from emailing the customer. Once booked, shows the confirmed slot.
function ScheduleWalkthroughButton({ lead, compact = false }) {
  const [opening, setOpening] = useState(false);

  if (lead.booking_event_id) {
    return (
      <div className={`flex items-center font-semibold text-green-600 ${compact ? "gap-1 text-xs" : "gap-2.5 text-sm"}`}>
        <CalendarCheck className={compact ? "w-3 h-3 shrink-0" : "w-4 h-4 shrink-0"} />
        Walkthrough booked{lead.booking_slot_start ? ` — ${format(new Date(lead.booking_slot_start), "MMM d, h:mm a")}` : ""}
      </div>
    );
  }

  const handleClick = async () => {
    if (opening) return;
    setOpening(true);
    try {
      const res = await base44.functions.invoke("scheduleLeadWalkthrough", {
        lead_id: lead.id,
        full_name: lead.full_name,
        email: lead.email || "",
        phone: lead.phone || "",
        project_type: lead.project_type,
        address: lead.address || "",
        source: lead.source || "Website",
        contractor_project_id: lead.contractor_project_id || null,
        skip_email: true,
      });
      const token = res.data?.booking_token;
      if (!token) throw new Error(res.data?.error || "No booking link available for this lead");
      window.open(`/book-walkthrough?token=${token}`, "_blank");
    } catch (e) {
      alert(`Could not open the walkthrough scheduler: ${e.message}`);
    }
    setOpening(false);
  };

  const Icon = opening ? Loader2 : CalendarCheck;
  return (
    <button
      onClick={handleClick}
      disabled={opening}
      className={compact
        ? "flex items-center gap-1 text-xs bg-secondary text-white px-2 py-1 rounded hover:bg-secondary/90 disabled:opacity-60"
        : "flex items-center gap-2.5 text-sm font-semibold text-primary hover:underline disabled:opacity-60"}
    >
      <Icon className={`shrink-0 ${compact ? "w-3 h-3" : "w-4 h-4"} ${opening ? "animate-spin" : ""}`} />
      Schedule a Walkthrough
    </button>
  );
}

function MobileLeadCard({ lead, onStatusChange, onNotesChange, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(lead.notes || "");
  const [saving, setSaving] = useState(false);

  const handleConvert = () => window.open(buildConvertToQuoteUrl(lead), "_blank");

  const saveNotes = async () => {
    setSaving(true);
    await onNotesChange(lead.id, notes);
    setSaving(false);
  };

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-secondary text-sm">{lead.full_name}</div>
          <div className="text-xs text-gray-400">{formatLeadDate(lead)}</div>
          {lead.project_id && (
            <a href={`/project?id=${lead.project_id}`} className="text-xs text-primary hover:underline">View Design →</a>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={lead.status}
            onChange={e => onStatusChange(lead.id, e.target.value)}
            className={`text-xs font-semibold px-2 py-1 rounded border-0 outline-none cursor-pointer ${STATUS_STYLES[lead.status]}`}
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-primary p-1">
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          <button onClick={() => onDelete(lead)} className="text-gray-300 hover:text-red-400 p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-gray-500"><Phone className="w-3 h-3" />{lead.phone}</a>
        <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-primary"><Mail className="w-3 h-3" />{lead.email}</a>
      </div>
      {(lead.project_type || lead.source) && (
        <div className="flex flex-wrap gap-2">
          {lead.project_type && <span className="text-xs text-gray-600">{lead.project_type}</span>}
          {lead.source && <span className={`text-xs font-semibold px-2 py-0.5 rounded ${SOURCE_STYLES[lead.source] || "bg-gray-100 text-gray-600"}`}>{lead.source}</span>}
        </div>
      )}
      {lead.contractor_project_id && (
        <a href={`/estimator/projects/${lead.contractor_project_id}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View Project →</a>
      )}
      <ScheduleWalkthroughButton lead={lead} compact />
      <button onClick={handleConvert} className="flex items-center gap-1 text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/90">
        <ArrowRightCircle className="w-3 h-3" /> Convert to Customer Quote
      </button>
      {expanded && (
        <div className="pt-2 space-y-3 border-t border-gray-100">
          {lead.message && <p className="text-xs text-gray-600 whitespace-pre-wrap">{lead.message}</p>}
          {lead.address && <p className="text-xs text-gray-500">{lead.address}</p>}
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase mb-1">Notes</div>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Add notes..." className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs resize-none focus:outline-none focus:border-primary" />
            <button onClick={saveNotes} disabled={saving} className="mt-1 text-xs bg-secondary text-white px-3 py-1.5 rounded hover:bg-secondary/90 disabled:opacity-50">
              {saving ? "Saving..." : "Save Notes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Desktop lead board (Angi Lead Office-style master/detail) ──

function LeadListCard({ lead, selected, onSelect }) {
  const { city } = parseAddress(lead.address);
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left bg-white rounded-lg border p-3 transition-colors ${
        selected ? "border-secondary ring-1 ring-secondary" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[11px] font-semibold text-gray-500">{listDate(lead)}</span>
        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${STATUS_STYLES[lead.status] || "bg-gray-100 text-gray-600"}`}>
          {lead.status}
        </span>
      </div>
      <div className="text-sm font-semibold text-secondary truncate">
        {lead.full_name}{city ? <span className="font-normal text-gray-500"> · {city}</span> : null}
      </div>
      <div className="text-xs text-gray-500 truncate mt-0.5">{lead.project_type || "General Inquiry"}</div>
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <span className="text-xs font-semibold text-primary">{lead.phone && lead.phone !== "Not provided" ? lead.phone : ""}</span>
        {lead.source && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SOURCE_STYLES[lead.source] || "bg-gray-100 text-gray-600"}`}>
            {lead.source}
          </span>
        )}
      </div>
    </button>
  );
}

// Derived activity timeline — newest first. We don't store discrete history
// events on Lead, so this surfaces the milestone timestamps we do have.
function buildActivity(lead) {
  const events = [];
  events.push({ when: effectiveDate(lead), label: "Lead received", detail: `via ${lead.source || "Unknown source"}` });
  if (lead.booking_sent_at) {
    events.push({ when: new Date(lead.booking_sent_at), label: "Booking link sent", detail: lead.email });
  }
  if (lead.booking_event_id) {
    events.push({
      when: lead.booking_slot_start ? new Date(lead.booking_slot_start) : null,
      label: "Walkthrough booked",
      detail: lead.booking_slot_start ? format(new Date(lead.booking_slot_start), "EEE, MMM d 'at' h:mm a") : "On the calendar",
    });
  }
  if (lead.contractor_project_id) {
    events.push({ when: null, label: "Converted to project", detail: "Linked ContractorProject", href: `/estimator/projects/${lead.contractor_project_id}` });
  }
  if (lead.sms_opt_in_status) {
    events.push({ when: lead.sms_opt_in_timestamp ? new Date(lead.sms_opt_in_timestamp) : null, label: "SMS opt-in", detail: "Consented to text messages" });
  }
  return events.sort((a, b) => (b.when?.getTime() || 0) - (a.when?.getTime() || 0));
}

const DETAIL_TABS = [
  { key: "details", label: "Details", icon: FileText },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "activity", label: "Activity", icon: History },
];

function LeadDetailPane({ lead, onStatusChange, onNotesChange, onDelete }) {
  const [tab, setTab] = useState("details");
  const [notes, setNotes] = useState(lead.notes || "");
  const [saving, setSaving] = useState(false);

  const handleConvert = () => window.open(buildConvertToQuoteUrl(lead), "_blank");
  const saveNotes = async () => {
    setSaving(true);
    await onNotesChange(lead.id, notes);
    setSaving(false);
  };

  const activity = buildActivity(lead);

  return (
    <div className="flex-1 min-w-0">
      {/* Title block */}
      <h2 className="text-2xl font-bold text-secondary leading-tight">{lead.project_type || "General Inquiry"}</h2>
      <p className="text-gray-600 mt-0.5">{lead.full_name}</p>

      {/* Status pipeline dropdown */}
      <div className="relative inline-flex items-center mt-3 bg-white border border-gray-300 rounded-lg pl-3 pr-2 py-1">
        <span className={`w-2.5 h-2.5 rounded-full mr-2 shrink-0 ${STATUS_DOTS[lead.status] || "bg-gray-400"}`} />
        <select
          value={lead.status}
          onChange={e => onStatusChange(lead.id, e.target.value)}
          className="text-sm font-medium text-secondary bg-transparent border-0 outline-none cursor-pointer py-1.5 pr-1"
        >
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Contact + quick actions cards */}
      <div className="grid lg:grid-cols-2 gap-3 mt-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2.5">
          {lead.phone && lead.phone !== "Not provided" ? (
            <a href={`tel:${lead.phone}`} className="flex items-center gap-2.5 text-sm font-semibold text-primary hover:underline">
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />{lead.phone}
            </a>
          ) : (
            <div className="flex items-center gap-2.5 text-sm text-gray-400"><Phone className="w-4 h-4 shrink-0" />No phone</div>
          )}
          {lead.email ? (
            <a href={`mailto:${lead.email}`} className="flex items-center gap-2.5 text-sm font-semibold text-primary hover:underline break-all">
              <Mail className="w-4 h-4 text-gray-400 shrink-0" />{lead.email}
            </a>
          ) : (
            <div className="flex items-center gap-2.5 text-sm text-gray-400"><Mail className="w-4 h-4 shrink-0" />No email</div>
          )}
          {lead.address && (
            <div className="flex items-start gap-2.5 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />{lead.address}
            </div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2.5">
          <ScheduleWalkthroughButton lead={lead} />
          <button onClick={handleConvert} className="flex items-center gap-2.5 text-sm font-semibold text-primary hover:underline">
            <ArrowRightCircle className="w-4 h-4 shrink-0" /> Convert to Customer Quote
          </button>
          {lead.project_id && (
            <a href={`/project?id=${lead.project_id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 text-sm font-semibold text-primary hover:underline">
              <Sparkles className="w-4 h-4 shrink-0" /> View Design Preview
            </a>
          )}
          {lead.contractor_project_id && (
            <a href={`/estimator/projects/${lead.contractor_project_id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 text-sm font-semibold text-primary hover:underline">
              <ExternalLink className="w-4 h-4 shrink-0" /> View Project
            </a>
          )}
          <button onClick={() => onDelete(lead)} className="flex items-center gap-2.5 text-sm font-semibold text-gray-400 hover:text-red-500">
            <Trash2 className="w-4 h-4 shrink-0" /> Delete lead
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-gray-200 mt-5">
        {DETAIL_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 text-sm font-medium pb-2 -mb-px border-b-2 transition-colors ${
              tab === t.key ? "border-secondary text-secondary" : "border-transparent text-gray-500 hover:text-secondary"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <div className="py-4 space-y-4">
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Customer Message</div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {lead.message || "Customer did not provide additional details. Contact them to discuss the project."}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Lead Date</div>
              <p className="text-sm font-semibold text-secondary">{format(effectiveDate(lead), "EEEE, MMMM d, yyyy")}</p>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Source</div>
              <p className="text-sm font-semibold text-secondary">{lead.source || "—"}</p>
            </div>
          </div>
          {lead.source === "Angi" && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 space-y-1">
              <div className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">Angi Lead Details</div>
              {lead.angi_lead_id && <p className="text-xs text-gray-600">Lead ID: <span className="font-mono">{lead.angi_lead_id}</span></p>}
              {lead.angi_task && <p className="text-xs text-gray-600">Task: <strong>{lead.angi_task}</strong></p>}
              {lead.angi_budget && <p className="text-xs text-gray-600">Budget: <strong>{lead.angi_budget}</strong></p>}
              {lead.angi_timeline && <p className="text-xs text-gray-600">Timeline: <strong>{lead.angi_timeline}</strong></p>}
            </div>
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className="py-4">
          <div className="text-sm font-bold text-secondary mb-2">Internal notes</div>
          <textarea
            rows={5}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add a note about this lead..."
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary"
          />
          <button
            onClick={saveNotes}
            disabled={saving}
            className="mt-2 text-sm font-semibold bg-secondary text-white px-4 py-2 rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Note"}
          </button>
        </div>
      )}

      {tab === "activity" && (
        <div className="py-4 space-y-2">
          {activity.map((ev, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-secondary flex items-center gap-1.5">
                  {ev.label === "Booking link sent" && <Send className="w-3.5 h-3.5 text-sky-500" />}
                  {ev.label === "Walkthrough booked" && <CalendarCheck className="w-3.5 h-3.5 text-green-600" />}
                  {ev.label === "Lead received" && <UserPlus className="w-3.5 h-3.5 text-blue-500" />}
                  {ev.label}
                </div>
                {ev.href ? (
                  <a href={ev.href} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">{ev.detail} →</a>
                ) : (
                  ev.detail && <div className="text-xs text-gray-500 mt-0.5 break-all">{ev.detail}</div>
                )}
              </div>
              {ev.when && (
                <span className="text-xs text-gray-400 shrink-0">{format(ev.when, "M/d/yyyy h:mm a")}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminLeads({ embedded = false }) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(embedded);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterSource, setFilterSource] = useState("All");
  const [selectedId, setSelectedId] = useState(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => adminEntities.Lead.list("-created_date", 1000),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => adminEntities.Lead.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminEntities.Lead.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const handleDelete = (lead) => {
    if (!confirm(`Delete lead from "${lead.full_name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(lead.id);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await base44.functions.invoke("validateAdminPassword", { password });
      if (res.data.valid) {
        setAuthenticated(true);
      } else {
        alert("Incorrect password");
        setPassword("");
      }
    } catch (error) {
      alert("Error validating password");
      setPassword("");
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary to-secondary/95 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full">
          <h1 className="text-2xl font-bold text-secondary mb-2 text-center">Lead Dashboard</h1>
          <p className="text-gray-600 text-center text-sm mb-6">Enter password to access</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Unlock Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  const handleStatusChange = (id, status) => updateMutation.mutate({ id, data: { status } });
  const handleNotesChange = (id, notes) => updateMutation.mutateAsync({ id, data: { notes } });

  const sorted = [...leads].sort((a, b) => effectiveDate(b) - effectiveDate(a));

  const filtered = sorted.filter(l => {
    const matchSearch = !search ||
      l.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.email?.toLowerCase().includes(search.toLowerCase()) ||
      l.phone?.includes(search);
    const matchStatus = filterStatus === "All" || l.status === filterStatus;
    const matchSource = filterSource === "All" || l.source === filterSource;
    return matchSearch && matchStatus && matchSource;
  });

  // Selected lead for the desktop detail pane — falls back to the first match
  // whenever the selection is filtered out (or nothing is selected yet).
  const selectedLead = filtered.find(l => l.id === selectedId) || filtered[0] || null;

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.status === s).length;
    return acc;
  }, {});
  const angiCount = leads.filter(l => l.source === "Angi").length;

  return (
    <div className={embedded ? "" : "min-h-screen bg-gray-50"}>
      {!embedded && (
        <div className="bg-secondary text-white px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lead Dashboard</h1>
            <p className="text-white/60 text-sm">Coen Construction — {leads.length} total leads</p>
          </div>
          <a href="/" className="text-white/70 hover:text-white text-sm transition-colors">← Back to Site</a>
        </div>
      )}
      {embedded && (
        <div className="px-4 sm:px-6 pt-5 pb-2">
          <h1 className="text-xl sm:text-2xl font-bold text-secondary">Leads ({leads.length})</h1>
          <p className="text-gray-500 text-sm mt-1">Every inquiry across all sources</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 px-4 sm:px-6 py-4 sm:py-5">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? "All" : s)}
            className={`rounded-xl p-4 shadow-sm border border-l-4 text-left transition-colors ${
              filterStatus === s ? "bg-secondary/5 border-secondary/40 border-l-secondary" : "bg-white border-gray-100 border-l-primary/30 hover:bg-gray-50"
            }`}
          >
            <div className={`inline-block text-xs font-semibold px-2 py-0.5 rounded mb-2 ${STATUS_STYLES[s]}`}>{s}</div>
            <div className="text-3xl font-bold text-secondary">{counts[s] || 0}</div>
          </button>
        ))}
        <button
          onClick={() => setFilterSource(filterSource === "Angi" ? "All" : "Angi")}
          className={`rounded-xl p-4 shadow-sm border border-l-4 text-left transition-colors ${filterSource === "Angi" ? "bg-green-50 border-green-300 border-l-green-500" : "bg-white border-gray-100 border-l-green-400 hover:bg-green-50"}`}
        >
          <div className="inline-block text-xs font-semibold px-2 py-0.5 rounded mb-2 bg-green-100 text-green-800 border border-green-300">Angi</div>
          <div className="text-3xl font-bold text-secondary">{angiCount}</div>
        </button>
      </div>

      {/* Filters */}
      <div className="px-4 sm:px-6 pb-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none">
            <option value="All">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none">
            <option value="All">All Sources</option>
            {["Contact Form", "Design Preview", "Budget Estimator", "Phone", "Referral", "Angi", "Email Campaign", "Other"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Leads */}
      <div className="px-4 sm:px-6 pb-10">
        {isLoading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center text-gray-400">Loading leads...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-16 text-center text-gray-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No leads found</p>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
              {filtered.map(lead => (
                <MobileLeadCard
                  key={lead.id}
                  lead={lead}
                  onStatusChange={handleStatusChange}
                  onNotesChange={handleNotesChange}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {/* Desktop lead board: list + detail pane */}
            <div className="hidden sm:flex items-start gap-5">
              <div className="w-[320px] lg:w-[360px] shrink-0">
                <div className="text-xs text-gray-400 text-right mb-2">{filtered.length} of {leads.length} leads</div>
                <div className="space-y-2.5 max-h-[72vh] overflow-y-auto pr-1">
                  {filtered.map(lead => (
                    <LeadListCard
                      key={lead.id}
                      lead={lead}
                      selected={selectedLead?.id === lead.id}
                      onSelect={() => setSelectedId(lead.id)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-0 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                {selectedLead ? (
                  <LeadDetailPane
                    key={selectedLead.id}
                    lead={selectedLead}
                    onStatusChange={handleStatusChange}
                    onNotesChange={handleNotesChange}
                    onDelete={handleDelete}
                  />
                ) : (
                  <div className="py-16 text-center text-gray-400">Select a lead to view details</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
