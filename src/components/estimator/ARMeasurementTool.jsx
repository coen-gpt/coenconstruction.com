import { useState, useRef, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Camera, Ruler, Plus, Trash2, Save, RefreshCw, Maximize2,
  Home, Square, Triangle, ChevronDown, ChevronUp, Zap
} from "lucide-react";

// Class names baked into yolov8n-construction-v1.onnx (Ultralytics fine-tune,
// output [1, 4 + 52, 8400]). Order must match the model's metadata exactly.
const MODEL_CLASSES = [
  "door","window","garage_door","sliding_door","skylight","rough_opening",
  "drywall_panel","brick_wall","siding_lap","siding_panel","stud","header",
  "roof_plane","ridge","valley","gutter","downspout","fascia","soffit",
  "vent_stack","toilet","sink","vanity","bathtub","shower_pan","faucet",
  "upper_cabinet","base_cabinet","range","refrigerator","dishwasher",
  "backsplash_panel","countertop_run","tile_field","grout_line",
  "hardwood_plank","vinyl_plank","transition_strip","pool_water","pool_coping",
  "deck_board","deck_rail","post","beam","fence_panel","paver","lawn_edge",
  "ductwork","register","condenser_pad","ev_charger_mount","conduit_run"
];

// Detected objects with predictable real-world widths → scale anchors for
// estimating room dimensions from the camera frame.
const OBJECT_AREA_HINTS = {
  "door":         { ref_ft: 3.0, label: "entry door (~3ft wide)" },
  "sliding_door": { ref_ft: 6.0, label: "sliding door (~6ft wide)" },
  "garage_door":  { ref_ft: 9.0, label: "garage door (~9ft wide)" },
  "window":       { ref_ft: 3.0, label: "window (~3ft wide)" },
  "toilet":       { ref_ft: 1.4, label: "toilet (~1.4ft wide)" },
  "sink":         { ref_ft: 2.0, label: "sink (~2ft wide)" },
  "vanity":       { ref_ft: 3.0, label: "vanity (~3ft wide)" },
  "bathtub":      { ref_ft: 5.0, label: "bathtub (~5ft long)" },
  "range":        { ref_ft: 2.5, label: "range (~2.5ft wide)" },
  "refrigerator": { ref_ft: 3.0, label: "fridge (~3ft wide)" },
  "dishwasher":   { ref_ft: 2.0, label: "dishwasher (~2ft wide)" },
};

const CONSTRUCTION_CLASSES = new Set(Object.keys(OBJECT_AREA_HINTS));

// Served from public/ — the construction-tuned model ships with the app.
const MODEL_URL = "/models/yolov8n-construction-v1.onnx";
const INPUT_SIZE = 640;
const CONF_THRESHOLD = 0.4;
const IOU_THRESHOLD = 0.45;

const MEASURE_TYPES = [
  { id: "room",    label: "Room (L×W×H)", icon: Home,     color: "bg-blue-100 text-blue-700" },
  { id: "floor",   label: "Floor Area",   icon: Square,   color: "bg-green-100 text-green-700" },
  { id: "wall",    label: "Wall Area",    icon: Maximize2, color: "bg-orange-100 text-orange-700" },
  { id: "outdoor", label: "Outdoor Area", icon: Triangle, color: "bg-purple-100 text-purple-700" },
];

const PRESET_ROOMS = ["Living Room","Kitchen","Master Bedroom","Bedroom 2","Bathroom","Master Bath","Dining Room","Garage","Basement","Deck","Mudroom","Office"];

// ── ONNX helpers ──────────────────────────────────────────────────────────────

async function loadModel() {
  const ort = await import("onnxruntime-web");
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = "https://unpkg.com/onnxruntime-web@1.14.0/dist/";
  const session = await ort.InferenceSession.create(MODEL_URL, {
    executionProviders: ["wasm"],
  });
  return { ort, session };
}

function preprocessCanvas(canvas) {
  const offscreen = document.createElement("canvas");
  offscreen.width = INPUT_SIZE;
  offscreen.height = INPUT_SIZE;
  const ctx = offscreen.getContext("2d");
  ctx.drawImage(canvas, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const imgData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;

  const float32 = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
    float32[i]                              = imgData[i * 4]     / 255; // R
    float32[INPUT_SIZE * INPUT_SIZE + i]    = imgData[i * 4 + 1] / 255; // G
    float32[2 * INPUT_SIZE * INPUT_SIZE + i] = imgData[i * 4 + 2] / 255; // B
  }
  return float32;
}

