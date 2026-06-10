import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44, ADMIN_SESSION_KEY } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import {
  Clock, TrendingUp, Trophy, Users, AlertCircle, ChevronDown, ChevronUp, ArrowUpRight, ArrowLeft
} from "lucide-react";
import { formatDistanceToNow, subDays, isAfter, parseISO } from "date-fns";

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function fmtMin(min) {
  if (min == null) return "—";
  if (min < 60) return `${Math.round(min)}m`;
  if (min < 1440) return `${(min / 60).toFixed(1)}h`;
  return `${(min / 1440).toFixed(1)}d`;
}

function StatCard({ icon: Icon, label, value, sub, color = "text-secondary" }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-indigo-600" />
      </div>
      <div>
        <div className={`text-xl font-bold ${color}`}>{value}</div>
        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function CommsPerformance() {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const [expandedProject, setExpandedProject] = useState(null);

  const { data: allComms = [], isLoading } = useQuery({
    queryKey: ["all-comms-perf"],
    queryFn: () => base44.entities.ClientCommunication.list("-created_date", 1000),
    staleTime: 60_000,
  });

  const { data: benchmarks = [] } = useQuery({
    queryKey: ["benchmarks-perf"],
    queryFn: () => base44.entities.CommunicationBenchmark.filter({ active: true }),
    staleTime: 120_000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-comms-perf"],
    queryFn: () => adminEntities.ContractorProject.list("-updated_date", 300),
    staleTime: 60_000,
  });
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  // Scope to current user if not admin
  const scopedComms = isAdmin
    ? allComms
    : allComms.filter(c => c.assigned_to === currentUser?.email || c.handled_by === currentUser?.email);

  const now = new Date();
  const thisWeekStart = subDays(now, 7);
  const lastWeekStart = subDays(now, 14);

  // ── Inbound items (logged) for response time ──
  const inboundLogged = scopedComms.filter(c => c.kind === "inbound" && c.status === "logged" && c.response_minutes != null);

  // ── Per-member stats ──
  const memberMap = {};
  for (const c of scopedComms) {
    const person = c.handled_by || c.assigned_to;
    if (!person) continue;
    if (!memberMap[person]) {
      memberMap[person] = { email: person, inboundTimes: [], benchmarkOnTime: 0, benchmarkTotal: 0, openCount: 0, overdueCount: 0 };
    }
    const m = memberMap[person];

    if (c.kind === "inbound" && c.status === "logged" && c.response_minutes != null) {
      m.inboundTimes.push(c.response_minutes);
    }
    if (c.kind === "benchmark" && c.status === "logged") {
      m.benchmarkTotal++;
      const bm = benchmarks.find(b => b.key === c.benchmark_key);
      const escalateH = bm?.escalate_to_high_after_hours ?? 24;
      if (c.response_minutes != null && c.response_minutes <= escalateH * 60) {
        m.benchmarkOnTime++;
      }
    }
    if (c.status === "open") {
      m.openCount++;
      if (c.due_at && new Date(c.due_at) < now) m.overdueCount++;
    }
  }

  const members = Object.values(memberMap).map(m => ({
    ...m,
    medianResponse: median(m.inboundTimes),
    avgResponse: avg(m.inboundTimes),
    onTimePct: m.benchmarkTotal > 0 ? Math.round((m.benchmarkOnTime / m.benchmarkTotal) * 100) : null,
  })).sort((a, b) => (a.medianResponse ?? Infinity) - (b.medianResponse ?? Infinity));

  // ── Overall stats ──
  const allInboundTimes = inboundLogged.map(c => c.response_minutes);
  const overallMedian = median(allInboundTimes);
  const overallAvg = avg(allInboundTimes);
  const totalOpen = scopedComms.filter(c => c.status === "open").length;
  const totalOverdue = scopedComms.filter(c => c.status === "open" && c.due_at && new Date(c.due_at) < now).length;

  // ── Benchmark on-time ──
  const bmLogged = scopedComms.filter(c => c.kind === "benchmark" && c.status === "logged");
  const bmOnTime = bmLogged.filter(c => {
    const bm = benchmarks.find(b => b.key === c.benchmark_key);
    const lim = (bm?.escalate_to_high_after_hours ?? 24) * 60;
    return c.response_minutes != null && c.response_minutes <= lim;
  });
  const bmPct = bmLogged.length > 0 ? Math.round((bmOnTime.length / bmLogged.length) * 100) : null;

  // ── Week-over-week ──
  const thisWeek = inboundLogged.filter(c => isAfter(parseISO(c.contacted_at), thisWeekStart));
  const lastWeek = inboundLogged.filter(c =>
    isAfter(parseISO(c.contacted_at), lastWeekStart) && !isAfter(parseISO(c.contacted_at), thisWeekStart)
  );
  const thisWeekAvg = avg(thisWeek.map(c => c.response_minutes));
  const lastWeekAvg = avg(lastWeek.map(c => c.response_minutes));

  // ── Per-project history ──
  const projectsWithComms = projects
    .filter(p => scopedComms.some(c => c.project_id === p.id))
    .map(p => {
      const comms = scopedComms
        .filter(c => c.project_id === p.id)
        .sort((a, b) => new Date(b.created_date || b.triggered_at || 0) - new Date(a.created_date || a.triggered_at || 0));
      return { project: p, comms };
    });

  // ── Chart data ──
  const chartData = members.slice(0, 8).map(m => ({
    name: m.email.split("@")[0],
    "Median (min)": m.medianResponse != null ? Math.round(m.medianResponse) : 0,
    "On-time %": m.onTimePct ?? 0,
  }));

  if (isLoading) return <div className="p-8 text-center text-gray-400 animate-pulse">Loading performance data…</div>;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/estimator" className="text-gray-400 hover:opacity-70">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-secondary flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Communication Performance
          </h1>
          <p className="text-sm text-gray-400">
            {isAdmin ? "All team members" : `Showing your data (${currentUser?.email})`}
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Clock} label="Median inbound response" value={fmtMin(overallMedian)} sub={`avg: ${fmtMin(overallAvg)}`} />
        <StatCard icon={TrendingUp} label="Benchmark on-time %" value={bmPct != null ? `${bmPct}%` : "—"} sub={`${bmOnTime.length}/${bmLogged.length} on time`} />
        <StatCard icon={AlertCircle} label="Open / overdue" value={`${totalOpen} / ${totalOverdue}`} color={totalOverdue > 0 ? "text-red-600" : "text-secondary"} sub="currently in queue" />
        <StatCard
          icon={TrendingUp}
          label="This vs last week (avg)"
          value={thisWeekAvg != null ? fmtMin(thisWeekAvg) : "—"}
          sub={lastWeekAvg != null ? `Last week: ${fmtMin(lastWeekAvg)}` : "No data last week"}
          color={thisWeekAvg != null && lastWeekAvg != null && thisWeekAvg < lastWeekAvg ? "text-green-600" : "text-secondary"}
        />
      </div>

      {/* Leaderboard */}
      {members.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <h2 className="font-semibold text-secondary text-sm">Inbound Responsiveness Leaderboard</h2>
          </div>
          <div className="space-y-2">
            {members.map((m, i) => (
              <div key={m.email} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-100 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-50 text-gray-400"}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-secondary truncate">{m.email}</div>
                  <div className="text-xs text-gray-400">
                    {m.inboundTimes.length} inbound{m.benchmarkTotal > 0 ? ` · ${m.onTimePct}% on-time` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-secondary">{fmtMin(m.medianResponse)}</div>
                  <div className="text-xs text-gray-400">median</div>
                </div>
                <div className="text-right shrink-0 w-16">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${m.overdueCount > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                    {m.openCount} open
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <h2 className="font-semibold text-secondary text-sm mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" /> Response Time by Team Member
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => [n === "Median (min)" ? fmtMin(v) : `${v}%`, n]} />
              <Bar dataKey="Median (min)" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-project communication history */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-secondary text-sm">Per-Project Communication Log</h2>
          <p className="text-xs text-gray-400 mt-0.5">Full history — newest first</p>
        </div>
        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {projectsWithComms.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">No project communication history yet</div>
          )}
          {projectsWithComms.map(({ project, comms }) => (
            <div key={project.id}>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                onClick={() => setExpandedProject(ep => ep === project.id ? null : project.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-secondary">{project.client_name}</div>
                  <div className="text-xs text-gray-400">{comms.length} comms · {project.status} · {project.project_type || ""}</div>
                </div>
                <Link
                  to={`/estimator/projects/${project.id}`}
                  className="shrink-0 text-xs text-indigo-600 hover:underline flex items-center gap-0.5 mr-2"
                  onClick={e => e.stopPropagation()}
                >
                  Open <ArrowUpRight className="w-3 h-3" />
                </Link>
                {expandedProject === project.id
                  ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>
              {expandedProject === project.id && (
                <div className="bg-gray-50 divide-y divide-gray-100">
                  {comms.map(c => (
                    <div key={c.id} className={`flex items-start gap-3 px-6 py-2.5 ${c.kind === "inbound" ? "border-l-4 border-l-red-300" : "border-l-4 border-l-gray-200"}`}>
                      <div className="shrink-0 mt-0.5">
                        <span className={`inline-block w-2 h-2 rounded-full ${c.status === "logged" ? "bg-green-400" : c.status === "dismissed" ? "bg-gray-300" : "bg-amber-400"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-secondary">{c.title || c.kind}</span>
                          {c.kind === "inbound" && <span className="text-xs bg-red-100 text-red-700 px-1 rounded">INBOUND</span>}
                          {c.channel && <span className="text-xs text-gray-400">· {c.channel}</span>}
                          <span className={`text-xs px-1 rounded ${c.status === "logged" ? "bg-green-100 text-green-700" : c.status === "dismissed" ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700"}`}>
                            {c.status}
                          </span>
                        </div>
                        {c.log_note && <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.log_note}</div>}
                        <div className="text-xs text-gray-400 mt-0.5 flex gap-2 flex-wrap">
                          {c.handled_by && <span>By: {c.handled_by}</span>}
                          {c.response_minutes != null && <span>Response: {fmtMin(c.response_minutes)}</span>}
                          {c.contacted_at && <span>{formatDistanceToNow(parseISO(c.contacted_at), { addSuffix: true })}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}