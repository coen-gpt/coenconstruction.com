import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Plus, Trash2, Camera, Mic, MicOff, ChevronRight, ChevronLeft, CheckCircle, Upload, ArrowRightCircle, UserCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useQuery } from "@tanstack/react-query";
import AddressInput from "@/components/AddressInput";

const STORAGE_KEY = "walkthrough_draft";
const STEPS = ["Client Info", "Rooms", "Photos", "Scope & Submit"];
const ROOM_TYPES = ["Kitchen", "Living Room", "Bedroom", "Bathroom", "Master Bedroom", "Garage", "Basement", "Attic", "Dining Room", "Office", "Hallway", "Exterior", "Deck/Porch", "Other"];
const PROJECT_TYPES = ["Home Addition", "Kitchen Remodel", "Bathroom Remodel", "Deck / Porch / Pergola", "Siding", "Custom Carpentry", "Snow Removal", "Full Home Renovation", "Roofing", "Flooring", "Other"];

const defaultState = () => ({
  step: 0,
  client: { name: "", phone: "", email: "", address: "", city: "", zipcode: "" },
  projectType: "",
  gps: null,
  rooms: [],
  photos: [],
  scope: "",
});

function stateFromLeadParams() {
  const params = new URLSearchParams(window.location.search);
  if (!params.get('lead_name')) return null;
  return {
    step: 0,
    client: {
      name: params.get('lead_name') || "",
      phone: params.get('lead_phone') || "",
      email: params.get('lead_email') || "",
      address: params.get('lead_address') || "",
      city: params.get('lead_city') || "",
      zipcode: params.get('lead_zipcode') || "",
    },
    projectType: params.get('lead_project_type') || "",
    gps: null,
    rooms: [],
    photos: [],
    scope: params.get('lead_scope') || "",
  };
}