function nms(boxes, scores, iouThreshold) {
  const indices = scores.map((s, i) => i).sort((a, b) => scores[b] - scores[a]);
  const keep = [];
  const suppressed = new Set();

  for (const i of indices) {
    if (suppressed.has(i)) continue;
    keep.push(i);
    for (const j of indices) {
      if (i === j || suppressed.has(j)) continue;
      const [x1a, y1a, x2a, y2a] = boxes[i];
      const [x1b, y1b, x2b, y2b] = boxes[j];
      const interX = Math.max(0, Math.min(x2a, x2b) - Math.max(x1a, x1b));
      const interY = Math.max(0, Math.min(y2a, y2b) - Math.max(y1a, y1b));
      const inter = interX * interY;
      const union = (x2a-x1a)*(y2a-y1a) + (x2b-x1b)*(y2b-y1b) - inter;
      if (inter / union > iouThreshold) suppressed.add(j);
    }
  }
  return keep;
}

function parseYOLOv8Output(outputData, origW, origH) {
  // output0 shape: [1, 4 + numClasses, 8400]
  const numDetections = 8400;
  const numClasses = MODEL_CLASSES.length;
  const detections = [];

  for (let i = 0; i < numDetections; i++) {
    const cx = outputData[0 * numDetections + i];
    const cy = outputData[1 * numDetections + i];
    const w  = outputData[2 * numDetections + i];
    const h  = outputData[3 * numDetections + i];

    let maxScore = 0, classId = -1;
    for (let c = 0; c < numClasses; c++) {
      const score = outputData[(4 + c) * numDetections + i];
      if (score > maxScore) { maxScore = score; classId = c; }
    }

    if (maxScore < CONF_THRESHOLD) continue;

    // Scale back to original image coords
    const scaleX = origW / INPUT_SIZE;
    const scaleY = origH / INPUT_SIZE;
    const x1 = (cx - w / 2) * scaleX;
    const y1 = (cy - h / 2) * scaleY;
    const x2 = (cx + w / 2) * scaleX;
    const y2 = (cy + h / 2) * scaleY;

    detections.push({ x1, y1, x2, y2, score: maxScore, classId, className: MODEL_CLASSES[classId] });
  }

  const boxes  = detections.map(d => [d.x1, d.y1, d.x2, d.y2]);
  const scores = detections.map(d => d.score);
  const kept   = nms(boxes, scores, IOU_THRESHOLD);
  return kept.map(i => detections[i]);
}

// Estimate room dimensions using detected reference objects
function estimateRoomFromDetections(detections, imgW, imgH) {
  const refs = detections.filter(d => CONSTRUCTION_CLASSES.has(d.className));
  if (!refs.length) return null;

  // Use largest confident reference object as scale anchor
  refs.sort((a, b) => (b.x2 - b.x1) * (b.y2 - b.y1) - (a.x2 - a.x1) * (a.y2 - a.y1));
  const anchor = refs[0];
  const hint = OBJECT_AREA_HINTS[anchor.className];

  const pixelWidth  = anchor.x2 - anchor.x1;
  const pxPerFt     = pixelWidth / hint.ref_ft;

  const roomWidthFt  = Math.round((imgW / pxPerFt) * 10) / 10;
  const roomDepthFt  = Math.round((imgH / pxPerFt) * 0.7 * 10) / 10; // perspective correction
  const roomAreaSqFt = Math.round(roomWidthFt * roomDepthFt);

  return {
    length_ft: roomDepthFt,
    width_ft:  roomWidthFt,
    floor_area_sqft: roomAreaSqFt,
    anchor_label: hint.label,
    px_per_ft: pxPerFt,
    all_detections: detections,
  };
}

