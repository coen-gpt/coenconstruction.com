import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_SESSION_KEY } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Clock, Users, Package, Receipt, ClipboardList, BarChart3,
  Plus, Search, CheckCircle2, Trash2, Loader2, DollarSign,
  Timer, Camera, AlertTriangle, ChevronRight, ImageIcon
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import LaborBudgetAlert from "@/components/field/LaborBudgetAlert";

const TABS = [
{ id: "reports", label: "Reports", icon: BarChart3 },
{ id: "timesheets", label: "Timesheets", icon: Clock },
{ id: "photos", label: "Clockout Photos", icon: Camera },
{ id: "progress_photos", label: "Progress Photos", icon: ImageIcon },
{ id: "receipts", label: "Receipts", icon: Receipt },
{ id: "tasks", label: "Assign Tasks", icon: ClipboardList },
{ id: "equipment", label: "Equipment", icon: Package },
{ id: "labor_budget", label: "Labor vs Budget", icon: AlertTriangle },
];

// Backend staff authenticate with AdminUser sessions, not Base44 logins —
// the reviewer identity comes from the stored session, and all field-entity
// reads/writes go through the session-verified adminEntities proxy.
function adminSessionEmail() {
  try { return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || "null")?.email || ""; } catch { return ""; }
}

function getPayWeek(offset = 0) {
  const today = new Date();
  const day = today.getDay();
  const fridayOffset = day >= 5 ? day - 5 : day + 2;
  const friday = new Date(today);
  friday.setDate(today.getDate() - fridayOffset + offset * 7);
  friday.setHours(0, 0, 0, 0);
  const thursday = new Date(friday);
  thursday.setDate(friday.getDate() + 6);
  thursday.setHours(23, 59, 59, 999);
  return { start: friday, end: thursday };
}

export default function FieldCrewAdmin() {
  const [activeTab, setActiveTab] = useState("reports");
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">Field Crew Management</h1>
        <p className="text-gray-500 text-sm mt-1">Timesheets, tasks, equipment, expense review, labor budgets</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 mb-6">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.id ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>
              <Icon className="w-4 h-4" />{tab.label}
            </button>
          );
        })}
      </div>
      {activeTab === "reports" && <ReportsTab />}
      {activeTab === "timesheets" && <TimesheetsTab />}
      {activeTab === "photos" && <ClockoutPhotosTab />}
      {activeTab === "progress_photos" && <ProgressPhotosTab />}
      {activeTab === "receipts" && <ReceiptsAdminTab />}
      {activeTab === "tasks" && <AssignTasksTab />}
      {activeTab === "equipment" && <EquipmentAdminTab />}
      {activeTab === "labor_budget" && <LaborBudgetAlert />}
    </div>
  );
}

