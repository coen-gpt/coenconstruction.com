import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { ChevronRight, DollarSign, AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

// Kanban column definitions mapped to ContractorProject.status groups
const COLUMNS = [
  {
    id: "pre_construction",
    label: "Pre-Construction",
    color: "bg-amber-50 border-amber-200",
    headerColor: "bg-amber-100 text-amber-800",
    statuses: ["walkthrough", "draft", "pending_review", "approved", "modify"],
  },
  {
    id: "active",
    label: "Active",
    color: "bg-blue-50 border-blue-200",
    headerColor: "bg-blue-100 text-blue-800",
    statuses: ["in_progress", "on_hold"],
  },
  {
    id: "closing",
    label: "Closing",
    color: "bg-purple-50 border-purple-200",
    headerColor: "bg-purple-100 text-purple-800",
    statuses: ["imported"], // projects near completion - we use this as a "closing" bucket
  },
  {
    id: "completed",
    label: "Completed",
    color: "bg-green-50 border-green-200",
    headerColor: "bg-green-100 text-green-800",
    statuses: ["completed"],
  },
];

// When dropped into a column, set this status
const COLUMN_TARGET_STATUS = {
  pre_construction: "approved",
  active: "in_progress",
  closing: "imported",
  completed: "completed",
};

const STATUS_BADGE = {
  walkthrough: "bg-yellow-100 text-yellow-800",
  draft: "bg-blue-100 text-blue-800",
  pending_review: "bg-purple-100 text-purple-800",
  approved: "bg-emerald-100 text-emerald-800",
  denied: "bg-red-100 text-red-800",
  modify: "bg-orange-100 text-orange-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  on_hold: "bg-amber-100 text-amber-800",
  completed: "bg-gray-100 text-gray-800",
  imported: "bg-teal-100 text-teal-800",
};

function checkPreconGate(project) {
  const checklist = project.precon_checklist;
  if (!checklist) return [];
  const allItems = [
    ...(checklist.materials || []),
    ...(checklist.subs || []),
    ...(checklist.general || []),
  ];
  return allItems.filter(i => !i.done).map(i => i.label);
}

function ProjectCard({ project, index }) {
  const value = project.adjusted_total || project.original_estimate_total || 0;
  const preconIncomplete = checkPreconGate(project);
  const showAlert = ["in_progress", "active"].includes(project.status) && preconIncomplete.length > 0;

  return (
    <Draggable draggableId={project.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white rounded-xl border p-3 mb-2 shadow-sm cursor-grab active:cursor-grabbing transition-shadow ${snapshot.isDragging ? "shadow-lg rotate-1 border-primary" : "border-gray-200 hover:shadow-md"}`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="font-semibold text-secondary text-sm leading-tight">{project.client_name}</div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_BADGE[project.status] || "bg-gray-100 text-gray-600"}`}>
              {project.status?.replace(/_/g, " ")}
            </span>
          </div>
          {project.project_type && (
            <div className="text-xs text-gray-400 mb-1">{project.project_type}</div>
          )}
          {project.client_city && (
            <div className="text-xs text-gray-400">{project.client_city}</div>
          )}
          {value > 0 && (
            <div className="flex items-center gap-1 mt-2">
              <DollarSign className="w-3 h-3 text-emerald-500" />
              <span className="text-xs font-bold text-emerald-600">${value.toLocaleString()}</span>
            </div>
          )}
          {showAlert && (
            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {preconIncomplete.length} pre-con items incomplete
            </div>
          )}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
            <span className="text-[10px] text-gray-400">
              {project.created_date ? format(new Date(project.created_date), "MMM d") : ""}
            </span>
            <Link to={`/estimator/projects/${project.id}`} onClick={e => e.stopPropagation()}>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 hover:text-primary" />
            </Link>
          </div>
        </div>
      )}
    </Draggable>
  );
}

export default function ProjectKanban() {
  const qc = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["kanban-projects"],
    queryFn: () => base44.entities.ContractorProject.list("-created_date", 300),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.ContractorProject.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kanban-projects"] }),
  });

  // Build column → project map
  const columnProjects = {};
  COLUMNS.forEach(col => {
    columnProjects[col.id] = projects.filter(p => col.statuses.includes(p.status));
  });

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const project = projects.find(p => p.id === draggableId);
    if (!project) return;

    const targetColId = destination.droppableId;
    const targetStatus = COLUMN_TARGET_STATUS[targetColId];

    // Gate: block moving to Active/Completed if precon incomplete
    if (targetColId === "active" || targetColId === "closing") {
      const incomplete = checkPreconGate(project);
      if (incomplete.length > 0) {
        toast.error(`Cannot move to Active — ${incomplete.length} pre-con items still incomplete. Complete the Pre-Con Checklist first.`);
        return;
      }
      // Also check in_progress gate
      if (!project.client_signed) {
        toast.error("Cannot activate — contract not yet signed by client.");
        return;
      }
      if (!project.deposit_paid) {
        toast.error("Cannot activate — deposit not yet collected.");
        return;
      }
    }

    updateMutation.mutate({ id: draggableId, status: targetStatus });
    toast.success(`Moved ${project.client_name} → ${COLUMNS.find(c => c.id === targetColId)?.label}`);
  };

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading projects...</div>;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-secondary">Project Kanban</h1>
          <p className="text-sm text-gray-400">{projects.length} projects · drag cards to update stage</p>
        </div>
        <Link to="/estimator/walkthrough">
          <Button className="bg-primary text-white gap-2 text-sm">
            <Plus className="w-4 h-4" /> New Walkthrough
          </Button>
        </Link>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colProjects = columnProjects[col.id] || [];
            return (
              <div key={col.id} className={`rounded-2xl border p-3 ${col.color} flex flex-col min-h-[400px]`}>
                {/* Column header */}
                <div className={`flex items-center justify-between px-2 py-1.5 rounded-xl mb-3 ${col.headerColor}`}>
                  <span className="font-bold text-sm">{col.label}</span>
                  <span className="text-xs font-bold bg-white/60 px-1.5 py-0.5 rounded-full">{colProjects.length}</span>
                </div>

                {/* Total value */}
                {colProjects.some(p => (p.adjusted_total || p.original_estimate_total) > 0) && (
                  <div className="text-xs text-gray-500 font-semibold px-1 mb-2">
                    ${colProjects.reduce((s, p) => s + (p.adjusted_total || p.original_estimate_total || 0), 0).toLocaleString()}
                  </div>
                )}

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 rounded-xl transition-colors min-h-[200px] ${snapshot.isDraggingOver ? "bg-white/60" : ""}`}
                    >
                      {colProjects.map((project, index) => (
                        <ProjectCard key={project.id} project={project} index={index} />
                      ))}
                      {provided.placeholder}
                      {colProjects.length === 0 && (
                        <div className="text-center py-8 text-gray-300 text-xs">
                          <CheckCircle2 className="w-6 h-6 mx-auto mb-1 opacity-30" />
                          Drop projects here
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}