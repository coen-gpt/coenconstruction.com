import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Returns communication performance analytics:
// - Per-team-member inbound response stats (median, avg response_minutes)
// - Benchmark on-time % per member
// - Open/overdue counts per member
// - This week vs last week trend
// - Leaderboard (best inbound responders)
// - Per-project comms log

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const { project_id, user_email } = body; // optional filters

  const [allComms, benchmarks, projects] = await Promise.all([
    base44.asServiceRole.entities.ClientCommunication.list("-created_date", 2000),
    base44.asServiceRole.entities.CommunicationBenchmark.filter({ active: true }),
    base44.asServiceRole.entities.ContractorProject.list("-created_date", 500),
  ]);

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const bmMap = Object.fromEntries(benchmarks.map(b => [b.key, b]));

  const now = new Date();

  // ── Time windows ────────────────────────────────────────────────────────────
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  function inWindow(dateStr, start, end) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= start && d < end;
  }

  // ── Per-project log (if requested) ──────────────────────────────────────────
  if (project_id) {
    const log = allComms
      .filter(c => c.project_id === project_id)
      .sort((a, b) => new Date(b.created_date || b.triggered_at || 0) - new Date(a.created_date || a.triggered_at || 0));
    return Response.json({ ok: true, project_log: log });
  }

  // ── Collect per-member stats ─────────────────────────────────────────────────
  const memberStats = {}; // email → stats

  function ensureMember(email) {
    if (!email) return;
    if (!memberStats[email]) {
      memberStats[email] = {
        email,
        inbound_response_minutes: [],
        benchmark_total: 0,
        benchmark_on_time: 0,
        open_count: 0,
        overdue_count: 0,
        this_week_logged: 0,
        last_week_logged: 0,
        this_week_inbound: 0,
        last_week_inbound: 0,
      };
    }
    return memberStats[email];
  }

  for (const c of allComms) {
    const memberEmail = c.assigned_to || c.handled_by;
    if (!memberEmail) continue;
    if (user_email && memberEmail !== user_email && c.handled_by !== user_email) continue;

    const m = ensureMember(memberEmail);

    // Inbound response times (logged inbound items only)
    if (c.kind === "inbound" && c.status === "logged" && typeof c.response_minutes === "number") {
      m.inbound_response_minutes.push(c.response_minutes);
    }

    // Benchmark on-time tracking
    if (c.kind === "benchmark" && c.status === "logged" && c.benchmark_key && c.contacted_at && c.due_at) {
      const bm = bmMap[c.benchmark_key];
      m.benchmark_total++;
      if (bm) {
        const dueDate = new Date(c.due_at);
        const closedDate = new Date(c.contacted_at);
        const hoursOverdue = (closedDate - dueDate) / (1000 * 60 * 60);
        if (hoursOverdue < (bm.escalate_to_high_after_hours || 24)) {
          m.benchmark_on_time++;
        }
      }
    }

    // Open / overdue
    if (c.status === "open") {
      m.open_count++;
      if (c.due_at && new Date(c.due_at) < now) {
        m.overdue_count++;
      }
    }

    // Weekly logged trends
    if (c.status === "logged" && c.contacted_at) {
      if (inWindow(c.contacted_at, startOfThisWeek, now)) {
        m.this_week_logged++;
        if (c.kind === "inbound") m.this_week_inbound++;
      } else if (inWindow(c.contacted_at, startOfLastWeek, startOfThisWeek)) {
        m.last_week_logged++;
        if (c.kind === "inbound") m.last_week_inbound++;
      }
    }
  }

  // ── Compute derived stats ────────────────────────────────────────────────────
  function median(arr) {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  function avg(arr) {
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  const memberList = Object.values(memberStats).map(m => ({
    email: m.email,
    inbound_count: m.inbound_response_minutes.length,
    median_response_minutes: median(m.inbound_response_minutes),
    avg_response_minutes: avg(m.inbound_response_minutes),
    benchmark_on_time_pct: m.benchmark_total > 0 ? Math.round((m.benchmark_on_time / m.benchmark_total) * 100) : null,
    benchmark_total: m.benchmark_total,
    benchmark_on_time: m.benchmark_on_time,
    open_count: m.open_count,
    overdue_count: m.overdue_count,
    this_week_logged: m.this_week_logged,
    last_week_logged: m.last_week_logged,
    this_week_inbound: m.this_week_inbound,
    last_week_inbound: m.last_week_inbound,
  }));

  // ── Overall stats ────────────────────────────────────────────────────────────
  const allInboundMinutes = memberList.flatMap(m =>
    m.inbound_count > 0 ? Array(m.inbound_count).fill(m.median_response_minutes) : []
  );
  // More accurate: collect all inbound response_minutes
  const allInboundRaw = allComms
    .filter(c => c.kind === "inbound" && c.status === "logged" && typeof c.response_minutes === "number")
    .map(c => c.response_minutes);

  const overall = {
    median_response_minutes: median(allInboundRaw),
    avg_response_minutes: avg(allInboundRaw),
    total_inbound_logged: allInboundRaw.length,
    total_open: allComms.filter(c => c.status === "open").length,
    total_overdue: allComms.filter(c => c.status === "open" && c.due_at && new Date(c.due_at) < now).length,
    this_week_logged: memberList.reduce((s, m) => s + m.this_week_logged, 0),
    last_week_logged: memberList.reduce((s, m) => s + m.last_week_logged, 0),
  };

  // ── Leaderboard: best inbound responders (lowest median, most logged) ─────
  const leaderboard = [...memberList]
    .filter(m => m.inbound_count > 0)
    .sort((a, b) => {
      // Primary: lowest median response time; secondary: most inbound handled
      const aMedian = a.median_response_minutes ?? Infinity;
      const bMedian = b.median_response_minutes ?? Infinity;
      if (aMedian !== bMedian) return aMedian - bMedian;
      return b.inbound_count - a.inbound_count;
    });

  // ── Per-project summary (newest 50 projects with any comms) ─────────────────
  const commsByProject = {};
  for (const c of allComms) {
    if (!c.project_id) continue;
    if (!commsByProject[c.project_id]) commsByProject[c.project_id] = [];
    commsByProject[c.project_id].push(c);
  }

  const projectCommsIndex = Object.entries(commsByProject)
    .map(([pid, comms]) => {
      const p = projectMap[pid];
      const open = comms.filter(c => c.status === "open").length;
      const inbound_open = comms.filter(c => c.status === "open" && c.kind === "inbound").length;
      const last = comms.filter(c => c.status === "logged" && c.contacted_at)
        .sort((a, b) => new Date(b.contacted_at) - new Date(a.contacted_at))[0];
      return {
        project_id: pid,
        client_name: p?.client_name || "Unknown",
        project_type: p?.project_type,
        assigned_to: p?.assigned_to,
        status: p?.status,
        open_count: open,
        inbound_open,
        total_comms: comms.length,
        last_contact_at: last?.contacted_at || null,
      };
    })
    .filter(p => p.total_comms > 0)
    .sort((a, b) => b.inbound_open - a.inbound_open || b.open_count - a.open_count)
    .slice(0, 50);

  return Response.json({
    ok: true,
    overall,
    members: memberList,
    leaderboard,
    project_index: projectCommsIndex,
  });
});