import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock, MapPin, Coffee, LogOut, CheckCircle2, Camera, Package,
  ClipboardList, Receipt, Search, HardHat, Plus,
  X, ScanLine, Briefcase, Loader2, CalendarOff, Truck, PackageCheck, ShoppingCart
} from "lucide-react";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import TimeOffTab from "@/components/field/TimeOffTab";

const TABS = [
  { id: "timeclock", label: "Time Clock", icon: Clock },
  { id: "tasks", label: "My Tasks", icon: ClipboardList },
  { id: "materials", label: "Materials", icon: ShoppingCart },
  { id: "equipment", label: "Equipment", icon: Package },
  { id: "receipts", label: "Receipts", icon: Receipt },
  { id: "timeoff", label: "Time Off", icon: CalendarOff },
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
    <div className="min-h-screen bg-secondary flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );

  return (
    // dvh tracks the real visible viewport (keyboard/browser chrome);
    // safe-area padding keeps the header out of notches and the home bar
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col max-w-lg mx-auto pb-[env(safe-area-inset-bottom)]">
      <div className="bg-secondary px-4 pb-3 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
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
                  activeTab === tab.id ? "bg-primary text-white" : "text-white/50 hover:text-white"
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
        {activeTab === "materials" && <MaterialsTab user={user} />}
        {activeTab === "equipment" && <EquipmentTab user={user} />}
        {activeTab === "receipts" && <ReceiptsTab user={user} />}
        {activeTab === "timeoff" && <TimeOffTab user={user} isFieldCrew={true} />}
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
    base44.functions.invoke("fieldCrewProjects", { action: "list" })
      .then(r => setProjects(r.data?.projects || []))
      .catch(() => toast({ title: "Couldn't load projects", description: "Pull down to refresh or check your connection.", variant: "destructive" }));
  }, []);

  const loadActiveEntry = async () => {
    setLoading(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const entries = await base44.entities.TimeEntry.filter({ user_id: user.id, date: today });
      const active = entries.find(e => e.status === "clocked_in" || e.status === "on_break");
      setEntry(active || null);
    } catch {
      toast({ title: "Couldn't load your clock status", description: "Check your connection and reload.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
    if (!selectedProject || gpsLoading) { if (!selectedProject) toast({ title: "Select a project first", variant: "destructive" }); return; }
    setGpsLoading(true);
    try {
      let gps = null;
      try { gps = await getGPS(); } catch { toast({ title: "No GPS — clocking in without location" }); }
      const now = new Date();
      const e = await base44.entities.TimeEntry.create({
        user_id: user.id,
        user_name: user.full_name || user.email,
        user_email: user.email,
        project_id: selectedProject.id,
        project_name: selectedProject.client_name || selectedProject.name || "Project",
        clock_in: now.toISOString(),
        date: format(now, "yyyy-MM-dd"),
        status: "clocked_in",
        gps_clock_in: gps,
        breaks: [],
      });
      setEntry(e);
      toast({ title: `✅ Clocked in at ${format(now, "h:mm a")}`, description: gps ? `📍 GPS confirmed (±${Math.round(gps.accuracy)}m)` : "No GPS" });
    } catch {
      // A failed write used to leave the button disabled forever
      toast({ title: "Clock-in failed", description: "Check your connection and try again.", variant: "destructive" });
    } finally {
      setGpsLoading(false);
    }
  };

  const startBreak = async () => {
    try {
      const breaks = [...(entry.breaks || []), { start: new Date().toISOString(), end: null }];
      const updated = await base44.entities.TimeEntry.update(entry.id, { status: "on_break", breaks });
      setEntry(updated);
      toast({ title: "Break started" });
    } catch {
      toast({ title: "Couldn't start break", description: "Try again.", variant: "destructive" });
    }
  };

  const endBreak = async () => {
    try {
      const breaks = (entry.breaks || []).map((b, i) =>
        i === entry.breaks.length - 1 && !b.end ? { ...b, end: new Date().toISOString() } : b
      );
      const updated = await base44.entities.TimeEntry.update(entry.id, { status: "clocked_in", breaks });
      setEntry(updated);
      toast({ title: "Break ended — back on the clock!" });
    } catch {
      toast({ title: "Couldn't end break", description: "Try again.", variant: "destructive" });
    }
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
      try {
        const file = new File([blob], `clockout_${Date.now()}.jpg`, { type: "image/jpeg" });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setClockoutPhoto(file_url);
        stopCamera();
      } catch {
        // Keep the camera open so they can retry — but never freeze the spinner
        toast({ title: "Photo upload failed", description: "Try capturing again.", variant: "destructive" });
      } finally {
        setUploadingPhoto(false);
      }
    }, "image/jpeg", 0.85);
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const uploadPhotoFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setClockoutPhoto(file_url);
    } catch {
      toast({ title: "Photo upload failed", description: "Try again.", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const clockOut = async () => {
    if (!clockoutPhoto) { toast({ title: "Jobsite photo required to clock out", variant: "destructive" }); return; }
    if (gpsLoading) return;
    setGpsLoading(true);
    try {
      let gps = null;
      try { gps = await getGPS(); } catch { /* clock out without location */ }
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
      setEntry(null); setShowClockoutPhoto(false); setClockoutPhoto(null);
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      toast({ title: `👋 Clocked out — ${hrs}h ${mins}m worked` });
    } catch {
      toast({ title: "Clock-out failed", description: "Your time is still running — try again.", variant: "destructive" });
    } finally {
      setGpsLoading(false);
    }
  };

  const elapsedMinutes = entry ? Math.round((now - new Date(entry.clock_in)) / 60000) : 0;
  const filteredProjects = projects.filter(p =>
    (p.client_name || "").toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.client_address || "").toLowerCase().includes(projectSearch.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-secondary rounded-2xl p-6 text-center">
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
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
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
                <Camera className="w-4 h-4 text-primary" /> Take a photo of the jobsite to clock out
              </p>
              {!clockoutPhoto ? (
                <>
                  <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={capturePhoto} disabled={uploadingPhoto}
                      className="flex-1 bg-primary text-white font-bold rounded-xl gap-2">
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
      .then(e => setEntries(e.filter(x => x.status === "clocked_out")))
      .catch(() => { /* summary list is non-critical — fail quiet */ });
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
  const [completionPhotos, setCompletionPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingProgress, setUploadingProgress] = useState(null); // task id

  useEffect(() => { loadTasks(); }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const t = await base44.entities.FieldTask.filter({ assigned_to_id: user.id });
      setTasks(t.filter(x => x.status !== "done").sort((a, b) => {
        const order = { urgent: 0, high: 1, normal: 2, low: 3 };
        return (order[a.priority] || 2) - (order[b.priority] || 2);
      }));
    } catch {
      toast({ title: "Couldn't load tasks", description: "Check your connection.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (task, status) => {
    setUpdating(task.id);
    try {
      await base44.entities.FieldTask.update(task.id, { status });
      // Optimistic local update — a full refetch made the list flash on every tap
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t));
    } catch {
      toast({ title: "Update failed", description: "Try again.", variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const completeTask = async (task) => {
    setUpdating(task.id);
    try {
      await base44.entities.FieldTask.update(task.id, {
        status: "done",
        completion_notes: completionNotes,
        completion_photos: completionPhotos,
        completed_at: new Date().toISOString(),
      });
      setExpandedTask(null); setCompletionNotes(""); setCompletionPhotos([]);
      setTasks(prev => prev.filter(t => t.id !== task.id));
      toast({ title: "✅ Task completed!" });
    } catch {
      toast({ title: "Couldn't complete task", description: "Your notes and photos are still here — try again.", variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const uploadCompletionPhoto = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setCompletionPhotos(prev => [...prev, file_url]);
      }
    } catch {
      toast({ title: "Photo upload failed", description: "Photos uploaded so far were kept — try the rest again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const uploadProgressPhoto = async (task, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingProgress(task.id);
    try {
      const newPhotos = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        newPhotos.push({
          url: file_url,
          uploaded_at: new Date().toISOString(),
          uploaded_by: user.full_name || user.email,
        });
      }
      const existing = task.progress_photos || [];
      await base44.entities.FieldTask.update(task.id, { progress_photos: [...existing, ...newPhotos] });
      // update local state
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, progress_photos: [...existing, ...newPhotos] } : t));
      toast({ title: `📸 ${newPhotos.length} photo${newPhotos.length > 1 ? "s" : ""} uploaded!` });
    } catch {
      toast({ title: "Photo upload failed", description: "Check your connection and try again.", variant: "destructive" });
    } finally {
      setUploadingProgress(null);
    }
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
      {tasks.map(task => {
        const progressCount = (task.progress_photos || []).length;
        return (
          <div key={task.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="p-4">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-gray-800 text-sm">{task.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.normal}`}>{task.priority}</span>
                {progressCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-700 flex items-center gap-1">
                    <Camera className="w-3 h-3" />{progressCount}
                  </span>
                )}
              </div>
              {task.project_name && <div className="text-xs text-primary font-medium mb-1">📍 {task.project_name}</div>}
              {task.description && <p className="text-xs text-gray-500">{task.description}</p>}
              {task.due_date && <div className="text-xs text-gray-400 mt-1">Due {format(parseLocalDate(task.due_date), "MMM d")}</div>}

              {/* Progress photo thumbnails */}
              {progressCount > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {(task.progress_photos || []).slice(-4).map((p, i) => (
                    <a key={i} href={p.url} target="_blank" rel="noreferrer">
                      <img src={p.url} className="w-12 h-12 object-cover rounded-lg border border-gray-100" alt="Progress" />
                    </a>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-3 flex-wrap">
                {task.status === "assigned" && (
                  <Button size="sm" onClick={() => updateStatus(task, "in_progress")} disabled={updating === task.id} className="flex-1 bg-blue-500 text-white text-xs h-8">Start</Button>
                )}
                {task.status === "in_progress" && (
                  <>
                    {/* Progress photo upload button */}
                    <label className={`flex items-center gap-1 px-3 h-8 rounded-md border text-xs font-semibold cursor-pointer transition-colors ${uploadingProgress === task.id ? "border-gray-200 text-gray-400" : "border-purple-200 text-purple-600 hover:bg-purple-50"}`}>
                      {uploadingProgress === task.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                      Photo
                      <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={e => uploadProgressPhoto(task, e)} disabled={uploadingProgress === task.id} />
                    </label>
                    <Button size="sm" onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)} className="flex-1 bg-green-500 text-white text-xs h-8">Complete</Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(task, "blocked")} className="text-xs h-8 border-orange-200 text-orange-600">Blocked</Button>
                  </>
                )}
              </div>
            </div>
            {expandedTask === task.id && (
              <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                <Textarea value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} placeholder="Completion notes (optional)..." className="resize-none text-sm" rows={2} />
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2">Final completion photos (optional)</p>
                  <div className="flex flex-wrap gap-2">
                    {completionPhotos.map((url, i) => <img key={i} src={url} className="w-16 h-16 object-cover rounded-lg" alt="" />)}
                    <label className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Camera className="w-5 h-5 text-gray-400" />}
                      <input type="file" accept="image/*" multiple className="hidden" onChange={uploadCompletionPhoto} />
                    </label>
                  </div>
                </div>
                <Button onClick={() => completeTask(task)} disabled={updating === task.id} className="w-full bg-green-500 text-white font-bold rounded-xl">
                  {updating === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "✅ Submit Completion"}
                </Button>
              </div>
            )}
          </div>
        );
      })}
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

  const [returningId, setReturningId] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.EquipmentItem.filter({ status: "available", active: true }),
      base44.entities.EquipmentCheckout.filter({ user_id: user.id, status: "out" }),
      base44.functions.invoke("fieldCrewProjects", { action: "list" }).then(r => r.data?.projects || []),
    ])
      .then(([eq, co, pr]) => { setEquipment(eq); setMyCheckouts(co); setProjects(pr); })
      .catch(() => toast({ title: "Couldn't load equipment", description: "Check your connection.", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const refreshLists = async () => {
    const [eq, co] = await Promise.all([
      base44.entities.EquipmentItem.filter({ status: "available", active: true }),
      base44.entities.EquipmentCheckout.filter({ user_id: user.id, status: "out" }),
    ]);
    setEquipment(eq); setMyCheckouts(co);
  };

  const checkOut = async () => {
    if (!selectedEquip || !selectedProject || submitting) { if (!selectedEquip || !selectedProject) toast({ title: "Select equipment and project", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      // Re-check availability right before writing — two crew members can
      // have the same stale list open (Base44 has no transactions)
      const freshRows = await base44.entities.EquipmentItem.filter({ id: selectedEquip.id });
      const fresh = freshRows[0];
      if (!fresh || fresh.status !== "available") {
        toast({ title: "Just missed it", description: `${selectedEquip.name} was checked out by someone else.`, variant: "destructive" });
        await refreshLists();
        return;
      }
      await base44.entities.EquipmentCheckout.create({
        equipment_id: selectedEquip.id, equipment_name: selectedEquip.name,
        user_id: user.id, user_name: user.full_name || user.email, user_email: user.email,
        project_id: selectedProject.id, project_name: selectedProject.client_name || selectedProject.name || "Project",
        checked_out_at: new Date().toISOString(), condition_out: "good", notes_out: notes, status: "out",
      });
      await base44.entities.EquipmentItem.update(selectedEquip.id, { status: "checked_out" });
      toast({ title: `✅ ${selectedEquip.name} checked out` });
      setSelectedEquip(null); setSelectedProject(null); setNotes("");
      await refreshLists();
    } catch {
      toast({ title: "Check-out failed", description: "Try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const checkIn = async (checkout) => {
    if (returningId) return; // double-tapping Return created duplicate records
    setReturningId(checkout.id);
    try {
      await base44.entities.EquipmentCheckout.update(checkout.id, { checked_in_at: new Date().toISOString(), status: "returned" });
      await base44.entities.EquipmentItem.update(checkout.equipment_id, { status: "available" });
      toast({ title: `✅ ${checkout.equipment_name} returned` });
      await refreshLists();
    } catch {
      toast({ title: "Return failed", description: "Try again.", variant: "destructive" });
    } finally {
      setReturningId(null);
    }
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
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors ${selectedEquip?.id === eq.id ? "border-primary bg-primary/5" : "border-gray-200"}`}>
                  <Package className={`w-5 h-5 shrink-0 ${selectedEquip?.id === eq.id ? "text-primary" : "text-gray-400"}`} />
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-800 text-sm">{eq.name}</div>
                    <div className="text-xs text-gray-400">{eq.category}</div>
                  </div>
                  {selectedEquip?.id === eq.id && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
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
              className="w-full bg-primary text-white font-bold rounded-xl">
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
              <Button size="sm" onClick={() => checkIn(co)} disabled={returningId === co.id} className="bg-green-500 text-white text-xs">
                {returningId === co.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Return"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MATERIALS TAB ─────────────────────────────────────────────────────────────
function MaterialsTab({ user }) {
  const { toast } = useToast();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    base44.functions.invoke("fieldCrewProjects", { action: "list" })
      .then(r => setProjects(r.data?.projects || []))
      .catch(() => toast({ title: "Couldn't load projects", description: "Check your connection.", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const loadProject = async (proj) => {
    setSelectedProject(proj);
    try {
      const full = await base44.functions.invoke("fieldCrewProjects", { action: "get", id: proj.id });
      setProject(full.data?.project || proj);
    } catch {
      setProject(proj);
      toast({ title: "Couldn't load the checklist", description: "Try again.", variant: "destructive" });
    }
  };

  const toggleOrdered = async (item) => {
    if (!project || saving) return;
    setSaving(item.id);
    try {
      const now = new Date().toISOString();
      const userName = user?.full_name || user?.email || "Field";
      const updated = (project.material_checklist || []).map(i =>
        i.id === item.id ? { ...i, ordered: !i.ordered, ordered_at: !i.ordered ? now : null, ordered_by: !i.ordered ? userName : null } : i
      );
      await base44.functions.invoke("fieldCrewProjects", { action: "updateChecklist", id: project.id, material_checklist: updated });
      setProject(prev => ({ ...prev, material_checklist: updated }));
      toast({ title: item.ordered ? "Marked unordered" : "✅ Marked as ordered" });
    } catch {
      toast({ title: "Couldn't save", description: "Try again.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const toggleReceived = async (item) => {
    if (!project || saving) return;
    setSaving(item.id);
    try {
      const now = new Date().toISOString();
      const userName = user?.full_name || user?.email || "Field";
      const updated = (project.material_checklist || []).map(i =>
        i.id === item.id ? { ...i, received: !i.received, received_at: !i.received ? now : null, received_by: !i.received ? userName : null, ordered: !i.received ? true : i.ordered } : i
      );
      await base44.functions.invoke("fieldCrewProjects", { action: "updateChecklist", id: project.id, material_checklist: updated });
      setProject(prev => ({ ...prev, material_checklist: updated }));
      toast({ title: item.received ? "Marked not received" : "✅ Marked on site!" });
    } catch {
      toast({ title: "Couldn't save", description: "Try again.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const items = project?.material_checklist || [];
  const receivedCount = items.filter(i => i.received).length;
  const orderedCount = items.filter(i => i.ordered).length;

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-gray-800">Materials</h2>

      {!selectedProject ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Select a project to view its material checklist:</p>
          {projects.map(p => (
            <button key={p.id} onClick={() => loadProject(p)}
              className="w-full text-left bg-white rounded-2xl border border-gray-100 p-4 hover:border-primary/30 transition-colors">
              <div className="font-semibold text-gray-800 text-sm">{p.client_name}</div>
              <div className="text-xs text-gray-400">{p.client_address}</div>
            </button>
          ))}
          {!projects.length && (
            <div className="bg-white rounded-2xl p-10 text-center text-gray-400">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="font-medium">No active projects</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => { setSelectedProject(null); setProject(null); }} className="text-primary text-sm font-semibold">← Back</button>
            <span className="text-gray-400 text-sm">/ {selectedProject.client_name}</span>
          </div>

          {items.length > 0 && (
            <div className="bg-secondary rounded-2xl p-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xl font-bold text-white">{items.length}</div>
                <div className="text-xs text-white/50">Total</div>
              </div>
              <div>
                <div className="text-xl font-bold text-blue-300">{orderedCount}</div>
                <div className="text-xs text-white/50">Ordered</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-300">{receivedCount}</div>
                <div className="text-xs text-white/50">On Site</div>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center text-gray-400">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="font-medium">No materials on the list yet</p>
              <p className="text-xs mt-1">The office team can add items from the project page.</p>
            </div>
          ) : items.map(item => (
            <div key={item.id} className={`bg-white rounded-2xl border p-4 ${item.received ? "border-green-200" : item.ordered ? "border-blue-200" : "border-gray-100"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm ${item.received ? "line-through text-gray-400" : "text-gray-800"}`}>{item.name}</div>
                  <div className="flex flex-wrap gap-x-2 mt-0.5">
                    {item.quantity && <span className="text-xs text-gray-400">Qty: {item.quantity}</span>}
                    {item.supplier && <span className="text-xs text-gray-400">· {item.supplier}</span>}
                  </div>
                  {item.notes && <p className="text-xs text-gray-400 italic mt-0.5">{item.notes}</p>}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleOrdered(item)}
                    disabled={saving === item.id}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${item.ordered ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {saving === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Truck className="w-3 h-3" />}
                    {item.ordered ? "Ordered" : "Order?"}
                  </button>
                  <button
                    onClick={() => toggleReceived(item)}
                    disabled={saving === item.id}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${item.received ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {saving === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageCheck className="w-3 h-3" />}
                    {item.received ? "On Site" : "Got It?"}
                  </button>
                </div>
              </div>
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
      base44.functions.invoke("fieldCrewProjects", { action: "list" }).then(r => r.data?.projects || []),
    ])
      .then(([r, p]) => { setReceipts(r); setProjects(p); })
      .catch(() => toast({ title: "Couldn't load receipts", description: "Check your connection.", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const uploadImage = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImageUrl(file_url);
    } catch {
      toast({ title: "Photo upload failed", description: "Try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!imageUrl) { toast({ title: "Please upload a receipt photo", variant: "destructive" }); return; }
    if (!form.amount) { toast({ title: "Amount required", variant: "destructive" }); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      const proj = projects.find(p => p.id === form.project_id);
      await base44.entities.FieldReceipt.create({
        ...form, amount: parseFloat(form.amount),
        // Stamp the date at submit time — a form opened before midnight used
        // to submit yesterday's date
        receipt_date: format(new Date(), "yyyy-MM-dd"),
        project_name: proj?.client_name,
        user_id: user.id, user_name: user.full_name || user.email, user_email: user.email,
        image_url: imageUrl, status: "pending",
      });
      toast({ title: "✅ Receipt submitted!" });
      setShowForm(false); setImageUrl("");
      setForm({ receipt_type: "job_expense", project_id: "", reason: "", vendor_name: "", amount: "", description: "", receipt_date: format(new Date(), "yyyy-MM-dd") });
      const r = await base44.entities.FieldReceipt.filter({ user_id: user.id }).catch(() => null);
      if (r) setReceipts(r);
    } catch {
      toast({ title: "Couldn't submit receipt", description: "Your photo and details are still here — try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const STATUS_STYLES = { pending: "bg-yellow-100 text-yellow-700", in_progress: "bg-blue-100 text-blue-700", approved: "bg-green-100 text-green-700", denied: "bg-red-100 text-red-700" };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">Receipts</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-primary text-white gap-1">
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
            <label className="w-full h-28 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary">
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
            <Button onClick={submit} disabled={submitting} className="flex-1 bg-primary text-white text-sm">
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