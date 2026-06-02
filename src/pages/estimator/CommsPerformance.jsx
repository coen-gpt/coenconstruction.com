import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44, ADMIN_SESSION_KEY } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Trophy, Clock, AlertTriangle, TrendingUp, TrendingDown, Minus,
  ArrowUpRight, ChevronDown, ChevronUp, User, BarChart3, Inbox,
  CheckCircle2, RefreshCw, MessageSquare
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function fmtMinutes(mins) {
  if (mins == null) return "—";
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function TrendBadge({ thisWeek, lastWeek, higherIsBetter = true }) {
  if (thisWeek == null || lastWeek == null) return <span className="text-gray-400 text-xs">—</span>;
  if (lastWeek === 0 && thisWeek === 0) return <span className="text-gray-400 text-xs">—</span>;
  const delta = thisWeek - lastWeek;
  const improved = higherIsBetter ? delta >= 0 : delta <= 0;
  const Icon = delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${improved ? "text-green-600" : "text-red-500"}`}>
      <Icon className="w-3 h-3" />
      {delta > 0 ? "+" : ""}{delta} vs last wk
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "indigo" }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    red: "bg-red-50 text-red-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-bold text-secondary">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function ProjectHistoryDrawer({ projectId, clientName, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ["project-comms-log", projectId],
    queryFn: () => base44.functions.invoke("getCommsPerformance", { project_id: projectId }).then(r => r.data),
    enabled: !!projectId,
  });

  const log = data?.project_log || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white h-full flex flex-col shadow-2xl">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-secondary text-sm">Comms History</h3>
            <p className="text-xs text-gray-500">{clientName}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {isLoading && <div className="py-12 text-center text-sm text-gray-400 animate-pulse">Loading…</div>}
          {!isLoading && log.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">No communication history</div>
          )}
          {!isLoading && log.map(item => (
            <div key={item.id} className="px-5 py-3 hover:bg-gray-50">
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                  item.kind === "inbound" ? "bg-red-500" :
                  item.status === "logged" ? "bg-green-500" :
                  item.status === "dismissed" ? "bg-gray-400" : "bg-orange-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-secondary">{item.title}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      item.kind === "inbound" ? "bg-red-100 text-red-700" :
                      item.kind === "manual" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>{item.kind}</span>
                    <span className="text-xs text-gray-400">{item.channel}</span>
                    <span className={`text-xs font-medium ${
                      item.status === "logged" ? "text-green-600" :
                      item.status === "dismissed" ? "text-gray-400" : "text-orange-500"
                    }`}>{item.status}</span>
                  </div>
                  {item.log_note && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.log_note}</p>}
                  {item.dismiss_reason && <p className="text-xs text-gray-400 mt-1 italic">{item.dismiss_reason}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                    {item.contacted_at && (
                      <span>Logged {formatDistanceToNow(parseISO(item.contacted_at), { addSuffix: true })}</span>
                    )}
                    {item.handled_by && <span>by {item.handled_by}</span>}
                    {item.response_minutes != null && (
                      <span className="text-indigo-600 font-medium">⚡ {fmtMinutes(item.response_minutes)} response</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CommsPerformance() {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const [selectedProject, setSelectedProject] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["comms-performance", isAdmin ? "all" : currentUser?.email],
    queryFn: () => base44.functions.invoke("getCommsPerformance",
      isAdmin ? {} : { user_email: currentUser?.email }
    ).then(r => r.data),
    staleTime: 60_000,
  });

  const overall = data?.overall || {};
  const members = data?.members || [];
  const leaderboard = data?.leaderboard || [];
  const projectIndex = data?.project_index || [];

  const visibleProjects = showAll ? projectIndex : projectIndex.slice(0, 10);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-secondary flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Communication Performance
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? "All team members" : "Your performance"} · Inbound response times & benchmark compliance
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="py-16 text-center text-gray-400 animate-pulse">Loading performance data…</div>
      )}

      {!isLoading && (
        <>
          {/* ── Overall KPIs ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={Clock}
              label="Median Inbound Response"
              value={fmtMinutes(overall.median_response_minutes)}
              color="indigo"
            />
            <StatCard
              icon={Inbox}
              label="Inbound Contacts Logged"
              value={overall.total_inbound_logged ?? 0}
              sub={<TrendBadge thisWeek={overall.this_week_logged} lastWeek={overall.last_week_logged} />}
              color="green"
            />
            <StatCard
              icon={AlertTriangle}
              label="Currently Overdue"
              value={overall.total_overdue ?? 0}
              sub={`${overall.total_open ?? 0} open total`}
              color="red"
            />
            <StatCard
              icon={MessageSquare}
              label="Avg Inbound Response"
              value={fmtMinutes(overall.avg_response_minutes)}
              color="orange"
            />
          </div>

          {/* ── Per-member table (admin only) ── */}
          {isAdmin && members.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-secondary text-sm">Team Member Breakdown</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Member</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Median Response</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Avg Response</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Inbound Logged</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Benchmark On-Time</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Open / Overdue</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-600">This Wk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {members.map(m => (
                      <tr key={m.email} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                              <User className="w-3 h-3 text-indigo-600" />
                            </div>
                            <span className="font-medium text-secondary truncate max-w-[160px]">{m.email}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono">{fmtMinutes(m.median_response_minutes)}</td>
                        <td className="px-3 py-3 text-right font-mono text-gray-500">{fmtMinutes(m.avg_response_minutes)}</td>
                        <td className="px-3 py-3 text-right">{m.inbound_count}</td>
                        <td className="px-3 py-3 text-right">
                          {m.benchmark_on_time_pct != null ? (
                            <span className={`font-bold ${m.benchmark_on_time_pct >= 80 ? "text-green-600" : m.benchmark_on_time_pct >= 60 ? "text-orange-500" : "text-red-500"}`}>
                              {m.benchmark_on_time_pct}%
                            </span>
                          ) : "—"}
                          {m.benchmark_total > 0 && <span className="text-gray-400 ml-1">({m.benchmark_total})</span>}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={m.overdue_count > 0 ? "text-red-600 font-bold" : "text-gray-600"}>
                            {m.open_count}
                          </span>
                          {m.overdue_count > 0 && (
                            <span className="text-red-500 ml-1">({m.overdue_count} overdue)</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <TrendBadge thisWeek={m.this_week_logged} lastWeek={m.last_week_logged} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── My Stats (non-admin) ── */}
          {!isAdmin && members.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h2 className="font-semibold text-secondary text-sm">Your Stats</h2>
              {members.map(m => (
                <div key={m.email} className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Median Inbound Response</div>
                    <div className="font-bold text-secondary">{fmtMinutes(m.median_response_minutes)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Benchmark On-Time</div>
                    <div className={`font-bold ${m.benchmark_on_time_pct >= 80 ? "text-green-600" : m.benchmark_on_time_pct >= 60 ? "text-orange-500" : "text-red-500"}`}>
                      {m.benchmark_on_time_pct != null ? `${m.benchmark_on_time_pct}%` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Open / Overdue</div>
                    <div className="font-bold text-secondary">
                      {m.open_count}
                      {m.overdue_count > 0 && <span className="text-red-500 ml-1">({m.overdue_count} late)</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">This Week Logged</div>
                    <div className="font-bold text-secondary">
                      {m.this_week_logged}
                      <span className="ml-2"><TrendBadge thisWeek={m.this_week_logged} lastWeek={m.last_week_logged} /></span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Inbound Handled</div>
                    <div className="font-bold text-secondary">
                      {m.inbound_count}
                      <span className="ml-2"><TrendBadge thisWeek={m.this_week_inbound} lastWeek={m.last_week_inbound} /></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Leaderboard ── */}
          {isAdmin && leaderboard.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <h2 className="font-semibold text-secondary text-sm">Inbound Responsiveness Leaderboard</h2>
                <span className="text-xs text-gray-400">(fastest median response time)</span>
              </div>
              <div className="divide-y divide-gray-100">
                {leaderboard.map((m, i) => (
                  <div key={m.email} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                      i === 0 ? "bg-yellow-100 text-yellow-700" :
                      i === 1 ? "bg-gray-100 text-gray-600" :
                      i === 2 ? "bg-orange-100 text-orange-700" :
                      "bg-gray-50 text-gray-400"
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-secondary truncate">{m.email}</div>
                      <div className="text-xs text-gray-400">{m.inbound_count} inbound handled</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-indigo-600 text-sm">{fmtMinutes(m.median_response_minutes)}</div>
                      <div className="text-xs text-gray-400">median response</div>
                    </div>
                    <div className="text-right shrink-0">
                      {m.benchmark_on_time_pct != null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          m.benchmark_on_time_pct >= 80 ? "bg-green-100 text-green-700" :
                          m.benchmark_on_time_pct >= 60 ? "bg-orange-100 text-orange-700" :
                          "bg-red-100 text-red-700"
                        }`}>{m.benchmark_on_time_pct}% on-time</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Per-project communication index ── */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-secondary text-sm">Project Communication Index</h2>
              <p className="text-xs text-gray-400 mt-0.5">Click any project to view the full communication log</p>
            </div>
            <div className="divide-y divide-gray-100">
              {visibleProjects.length === 0 && (
                <div className="py-10 text-center text-sm text-gray-400">No project communication data yet</div>
              )}
              {visibleProjects.map(p => (
                <button
                  key={p.project_id}
                  className="w-full flex items-center gap-4 px-5 py-3 hover:bg-gray-50 text-left transition-colors"
                  onClick={() => setSelectedProject(p)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-secondary">{p.client_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {p.project_type} · {p.status}
                      {p.assigned_to && <span> · {p.assigned_to}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-3 text-xs">
                    {p.inbound_open > 0 && (
                      <span className="inline-flex items-center gap-0.5 bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                        <Inbox className="w-2.5 h-2.5" /> {p.inbound_open} inbound
                      </span>
                    )}
                    {p.open_count > 0 && (
                      <span className="text-orange-600 font-medium">{p.open_count} open</span>
                    )}
                    <span className="text-gray-400">{p.total_comms} total</span>
                    {p.last_contact_at && (
                      <span className="text-gray-400 hidden sm:inline">
                        Last: {formatDistanceToNow(parseISO(p.last_contact_at), { addSuffix: true })}
                      </span>
                    )}
                    <ArrowUpRight className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
            {projectIndex.length > 10 && (
              <div className="px-5 py-3 border-t border-gray-100">
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setShowAll(v => !v)}>
                  {showAll ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show all {projectIndex.length} projects</>}
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Project comms drawer */}
      {selectedProject && (
        <ProjectHistoryDrawer
          projectId={selectedProject.project_id}
          clientName={selectedProject.client_name}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
}