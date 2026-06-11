import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit3, Save, X, Trash2, FileText, Package, Camera, ExternalLink, Users, User, Ruler, CheckSquare, FolderOpen, HardHat, CreditCard, Eye, FileBadge, ClipboardCheck, Upload, Loader2, TrendingUp, ShoppingCart, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import EstimatePanel from "@/components/estimator/EstimatePanel";
import MaterialTakeoffPanel from "@/components/estimator/MaterialTakeoffPanel";
import ProjectStatusBar from "@/components/estimator/ProjectStatusBar";
import CustomerPortalTab from "@/components/estimator/CustomerPortalTab";
import ARMeasurementTool from "@/components/estimator/ARMeasurementTool";
import ProjectWorkflow from "@/components/estimator/ProjectWorkflow";
import ProjectDocuments from "@/components/estimator/ProjectDocuments";
import SubBidDashboard from "@/components/estimator/SubBidDashboard";
import SubPayablesDashboard from "@/components/estimator/SubPayablesDashboard";
import SmsHistoryPanel from "@/components/estimator/SmsHistoryPanel";
import VirtualSiteWalk from "@/components/estimator/VirtualSiteWalk";
import SubcontractorScheduler from "@/components/estimator/SubcontractorScheduler";
import QuickBooksSyncPanel from "@/components/estimator/QuickBooksSyncPanel";
import PermitsInspectionsPanel from "@/components/estimator/PermitsInspectionsPanel";
import ChangeOrdersPanel from "@/components/estimator/ChangeOrdersPanel";
import PreConstructionChecklist from "@/components/estimator/PreConstructionChecklist";
import PaymentScheduleBuilder from "@/components/estimator/PaymentScheduleBuilder";
import MaterialChecklist from "@/components/estimator/MaterialChecklist";
import ProfitabilityPanel from "@/components/estimator/ProfitabilityPanel";
import AddressInput from "@/components/AddressInput";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";

function PhotosTab({ project, onUpdate }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const newUrls = [];
    for (const file of files) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        newUrls.push(file_url);
      } catch (err) {
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      }
    }
    if (newUrls.length) {
      await adminEntities.ContractorProject.update(project.id, {
        photos: [...(project.photos || []), ...newUrls],
      });
      onUpdate();
    }
    setUploading(false);
    e.target.value = "";
  };

  const removePhoto = async (url) => {
    await adminEntities.ContractorProject.update(project.id, {
      photos: (project.photos || []).filter(p => p !== url),
    });
    onUpdate();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-secondary">Site Photos ({project.photos?.length || 0})</h2>
        <label className="cursor-pointer">
          <div className="flex items-center gap-1.5 text-sm font-medium text-primary border border-primary/30 bg-primary/5 hover:bg-primary/10 rounded-lg px-3 py-1.5 transition-colors">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? "Uploading…" : "Upload Photos"}
          </div>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      {project.photos?.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {project.photos.map((url, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden aspect-square bg-gray-100">
              <a href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
              </a>
              <button
                onClick={() => removePhoto(url)}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No photos yet</p>
          <p className="text-sm mt-1">Upload site photos using the button above.</p>
        </div>
      )}
    </div>
  );
}

