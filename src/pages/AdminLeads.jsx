import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Phone, Mail, MessageSquare, ChevronDown, Search, Filter, ArrowRightCircle, Trash2, RefreshCw } from "lucide-react";

const ADMIN_SESSION_KEY = "admin_session";

function effectiveDate(lead) {
  return lead.lead_received_date
    ? new Date(lead.lead_received_date + "T00:00:00")
    : new Date(lead.created_date);
}

function formatLeadDate(lead) {
  return format(effectiveDate(lead), "MMM d, yyyy");
}

const STATUS_STYLES = {
  New: "bg-blue-100 text-blue-700",
  Contacted: "bg-yellow-100 text-yellow-700",
  Won: "bg-green-100 text-green-700",
  Lost: "bg-gray-100 text-gray-500",
  Imported: "bg-purple-100 text-purple-700",
};

const SOURCE_STYLES = {
  "Contact Form": "bg-purple-100 text-purple-700",
  "Design Preview": "bg-orange-100 text-orange-700",
  Phone: "bg-teal-100 text-teal-700",
  Referral: "bg-pink-100 text-pink-700",
  Angi: "bg-green-100 text-green-800 border border-green-300",
  Other: "bg-gray-100 text-gray-600",
};

const STATUSES = ["New", "Contacted", "Won", "Lost", "Imported"];

