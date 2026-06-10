/**
 * CommsHub — Full communication feed & action center
 * Shows all ClientCommunication records (open + logged) with filtering,
 * per-item compose/send, and a top-level "Compose Email" button.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44, ADMIN_SESSION_KEY } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Mail, MessageCircle, Phone, Users, Globe, MoreHorizontal,
  AlertTriangle, Clock, CheckCircle2, Plus, RefreshCw,
  Search, Filter, ArrowUpRight, Inbox, UserCheck
} from "lucide-react";
import { formatDistanceToNow, isPast, parseISO, format } from "date-fns";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";
import ComposeEmailModal from "@/components/comms/ComposeEmailModal";
import LogContactModal from "@/components/comms/LogContactModal";
import DismissModal from "@/components/comms/DismissModal";
import ManualLogModal from "@/components/comms/ManualLogModal";

const CHANNEL_ICONS = {
  phone: Phone, email: Mail, text: MessageCircle, in_person: Users,
  portal: Globe, other: MoreHorizontal,
};

const STATUS_CONFIG = {
  open:      { label: "Open",      color: "bg-blue-100 text-blue-700",    dot: "bg-blue-400" },
  logged:    { label: "Logged",    color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
  dismissed: { label: "Dismissed", color: "bg-slate-100 text-slate-500",  dot: "bg-slate-300" },
};

const URGENCY_CONFIG = {
  high:   { label: "Urgent",  class: "bg-red-100 text-red-700 border-red-200",    border: "border-l-red-400" },
  normal: { label: "Normal",  class: "bg-slate-100 text-slate-600 border-slate-200", border: "border-l-gray-200" },
  low:    { label: "Low",     class: "bg-slate-50 text-slate-400 border-slate-100",  border: "border-l-gray-100" },
};

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function CommsHub() {
  const { brandColor } = useCompanyBrand();
  const qc = useQueryClient();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterChannel, setFilterChannel] = useState("all");
  const [showCompose, setShowCompose] = useState(false);
  const [composeItem, setComposeItem] = useState(null);
  const [logItem, setLogItem] = useState(null);
  const [dismissItem, setDismissItem] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { data: allComms = [], isLoading, refetch } = useQuery({
    queryKey: ["all-comms-hub"],
    queryFn: () => base44.entities.ClientCommunication.list("-due_at", 500),
    refetchInterval: 60_000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-hub"],
    queryFn: () => base44.entities.ContractorProject.list("-updated_date", 300),
    staleTime: 60_000,
  });

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  const handleRunBenchmarks = async () => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke("generateCommunications", {});
      qc.invalidateQueries({ queryKey: ["all-comms-hub"] });
      qc.invalidateQueries({ queryKey: ["open-comms"] });
    } catch {}
    setGenerating(false);
  };

  // Filter & search
  const filtered = allComms.filter(c => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterChannel !== "all" && c.channel !== filterChannel) return false;
    if (!isAdmin && c.assigned_to && c.assigned_to !== currentUser?.email) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const proj = c.project_id ? projectMap[c.project_id] : null;
      const haystack = [c.title, c.prompt_detail, c.log_note, proj?.client_name, proj?.project_type].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // Sorted: open+high first, then due_at, then logged
  const sorted = [...filtered].sort((a, b) => {
    const aOpen = a.status === "open" ? 0 : 1;
    const bOpen = b.status === "open" ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    const aHigh = a.urgency === "high" ? 0 : 1;
    const bHigh = b.urgency === "high" ? 0 : 1;
    if (aHigh !== bHigh) return aHigh - bHigh;
    return new Date(a.due_at || 0) - new Date(b.due_at || 0);
  });

  const openCount   = allComms.filter(c => c.status === "open").length;
  const urgentCount = allComms.filter(c => c.status === "open" && c.urgency === "high").length;
  const loggedToday = allComms.filter(c => c.status === "logged" && c.contacted_at && new Date(c.contacted_at).toDateString() === new Date().toDateString()).length;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-secondary flex items-center gap-2">
            <Inbox className="w-5 h-5" style={{ color: brandColor }} />
            Communications Hub
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">All client, sub, vendor & team communication activity</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={handleRunBenchmarks} disabled={generating} className="gap-1.5 text-xs">
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
              Run AI Benchmarks
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowManual(true)} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> Log Contact
          </Button>
          <Button size="sm" onClick={() => setShowCompose(true)} className="gap-1.5 text-xs text-white" style={{ background: brandColor }}>
            <Mail className="w-3.5 h-3.5" /> Compose Email
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Open Items",    value: openCount,   icon: Inbox,       color: "text-blue-600",    bg: "bg-blue-50"    },
          { label: "Urgent",        value: urgentCount, icon: AlertTriangle,color: "text-red-600",     bg: "bg-red-50"     },
          { label: "Logged Today",  value: loggedToday, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div>
              <div className={`text-2xl font-bold leading-tight ${color}`}>{value}</div>
              <div className="text-xs text-slate-400">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Urgent banner */}
      {urgentCount > 0 && filterStatus === "open" && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl font-semibold">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          {urgentCount} high-urgency item{urgentCount !== 1 ? "s" : ""} need immediate attention
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search client, project, or subject…"
            className="pl-8 text-sm h-8"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          {["all", "open", "logged", "dismissed"].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors border ${
                filterStatus === s ? "bg-secondary text-white border-secondary" : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <span className="text-gray-200">|</span>
          {["all", "email", "phone", "text", "portal"].map(ch => (
            <button
              key={ch}
              onClick={() => setFilterChannel(ch)}
              className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors border ${
                filterChannel === ch ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {ch.charAt(0).toUpperCase() + ch.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading && (
          <div className="py-16 text-center text-sm text-gray-400 animate-pulse">Loading communications…</div>
        )}
        {!isLoading && sorted.length === 0 && (
          <div className="py-16 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
            <p className="text-sm font-semibold text-slate-600">All clear!</p>
            <p className="text-xs text-slate-400 mt-1">
              {filterStatus === "open" ? "No open communication items." : "No items match your filters."}
            </p>
          </div>
        )}

        <div className="divide-y divide-gray-50">
          {sorted.map(item => {
            const project = item.project_id ? projectMap[item.project_id] : null;
            const ChanIcon = CHANNEL_ICONS[item.channel] || MoreHorizontal;
            const urgCfg = URGENCY_CONFIG[item.urgency] || URGENCY_CONFIG.normal;
            const statCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
            const isOverdue = item.due_at && isPast(parseISO(item.due_at)) && item.status === "open";

            return (
              <div
                key={item.id}
                className={`flex items-start gap-4 px-5 py-4 border-l-4 hover:bg-gray-50/60 transition-colors ${
                  item.status === "open"
                    ? (item.urgency === "high" ? "border-l-red-400 bg-red-50/30" : isOverdue ? "border-l-orange-400 bg-orange-50/20" : "border-l-blue-300")
                    : item.status === "logged" ? "border-l-emerald-300 bg-emerald-50/10"
                    : "border-l-gray-200"
                }`}
              >
                {/* Icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  item.status === "open" && item.urgency === "high" ? "bg-red-100"
                  : item.status === "logged" ? "bg-emerald-100"
                  : "bg-gray-100"
                }`}>
                  {item.status === "logged"
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : item.urgency === "high"
                    ? <AlertTriangle className="w-4 h-4 text-red-500" />
                    : <Clock className="w-4 h-4 text-gray-400" />
                  }
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-secondary">
                      {project?.client_name || "General"}
                    </span>
                    {project?.project_type && (
                      <span className="text-xs text-gray-400">· {project.project_type}</span>
                    )}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${statCfg.color}`}>
                      {statCfg.label}
                    </span>
                    {item.urgency === "high" && item.status === "open" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">URGENT</span>
                    )}
                    {item.kind === "inbound" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">INBOUND</span>
                    )}
                  </div>

                  <div className="text-sm font-medium text-slate-700 mt-0.5">{item.title}</div>

                  {item.prompt_detail && item.status === "open" && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.prompt_detail}</p>
                  )}
                  {item.log_note && item.status === "logged" && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 italic">"{item.log_note}"</p>
                  )}

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <ChanIcon className="w-3 h-3" />
                      {item.channel || "—"}
                    </span>
                    {item.due_at && item.status === "open" && (
                      <span className={`text-xs font-medium ${isOverdue ? "text-red-600" : "text-gray-500"}`}>
                        {isOverdue ? "Overdue " : "Due "}
                        {formatDistanceToNow(parseISO(item.due_at), { addSuffix: true })}
                      </span>
                    )}
                    {item.contacted_at && item.status === "logged" && (
                      <span className="text-xs text-gray-400">
                        Logged {format(new Date(item.contacted_at), "MMM d")}
                        {item.handled_by ? ` by ${item.handled_by.split("@")[0]}` : ""}
                      </span>
                    )}
                    {item.assigned_to && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <UserCheck className="w-3 h-3" />
                        {item.assigned_to.split("@")[0]}
                      </span>
                    )}
                    {project && (
                      <Link
                        to={`/estimator/projects/${item.project_id}`}
                        className="inline-flex items-center gap-0.5 text-xs text-indigo-600 hover:underline"
                      >
                        Project <ArrowUpRight className="w-2.5 h-2.5" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {item.status === "open" && (
                  <div className="shrink-0 flex flex-col gap-1.5">
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1 text-white"
                      style={{ background: brandColor }}
                      onClick={() => {
                        setComposeItem({
                          ...item,
                          _project: project,
                        });
                      }}
                    >
                      <Mail className="w-3 h-3" /> Email
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() => setLogItem(item)}
                    >
                      <CheckCircle2 className="w-3 h-3" /> Log
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-gray-500"
                      onClick={() => setDismissItem(item)}
                    >
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {showCompose && (
        <ComposeEmailModal
          onClose={() => setShowCompose(false)}
          onSent={() => { setShowCompose(false); qc.invalidateQueries({ queryKey: ["all-comms-hub"] }); qc.invalidateQueries({ queryKey: ["open-comms"] }); }}
        />
      )}
      {composeItem && (() => {
        const project = composeItem._project;
        return (
          <ComposeEmailModal
            onClose={() => setComposeItem(null)}
            onSent={() => { setComposeItem(null); qc.invalidateQueries({ queryKey: ["all-comms-hub"] }); qc.invalidateQueries({ queryKey: ["open-comms"] }); refetch(); }}
            prefill={{
              audience_type: "customer",
              to_email: project?.client_email || "",
              to_name: project?.client_name || "",
              subject: composeItem.title || "",
              project_id: composeItem.project_id || "",
              comm_id: composeItem.id,
              context_hint: composeItem.prompt_detail || composeItem.title || "",
            }}
          />
        );
      })()}
      {logItem && (
        <LogContactModal
          item={logItem}
          onClose={() => setLogItem(null)}
          onSaved={() => { setLogItem(null); qc.invalidateQueries({ queryKey: ["all-comms-hub"] }); qc.invalidateQueries({ queryKey: ["open-comms"] }); refetch(); }}
        />
      )}
      {dismissItem && (
        <DismissModal
          item={dismissItem}
          onClose={() => setDismissItem(null)}
          onSaved={() => { setDismissItem(null); qc.invalidateQueries({ queryKey: ["all-comms-hub"] }); qc.invalidateQueries({ queryKey: ["open-comms"] }); refetch(); }}
        />
      )}
      {showManual && (
        <ManualLogModal
          onClose={() => setShowManual(false)}
          onSaved={() => { setShowManual(false); qc.invalidateQueries({ queryKey: ["all-comms-hub"] }); qc.invalidateQueries({ queryKey: ["open-comms"] }); refetch(); }}
        />
      )}
    </div>
  );
}