export default function Walkthrough() {
  const [data, setData] = useState(() => {
    const fromParams = stateFromLeadParams();
    if (fromParams) return fromParams;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : defaultState();
    } catch { return defaultState(); }
  });
  const [fromLead] = useState(() => !!stateFromLeadParams());
  const [submitting, setSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [matchedCustomer, setMatchedCustomer] = useState(null);
  const recognitionRef = useRef(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: existingProjects = [] } = useQuery({
    queryKey: ["all-contractor-projects-autocomplete"],
    queryFn: () => base44.entities.ContractorProject.list("-created_date", 300),
  });

  // Build unique customer list from existing projects
  const knownCustomers = existingProjects.reduce((acc, p) => {
    const key = (p.client_name || "").trim().toLowerCase();
    if (key && !acc.find((c) => c.key === key)) {
      acc.push({ key, name: p.client_name, phone: p.client_phone, email: p.client_email, address: p.client_address, city: p.client_city, zipcode: p.client_zipcode });
    }
    return acc;
  }, []);

  const handleNameChange = (val) => {
    updateClient("name", val);
    setMatchedCustomer(null);
    if (val.length >= 2) {
      const matches = knownCustomers.filter((c) => c.name.toLowerCase().includes(val.toLowerCase()));
      setNameSuggestions(matches.slice(0, 5));
      setShowSuggestions(matches.length > 0);
    } else {
      setNameSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const applyCustomer = (customer) => {
    setData((d) => ({
      ...d,
      client: {
        name: customer.name,
        phone: customer.phone || "",
        email: customer.email || "",
        address: customer.address || "",
        city: customer.city || "",
        zipcode: customer.zipcode || "",
      },
    }));
    setMatchedCustomer(customer);
    setShowSuggestions(false);
    setNameSuggestions([]);
  };

  // Auto-save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const updateClient = (field, val) =>
    setData((d) => ({ ...d, client: { ...d.client, [field]: val } }));

  const captureGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setData((d) => ({ ...d, gps: { lat: latitude, lng: longitude } }));
      toast({ title: "GPS captured", description: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` });
    });
  };

  const addRoom = () => {
    const room = { id: crypto.randomUUID(), name: "", type: "Other", notes: "", dimensions: "" };
    setData((d) => ({ ...d, rooms: [...d.rooms, room] }));
  };

  const updateRoom = (id, field, val) =>
    setData((d) => ({ ...d, rooms: d.rooms.map((r) => (r.id === id ? { ...r, [field]: val } : r)) }));

  const removeRoom = (id) =>
    setData((d) => ({ ...d, rooms: d.rooms.filter((r) => r.id !== id) }));

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingPhoto(true);
    for (const file of files) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setData((d) => ({ ...d, photos: [...d.photos, file_url] }));
      } catch (err) {
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      }
    }
    setUploadingPhoto(false);
    e.target.value = "";
  };

  const removePhoto = (url) =>
    setData((d) => ({ ...d, photos: d.photos.filter((p) => p !== url) }));

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return toast({ title: "Voice not supported", variant: "destructive" });
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setData((d) => ({ ...d, scope: (d.scope + " " + transcript).trim() }));
    };
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const project = await base44.entities.ContractorProject.create({
        client_name: data.client.name,
        client_phone: data.client.phone,
        client_email: data.client.email,
        client_address: data.client.address,
        client_city: data.client.city,
        client_zipcode: data.client.zipcode,
        project_type: data.projectType,
        status: "draft",
        scope_of_work: data.scope,
        rooms: data.rooms,
        photos: data.photos,
        gps_lat: data.gps?.lat,
        gps_lng: data.gps?.lng,
      });
      localStorage.removeItem(STORAGE_KEY);
      toast({ title: "Project created!", description: "Redirecting to project..." });
      navigate(`/estimator/projects/${project.id}`);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = () => {
    if (data.step === 0) return data.client.name.trim().length > 0;
    return true;
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 bg-gray-50 min-h-screen rounded-xl">
      {/* Lead import banner */}
      {fromLead && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-900/50 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
          <ArrowRightCircle className="w-4 h-4 shrink-0" />
          Pre-filled from lead. Review the info, add rooms &amp; photos, then submit.
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-secondary dark:text-gray-100">New Walkthrough</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Step {data.step + 1} of {STEPS.length} — {STEPS[data.step]}</p>
        <div className="flex gap-1 mt-3">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= data.step ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"}`} />
          ))}
        </div>
      </div>

      {/* Step 0: Client Info */}
      {data.step === 0 && (
        <div className="space-y-4">
          {matchedCustomer && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-blue-800">
              <UserCheck className="w-4 h-4 shrink-0" />
              Returning customer — fields auto-filled from previous project.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 relative">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide block mb-1">Client Name *</label>
              <Input
                value={data.client.name}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Full name"
                autoComplete="off"
              />
              {showSuggestions && nameSuggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {nameSuggestions.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onMouseDown={() => applyCustomer(c)}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      <div className="font-medium text-secondary text-sm">{c.name}</div>
                      <div className="text-xs text-gray-400">{c.address}{c.city ? `, ${c.city}` : ""} · Returning customer</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide block mb-1">Phone</label>
              <Input value={data.client.phone} onChange={(e) => updateClient("phone", e.target.value)} placeholder="(617) 000-0000" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide block mb-1">Email</label>
              <Input value={data.client.email} onChange={(e) => updateClient("email", e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide block mb-1">Address</label>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <AddressInput
                    value={data.client.address}
                    onChange={(val) => updateClient("address", val)}
                    onGeocode={(geo) => {
                      if (geo.city) updateClient("city", geo.city);
                      setData((d) => ({ ...d, gps: { lat: geo.lat, lng: geo.lng } }));
                    }}
                  />
                </div>
                <Button type="button" variant="outline" size="icon" onClick={captureGPS} title="Capture GPS">
                  <MapPin className="w-4 h-4" />
                </Button>
              </div>
              {data.gps && <p className="text-xs text-green-600 mt-1">📍 GPS: {data.gps.lat.toFixed(5)}, {data.gps.lng.toFixed(5)}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide block mb-1">City</label>
              <Input value={data.client.city} onChange={(e) => updateClient("city", e.target.value)} placeholder="City" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide block mb-1">Zipcode</label>
              <Input value={data.client.zipcode} onChange={(e) => updateClient("zipcode", e.target.value)} placeholder="02072" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide block mb-1">Project Type</label>
            <Select value={data.projectType} onValueChange={(v) => setData((d) => ({ ...d, projectType: v }))}>
              <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Step 1: Rooms */}
      {data.step === 1 && (
        <div className="space-y-4">
          {data.rooms.map((room, i) => (
            <div key={room.id} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white shadow-sm">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-secondary dark:text-gray-200 text-sm">Room {i + 1}</span>
                <Button variant="ghost" size="icon" onClick={() => removeRoom(room.id)}>
                  <Trash2 className="w-4 h-4 text-red-400" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Room Name</label>
                  <Input value={room.name} onChange={(e) => updateRoom(room.id, "name", e.target.value)} placeholder="e.g. Master Bath" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Type</label>
                  <Select value={room.type} onValueChange={(v) => updateRoom(room.id, "type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROOM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Dimensions (LxW)</label>
                  <Input value={room.dimensions} onChange={(e) => updateRoom(room.id, "dimensions", e.target.value)} placeholder="12x14 ft" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Notes</label>
                  <Input value={room.notes} onChange={(e) => updateRoom(room.id, "notes", e.target.value)} placeholder="Observations..." />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={addRoom} className="w-full gap-2">
            <Plus className="w-4 h-4" /> Add Room
          </Button>
          {data.rooms.length === 0 && (
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">No rooms added yet. Click above to add a room.</p>
          )}
        </div>
      )}

      {/* Step 2: Photos */}
      {data.step === 2 && (
        <div className="space-y-4">
          <label className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer hover:border-primary dark:hover:border-primary transition-colors block bg-white dark:bg-gray-900">
            <Camera className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            <span className="font-medium text-gray-600 dark:text-gray-400">Upload Site Photos</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">Click to select multiple photos</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
          </label>
          {uploadingPhoto && <p className="text-center text-sm text-primary animate-pulse">Uploading...</p>}
          {data.photos.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {data.photos.map((url, i) => (
                <div key={i} className="relative group rounded-lg overflow-hidden aspect-square bg-gray-100 dark:bg-gray-800">
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(url)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  >
                    <Trash2 className="w-5 h-5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {data.photos.length === 0 && (
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">No photos uploaded yet.</p>
          )}
        </div>
      )}

      {/* Step 3: Scope & Submit */}
      {data.step === 3 && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Scope of Work</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={isRecording ? stopVoice : startVoice}
                className={`gap-1 text-xs ${isRecording ? "text-red-500" : "text-gray-500"}`}
              >
                {isRecording ? <><MicOff className="w-3 h-3" /> Stop</> : <><Mic className="w-3 h-3" /> Voice</>}
              </Button>
            </div>
            <Textarea
              rows={8}
              value={data.scope}
              onChange={(e) => setData((d) => ({ ...d, scope: e.target.value }))}
              placeholder="Describe the full scope of work in detail..."
              className="resize-none"
            />
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 text-sm shadow-sm">
            <div className="font-semibold text-secondary dark:text-gray-200 mb-2">Summary</div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Client:</span><span className="font-medium dark:text-gray-300">{data.client.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Address:</span><span className="font-medium dark:text-gray-300">{data.client.address}, {data.client.city}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Project Type:</span><span className="font-medium dark:text-gray-300">{data.projectType || "Not set"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Rooms:</span><span className="font-medium dark:text-gray-300">{data.rooms.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Photos:</span><span className="font-medium dark:text-gray-300">{data.photos.length}</span></div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        {data.step > 0 ? (
          <Button variant="outline" onClick={() => setData((d) => ({ ...d, step: d.step - 1 }))} className="gap-1">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
        ) : <div />}
        {data.step < STEPS.length - 1 ? (
          <Button onClick={() => setData((d) => ({ ...d, step: d.step + 1 }))} disabled={!canNext()} className="gap-1 bg-primary text-white">
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting || !data.client.name} className="gap-2 bg-primary text-white">
            <CheckCircle className="w-4 h-4" /> {submitting ? "Creating..." : "Create Project"}
          </Button>
        )}
      </div>
    </div>
  );
}