// Project tab strip — rendered in order. `short` is the compact mobile label.
const PROJECT_TABS = [
  { value: "overview", label: "Overview" },
  { value: "estimate", label: "Estimate", icon: FileText },
  { value: "mto", label: "Material Take-Off", short: "MTO", icon: Package },
  { value: "workflow", label: "Workflow", short: "Work", icon: CheckSquare },
  { value: "materials", label: "Materials", short: "Matls", icon: ShoppingCart },
  { value: "precon", label: "Pre-Con", icon: ClipboardCheck },
  { value: "permits", label: "Permits", icon: FileBadge },
  { value: "changes", label: "Changes", short: "CO", icon: ClipboardCheck },
  { value: "measure", label: "Measure", short: "AR", icon: Ruler },
  { value: "docs", label: "Docs", icon: FolderOpen },
  { value: "photos", label: "Photos", icon: Camera },
  { value: "360walk", label: "Site Walk", short: "360°", icon: Eye },
  { value: "subs", label: "Sub Bids", short: "Subs", icon: HardHat },
  { value: "payments", label: "Pay Schedule", short: "Pymts", icon: CreditCard },
  { value: "payables", label: "Payables", short: "Pay", icon: CreditCard },
  { value: "portal", label: "Portal", icon: User },
  { value: "profitability", label: "Profitability", short: "P&L", icon: TrendingUp },
  { value: "quickbooks", label: "QuickBooks", icon: CreditCard },
];

