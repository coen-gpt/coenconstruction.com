import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock, MapPin, Coffee, LogOut, CheckCircle2, Camera, Package,
  ClipboardList, Receipt, Search, HardHat, Plus,
  X, ScanLine, Briefcase, Loader2
} from "lucide-react";
import { format } from "date-fns";

const TABS = [
  { id: "timeclock", label: "Time Clock", icon: Clock },
  { id: "tasks", label: "My Tasks", icon: ClipboardList },
  { id: "equipment", label: "Equipment", icon: Package },
  { id: "receipts", label: "Receipts", icon: Receipt },
];

export default function FieldCrewApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("timeclock");

  useEffect(() => {
    base44.auth.me()
      .then(u => { setUser(u); setLoading(false); })
      .catch(() => base44.auth.redirectToLogin());
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#1B2B3A] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-[#E35235] animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      <div className="bg-[#1B2B3A] px-4 pt-8 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E35235] flex items-center justify-center">
            <HardHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-base">Field Crew</div>
            <div className="text-white/60 text-xs">{user?.full_name || user?.email}</div>
          </div>
        </div>
        <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === tab.id ? "bg-[#E35235] text-white" : "text-white/50 hover:text-white"
                }`}>
                <Icon className="w-4 h-4" />{tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "timeclock" && <TimeclockTab user={user} />}
        {activeTab === "tasks" && <TasksTab user={user} />}
        {activeTab === "equipment" && <EquipmentTab user={user} />}
        {activeTab === "receipts" && <ReceiptsTab user={user} />}
      </div>
    </div>
  );
}

// ── TIMECLOCK ─────────────────────────────────────────────────────────────────
function TimeclockTab({ user }) {
  const { toast } = useToast();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [now, setNow] = useState(new Date());
  const [showClockoutPhoto, setShowClockoutPhoto] = useState(false);
  const [clockoutPhoto, setClockoutPhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    loadActiveEntry();
    base44.entities.ContractorProject.filter({ status: "in_progress" }).then(setProjects);
  }, []);

  const loadActiveEntry = async () => {
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const entries = await base44.entities.TimeEntry.filter({ user_id: user.id, date: today });
    const active = entries.find(e => e.status === "clocked_in" || e.status === "on_break");
    setEntry(active || null);
    setLoading(false);
  };

  const getGPS = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("GPS not available")); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      reject,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  const clockIn = async () => {
    if (!selectedProject) { toast({ title: "Select a project first", variant: "destructive" }); return; }
    setGpsLoading(true);
    let gps = null;
    try { gps = await getGPS(); } catch { toast({ title: "No GPS — clocking in without location" }); }
    const now = new Date();
    const e = await base44.entities.TimeEntry.create({
      user_id: user.id,
      user_name: user.full_name || user.email,
      user_email: user.email,
      project_id: selectedProject.id,
      project_name: selectedProject.client_name,
      clock_in: now.toISOString(),
      date: format(now, "yyyy-MM-dd"),
      status: "clocked_in",
      gps_clock_in: gps,
      breaks: [],
    });
    setEntry(e);
    setGpsLoading(false);
    toast({ title: `✅ Clocked in at ${format(now, "h:mm a")}`, description: gps ? `📍 GPS confirmed (±${Math.round(gps.accuracy)}m)` : "No GPS" });
  };

  const startBreak = async () => {
    const breaks = [...(entry.breaks || []), { start: new Date().toISOString(), end: null }];
    const updated = await base44.entities.TimeEntry.update(entry.id, { status: "on_break", breaks });
    setEntry(updated);
    toast({ title: "Break started" });
  };

  const endBreak = async () => {
    const breaks = (entry.breaks || []).map((b, i) =>
      i === entry.breaks.length - 1 && !b.end ? { ...b, end: new Date().toISOString() } : b
    );
    const updated = await base44.entities.TimeEntry.update(entry.id, { status: "clocked_in", breaks });
    setEntry(updated);
    toast({ title: "Break ended — back on the clock!" });
  };

  // Start camera for jobsite photo
  const startCamera = async () => {
    setShowClockoutPhoto(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      toast({ title: "Camera unavailable", description: "Please upload a photo instead", variant: "destructive" });
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      setUploadingPhoto(true);
      const file = new File([blob], `clockout_${Date.now()}.jpg`, { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setClockoutPhoto(file_url);
      stopCamera();
      setUploadingPhoto(false);
    }, "image/jpeg", 0.85);
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const uploadPhotoFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setClockoutPhoto(file_url);
    setUploadingPhoto(false);
  };

  const clockOut = async () => {
    if (!clockoutPhoto) { toast({ title: "Jobsite photo required to clock out", variant: "destructive" }); return; }
    setGpsLoading(true);
    let gps = null;
    try { gps = await getGPS(); } catch { }
    const outTime = new Date();
    const inTime = new Date(entry.clock_in);
    const breakMs = (entry.breaks || []).reduce((s, b) => b.start && b.end ? s + (new Date(b.end) - new Date(b.start)) : s, 0);
    const totalMinutes = Math.round(((outTime - inTime) - breakMs) / 60000);
    await base44.entities.TimeEntry.update(entry.id, {
      clock_out: outTime.toISOString(),
      status: "clocked_out",
      gps_clock_out: gps,
      total_minutes: totalMinutes,
      clockout_photo_url: clockoutPhoto,
    });
    setEntry(null); setShowClockoutPhoto(false); setClockoutPhoto(null); setGpsLoading(false);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    toast({ title: `👋 Clocked out — ${hrs}h ${mins}m worked` });
  };

  const elapsedMinutes = entry ? Math.round((now - new Date(entry.clock_in)) / 60000) : 0;
  const filteredProjects = projects.filter(p =>
    (p.client_name || "").toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.client_address || "").toLowerCase().includes(projectSearch.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-[#1B2B3A] rounded-2xl p-6 text-center">
        <div className="text-4xl font-mono font-bold text-white mb-1">{format(now, "h:mm:ss a")}</div>
        <div className="text-white/50 text-sm">{format(now, "EEEE, MMMM d, yyyy")}</div>
        {entry && (
          <div className="mt-4">
            <div className="flex items-center justify-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${entry.status === "on_break" ? "bg-amber-400" : "bg-green-400 animate-pulse"}`} />
              <span className={`text-sm font-semibold ${entry.status === "on_break" ? "text-amber-300" : "text-green-300"}`}>
                {entry.status === "on_break" ? "On Break" : `Working — ${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m`}
              </span>
            </div>
            <div className="text-white/50 text-xs mt-1">📍 {entry.project_name} · In at {format(new Date(entry.clock_in), "h:mm a")}</div>
          </div>
        )}
      </div>

      {!entry && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Select Job Site</label>
          {selectedProject ? (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <Briefcase className="w-5 h-5 text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-800 text-sm truncate">{selectedProject.client_name}</div>
                <div className="text-xs text-gray-500 truncate">{selectedProject.client_address}</div>
              </div>
              <button onClick={() => setSelectedProject(null)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={projectSearch}
                onChange={e => { setProjectSearch(e.target.value); setShowPicker(true); }}
                onFocus={() => setShowPicker(true)}
                placeholder="Search projects..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#E35235]/30" />
              {showPicker && filteredProjects.length > 0 && (
                <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredProjects.map(p => (
                    <button key={p.id} onClick={() => { setSelectedProject(p); setShowPicker(false); setProjectSearch(""); }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                      <div className="font-semibold text-gray-800 text-sm">{p.client_name}</div>
                      <div className="text-xs text-gray-500">{p.client_address}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!entry ? (
        <Button onClick={clockIn} disabled={gpsLoading || !selectedProject}
          className="w-full h-16 text-lg font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl gap-3">
          {gpsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-6 h-6" />}
          {gpsLoading ? "Getting Location…" : "Clock In"}
        </Button>
      ) : (
        <div className="space-y-3">
          {entry.status === "clocked_in" ? (
            <Button onClick={startBreak}
              className="w-full h-14 font-bold bg-amber-400 hover:bg-amber-500 text-amber-900 rounded-2xl gap-2">
              <Coffee className="w-5 h-5" /> Start Break
            </Button>
          ) : (
            <Button onClick={endBreak}
              className="w-full h-14 font-bold bg-blue-500 hover:bg-blue-600 text-white rounded-2xl gap-2">
              <CheckCircle2 className="w-5 h-5" /> End Break
            </Button>
          )}

          {/* Clock Out flow — requires jobsite photo */}
          {!showClockoutPhoto ? (
            <Button onClick={startCamera} disabled={entry.status === "on_break"}
              className="w-full h-14 font-bold bg-red-500 hover:bg-red-600 text-white rounded-2xl gap-2">
              <Camera className="w-5 h-5" /> Clock Out (Photo Required)
            </Button>
          ) : (
            <div className="bg-white rounded-2xl border border-red-200 p-4 space-y-3">
              <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#E35235]" /> Take a photo of the jobsite to clock out
              </p>
              {!clockoutPhoto ? (
                <>
                  <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={capturePhoto} disabled={uploadingPhoto}
                      className="flex-1 bg-[#E35235] text-white font-bold rounded-xl gap-2">
                      {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                      Capture Photo
                    </Button>
                    <label className="flex items-center justify-center px-3 py-2 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 text-xs text-gray-500">
                      Upload
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={uploadPhotoFile} />
                    </label>
                    <Button variant="outline" onClick={() => { stopCamera(); setShowClockoutPhoto(false); }} className="text-xs">Cancel</Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative">
                    <img src={clockoutPhoto} className="w-full rounded-xl object-cover max-h-40" alt="Jobsite" />
                    <button onClick={() => setClockoutPhoto(null)} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {format(new Date(), "h:mm a")}
                    </div>
                  </div>
                  <Button onClick={clockOut} disabled={gpsLoading}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl gap-2 h-12">
                    {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                    Confirm Clock Out
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <TodayEntriesList userId={user.id} />
    </div>
  );
}

function TodayEntriesList({ userId }) {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    base44.entities.TimeEntry.filter({ user_id: userId, date: today })
      .then(e => setEntries(e.filter(x => x.status === "clocked_out")));
  }, [userId]);
  if (!entries.length) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <h3 className="font-bold text-gray-700 text-sm mb-3">Today's Completed Shifts</h3>
      {entries.map(e => (
        <div key={e.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-700">{e.project_name}</span>
            {e.clockout_photo_url && <Camera className="w-3 h-3 text-gray-300" />}
          </div>
          <div className="font-semibold text-gray-800">
            {Math.floor((e.total_minutes || 0) / 60)}h {(e.total_minutes || 0) % 60}m
          </div>
        </div>
      ))}
    </div>
  );
}

// ── TASKS TAB ──────────────────────────────────────────────────────────────────
function TasksTab({ user }) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadTasks(); }, []);

  const loadTasks = async () => {
    setLoading(true);
    const t = await base44.entities.FieldTask.filter({ assigned_to_id: user.id });
    setTasks(t.filter(x => x.status !== "done").sort((a, b) => {
      const order = { urgent: 0, high: 1, normal: 2, low: 3 };
      return (order[a.priority] || 2) - (order[b.priority] || 2);
    }));
    setLoading(false);
  };

  const updateStatus = async (task, status) => {
    setUpdating(task.id);
    await base44.entities.FieldTask.update(task.id, { status });
    await loadTasks();
    setUpdating(null);
  };

  const completeTask = async (task) => {
    setUpdating(task.id);
    await base44.entities.FieldTask.update(task.id, {
      status: "done",
      completion_notes: completionNotes,
      completion_photos: photos,
      completed_at: new Date().toISOString(),
    });
    setExpandedTask(null); setCompletionNotes(""); setPhotos([]);
    await loadTasks();
    setUpdating(null);
    toast({ title: "✅ Task completed!" });
  };

  const uploadPhoto = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotos(prev => [...prev, file_url]);
    }
    setUploading(false);
  };

  const PRIORITY_STYLES = { urgent: "bg-red-100 text-red-700", high: "bg-orange-100 text-orange-700", normal: "bg-blue-100 text-blue-700", low: "bg-gray-100 text-gray-600" };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-3">
      <h2 className="font-bold text-gray-800">My Tasks ({tasks.length})</h2>
      {tasks.length === 0 && (
        <div className="bg-white rounded-2xl p-10 text-center text-gray-400">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="font-medium">All caught up! No open tasks.</p>
        </div>
      )}
      {tasks.map(task => (
        <div key={task.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-gray-800 text-sm">{task.title}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.normal}`}>{task.priority}</span>
            </div>
            {task.project_name && <div className="text-xs text-[#E35235] font-medium mb-1">📍 {task.project_name}</div>}
            {task.description && <p className="text-xs text-gray-500">{task.description}</p>}
            {task.due_date && <div className="text-xs text-gray-400 mt-1">Due {format(new Date(task.due_date), "MMM d")}</div>}
            <div className="flex gap-2 mt-3">
              {task.status === "assigned" && (
                <Button size="sm" onClick={() => updateStatus(task, "in_progress")} disabled={updating === task.id} className="flex-1 bg-blue-500 text-white text-xs h-8">Start</Button>
              )}
              {task.status === "in_progress" && (
                <Button size="sm" onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)} className="flex-1 bg-green-500 text-white text-xs h-8">Mark Complete</Button>
              )}
              {task.status === "in_progress" && (
                <Button size="sm" variant="outline" onClick={() => updateStatus(task, "blocked")} className="text-xs h-8 border-orange-200 text-orange-600">Blocked</Button>
              )}
            </div>
          </div>
          {expandedTask === task.id && (
            <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
              <Textarea value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} placeholder="Completion notes..." className="resize-none text-sm" rows={2} />
              <div className="flex flex-wrap gap-2">
                {photos.map((url, i) => <img key={i} src={url} className="w-16 h-16 object-cover rounded-lg" />)}
                <label className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Camera className="w-5 h-5 text-gray-400" />}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={uploadPhoto} />
                </label>
              </div>
              <Button onClick={() => completeTask(task)} disabled={updating === task.id} className="w-full bg-green-500 text-white font-bold rounded-xl">
                {updating === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "✅ Submit Completion"}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── EQUIPMENT TAB ──────────────────────────────────────────────────────────────
function EquipmentTab({ user }) {
  const { toast } = useToast();
  const [tab, setTab] = useState("checkout");
  const [equipment, setEquipment] = useState([]);
  const [myCheckouts, setMyCheckouts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEquip, setSelectedEquip] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.EquipmentItem.filter({ status: "available", active: true }),
      base44.entities.EquipmentCheckout.filter({ user_id: user.id, status: "out" }),
      base44.entities.ContractorProject.filter({ status: "in_progress" }),
    ]).then(([eq, co, pr]) => { setEquipment(eq); setMyCheckouts(co); setProjects(pr); setLoading(false); });
  }, []);

  const checkOut = async () => {
    if (!selectedEquip || !selectedProject) { toast({ title: "Select equipment and project", variant: "destructive" }); return; }
    setSubmitting(true);
    await base44.entities.EquipmentCheckout.create({
      equipment_id: selectedEquip.id, equipment_name: selectedEquip.name,
      user_id: user.id, user_name: user.full_name || user.email, user_email: user.email,
      project_id: selectedProject.id, project_name: selectedProject.client_name,
      checked_out_at: new Date().toISOString(), condition_out: "good", notes_out: notes, status: "out",
    });
    await base44.entities.EquipmentItem.update(selectedEquip.id, { status: "checked_out" });
    toast({ title: `✅ ${selectedEquip.name} checked out` });
    setSelectedEquip(null); setSelectedProject(null); setNotes("");
    const [eq, co] = await Promise.all([
      base44.entities.EquipmentItem.filter({ status: "available", active: true }),
      base44.entities.EquipmentCheckout.filter({ user_id: user.id, status: "out" }),
    ]);
    setEquipment(eq); setMyCheckouts(co); setSubmitting(false);
  };

  const checkIn = async (checkout) => {
    await base44.entities.EquipmentCheckout.update(checkout.id, { checked_in_at: new Date().toISOString(), status: "returned" });
    await base44.entities.EquipmentItem.update(checkout.equipment_id, { status: "available" });
    toast({ title: `✅ ${checkout.equipment_name} returned` });
    const [eq, co] = await Promise.all([
      base44.entities.EquipmentItem.filter({ status: "available", active: true }),
      base44.entities.EquipmentCheckout.filter({ user_id: user.id, status: "out" }),
    ]);
    setEquipment(eq); setMyCheckouts(co);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex bg-gray-200 rounded-xl p-1 gap-1">
        {[["checkout", "Check Out"], ["myitems", `My Items (${myCheckouts.length})`]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === id ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "checkout" && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block">Select Equipment</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {equipment.map(eq => (
                <button key={eq.id} onClick={() => setSelectedEquip(selectedEquip?.id === eq.id ? null : eq)}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors ${selectedEquip?.id === eq.id ? "border-[#E35235] bg-[#E35235]/5" : "border-gray-200"}`}>
                  <Package className={`w-5 h-5 shrink-0 ${selectedEquip?.id === eq.id ? "text-[#E35235]" : "text-gray-400"}`} />
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-800 text-sm">{eq.name}</div>
                    <div className="text-xs text-gray-400">{eq.category}</div>
                  </div>
                  {selectedEquip?.id === eq.id && <CheckCircle2 className="w-4 h-4 text-[#E35235] ml-auto" />}
                </button>
              ))}
              {!equipment.length && <p className="text-sm text-gray-400 text-center py-4">No equipment available</p>}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block">Select Project</label>
            <select value={selectedProject?.id || ""} onChange={e => setSelectedProject(projects.find(p => p.id === e.target.value) || null)}
              className="w-full border border-gray-200 rounded-xl p-2.5 text-sm">
              <option value="">Choose a project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.client_name}</option>)}
            </select>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." className="resize-none text-sm" rows={2} />
            <Button onClick={checkOut} disabled={submitting || !selectedEquip || !selectedProject}
              className="w-full bg-[#E35235] text-white font-bold rounded-xl">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check Out Equipment"}
            </Button>
          </div>
        </div>
      )}
      {tab === "myitems" && (
        <div className="space-y-3">
          {!myCheckouts.length ? (
            <div className="bg-white rounded-2xl p-10 text-center text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="font-medium">No equipment checked out</p>
            </div>
          ) : myCheckouts.map(co => (
            <div key={co.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-gray-800">{co.equipment_name}</div>
                <div className="text-xs text-gray-500">{co.project_name}</div>
              </div>
              <Button size="sm" onClick={() => checkIn(co)} className="bg-green-500 text-white text-xs">Return</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── RECEIPTS TAB ───────────────────────────────────────────────────────────────
function ReceiptsTab({ user }) {
  const { toast } = useToast();
  const [receipts, setReceipts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ receipt_type: "job_expense", project_id: "", reason: "", vendor_name: "", amount: "", description: "", receipt_date: format(new Date(), "yyyy-MM-dd") });
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.FieldReceipt.filter({ user_id: user.id }),
      base44.entities.ContractorProject.filter({ status: "in_progress" }),
    ]).then(([r, p]) => { setReceipts(r); setProjects(p); setLoading(false); });
  }, []);

  const uploadImage = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageUrl(file_url);
    setUploading(false);
  };

  const submit = async () => {
    if (!imageUrl) { toast({ title: "Please upload a receipt photo", variant: "destructive" }); return; }
    if (!form.amount) { toast({ title: "Amount required", variant: "destructive" }); return; }
    setSubmitting(true);
    const proj = projects.find(p => p.id === form.project_id);
    await base44.entities.FieldReceipt.create({
      ...form, amount: parseFloat(form.amount),
      project_name: proj?.client_name,
      user_id: user.id, user_name: user.full_name || user.email, user_email: user.email,
      image_url: imageUrl, status: "pending",
    });
    toast({ title: "✅ Receipt submitted!" });
    setShowForm(false); setImageUrl("");
    setForm({ receipt_type: "job_expense", project_id: "", reason: "", vendor_name: "", amount: "", description: "", receipt_date: format(new Date(), "yyyy-MM-dd") });
    const r = await base44.entities.FieldReceipt.filter({ user_id: user.id });
    setReceipts(r); setSubmitting(false);
  };

  const STATUS_STYLES = { pending: "bg-yellow-100 text-yellow-700", in_progress: "bg-blue-100 text-blue-700", approved: "bg-green-100 text-green-700", denied: "bg-red-100 text-red-700" };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">Receipts</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-[#E35235] text-white gap-1">
          <Plus className="w-4 h-4" /> New Receipt
        </Button>
      </div>
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {[["job_expense", "Job Expense"], ["reimbursement", "Reimbursement"]].map(([val, label]) => (
              <button key={val} onClick={() => setForm(f => ({ ...f, receipt_type: val, project_id: "", reason: "" }))}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${form.receipt_type === val ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}>
                {label}
              </button>
            ))}
          </div>
          {imageUrl ? (
            <div className="relative">
              <img src={imageUrl} className="w-full h-36 object-contain bg-gray-50 rounded-xl border" />
              <button onClick={() => setImageUrl("")} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <label className="w-full h-28 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#E35235]">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : <><ScanLine className="w-5 h-5 text-gray-400" /><span className="text-xs text-gray-400">Tap to scan receipt</span></>}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={uploadImage} disabled={uploading} />
            </label>
          )}
          {form.receipt_type === "job_expense" ? (
            <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl p-2.5 text-sm">
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.client_name}</option>)}
            </select>
          ) : (
            <Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason for reimbursement..." className="resize-none text-sm" rows={2} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} placeholder="Vendor / store" className="text-sm" />
            <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="Amount" className="text-sm" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1 text-sm">Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="flex-1 bg-[#E35235] text-white text-sm">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {receipts.map(r => (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
            {r.image_url && <img src={r.image_url} className="w-14 h-14 object-cover rounded-xl shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-gray-800 text-sm">{r.vendor_name || "Receipt"}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[r.status] || "bg-gray-100 text-gray-600"}`}>{r.status}</span>
              </div>
              <div className="text-xs text-gray-500">{r.receipt_type === "job_expense" ? `Job: ${r.project_name}` : `Reimb: ${r.reason?.slice(0, 40)}`}</div>
              <div className="text-sm font-bold text-gray-800 mt-1">${(r.amount || 0).toLocaleString()}</div>
            </div>
          </div>
        ))}
        {!receipts.length && (
          <div className="bg-white rounded-2xl p-10 text-center text-gray-400">
            <Receipt className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="font-medium">No receipts submitted yet</p>
          </div>
        )}
      </div>
    </div>
  );
}