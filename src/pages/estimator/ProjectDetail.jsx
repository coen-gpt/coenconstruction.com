import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit3, Save, X, Trash2, FileText, Package, Camera, ExternalLink, Users } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import EstimatePanel from "@/components/estimator/EstimatePanel";
import MaterialTakeoffPanel from "@/components/estimator/MaterialTakeoffPanel";
import ProjectStatusBar from "@/components/estimator/ProjectStatusBar";

const STATUS_COLORS = {
  walkthrough: "bg-yellow-100 text-yellow-800",
  draft: "bg-blue-100 text-blue-800",
  pending_review: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  denied: "bg-red-100 text-red-800",
  modify: "bg-orange-100 text-orange-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  imported: "bg-teal-100 text-teal-800",
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: project, isLoading, refetch } = useQuery({
    queryKey: ["contractor-project", id],
    queryFn: () => base44.entities.ContractorProject.filter({ id }),
    select: (d) => d[0],
    onSuccess: (p) => { if (!form) setForm(p); },
  });

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.ContractorProject.update(id, data),
    onSuccess: () => { qc.invalidateQueries(["contractor-project", id]); setEditing(false); toast({ title: "Saved" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.ContractorProject.delete(id),
    onSuccess: () => { navigate("/estimator/projects"); toast({ title: "Project deleted" }); },
  });

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (!project) return <div className="p-8 text-center text-gray-400">Project not found.</div>;

  const p = editing ? (form || project) : project;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-start gap-3 mb-2">
          <Link to="/estimator/projects" className="text-gray-400 hover:text-primary mt-1 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-secondary truncate">{project.client_name}</h1>
            <p className="text-sm text-gray-500 truncate">{project.client_address}{project.client_city ? `, ${project.client_city}` : ""}</p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
            <Link
              to={`/estimator/customers?search=${encodeURIComponent(project.client_name || "")}`}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-primary border border-gray-200 rounded-md px-2 py-1.5 hover:border-primary transition-colors"
            >
              <Users className="w-3.5 h-3.5" /> Customer History
            </Link>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => { setForm({ ...project }); setEditing(true); }} className="gap-1">
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={() => updateMutation.mutate(form)} className="gap-1 bg-primary text-white">
                  <Save className="w-3.5 h-3.5" /> Save
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            {user?.role === "admin" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => confirmDelete ? deleteMutation.mutate() : setConfirmDelete(true)}
                className={`gap-1 ${confirmDelete ? "border-red-400 text-red-500" : "text-gray-400"}`}
              >
                <Trash2 className="w-3.5 h-3.5" /> {confirmDelete ? "Confirm?" : ""}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <ProjectStatusBar
        project={project}
        onStatusChanged={() => { refetch(); qc.invalidateQueries(["contractor-project", id]); }}
      />

      <Tabs defaultValue="overview">
        <TabsList className="mb-6 bg-gray-100 w-full flex overflow-x-auto scrollbar-hide">
          <TabsTrigger value="overview" className="flex-1 min-w-fit text-xs sm:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="estimate" className="flex-1 min-w-fit text-xs sm:text-sm"><FileText className="w-3.5 h-3.5 mr-1 sm:mr-1.5 inline" /><span>Estimate</span></TabsTrigger>
          <TabsTrigger value="mto" className="flex-1 min-w-fit text-xs sm:text-sm"><Package className="w-3.5 h-3.5 mr-1 sm:mr-1.5 inline" /><span className="hidden sm:inline">Material Take-Off</span><span className="sm:hidden">MTO</span></TabsTrigger>
          <TabsTrigger value="photos" className="flex-1 min-w-fit text-xs sm:text-sm"><Camera className="w-3.5 h-3.5 mr-1 sm:mr-1.5 inline" /><span>Photos</span></TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Client Info */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-secondary mb-4">Client Information</h2>
              <div className="space-y-3">
                {[
                  ["client_name", "Name"],
                  ["client_phone", "Phone"],
                  ["client_email", "Email"],
                  ["client_address", "Address"],
                  ["client_city", "City"],
                  ["client_zipcode", "Zipcode"],
                ].map(([field, label]) => (
                  <div key={field}>
                    <label className="text-xs text-gray-400 uppercase tracking-wide">{label}</label>
                    {editing ? (
                      <Input value={form?.[field] || ""} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} className="mt-1 h-8 text-sm" />
                    ) : (
                       <p className="text-sm font-medium text-secondary mt-0.5">{p[field] || "—"}</p>
                     )}
                  </div>
                ))}

              </div>
            </div>

            {/* Financial Overview */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-secondary mb-4">Financial Overview</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Original Estimate</span>
                  <span className="font-semibold text-secondary">
                    {project.original_estimate_total > 0 ? `$${project.original_estimate_total.toLocaleString()}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Adjusted Total</span>
                  <span className="font-semibold text-secondary">
                    {project.adjusted_total > 0 ? `$${project.adjusted_total.toLocaleString()}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600">Client Signed</span>
                  <span className={`text-sm font-semibold ${project.client_signed ? "text-green-600" : "text-gray-400"}`}>
                    {project.client_signed ? "✓ Signed" : "Pending"}
                  </span>
                </div>
                {editing && (
                   <div className="flex items-center gap-3 mt-3">
                     <input type="checkbox" id="signed" checked={form?.client_signed || false}
                       onChange={(e) => setForm((f) => ({ ...f, client_signed: e.target.checked }))} />
                     <label htmlFor="signed" className="text-sm text-gray-600">Mark as client signed</label>
                  </div>
                )}
              </div>
              {project.design_preview_id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Linked Design Preview</p>
                  <a href={`/project?id=${project.design_preview_id}`} target="_blank" rel="noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1">
                    View Design Preview <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* SOW */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 md:col-span-2">
              <h2 className="font-semibold text-secondary mb-3">Scope of Work</h2>
              {editing ? (
                <Textarea rows={5} value={form?.scope_of_work || ""} onChange={(e) => setForm((f) => ({ ...f, scope_of_work: e.target.value }))} className="resize-none" />
              ) : (
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{p.scope_of_work || "No scope entered."}</p>
              )}
            </div>

            {/* Rooms */}
            {project.rooms?.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 md:col-span-2">
                <h2 className="font-semibold text-secondary mb-4">Rooms ({project.rooms.length})</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {project.rooms.map((r) => (
                    <div key={r.id} className="bg-muted rounded-lg p-3">
                      <div className="font-medium text-sm text-secondary">{r.name || r.type}</div>
                      {r.dimensions && <div className="text-xs text-gray-500">{r.dimensions}</div>}
                      {r.notes && <div className="text-xs text-gray-500 mt-1">{r.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="estimate">
          <EstimatePanel projectId={id} project={project} />
        </TabsContent>

        <TabsContent value="mto">
          <MaterialTakeoffPanel projectId={id} project={project} />
        </TabsContent>

        <TabsContent value="photos">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-secondary mb-4">Site Photos ({project.photos?.length || 0})</h2>
            {project.photos?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {project.photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="rounded-lg overflow-hidden aspect-square bg-gray-100 block hover:opacity-90 transition-opacity">
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No photos uploaded.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}