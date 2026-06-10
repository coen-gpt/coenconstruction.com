/**
 * Project Tasks — view and manage auto-generated + manual tasks across all projects
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, ADMIN_SESSION_KEY } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";
import {
  CheckCircle2, Circle, ClipboardList, ArrowUpRight, User,
  Filter, ChevronDown, ChevronUp, Zap, Clock, AlertTriangle
} from "lucide-react";

const STATUS_CFG = {
  open:       { label: "Open",       color: "bg-blue-100 text-blue-700", dot: "bg-blue-400" },
  in_progress:{ label: "In Progress",color: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  done:       { label: "Done",       color: "bg-green-100 text-green-700", dot: "bg-green-400" },
  skipped:    { label: "Skipped",    color: "bg-gray-100 text-gray-400",  dot: "bg-gray-300" },
};

const PRIORITY_CFG = {
  high:   { label: "High",   color: "text-red-600 bg-red-50 border-red-200" },
  normal: { label: "Normal", color: "text-gray-500 bg-gray-50 border-gray-200" },
  low:    { label: "Low",    color: "text-gray-400 bg-gray-50 border-gray-100" },
};

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || "null"); } catch { return null; }
}

export default function ProjectTasks() {
  const { brandColor } = useCompanyBrand();
  const { toast } = useToast();
  const qc = useQueryClient();
  const currentUser = getCurrentUser();

  const [filterStatus, setFilterStatus] = useState("open");
  const [filterRole, setFilterRole] = useState("all");
  const [expandedTask, setExpandedTask] = useState(null);
  const [search, setSearch] = useState("");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["project-tasks"],
    queryFn: () => base44.entities.ProjectTask.list("-created_date", 500),
    refetchInterval: 60_000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-tasks-hub"],
    queryFn: () => adminEntities.ContractorProject.list("-updated_date", 300),
    staleTime: 60_000,
  });

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProjectTask.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-tasks"] }),
  });

  const toggleChecklistItem = (task, itemId) => {
    const newChecklist = (task.checklist || []).map(c =>
      c.id === itemId ? { ...c, done: !c.done } : c
    );
    const allDone = newChecklist.every(c => c.done);
    updateMutation.mutate({
      id: task.id,
      data: {
        checklist: newChecklist,
        status: allDone ? "done" : task.status === "open" ? "in_progress" : task.status,
      }
    });
  };

  const cycleStatus = (task, newStatus) => {
    updateMutation.mutate({ id: task.id, data: { status: newStatus } });
    toast({ title: `Task marked as ${newStatus}` });
  };

  const filtered = tasks.filter(t => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterRole !== "all" && t.assigned_role !== filterRole) return false;
    if (search.trim()) {
      const proj = projectMap[t.project_id];
      const hay = [t.title, t.stage_name, proj?.client_name].join(" ").toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const openCount = tasks.filter(t => t.status === "open").length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;

  const kpis = [
    { label: "Open Tasks", value: openCount, Icon: Circle, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "In Progress", value: inProgressCount, Icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "High Priority", value: tasks.filter(t => t.priority === "high" && t.status !== "done").length, Icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-secondary flex items-center gap-2">
            <ClipboardList className="w-5 h-5" style={{ color: brandColor }} />
            Project Tasks
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Auto-generated checklists from phase triggers + manual tasks</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {kpis.map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
              <Icon className={`w-4 h-4 ${color}`} aria-hidden="true" />
            </div>
            <div>
              <div className={`text-2xl font-bold leading-tight ${color}`}>{value}</div>
              <div className="text-xs text-slate-400">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks or projects…"
          className="text-sm h-8 flex-1 min-w-[160px]"
        />
        <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        {["all", "open", "in_progress", "done"].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1 rounded-full font-semibold border transition-colors ${
              filterStatus === s ? "bg-secondary text-white border-secondary" : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ").replace(/^\w/, c => c.toUpperCase())}
          </button>
        ))}
        <span className="text-gray-200">|</span>
        {["all", "estimator", "project_manager", "admin", "field_lead"].map(r => (
          <button
            key={r}
            onClick={() => setFilterRole(r)}
            className={`text-xs px-3 py-1 rounded-full font-semibold border transition-colors ${
              filterRole === r ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            {r === "all" ? "All Roles" : r.replace("_", " ").replace(/^\w/, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {isLoading && <div className="text-center py-16 text-sm text-gray-400 animate-pulse">Loading tasks…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
            <CheckCircle2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500">No tasks match your filters</p>
            <p className="text-xs text-gray-400 mt-1">Tasks are auto-created when a project phase becomes active.</p>
          </div>
        )}

        {filtered.map(task => {
          const project = projectMap[task.project_id];
          const statCfg = STATUS_CFG[task.status] || STATUS_CFG.open;
          const priCfg = PRIORITY_CFG[task.priority] || PRIORITY_CFG.normal;
          const checklist = task.checklist || [];
          const checkDone = checklist.filter(c => c.done).length;
          const isExpanded = expandedTask === task.id;

          return (
            <div key={task.id} className={`bg-white border rounded-xl overflow-hidden transition-shadow hover:shadow-sm ${
              task.priority === "high" && task.status !== "done" ? "border-red-200" : "border-gray-200"
            }`}>
              <div className="flex items-start gap-3 p-4">
                {/* Status toggle */}
                <button
                  onClick={() => cycleStatus(task, task.status === "done" ? "open" : "done")}
                  className="shrink-0 mt-0.5 transition-colors"
                >
                  {task.status === "done"
                    ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                    : <Circle className="w-5 h-5 text-gray-300 hover:text-primary" />
                  }
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-sm ${task.status === "done" ? "line-through text-gray-400" : "text-secondary"}`}>
                      {task.title}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statCfg.color}`}>{statCfg.label}</span>
                    {task.priority === "high" && task.status !== "done" && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${priCfg.color}`}>High Priority</span>
                    )}
                    {task.trigger_source === "phase_in_progress" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" /> Auto
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {task.stage_name && (
                      <span className="text-xs text-gray-400">Phase: {task.stage_name}</span>
                    )}
                    {project && (
                      <Link
                        to={`/estimator/projects/${task.project_id}`}
                        className="inline-flex items-center gap-0.5 text-xs text-indigo-600 hover:underline"
                      >
                        {project.client_name} <ArrowUpRight className="w-2.5 h-2.5" />
                      </Link>
                    )}
                    {task.assigned_to && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <User className="w-3 h-3" /> {task.assigned_to.split("@")[0]}
                      </span>
                    )}
                    {checklist.length > 0 && (
                      <span className="text-xs text-gray-400">{checkDone}/{checklist.length} steps</span>
                    )}
                  </div>
                </div>

                {checklist.length > 0 && (
                  <button
                    onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                    className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {/* Checklist */}
              {isExpanded && checklist.length > 0 && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                  <div className="space-y-2">
                    {checklist.map(item => (
                      <div key={item.id} className="flex items-center gap-2.5">
                        <button onClick={() => toggleChecklistItem(task, item.id)} className="shrink-0">
                          {item.done
                            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                            : <Circle className="w-4 h-4 text-gray-300 hover:text-primary transition-colors" />
                          }
                        </button>
                        <span className={`text-sm ${item.done ? "line-through text-gray-400" : "text-gray-700"}`}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Status actions */}
                  {task.status !== "done" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      {task.status === "open" && (
                        <Button size="sm" variant="outline" onClick={() => cycleStatus(task, "in_progress")} className="h-7 text-xs gap-1 text-amber-600 border-amber-200 hover:bg-amber-50">
                          Start
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => cycleStatus(task, "done")} className="h-7 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50">
                        <CheckCircle2 className="w-3 h-3" /> Mark Done
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cycleStatus(task, "skipped")} className="h-7 text-xs text-gray-400">
                        Skip
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}