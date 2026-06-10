import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, ChevronUp, CheckCircle2, ArrowUpRight } from "lucide-react";
import { formatDistanceToNow, isPast, parseISO, subDays } from "date-fns";

function getStalledReasons(project, logs) {
  const reasons = [];
  const now = new Date();
  const cutoff = subDays(now, 5);

  // No daily log in 5 days
  const projectLogs = logs.filter(l => l.project_id === project.id);
  const lastLog = projectLogs.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  if (!lastLog || new Date(lastLog.date) < cutoff) {
    reasons.push(lastLog
      ? `No site log in ${formatDistanceToNow(new Date(lastLog.date))} (last: ${lastLog.date})`
      : "No site log entries recorded");
  }

  // Overdue milestones
  const allMilestones = (project.workflow_stages || []).flatMap(stage =>
    (stage.milestones || []).map(m => ({ ...m, stage_name: stage.name }))
  );
  const overdue = allMilestones.filter(m => !m.done && m.due_date && isPast(parseISO(m.due_date)));
  for (const m of overdue.slice(0, 3)) {
    reasons.push(`Milestone overdue: "${m.label}" (${m.stage_name}) — due ${formatDistanceToNow(parseISO(m.due_date), { addSuffix: true })}`);
  }

  return reasons;
}

export default function StalledProjectsPanel() {
  const [collapsed, setCollapsed] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["in-progress-projects"],
    queryFn: () => adminEntities.ContractorProject.filter({ status: "in_progress" }),
    staleTime: 120_000,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["all-daily-logs"],
    queryFn: () => base44.entities.DailyLog.list("-date", 500),
    staleTime: 120_000,
    enabled: projects.length > 0,
  });

  const stalledProjects = projects
    .map(p => ({ project: p, reasons: getStalledReasons(p, logs) }))
    .filter(({ reasons }) => reasons.length > 0);

  const count = stalledProjects.length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${count > 0 ? "bg-amber-100" : "bg-gray-100"}`}>
          <AlertTriangle className={`w-4 h-4 ${count > 0 ? "text-amber-600" : "text-gray-400"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-secondary text-sm">Stalled / Needs Attention</h2>
            {count > 0 && (
              <span className="text-xs font-bold bg-amber-500 text-white rounded-full px-2 py-0.5">{count}</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">In-progress projects with no log in 5 days or overdue milestones</p>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {!collapsed && (
        <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
          {count === 0 && (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <p className="text-sm text-green-700 font-medium">All projects are on track</p>
            </div>
          )}
          {stalledProjects.map(({ project, reasons }) => (
            <div key={project.id} className="flex items-start gap-3 px-4 py-3 bg-amber-50 border-l-4 border-l-amber-400">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-secondary">{project.client_name}</div>
                <div className="text-xs text-gray-500 mb-1">
                  {project.project_type}{project.client_city ? ` · ${project.client_city}` : ""}
                </div>
                <ul className="space-y-0.5">
                  {reasons.map((r, i) => (
                    <li key={i} className="text-xs text-amber-800 flex items-start gap-1">
                      <span className="text-amber-500 shrink-0">•</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to={`/estimator/projects/${project.id}`}
                className="shrink-0 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-0.5"
              >
                Open <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}