const STATUS_COLORS = {
  walkthrough: "bg-yellow-100 text-yellow-800",
  draft: "bg-blue-100 text-blue-800",
  pending_review: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  denied: "bg-red-100 text-red-800",
  modify: "bg-orange-100 text-orange-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  on_hold: "bg-amber-100 text-amber-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  imported: "bg-teal-100 text-teal-800",
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { brandColor } = useCompanyBrand();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  // Allow deep links like /estimator/projects/:id?tab=estimate (used by the
  // New Quote flow's post-save redirect).
  const [tabParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(tabParams.get("tab") || "overview");

  const { data: project, isLoading, refetch } = useQuery({
    queryKey: ["contractor-project", id],
    queryFn: () => adminEntities.ContractorProject.filter({ id }),
    select: (d) => d[0],
  });

  useEffect(() => {
    if (project && form === null) setForm(project);
     
  }, [project?.id]);

  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates", id],
    queryFn: () => base44.entities.Estimate.filter({ project_id: id }),
  });

  const latestEstimate = estimates.length > 0 ? estimates[0] : null;

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => adminEntities.ContractorProject.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contractor-project", id] }); setEditing(false); toast({ title: "Saved" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminEntities.ContractorProject.delete(id),
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
          <Link to="/estimator/projects" className="text-gray-400 mt-1 shrink-0 hover:opacity-70" style={{ color: brandColor }}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-secondary truncate">{project.client_name}</h1>
            <p className="text-sm text-gray-500 truncate">{project.client_address}{project.client_city ? `, ${project.client_city}` : ""}</p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
            <Button
              onClick={() => setActiveTab("estimate")}
              className="gap-2 text-white font-semibold"
              style={{ background: brandColor }}
            >
              <FileText className="w-4 h-4" /> View / Edit Quote
            </Button>
            {!editing ? (
              <Button variant="outline" onClick={() => { setForm({ ...project }); setEditing(true); }} className="gap-2">
                <Edit3 className="w-4 h-4" /> Edit
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => updateMutation.mutate(form)}
                  disabled={updateMutation.isPending}
                  className="gap-2 text-white font-semibold"
                  style={{ background: brandColor }}
                >
                  <Save className="w-4 h-4" /> Save
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)} className="gap-2">
                  <X className="w-4 h-4" /> Cancel
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-1.5" aria-label="More actions">
                  <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">More</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to={`/estimator/customers?search=${encodeURIComponent(project.client_name || "")}`}>
                    <Users className="w-4 h-4" aria-hidden="true" /> Customer History
                  </Link>
                </DropdownMenuItem>
                {user?.role === "admin" && (
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-700"
                    onClick={() => {
                      if (window.confirm(`Delete the ${project.client_name} project? This permanently removes the project and cannot be undone.`)) {
                        deleteMutation.mutate();
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" /> Delete Project
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <ProjectStatusBar
        project={project}
        onStatusChanged={() => { refetch(); qc.invalidateQueries({ queryKey: ["contractor-project", id] }); }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          className="brand-tabs mb-6 bg-white border border-gray-200 rounded-xl w-full flex justify-start overflow-x-auto scrollbar-hide h-auto p-1 gap-0.5"
          style={{ "--brand": brandColor }}
        >
          {PROJECT_TABS.map(({ value, label, short, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="shrink-0 whitespace-nowrap text-xs sm:text-sm rounded-lg hover:bg-gray-50">
              {Icon && <Icon className="w-3.5 h-3.5 mr-1 sm:mr-1.5 inline" />}
              {short ? (
                <>
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{short}</span>
                </>
              ) : (
                <span>{label}</span>
              )}
            </TabsTrigger>
          ))}
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
                      field === "client_address" ? (
                        <AddressInput
                          className="mt-1 h-8 text-sm rounded-md pr-8"
                          value={form?.client_address || ""}
                          onChange={(val) => setForm((f) => ({ ...f, client_address: val }))}
                          onGeocode={(geo) =>
                            setForm((f) => ({
                              ...f,
                              client_city: f?.client_city || geo.city || "",
                              client_zipcode: f?.client_zipcode || geo.zip || "",
                            }))
                          }
                          placeholder="Street address"
                        />
                      ) : (
                        <Input value={form?.[field] || ""} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} className="mt-1 h-8 text-sm" />
                      )
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

        <TabsContent value="workflow">
          <ProjectWorkflow project={project} onUpdate={() => { refetch(); qc.invalidateQueries({ queryKey: ["contractor-project", id] }); }} />
          <div className="mt-6">
            <SubcontractorScheduler project={project} onUpdate={() => { refetch(); qc.invalidateQueries({ queryKey: ["contractor-project", id] }); }} />
          </div>
        </TabsContent>

        <TabsContent value="materials">
          <MaterialChecklist project={project} onUpdate={() => { refetch(); qc.invalidateQueries({ queryKey: ["contractor-project", id] }); }} />
        </TabsContent>

        <TabsContent value="precon">
          <PreConstructionChecklist project={project} onUpdate={() => { refetch(); qc.invalidateQueries({ queryKey: ["contractor-project", id] }); }} />
        </TabsContent>

        <TabsContent value="permits">
          <PermitsInspectionsPanel project={project} onUpdate={() => { refetch(); qc.invalidateQueries({ queryKey: ["contractor-project", id] }); }} />
        </TabsContent>

        <TabsContent value="changes">
          <ChangeOrdersPanel project={project} estimates={estimates} />
        </TabsContent>

        <TabsContent value="measure">
          <ARMeasurementTool project={project} onSave={() => { refetch(); qc.invalidateQueries({ queryKey: ["contractor-project", id] }); }} />
        </TabsContent>

        <TabsContent value="docs">
          <ProjectDocuments project={project} onUpdate={() => { refetch(); qc.invalidateQueries({ queryKey: ["contractor-project", id] }); }} />
        </TabsContent>

        <TabsContent value="photos">
          <PhotosTab project={project} onUpdate={() => { refetch(); qc.invalidateQueries({ queryKey: ["contractor-project", id] }); }} />
        </TabsContent>

        <TabsContent value="360walk">
          <VirtualSiteWalk project={project} onUpdate={() => { refetch(); qc.invalidateQueries({ queryKey: ["contractor-project", id] }); }} />
        </TabsContent>

        <TabsContent value="subs">
          <SubBidDashboard project={project} />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentScheduleBuilder project={project} estimate={latestEstimate} />
        </TabsContent>

        <TabsContent value="payables">
          <SubPayablesDashboard project={project} />
        </TabsContent>

        <TabsContent value="portal">
          <CustomerPortalTab project={project} />
          <div className="mt-6">
            <SmsHistoryPanel project={project} />
          </div>
        </TabsContent>

        <TabsContent value="profitability">
          <ProfitabilityPanel project={project} estimates={estimates} />
        </TabsContent>

        <TabsContent value="quickbooks">
          <QuickBooksSyncPanel project={project} estimate={latestEstimate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}