function ReportsTab() {
  const [weekOffset, setWeekOffset] = useState(0);
  const week = getPayWeek(weekOffset);

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["time-entries-all"],
    queryFn: () => adminEntities.TimeEntry.list("-clock_in", 500),
  });
  const { data: receipts = [] } = useQuery({
    queryKey: ["field-receipts-all"],
    queryFn: () => adminEntities.FieldReceipt.list("-created_date", 500),
  });

  const weekEntries = timeEntries.filter(e => {
    if (!e.clock_in) return false;
    const d = parseISO(e.clock_in);
    return d >= week.start && d <= week.end && e.status === "clocked_out";
  });
  const weekReceipts = receipts.filter(r => {
    if (!r.receipt_date) return false;
    const d = parseISO(r.receipt_date);
    return d >= week.start && d <= week.end;
  });

  const byEmployee = {};
  weekEntries.forEach(e => {
    const k = e.user_name || e.user_email;
    if (!byEmployee[k]) byEmployee[k] = { minutes: 0, days: new Set(), entries: [] };
    byEmployee[k].minutes += e.total_minutes || 0;
    byEmployee[k].days.add(e.date);
    byEmployee[k].entries.push(e);
  });

  const totalHours = weekEntries.reduce((s, e) => s + (e.total_minutes || 0), 0) / 60;
  const totalExpenses = weekReceipts.filter(r => r.status !== "denied").reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
        <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronRight className="w-5 h-5 rotate-180 text-gray-600" />
        </button>
        <div className="text-center">
          <div className="font-bold text-gray-800">Pay Week (Fri–Thu)</div>
          <div className="text-sm text-gray-500">{format(week.start, "MMM d")} – {format(week.end, "MMM d, yyyy")}
            {weekOffset === 0 && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Current</span>}
          </div>
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30">
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Hours", value: `${totalHours.toFixed(1)}h`, sub: `${weekEntries.length} shifts`, icon: Timer, color: "text-blue-500" },
          { label: "Crew Members", value: Object.keys(byEmployee).length, sub: "logged hours", icon: Users, color: "text-green-500" },
          { label: "Total Expenses", value: `$${totalExpenses.toLocaleString()}`, sub: `${weekReceipts.filter(r => r.status === "pending").length} pending`, icon: DollarSign, color: "text-primary" },
          { label: "Approved $", value: `$${weekReceipts.filter(r => r.status === "approved").reduce((s, r) => s + (r.amount || 0), 0).toLocaleString()}`, sub: "approved receipts", icon: CheckCircle2, color: "text-green-500" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><Icon className={`w-4 h-4 ${color}`} /><span className="text-xs font-bold text-gray-400 uppercase">{label}</span></div>
            <div className="text-2xl font-bold text-secondary">{value}</div>
            <div className="text-xs text-gray-400">{sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 font-bold text-secondary flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Hours by Employee
        </div>
        {!Object.keys(byEmployee).length ? (
          <div className="p-8 text-center text-gray-400 text-sm">No time entries for this week</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50">
              {["Employee", "Days", "Shifts", "Total Hours"].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {Object.entries(byEmployee).map(([name, data]) => (
                <tr key={name} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-semibold text-gray-800">{name}</td>
                  <td className="px-5 py-3 text-center text-gray-600">{data.days.size}</td>
                  <td className="px-5 py-3 text-center text-gray-600">{data.entries.length}</td>
                  <td className="px-5 py-3 font-bold text-primary">{(data.minutes / 60).toFixed(1)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TimesheetsTab() {
  const [weekOffset, setWeekOffset] = useState(0);
  const week = getPayWeek(weekOffset);
  const [search, setSearch] = useState("");

  const { data: entries = [] } = useQuery({
    queryKey: ["all-time-entries"],
    queryFn: () => adminEntities.TimeEntry.list("-clock_in", 500),
  });

  const weekEntries = entries.filter(e => {
    if (!e.clock_in) return false;
    const d = parseISO(e.clock_in);
    return d >= week.start && d <= week.end;
  }).filter(e => !search || (e.user_name || "").toLowerCase().includes(search.toLowerCase()) || (e.project_name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <ChevronRight className="w-4 h-4 rotate-180 text-gray-600" />
          </button>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-semibold">
            {format(week.start, "MMM d")} – {format(week.end, "MMM d")}
          </div>
          <button onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0} className="p-2 bg-white border border-gray-200 rounded-lg disabled:opacity-30">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee or project..." className="pl-9 w-64 text-sm" />
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            {["Employee", "Project", "Date", "In", "Out", "Breaks", "Total", "GPS In", "Photo"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase whitespace-nowrap">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {!weekEntries.length ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No entries for this week</td></tr>
            ) : weekEntries.map(e => {
              const breakMins = (e.breaks || []).reduce((s, b) => b.start && b.end ? s + Math.round((new Date(b.end) - new Date(b.start)) / 60000) : s, 0);
              return (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{e.user_name || e.user_email}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[100px] truncate">{e.project_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{e.date}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{e.clock_in ? format(parseISO(e.clock_in), "h:mm a") : "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{e.clock_out ? format(parseISO(e.clock_out), "h:mm a") : <span className="text-green-600 font-semibold">Active</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{breakMins}m</td>
                  <td className="px-4 py-3 font-bold text-primary whitespace-nowrap">{Math.floor((e.total_minutes || 0) / 60)}h {(e.total_minutes || 0) % 60}m</td>
                  <td className="px-4 py-3">
                    {e.gps_clock_in?.lat ? (
                      <a href={`https://maps.google.com/?q=${e.gps_clock_in.lat},${e.gps_clock_in.lng}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-xs">Map</a>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {e.clockout_photo_url ? (
                      <a href={e.clockout_photo_url} target="_blank" rel="noreferrer">
                        <img src={e.clockout_photo_url} className="w-10 h-10 object-cover rounded-lg" alt="Jobsite" />
                      </a>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClockoutPhotosTab() {
  const [search, setSearch] = useState("");
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["clockout-photos"],
    queryFn: () => adminEntities.TimeEntry.list("-clock_out", 200),
  });

  const photosOnly = entries.filter(e => e.clockout_photo_url && (!search || (e.user_name || "").toLowerCase().includes(search.toLowerCase()) || (e.project_name || "").toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-bold text-secondary">Clockout Jobsite Photos</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by employee or project..." className="pl-9 w-64 text-sm" />
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {photosOnly.map(e => (
            <a key={e.id} href={e.clockout_photo_url} target="_blank" rel="noreferrer" className="group block bg-white rounded-xl overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="relative">
                <img src={e.clockout_photo_url} className="w-full h-40 object-cover" alt="Jobsite" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>
              <div className="p-2.5">
                <div className="font-semibold text-gray-800 text-xs truncate">{e.user_name}</div>
                <div className="text-xs text-gray-400 truncate">{e.project_name}</div>
                <div className="text-xs text-gray-400">{e.date} · {e.clock_out ? format(parseISO(e.clock_out), "h:mm a") : ""}</div>
              </div>
            </a>
          ))}
          {!photosOnly.length && (
            <div className="col-span-4 py-12 text-center text-gray-400">
              <Camera className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>No clockout photos yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProgressPhotosTab() {
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["field-tasks-photos"],
    queryFn: () => adminEntities.FieldTask.list("-updated_date", 200),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-in-progress"],
    queryFn: () => adminEntities.ContractorProject.filter({ status: "in_progress" }),
  });

  const tasksWithPhotos = tasks.filter(t => (t.progress_photos || []).length > 0 || (t.completion_photos || []).length > 0);
  const filtered = tasksWithPhotos.filter(t => {
    const matchSearch = !search || (t.title || "").toLowerCase().includes(search.toLowerCase()) || (t.assigned_to_name || "").toLowerCase().includes(search.toLowerCase());
    const matchProject = !projectFilter || t.project_id === projectFilter;
    return matchSearch && matchProject;
  });

  const totalPhotos = filtered.reduce((s, t) => s + (t.progress_photos || []).length + (t.completion_photos || []).length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 className="font-bold text-secondary">Task Progress Photos</h2>
          <p className="text-sm text-gray-400">{filtered.length} tasks · {totalPhotos} photos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search task or crew..." className="pl-9 w-52 text-sm" />
          </div>
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.client_name}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No progress photos yet</p>
          <p className="text-sm mt-1">Crew members can upload photos from the Field app while working on tasks.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map(task => {
            const allPhotos = [
              ...(task.progress_photos || []).map(p => ({ ...p, type: "progress" })),
              ...(task.completion_photos || []).map(url => ({ url, type: "completion", uploaded_by: task.assigned_to_name })),
            ];
            const STATUS_STYLES = { assigned: "bg-gray-100 text-gray-600", in_progress: "bg-blue-100 text-blue-700", done: "bg-green-100 text-green-700", blocked: "bg-red-100 text-red-700" };
            return (
              <div key={task.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-secondary">{task.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[task.status] || STATUS_STYLES.assigned}`}>{task.status?.replace("_", " ")}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      👤 {task.assigned_to_name || task.assigned_to_email}
                      {task.project_name && <> · 📍 {task.project_name}</>}
                      <span className="ml-2 text-purple-500 font-semibold">{allPhotos.length} photo{allPhotos.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {allPhotos.map((p, i) => (
                    <a key={i} href={p.url} target="_blank" rel="noreferrer" className="group relative block">
                      <img src={p.url} className="w-full aspect-square object-cover rounded-lg border border-gray-100 group-hover:opacity-80 transition-opacity" alt="Progress" />
                      <div className="absolute bottom-1 left-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${p.type === "completion" ? "bg-green-500/80 text-white" : "bg-purple-500/80 text-white"}`}>
                          {p.type === "completion" ? "Final" : "Progress"}
                        </span>
                      </div>
                      {p.uploaded_by && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-end p-1.5">
                          <span className="text-white text-xs truncate">{p.uploaded_by}</span>
                        </div>
                      )}
                    </a>
                  ))}
                </div>
                {task.completion_notes && (
                  <div className="px-5 pb-4">
                    <div className="bg-green-50 rounded-lg p-3 text-xs text-green-700">
                      <span className="font-semibold">Completion notes: </span>{task.completion_notes}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReceiptsAdminTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selected, setSelected] = useState(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: receipts = [], isLoading } = useQuery({ queryKey: ["field-receipts"], queryFn: () => adminEntities.FieldReceipt.list("-created_date", 200) });
  const filtered = receipts.filter(r => statusFilter === "all" || r.status === statusFilter);
  const STATUS_STYLES = { pending: "bg-yellow-100 text-yellow-700", in_progress: "bg-blue-100 text-blue-700", approved: "bg-green-100 text-green-700", denied: "bg-red-100 text-red-700" };

  const updateStatus = async (id, status) => {
    setSaving(true);
    try {
      await adminEntities.FieldReceipt.update(id, { status, admin_notes: adminNotes, reviewed_by: adminSessionEmail(), reviewed_at: new Date().toISOString() });
      qc.invalidateQueries({ queryKey: ["field-receipts"] });
      setSelected(null); setAdminNotes("");
      toast({ title: `Receipt ${status}` });
    } catch (err) {
      toast({ title: "Couldn't update receipt", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[["pending", "Pending"], ["in_progress", "In Review"], ["approved", "Approved"], ["denied", "Denied"], ["all", "All"]].map(([val, label]) => (
          <button key={val} onClick={() => setStatusFilter(val)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${statusFilter === val ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
            {label} <span className="ml-1 opacity-60">({receipts.filter(r => val === "all" ? true : r.status === val).length})</span>
          </button>
        ))}
      </div>
      {isLoading ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div> : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map(r => (
            <div key={r.id} className={`bg-white border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all ${selected?.id === r.id ? "border-primary ring-2 ring-primary/20" : "border-gray-200"}`}
              onClick={() => { setSelected(selected?.id === r.id ? null : r); setAdminNotes(r.admin_notes || ""); }}>
              <div className="flex gap-3">
                {r.image_url && <img src={r.image_url} className="w-16 h-16 object-cover rounded-lg shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-800 text-sm">{r.vendor_name || "Receipt"}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[r.status] || "bg-gray-100"}`}>{r.status}</span>
                  </div>
                  <div className="text-xs text-gray-500">{r.user_name} · {r.receipt_date}</div>
                  <div className="text-xs text-gray-500">{r.receipt_type === "job_expense" ? `Job: ${r.project_name}` : `Reimb: ${r.reason?.slice(0, 35)}`}</div>
                  <div className="text-lg font-bold text-gray-800 mt-1">${(r.amount || 0).toLocaleString()}</div>
                </div>
              </div>
              {selected?.id === r.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  {r.image_url && <img src={r.image_url} className="w-full max-h-56 object-contain bg-gray-50 rounded-xl" />}
                  <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Admin notes..." className="resize-none text-sm" rows={2} onClick={e => e.stopPropagation()} />
                  <div className="flex gap-2">
                    {["in_progress", "approved", "denied"].map(s => (
                      <Button key={s} size="sm" onClick={e => { e.stopPropagation(); updateStatus(r.id, s); }} disabled={saving}
                        className={`flex-1 text-xs capitalize ${s === "approved" ? "bg-green-500 hover:bg-green-600 text-white" : s === "denied" ? "bg-red-500 hover:bg-red-600 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"}`}>
                        {s === "in_progress" ? "In Review" : s}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {!filtered.length && (
            <div className="col-span-2 py-12 text-center text-gray-400">
              <Receipt className="w-10 h-10 mx-auto mb-2 opacity-20" /><p>No receipts</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssignTasksTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", assigned_to_id: "", assigned_to_name: "", assigned_to_email: "", project_id: "", project_name: "", due_date: "", priority: "normal" });
  const [submitting, setSubmitting] = useState(false);
  const { data: tasks = [] } = useQuery({ queryKey: ["field-tasks"], queryFn: () => adminEntities.FieldTask.list("-created_date", 200) });
  const { data: users = [] } = useQuery({
    queryKey: ["all-team-members"],
    // Tasks are assigned to AdminUsers — the same accounts crew sign in with
    queryFn: async () => (await adminEntities.AdminUser.list()).filter(u => u.active !== false),
  });
  const { data: projects = [] } = useQuery({ queryKey: ["projects-in-progress-assign"], queryFn: () => adminEntities.ContractorProject.filter({ status: "in_progress" }) });

  const submitTask = async () => {
    if (!form.title || !form.assigned_to_id) { toast({ title: "Title and assignee required", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      await adminEntities.FieldTask.create({ ...form, assigned_by: adminSessionEmail(), status: "assigned" });
      qc.invalidateQueries({ queryKey: ["field-tasks"] });
      setShowForm(false);
      setForm({ title: "", description: "", assigned_to_id: "", assigned_to_name: "", assigned_to_email: "", project_id: "", project_name: "", due_date: "", priority: "normal" });
      toast({ title: "✅ Task assigned!" });
    } catch (err) {
      toast({ title: "Couldn't assign task", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTask = async (id) => {
    try {
      await adminEntities.FieldTask.delete(id);
      qc.invalidateQueries({ queryKey: ["field-tasks"] });
    } catch (err) {
      toast({ title: "Couldn't delete task", description: err.message, variant: "destructive" });
    }
  };

  const PRIORITY_STYLES = { urgent: "bg-red-100 text-red-700", high: "bg-orange-100 text-orange-700", normal: "bg-blue-100 text-blue-700", low: "bg-gray-100 text-gray-600" };
  const STATUS_STYLES = { assigned: "bg-gray-100 text-gray-600", in_progress: "bg-blue-100 text-blue-700", done: "bg-green-100 text-green-700", blocked: "bg-red-100 text-red-700" };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-secondary">Field Tasks</h2>
        <Button onClick={() => setShowForm(!showForm)} className="gap-1 bg-primary text-white text-sm"><Plus className="w-4 h-4" /> Assign Task</Button>
      </div>
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Task Title *</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What needs to be done?" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Assign To *</label>
              <Select value={form.assigned_to_id} onValueChange={v => {
                const u = users.find(x => x.id === v);
                setForm(f => ({ ...f, assigned_to_id: v, assigned_to_name: u?.full_name || u?.email || "", assigned_to_email: u?.email || "" }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select crew member..." /></SelectTrigger>
                <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Project</label>
              {/* Radix Select crashes on null/empty item values — use a sentinel */}
              <Select value={form.project_id || "none"} onValueChange={v => {
                const p = projects.find(x => x.id === v);
                setForm(f => ({ ...f, project_id: p ? v : "", project_name: p?.client_name || "" }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.client_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Due Date</label>
              <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Priority</label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["low", "normal", "high", "urgent"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Description</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Details..." className="resize-none text-sm" rows={2} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
            <Button onClick={submitTask} disabled={submitting} className="flex-1 bg-primary text-white">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Assign Task"}</Button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {tasks.map(task => (
          <div key={task.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-secondary text-sm">{task.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.normal}`}>{task.priority}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[task.status] || STATUS_STYLES.assigned}`}>{task.status?.replace("_", " ")}</span>
              </div>
              <div className="text-xs text-gray-500">👤 {task.assigned_to_name || task.assigned_to_email}{task.project_name ? ` · 📍 ${task.project_name}` : ""}</div>
              {task.status === "done" && task.completion_notes && (
                <div className="mt-2 bg-green-50 rounded-lg p-2 text-xs text-green-700">✅ {task.completion_notes}</div>
              )}
              {((task.progress_photos || []).length > 0 || (task.completion_photos || []).length > 0) && (
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  {[...(task.progress_photos || []).map(p => p.url), ...(task.completion_photos || [])].slice(0, 6).map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer">
                      <img src={url} className="w-10 h-10 object-cover rounded-lg border border-gray-100" alt="Progress" />
                    </a>
                  ))}
                  {((task.progress_photos || []).length + (task.completion_photos || []).length) > 6 && (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                      +{(task.progress_photos || []).length + (task.completion_photos || []).length - 6}
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => deleteTask(task.id)} className="h-8 w-8 text-red-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {!tasks.length && (
          <div className="py-12 text-center text-gray-400"><ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-20" /><p>No tasks assigned yet</p></div>
        )}
      </div>
    </div>
  );
}

function EquipmentAdminTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("inventory");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Power Tools", serial_number: "", asset_tag: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const { data: equipment = [] } = useQuery({ queryKey: ["equipment"], queryFn: () => adminEntities.EquipmentItem.filter({ active: true }) });
  const { data: checkouts = [] } = useQuery({ queryKey: ["all-checkouts"], queryFn: () => adminEntities.EquipmentCheckout.list("-checked_out_at", 100) });
  const activeCheckouts = checkouts.filter(c => c.status === "out");
  const STATUS_STYLES = { available: "bg-green-100 text-green-700", checked_out: "bg-orange-100 text-orange-700", maintenance: "bg-yellow-100 text-yellow-700", retired: "bg-gray-100 text-gray-500" };

  const createEquipment = async () => {
    if (!form.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      await adminEntities.EquipmentItem.create({ ...form, status: "available", active: true });
      qc.invalidateQueries({ queryKey: ["equipment"] });
      setShowForm(false); setForm({ name: "", category: "Power Tools", serial_number: "", asset_tag: "", description: "" });
      toast({ title: "Equipment added!" });
    } catch (err) {
      toast({ title: "Couldn't add equipment", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const forceReturn = async (checkout) => {
    try {
      await adminEntities.EquipmentCheckout.update(checkout.id, { status: "returned", checked_in_at: new Date().toISOString() });
      await adminEntities.EquipmentItem.update(checkout.equipment_id, { status: "available" });
      qc.invalidateQueries({ queryKey: ["equipment"] }); qc.invalidateQueries({ queryKey: ["all-checkouts"] });
      toast({ title: `${checkout.equipment_name} returned` });
    } catch (err) {
      toast({ title: "Couldn't return equipment", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex bg-gray-200 rounded-xl p-1 gap-1">
          {[["inventory", `Inventory (${equipment.length})`], ["out", `Out (${activeCheckouts.length})`], ["history", "History"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === id ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}>
              {label}
            </button>
          ))}
        </div>
        {tab === "inventory" && <Button onClick={() => setShowForm(!showForm)} className="gap-1 bg-primary text-white text-sm"><Plus className="w-4 h-4" /> Add Equipment</Button>}
      </div>

      {showForm && tab === "inventory" && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Name *</label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">Category</label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Power Tools", "Hand Tools", "Safety", "Machinery", "Vehicles", "Other"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} placeholder="Serial #" /></div>
            <div><Input value={form.asset_tag} onChange={e => setForm(f => ({ ...f, asset_tag: e.target.value }))} placeholder="Asset Tag #" /></div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
            <Button onClick={createEquipment} disabled={submitting} className="flex-1 bg-primary text-white">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}</Button>
          </div>
        </div>
      )}

      {tab === "inventory" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              {["Name", "Category", "Asset Tag", "Status"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {equipment.map(eq => (
                <tr key={eq.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-secondary">{eq.name}</td>
                  <td className="px-4 py-3 text-gray-500">{eq.category}</td>
                  <td className="px-4 py-3 text-gray-500">{eq.asset_tag || "—"}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${STATUS_STYLES[eq.status] || "bg-gray-100"}`}>{eq.status?.replace("_", " ")}</span></td>
                </tr>
              ))}
              {!equipment.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No equipment added</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "out" && (
        <div className="space-y-3">
          {activeCheckouts.map(co => (
            <div key={co.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-secondary">{co.equipment_name}</div>
                <div className="text-xs text-gray-500">{co.user_name} · {co.project_name}</div>
              </div>
              <Button size="sm" onClick={() => forceReturn(co)} className="bg-green-500 text-white text-xs">Return</Button>
            </div>
          ))}
          {!activeCheckouts.length && <div className="py-10 text-center text-gray-400"><Package className="w-10 h-10 mx-auto mb-2 opacity-20" /><p>No equipment checked out</p></div>}
        </div>
      )}

      {tab === "history" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              {["Equipment", "Employee", "Project", "Out", "In", "Status"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {checkouts.slice(0, 50).map(co => (
                <tr key={co.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-secondary">{co.equipment_name}</td>
                  <td className="px-4 py-3 text-gray-600">{co.user_name}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[100px] truncate">{co.project_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{co.checked_out_at ? format(parseISO(co.checked_out_at), "MMM d") : "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{co.checked_in_at ? format(parseISO(co.checked_in_at), "MMM d") : "—"}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${co.status === "returned" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>{co.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}