function drawDetections(canvas, detections, estimate) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections.forEach(d => {
    const isRef = CONSTRUCTION_CLASSES.has(d.className);
    ctx.strokeStyle = isRef ? "#E35235" : "#60a5fa";
    ctx.lineWidth   = isRef ? 3 : 1.5;
    ctx.strokeRect(d.x1, d.y1, d.x2 - d.x1, d.y2 - d.y1);

    ctx.fillStyle = isRef ? "rgba(227,82,53,0.85)" : "rgba(96,165,250,0.75)";
    const label   = `${d.className} ${Math.round(d.score * 100)}%`;
    ctx.font       = "bold 12px sans-serif";
    const tw       = ctx.measureText(label).width;
    ctx.fillRect(d.x1, d.y1 - 18, tw + 8, 18);
    ctx.fillStyle  = "#fff";
    ctx.fillText(label, d.x1 + 4, d.y1 - 4);
  });

  if (estimate) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(8, canvas.height - 50, 260, 42);
    ctx.fillStyle = "#fff";
    ctx.font      = "bold 13px sans-serif";
    ctx.fillText(`~${estimate.width_ft}' × ${estimate.length_ft}'  ≈ ${estimate.floor_area_sqft} sq ft`, 16, canvas.height - 30);
    ctx.font      = "11px sans-serif";
    ctx.fillStyle = "#E35235";
    ctx.fillText(`Reference: ${estimate.anchor_label}`, 16, canvas.height - 14);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ARMeasurementTool({ project, onSave }) {
  const { toast } = useToast();
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);   // capture / preview canvas
  const overlayRef   = useRef(null);   // live detection overlay on video
  const modelRef     = useRef(null);   // { ort, session }
  const rafRef       = useRef(null);   // requestAnimationFrame handle

  const [modelStatus, setModelStatus] = useState("idle"); // idle | loading | ready | error
  const [cameraActive,  setCameraActive]  = useState(false);
  const [cameraError,   setCameraError]   = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [detections,    setDetections]    = useState([]);
  const [liveEstimate,  setLiveEstimate]  = useState(null);
  const [analyzing,     setAnalyzing]     = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [activeType,    setActiveType]    = useState("room");
  const [newName,       setNewName]       = useState("");
  const [expandedId,    setExpandedId]    = useState(null);

  const [measurements, setMeasurements] = useState(
    project?.rooms?.map(r => ({
      id: r.id, name: r.name || r.type, type: "room",
      length: "", width: "", height: "", area: r.dimensions || "",
      notes: r.notes || "", photo: null, fromProject: true,
    })) || []
  );

  // Load ONNX model once
  const ensureModel = useCallback(async () => {
    if (modelRef.current) return modelRef.current;
    setModelStatus("loading");
    try {
      const m = await loadModel();
      modelRef.current = m;
      setModelStatus("ready");
      return m;
    } catch (err) {
      setModelStatus("error");
      toast({ title: "AI detection unavailable", description: "Camera still works for photos and manual measurements. " + err.message, variant: "destructive" });
      return null;
    }
  }, []);

  // Live inference loop on video feed
  const runLiveInference = useCallback(async () => {
    const model = modelRef.current;
    if (!model || !videoRef.current || !overlayRef.current) return;
    const video   = videoRef.current;
    const overlay = overlayRef.current;
    if (video.readyState < 2) { rafRef.current = requestAnimationFrame(runLiveInference); return; }

    overlay.width  = video.videoWidth;
    overlay.height = video.videoHeight;

    // Draw video frame to temp canvas for preprocessing
    const tmp = document.createElement("canvas");
    tmp.width = video.videoWidth; tmp.height = video.videoHeight;
    tmp.getContext("2d").drawImage(video, 0, 0);

    try {
      const { ort, session } = model;
      const float32 = preprocessCanvas(tmp);
      const tensor  = new ort.Tensor("float32", float32, [1, 3, INPUT_SIZE, INPUT_SIZE]);
      const results = await session.run({ images: tensor });
      const output  = results["output0"].data;
      const dets    = parseYOLOv8Output(output, video.videoWidth, video.videoHeight);
      const est     = estimateRoomFromDetections(dets, video.videoWidth, video.videoHeight);
      drawDetections(overlay, dets, est);
      setDetections(dets);
      setLiveEstimate(est);
    } catch (_) { /* skip frame on error */ }

    rafRef.current = requestAnimationFrame(runLiveInference);
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    // If the model fails to load, still open the camera — photo capture and
    // manual measurements work without AI detection.
    const model = await ensureModel();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        if (model) rafRef.current = requestAnimationFrame(runLiveInference);
      }
    } catch (err) {
      setCameraError("Camera access denied or unavailable.");
    }
  };

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setDetections([]);
    setLiveEstimate(null);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width  = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);

    // Bake overlay onto captured image
    if (overlayRef.current) {
      canvas.getContext("2d").drawImage(overlayRef.current, 0, 0);
    }
    setCapturedPhoto(canvas.toDataURL("image/jpeg", 0.88));
    stopCamera();
  };

  const addMeasurement = () => {
    const name = newName.trim() || `${activeType} ${measurements.length + 1}`;
    const id   = `m_${Date.now()}`;
    const m = {
      id, name, type: activeType,
      length: liveEstimate?.length_ft?.toFixed(1) || "",
      width:  liveEstimate?.width_ft?.toFixed(1)  || "",
      height: "",
      area:   liveEstimate?.floor_area_sqft?.toFixed(1) || "",
      wall_area: "",
      notes: liveEstimate ? `Ref: ${liveEstimate.anchor_label}. ${detections.map(d => d.className).join(", ")}` : "",
      photo: capturedPhoto,
    };
    setMeasurements(prev => [...prev, m]);
    setNewName(""); setCapturedPhoto(null); setLiveEstimate(null);
    setExpandedId(id);
    toast({ title: "Measurement added", description: `${name} — ${m.area ? m.area + " sq ft" : "manual entry"}` });
  };

  const updateMeasurement = (id, field, val) => {
    setMeasurements(prev => prev.map(m => {
      if (m.id !== id) return m;
      const updated = { ...m, [field]: val };
      if ((field === "length" || field === "width") && updated.length && updated.width)
        updated.area = (parseFloat(updated.length) * parseFloat(updated.width)).toFixed(1);
      return updated;
    }));
  };

  const removeMeasurement = (id) => setMeasurements(prev => prev.filter(m => m.id !== id));

  const handleSave = async () => {
    setSaving(true);
    try {
      const rooms = measurements.map(m => ({
        id: m.id, name: m.name, type: m.type,
        dimensions: m.length && m.width
          ? `${m.length}' × ${m.width}'${m.height ? ` × ${m.height}'` : ""} (${m.area} sq ft)`
          : m.area ? `${m.area} sq ft` : "",
        notes: m.notes || "",
      }));
      await base44.entities.ContractorProject.update(project.id, { rooms });
      toast({ title: "Measurements saved!", description: `${rooms.length} areas saved to project.` });
      if (onSave) onSave(rooms);
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => () => { stopCamera(); }, []);

  const totalArea = measurements.reduce((s, m) => s + (parseFloat(m.area) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h2 className="font-semibold text-secondary flex items-center gap-2">
            <Ruler className="w-4 h-4 text-primary" /> AR Measurement Tool
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ml-1 ${
              modelStatus === "ready"   ? "bg-green-100 text-green-700" :
              modelStatus === "loading" ? "bg-yellow-100 text-yellow-700 animate-pulse" :
              modelStatus === "error"   ? "bg-red-100 text-red-700" :
              "bg-gray-100 text-gray-500"
            }`}>
              {modelStatus === "ready" ? "YOLOv8 ready" : modelStatus === "loading" ? "loading model…" : modelStatus === "error" ? "model error" : "YOLOv8n"}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {totalArea > 0 && <span className="text-sm text-gray-500 font-semibold">{totalArea.toFixed(0)} total sq ft</span>}
            <Button size="sm" onClick={handleSave} disabled={saving || measurements.length === 0} className="gap-2 bg-primary text-white">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save to Project
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-400">Point camera at a room — YOLOv8 detects reference objects and estimates dimensions in real time.</p>
      </div>

      {/* Camera + Live Inference */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-medium text-secondary mb-3 text-sm">Live Scan</h3>

        {/* Type + Name */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {MEASURE_TYPES.map(t => (
            <button key={t.id} onClick={() => setActiveType(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                activeType === t.id ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Room name (e.g. Living Room)" className="flex-1 min-w-40" />
          {PRESET_ROOMS.slice(0, 5).map(r => (
            <button key={r} onClick={() => setNewName(r)} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600">{r}</button>
          ))}
        </div>

        {/* Video / capture area */}
        <div className="rounded-xl overflow-hidden bg-black relative mb-3" style={{ minHeight: 200 }}>
          {!cameraActive && !capturedPhoto && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 bg-gray-50 border border-dashed border-gray-300 rounded-xl">
              <Camera className="w-8 h-8 text-gray-300" />
              <p className="text-xs text-gray-400">Opens rear camera + runs YOLOv8 inference</p>
              {cameraError && <p className="text-xs text-red-500">{cameraError}</p>}
              <Button variant="outline" size="sm" onClick={startCamera} disabled={modelStatus === "loading"} className="gap-2">
                {modelStatus === "loading"
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading model…</>
                  : <><Zap className="w-3.5 h-3.5" /> Start AR Scan</>
                }
              </Button>
            </div>
          )}

          {cameraActive && (
            <div className="relative">
              <video ref={videoRef} className="w-full max-h-64 object-cover" playsInline muted />
              {/* Overlay canvas for bounding boxes */}
              <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ objectFit: "cover" }} />

              {/* Live estimate badge */}
              {liveEstimate && (
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg">
                  <span className="font-bold text-primary">{liveEstimate.width_ft}' × {liveEstimate.length_ft}'</span>
                  <span className="ml-2 text-gray-300">≈ {liveEstimate.floor_area_sqft} sq ft</span>
                </div>
              )}

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
              <img src={capturedPhoto} alt="Captured" className="w-full max-h-56 object-cover rounded-xl" />
              <div className="absolute top-2 right-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setCapturedPhoto(null); startCamera(); }} className="bg-white text-xs shadow">Retake</Button>
                <Button size="sm" variant="outline" onClick={() => setCapturedPhoto(null)} className="bg-white text-xs shadow">Clear</Button>
              </div>
              {liveEstimate && (
                <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg">
                  <span className="font-bold text-primary">{liveEstimate.width_ft}' × {liveEstimate.length_ft}'</span>
                  <span className="ml-2">≈ {liveEstimate.floor_area_sqft} sq ft</span>
                </div>
              )}
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Detection summary */}
        {detections.length > 0 && (
          <div className="text-xs text-gray-500 mb-3 flex flex-wrap gap-1">
            <span className="font-semibold text-secondary">Detected:</span>
            {[...new Set(detections.map(d => d.className))].map(cls => (
              <span key={cls} className={`px-1.5 py-0.5 rounded ${CONSTRUCTION_CLASSES.has(cls) ? "bg-primary/10 text-primary font-semibold" : "bg-gray-100"}`}>{cls}</span>
            ))}
          </div>
        )}

        <Button onClick={addMeasurement} className="w-full gap-2 bg-primary text-white">
          <Plus className="w-3.5 h-3.5" /> Add Measurement{liveEstimate ? ` (${liveEstimate.floor_area_sqft} sq ft)` : ""}
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
              const typeInfo  = MEASURE_TYPES.find(t => t.id === m.type) || MEASURE_TYPES[0];
              const isExpanded = expandedId === m.id;
              return (
                <div key={m.id}>
                  <div className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${typeInfo.color}`}>{typeInfo.label}</span>
                    <span className="font-medium text-sm text-secondary flex-1">{m.name}</span>
                    {m.area && <span className="text-sm font-semibold text-primary">{m.area} sq ft</span>}
                    {m.fromProject && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">walkthrough</span>}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                  {isExpanded && (
                    <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100">
                      {m.photo && <img src={m.photo} alt={m.name} className="w-full max-h-36 object-cover rounded-lg mb-3 mt-3" />}
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {["length","width","height"].map(dim => (
                          <div key={dim}>
                            <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">{dim} (ft)</label>
                            <Input type="number" value={m[dim] || ""} onChange={e => updateMeasurement(m.id, dim, e.target.value)} placeholder="0" className="h-8 text-sm" />
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
                        <Input value={m.notes || ""} onChange={e => updateMeasurement(m.id, "notes", e.target.value)} className="h-8 text-sm" placeholder="Observations…" />
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