function MobileLeadCard({ lead, onStatusChange, onNotesChange, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(lead.notes || "");
  const [saving, setSaving] = useState(false);

  const handleConvertToWalkthrough = async () => {
    let scope = lead.message || "";
    if (lead.project_id) {
      scope += `\n\n--- DESIGN PREVIEW ---\nView AI-generated design: ${window.location.origin}/project?id=${lead.project_id}`;
    }
    const params = new URLSearchParams({
      lead_name: lead.full_name || "", lead_phone: lead.phone || "", lead_email: lead.email || "",
      lead_address: lead.address || "", lead_scope: scope,
    });
    window.open(`/estimator/walkthrough?${params.toString()}`, "_blank");
  };

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
      {lead.status === "Contacted" && (
        <button onClick={handleConvertToWalkthrough} className="flex items-center gap-1 text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/90">
          <ArrowRightCircle className="w-3 h-3" /> Send to Estimator
        </button>
      )}
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

function LeadRow({ lead, onStatusChange, onNotesChange, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(lead.notes || "");
  const [saving, setSaving] = useState(false);

  const handleConvertToWalkthrough = async () => {
    let scope = lead.message || "";
    if (lead.project_id) {
      const designUrl = `${window.location.origin}/project?id=${lead.project_id}`;
      scope += `\n\n--- DESIGN PREVIEW ---\nCustomer used the AI Design Preview tool. View AI-generated design photos here: ${designUrl}`;
    }

    // Parse address into street / city / zipcode
    // Common formats: "341 Main St, Worcester, MA 02072" or "341 Main St, Worcester, MA"
    let street = lead.address || "";
    let city = "";
    let zipcode = "";
    if (street) {
      const parts = street.split(",").map(p => p.trim());
      if (parts.length >= 3) {
        street = parts[0];
        city = parts[1];
        // Last part may be "MA 02072" or "MA" — extract zip
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

    const typeMap = {
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
    const params = new URLSearchParams({
      lead_name: lead.full_name || "",
      lead_phone: lead.phone || "",
      lead_email: lead.email || "",
      lead_address: street,
      lead_city: city,
      lead_zipcode: zipcode,
      lead_project_type: typeMap[lead.project_type] || lead.project_type || "",
      lead_scope: scope,
    });
    window.open(`/estimator/walkthrough?${params.toString()}`, "_blank");
  };

  const saveNotes = async () => {
    setSaving(true);
    await onNotesChange(lead.id, notes);
    setSaving(false);
  };

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3">
          <div className="font-semibold text-secondary text-sm">{lead.full_name}</div>
          <div className="text-xs text-gray-400">{formatLeadDate(lead)}</div>
          {lead.project_id && (
            <a href={`/project?id=${lead.project_id}`} className="text-xs text-primary hover:underline mt-1 inline-block">
              View Design Preview →
            </a>
          )}
          {lead.contractor_project_id && (
            <a href={`/estimator/projects/${lead.contractor_project_id}`} target="_blank" rel="noreferrer" className="text-xs text-green-700 hover:underline font-semibold mt-1 inline-block">
              📋 View Project →
            </a>
          )}
          {lead.status === "Contacted" && (
            <button
              onClick={handleConvertToWalkthrough}
              className="mt-1.5 flex items-center gap-1 text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/90 transition-colors"
            >
              <ArrowRightCircle className="w-3 h-3" /> Send to Estimator
            </button>
          )}
        </td>
        <td className="px-4 py-3">
          <a href={`mailto:${lead.email}`} className="text-primary hover:underline text-sm flex items-center gap-1">
            <Mail className="w-3 h-3" />{lead.email}
          </a>
          <a href={`tel:${lead.phone}`} className="text-gray-500 hover:text-primary text-xs flex items-center gap-1 mt-0.5">
            <Phone className="w-3 h-3" />{lead.phone}
          </a>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{lead.project_type || "—"}</td>
        <td className="px-4 py-3">
          <span className={`text-xs font-semibold px-2 py-1 rounded ${SOURCE_STYLES[lead.source] || "bg-gray-100 text-gray-600"}`}>
            {lead.source || "—"}
          </span>
        </td>
        <td className="px-4 py-3">
          <select
            value={lead.status}
            onChange={e => onStatusChange(lead.id, e.target.value)}
            className={`text-xs font-semibold px-2 py-1 rounded border-0 outline-none cursor-pointer ${STATUS_STYLES[lead.status]}`}
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-primary transition-colors">
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
            <button onClick={() => onDelete(lead)} className="text-gray-300 hover:text-red-400 transition-colors" title="Delete lead">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted border-b border-gray-100">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Message</div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{lead.message || "—"}</p>
                {lead.address && (
                  <div className="mt-2">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Address</div>
                    <p className="text-sm text-gray-600">{lead.address}</p>
                  </div>
                )}
                {lead.source === "Angi" && (
                  <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 space-y-1">
                    <div className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">Angi Lead Details</div>
                    {lead.lead_received_date && <p className="text-xs text-gray-600">Received: <strong>{format(new Date(lead.lead_received_date + "T00:00:00"), "MMM d, yyyy")}</strong></p>}
                    {lead.angi_lead_id && <p className="text-xs text-gray-600">Lead ID: <span className="font-mono">{lead.angi_lead_id}</span></p>}
                    {lead.angi_task && <p className="text-xs text-gray-600">Task: <strong>{lead.angi_task}</strong></p>}
                    {lead.angi_budget && <p className="text-xs text-gray-600">Budget: <strong>{lead.angi_budget}</strong></p>}
                    {lead.angi_timeline && <p className="text-xs text-gray-600">Timeline: <strong>{lead.angi_timeline}</strong></p>}
                    {lead.contractor_project_id && (
                      <a href={`/estimator/projects/${lead.contractor_project_id}`} target="_blank" rel="noreferrer" className="text-xs text-green-700 font-semibold hover:underline">Open Project in Estimator →</a>
                    )}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Internal Notes</div>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add notes..."
                  className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary"
                />
                <button
                  onClick={saveNotes}
                  disabled={saving}
                  className="mt-1 text-xs bg-secondary text-white px-3 py-1.5 rounded hover:bg-secondary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Notes"}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminLeads({ embedded = false }) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(embedded);
  const [isAdmin, setIsAdmin] = useState(() => {
    // When embedded in AdminHub, check the hub session for admin role
    if (!embedded) return false;
    try {
      const raw = localStorage.getItem(ADMIN_SESSION_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.role === "admin";
    } catch { return false; }
  });
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterSource, setFilterSource] = useState("All");
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date", 1000),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lead.delete(id),
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
        setIsAdmin(res.data.role === "admin");
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

  const handleBackfill = async () => {
    if (!confirm("Run the one-time Angi history backfill? This is safe to re-run — it is fully idempotent.")) return;
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await base44.functions.invoke("backfillAngiHistory", {});
      setBackfillResult(res.data);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (err) {
      setBackfillResult({ error: err.message });
    } finally {
      setBackfilling(false);
    }
  };

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
        <div className="px-4 sm:px-6 pt-5 pb-2 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-secondary">Lead Management</h1>
            <p className="text-gray-500 text-sm mt-1">{leads.length} total leads</p>
          </div>
          {isAdmin && (
            <button
              onClick={handleBackfill}
              disabled={backfilling}
              className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-60 transition-colors shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${backfilling ? "animate-spin" : ""}`} />
              {backfilling ? "Running backfill…" : "Backfill Angi History"}
            </button>
          )}
        </div>
      )}
      {!embedded && isAdmin && (
        <div className="px-6 pt-2 pb-1 flex justify-end">
          <button
            onClick={handleBackfill}
            disabled={backfilling}
            className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${backfilling ? "animate-spin" : ""}`} />
            {backfilling ? "Running backfill…" : "Backfill Angi History"}
          </button>
        </div>
      )}
      {backfillResult && (
        <div className={`mx-4 sm:mx-6 mb-3 rounded-lg px-4 py-3 text-sm border ${backfillResult.error ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-800"}`}>
          {backfillResult.error ? (
            <span>Backfill error: {backfillResult.error}</span>
          ) : (
            <span>
              ✅ Backfill complete — {backfillResult.leads_processed} leads processed &nbsp;·&nbsp;
              {backfillResult.dates_set} dates set &nbsp;·&nbsp;
              {backfillResult.date_unparsed} unparsed &nbsp;·&nbsp;
              {backfillResult.projects_created} projects created &nbsp;·&nbsp;
              {backfillResult.projects_linked_existing} linked to existing &nbsp;·&nbsp;
              {backfillResult.already_done} already done
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-4 sm:px-6 py-4 sm:py-5">
        {STATUSES.map(s => (
          <div key={s} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 border-l-4 border-l-primary/30">
            <div className={`inline-block text-xs font-semibold px-2 py-0.5 rounded mb-2 ${STATUS_STYLES[s]}`}>{s}</div>
            <div className="text-3xl font-bold text-secondary">{counts[s] || 0}</div>
          </div>
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
            {["Contact Form", "Design Preview", "Phone", "Referral", "Angi", "Other"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Leads */}
      <div className="px-4 sm:px-6 pb-10">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-gray-400">Loading leads...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No leads found</p>
            </div>
          ) : (
            <>
              {/* Mobile card list */}
              <div className="sm:hidden divide-y divide-gray-100">
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
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                 <table className="w-full">
                   <thead className="bg-secondary/5 border-b border-gray-200">
                    <tr>
                      {["Contact", "Email / Phone", "Project Type", "Source", "Status", ""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(lead => (
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        onStatusChange={handleStatusChange}
                        onNotesChange={handleNotesChange}
                        onDelete={handleDelete}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}