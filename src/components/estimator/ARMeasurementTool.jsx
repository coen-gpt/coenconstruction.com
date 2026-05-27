import { useState, useRef, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Camera, Ruler, Plus, Trash2, Save, RefreshCw, Maximize2,
  Home, Square, Triangle, ChevronDown, ChevronUp, Sparkles
} from "lucide-react";

const MEASURE_TYPES = [
  { id: "room", label: "Room (L×W×H)", icon: Home, color: "bg-blue-100 text-blue-700" },
  { id: "floor", label: "Floor Area (sq ft)", icon: Square, color: "bg-green-100 text-green-700" },
  { id: "wall", label: "Wall Area (sq ft)", icon: Maximize2, color: "bg-orange-100 text-orange-700" },
  { id: "outdoor", label: "Outdoor Area (sq ft)", icon: Triangle, color: "bg-purple-100 text-purple-700" },
];

const PRESET_ROOMS = ["Living Room", "Kitchen", "Master Bedroom", "Bedroom 2", "Bathroom", "Master Bath", "Dining Room", "Garage", "Basement", "Deck", "Mudroom", "Office"];

export default function ARMeasurementTool({ project, onSave }) {
  const { toast } = useToast();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [measurements, setMeasurements] = useState(project?.rooms?.map(r => ({
    id: r.id,
    name: r.name || r.type,
    type: "room",
    length: "",
    width: "",
    height: "",
    area: r.dimensions || "",
    notes: r.notes || "",
    photo: null,
    fromProject: true,
  })) || []);
  const [activeType, setActiveType] = useState("room");
  const [newName, setNewName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      setCameraError("Camera access denied or unavailable on this device.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedPhoto(dataUrl);
    stopCamera();
  };

  const analyzePhotoWithAI = async (photoDataUrl, name, type) => {
    setAnalyzing(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are analyzing a photo of a "${name}" (type: ${type}) taken at a construction site for a residential contractor.
        
Estimate the following based on what you can visually observe in the image:
- For rooms: length (ft), width (ft), height (ft), total floor area (sq ft), total wall area (sq ft)
- For floor areas: total area in sq ft
- For wall areas: total wall area in sq ft
- For outdoor areas: total area in sq ft

If you cannot determine exact measurements from the photo, provide reasonable estimates based on typical residential construction standards.
Also note any relevant observations (materials, condition, special considerations for contractors).

Respond with JSON only.`,
        file_urls: [photoDataUrl],
        response_json_schema: {
          type: "object",
          properties: {
            length_ft: { type: "number" },
            width_ft: { type: "number" },
            height_ft: { type: "number" },
            floor_area_sqft: { type: "number" },
            wall_area_sqft: { type: "number" },
            total_area_sqft: { type: "number" },
            observations: { type: "string" },
            confidence: { type: "string" }
          }
        }
      });
      return res;
    } finally {
      setAnalyzing(false);
    }
  };

  const addMeasurement = async () => {
    const name = newName.trim() || `${activeType} ${measurements.length + 1}`;
    const id = `m_${Date.now()}`;
    let aiData = null;

    if (capturedPhoto) {
      aiData = await analyzePhotoWithAI(capturedPhoto, name, activeType);
    }

    const m = {
      id,
      name,
      type: activeType,
      length: aiData?.length_ft?.toFixed(1) || "",
      width: aiData?.width_ft?.toFixed(1) || "",
      height: aiData?.height_ft?.toFixed(1) || "",
      area: aiData?.total_area_sqft?.toFixed(1) || aiData?.floor_area_sqft?.toFixed(1) || "",
      wall_area: aiData?.wall_area_sqft?.toFixed(1) || "",
      notes: aiData?.observations || "",
      photo: capturedPhoto,
      confidence: aiData?.confidence || null,
    };

    setMeasurements(prev => [...prev, m]);
    setNewName("");
    setCapturedPhoto(null);
    setExpandedId(id);
    toast({ title: capturedPhoto ? "AI measured from photo!" : "Measurement added", description: `${name} added successfully.` });
  };

  const updateMeasurement = (id, field, val) => {
    setMeasurements(prev => prev.map(m => {
      if (m.id !== id) return m;
      const updated = { ...m, [field]: val };
      if ((field === "length" || field === "width") && updated.length && updated.width) {
        updated.area = (parseFloat(updated.length) * parseFloat(updated.width)).toFixed(1);
      }
      return updated;
    }));
  };

  const removeMeasurement = (id) => {
    setMeasurements(prev => prev.filter(m => m.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const rooms = measurements.map(m => ({
        id: m.id,
        name: m.name,
        type: m.type,
        dimensions: m.length && m.width
          ? `${m.length}' × ${m.width}'${m.height ? ` × ${m.height}'` : ""} (${m.area} sq ft)`
          : m.area ? `${m.area} sq ft` : "",
        notes: m.notes || "",
      }));
      await base44.entities.ContractorProject.update(project.id, { rooms });
      toast({ title: "Measurements saved!", description: `${rooms.length} rooms/areas saved to project.` });
      if (onSave) onSave(rooms);
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const totalArea = measurements.reduce((s, m) => s + (parseFloat(m.area) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h2 className="font-semibold text-secondary flex items-center gap-2">
            <Ruler className="w-4 h-4 text-primary" /> AR Measurement Tool
          </h2>
          <div className="flex items-center gap-2">
            {totalArea > 0 && (
              <span className="text-sm text-gray-500 font-semibold">{totalArea.toFixed(0)} total sq ft</span>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving || measurements.length === 0} className="gap-2 bg-primary text-white">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save to Project
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-400">Capture photos to let AI estimate dimensions, or enter measurements manually.</p>
      </div>

      {/* Add New Measurement */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-medium text-secondary mb-3 text-sm">Add New Measurement</h3>

        {/* Type Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {MEASURE_TYPES.map(t => (
            <button key={t.id} onClick={() => setActiveType(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                activeType === t.id ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* Name Input with Presets */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Name (e.g. Living Room)"
            className="flex-1 min-w-48"
          />
          {PRESET_ROOMS.slice(0, 6).map(r => (
            <button key={r} onClick={() => setNewName(r)}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600 transition-colors">
              {r}
            </button>
          ))}
        </div>

        {/* Camera Section */}
        <div className="border border-dashed border-gray-300 rounded-xl overflow-hidden mb-3 bg-gray-50">
          {!cameraActive && !capturedPhoto && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Camera className="w-8 h-8 text-gray-300" />
              <p className="text-xs text-gray-400">Take a photo for AI-powered measurement estimation</p>
              {cameraError && <p className="text-xs text-red-500">{cameraError}</p>}
              <Button variant="outline" size="sm" onClick={startCamera} className="gap-2">
                <Camera className="w-3.5 h-3.5" /> Open Camera
              </Button>
            </div>
          )}
          {cameraActive && (
            <div className="relative">
              <video ref={videoRef} className="w-full max-h-56 object-cover" playsInline muted />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-3">
                <Button size="sm" onClick={capturePhoto} className="bg-white text-secondary shadow-lg gap-2">
                  <Camera className="w-3.5 h-3.5" /> Capture
                </Button>
                <Button variant="outline" size="sm" onClick={stopCamera} className="bg-white shadow-lg">Cancel</Button>
              </div>
            </div>
          )}
          {capturedPhoto && (
            <div className="relative">
              <img src={capturedPhoto} alt="Captured" className="w-full max-h-48 object-cover" />
              <div className="absolute top-2 right-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setCapturedPhoto(null); startCamera(); }} className="bg-white text-xs shadow">Retake</Button>
                <Button size="sm" variant="outline" onClick={() => setCapturedPhoto(null)} className="bg-white text-xs shadow">Remove</Button>
              </div>
              {analyzing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" /> Analyzing with AI…
                  </div>
                </div>
              )}
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <Button onClick={addMeasurement} disabled={analyzing} className="w-full gap-2 bg-primary text-white">
          {analyzing ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analyzing…</> : <><Plus className="w-3.5 h-3.5" /> Add Measurement</>}
        </Button>
      </div>

      {/* Measurements List */}
      {measurements.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-secondary text-sm">{measurements.length} Measurements</h3>
            <span className="text-xs text-gray-400">{totalArea.toFixed(0)} sq ft total</span>
          </div>
          <div className="divide-y divide-gray-100">
            {measurements.map(m => {
              const typeInfo = MEASURE_TYPES.find(t => t.id === m.type) || MEASURE_TYPES[0];
              const isExpanded = expandedId === m.id;
              return (
                <div key={m.id}>
                  <div
                    className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  >
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${typeInfo.color}`}>{typeInfo.label}</span>
                    <span className="font-medium text-sm text-secondary flex-1">{m.name}</span>
                    {m.area && <span className="text-sm font-semibold text-primary">{m.area} sq ft</span>}
                    {m.fromProject && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">from walkthrough</span>}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                  {isExpanded && (
                    <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100">
                      {m.photo && (
                        <img src={m.photo} alt={m.name} className="w-full max-h-36 object-cover rounded-lg mb-3 mt-3" />
                      )}
                      {m.confidence && (
                        <div className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1 mb-3 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> AI confidence: {m.confidence}
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {["length", "width", "height"].map(dim => (
                          <div key={dim}>
                            <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">{dim} (ft)</label>
                            <Input
                              type="number"
                              value={m[dim] || ""}
                              onChange={e => updateMeasurement(m.id, dim, e.target.value)}
                              placeholder="0"
                              className="h-8 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Floor Area (sq ft)</label>
                          <Input type="number" value={m.area || ""} onChange={e => updateMeasurement(m.id, "area", e.target.value)} className="h-8 text-sm" placeholder="Auto-calculated" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Wall Area (sq ft)</label>
                          <Input type="number" value={m.wall_area || ""} onChange={e => updateMeasurement(m.id, "wall_area", e.target.value)} className="h-8 text-sm" />
                        </div>
                      </div>
                      <div className="mb-2">
                        <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Notes</label>
                        <Input value={m.notes || ""} onChange={e => updateMeasurement(m.id, "notes", e.target.value)} className="h-8 text-sm" placeholder="Material observations, special conditions..." />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeMeasurement(m.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 gap-1">
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}