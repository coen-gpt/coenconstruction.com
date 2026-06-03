import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus, Trash2, Calculator,
  Layers, Triangle, Wind, Droplets, ArrowRight,
  Info, CheckCircle2, AlertTriangle, RefreshCw, MapPin, Search, Satellite
} from "lucide-react";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function useGoogleMaps() {
  const [loaded, setLoaded] = useState(!!(window.google?.maps?.places));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) { setFailed(true); return; }
    if (window.google?.maps?.places) { setLoaded(true); return; }
    const existing = document.getElementById("google-maps-script");
    if (existing) {
      const checkReady = setInterval(() => {
        if (window.google?.maps?.places) { setLoaded(true); clearInterval(checkReady); }
      }, 100);
      return () => clearInterval(checkReady);
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => setFailed(true);
    script.onload = () => {
      const checkReady = setInterval(() => {
        if (window.google?.maps?.places) { setLoaded(true); clearInterval(checkReady); }
      }, 100);
    };
    document.head.appendChild(script);
  }, []);
  return { loaded, failed };
}

function AddressSearchBar({ onSelect }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const { loaded: mapsLoaded, failed: mapsFailed } = useGoogleMaps();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!mapsLoaded || !inputRef.current || autocompleteRef.current) return;
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["formatted_address", "geometry", "name"],
    });
    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current.getPlace();
      if (!place.geometry) return;
      setValue(place.formatted_address || "");
      onSelect({
        address: place.formatted_address,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      });
    });
  }, [mapsLoaded, onSelect]);

  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type a property address to locate the roof..."
        className="w-full h-10 pl-9 pr-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
      />
    </div>
  );
}

function SatelliteMap({ lat, lng, address }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const { loaded: mapsLoaded, failed: mapsFailed } = useGoogleMaps();

  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || !lat || !lng) return;
    const center = { lat, lng };
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 20,
        mapTypeId: "satellite",
        tilt: 0,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });
    } else {
      mapInstanceRef.current.setCenter(center);
      mapInstanceRef.current.setZoom(20);
    }
    if (markerRef.current) markerRef.current.setMap(null);
    markerRef.current = new window.google.maps.Marker({
      position: center,
      map: mapInstanceRef.current,
      title: address,
      animation: window.google.maps.Animation.DROP,
    });
  }, [mapsLoaded, lat, lng, address]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full min-h-[340px] rounded-xl overflow-hidden"
      style={{ background: "#e5e7eb" }}
    >
      {mapsFailed && (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2 p-4">
          <AlertTriangle className="w-8 h-8 text-yellow-400" />
          <p className="text-sm text-center">Satellite map unavailable — Google Maps API key needs the <strong>Maps JavaScript API</strong> enabled in Google Cloud Console.</p>
        </div>
      )}
      {(!lat || !lng) && !mapsFailed && (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
          <Satellite className="w-10 h-10 text-gray-300" />
          <p className="text-sm">Enter an address to view satellite imagery</p>
        </div>
      )}
    </div>
  );
}

// ── Constants ──────────────────────────────────────────────────────────────
const SHINGLE_TYPES = [
  { label: "3-Tab Asphalt (30 yr)", coverage: 100, waste_pct: 10, unit_cost: 95 },
  { label: "Architectural Laminate (30 yr)", coverage: 100, waste_pct: 12, unit_cost: 130 },
  { label: "Architectural Laminate (50 yr)", coverage: 100, waste_pct: 12, unit_cost: 165 },
  { label: "Designer / Premium (50 yr)", coverage: 100, waste_pct: 15, unit_cost: 210 },
  { label: "GAF Timberline HDZ", coverage: 100, waste_pct: 12, unit_cost: 145 },
  { label: "GAF Timberline AS II (Impact Resistant)", coverage: 100, waste_pct: 12, unit_cost: 195 },
  { label: "CertainTeed Landmark Pro", coverage: 100, waste_pct: 12, unit_cost: 150 },
  { label: "Owens Corning Duration", coverage: 100, waste_pct: 12, unit_cost: 140 },
  { label: "Metal Standing Seam", coverage: 100, waste_pct: 8, unit_cost: 450 },
  { label: "Metal R-Panel (Exposed Fastener)", coverage: 100, waste_pct: 8, unit_cost: 300 },
  { label: "EPDM (Flat Roof)", coverage: 100, waste_pct: 5, unit_cost: 350 },
  { label: "TPO (Flat Roof)", coverage: 100, waste_pct: 5, unit_cost: 380 },
];

const PITCH_MULTIPLIERS = {
  "1/12": 1.003, "2/12": 1.014, "3/12": 1.031, "4/12": 1.054,
  "5/12": 1.083, "6/12": 1.118, "7/12": 1.158, "8/12": 1.202,
  "9/12": 1.250, "10/12": 1.302, "11/12": 1.357, "12/12": 1.414,
  "13/12": 1.474, "14/12": 1.537, "15/12": 1.601, "16/12": 1.667,
};

const UNDERLAYMENT_TYPES = [
  { label: "Felt 15# (Standard)", cost_per_sq: 12 },
  { label: "Felt 30# (Premium)", cost_per_sq: 18 },
  { label: "Synthetic Underlayment (Standard)", cost_per_sq: 22 },
  { label: "Synthetic Underlayment (Premium)", cost_per_sq: 32 },
  { label: "Ice & Water Shield (Full Deck)", cost_per_sq: 55 },
];

const ICE_WATER_ZONES = [
  { label: "Eaves only (3 ft)", rows: 1 },
  { label: "Eaves + Valleys (6 ft)", rows: 2 },
  { label: "Full Deck Coverage", rows: null },
];

const DECKING_TYPES = [
  { label: "None needed", cost_per_sq: 0 },
  { label: "1/2\" OSB (spot replacement, ~10%)", cost_per_sq: 28 },
  { label: "1/2\" OSB (25% replacement)", cost_per_sq: 70 },
  { label: "1/2\" OSB (full deck)", cost_per_sq: 140 },
  { label: "5/8\" CDX Plywood (full deck)", cost_per_sq: 175 },
];

const RIDGE_TYPES = [
  { label: "Standard Ridge Cap (included in shingles)", cost_per_lf: 0 },
  { label: "High-Profile Ridge Cap (separate)", cost_per_lf: 3.5 },
  { label: "Hip & Ridge Cap — Premium", cost_per_lf: 5.5 },
];

const VENTILATION_TYPES = [
  { label: "None", cost: 0 },
  { label: "Ridge Vent (LF)", cost_per_lf: 8, per_lf: true },
  { label: "Box Vents (each)", cost_per_unit: 85, per_unit: true },
  { label: "Power Attic Fan", cost_per_unit: 350, per_unit: true },
  { label: "Soffit Vents (continuous LF)", cost_per_lf: 6, per_lf: true },
  { label: "Gable Vents (each)", cost_per_unit: 120, per_unit: true },
];

const LABOR_RATES = {
  "Tear-off (1 layer)": { per_sq: 55 },
  "Tear-off (2 layers)": { per_sq: 90 },
  "Tear-off (3+ layers)": { per_sq: 130 },
  "Install — Standard Pitch (≤6/12)": { per_sq: 120 },
  "Install — Steep Pitch (7-9/12)": { per_sq: 165 },
  "Install — Very Steep (10-12/12)": { per_sq: 200 },
  "Install — Extreme (>12/12)": { per_sq: 250 },
};

function newPlane() {
  return {
    id: crypto.randomUUID(),
    label: "Roof Plane",
    width: "",
    length: "",
    pitch: "6/12",
    shape: "rectangle",
  };
}

function calcPlaneArea(plane) {
  const w = parseFloat(plane.width) || 0;
  const l = parseFloat(plane.length) || 0;
  const multiplier = PITCH_MULTIPLIERS[plane.pitch] || 1.118;
  if (plane.shape === "triangle") {
    return (w * l / 2) * multiplier;
  }
  return w * l * multiplier;
}

function pitchToAngle(pitch) {
  const [rise] = pitch.split("/").map(Number);
  return Math.round(Math.atan(rise / 12) * (180 / Math.PI));
}

export default function RoofMeasurement() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Measurement inputs ─────────────────────────────────────────────────
  const [planes, setPlanes] = useState([newPlane()]);
  const [ridgeLF, setRidgeLF] = useState("");
  const [hipLF, setHipLF] = useState("");
  const [valleyLF, setValleyLF] = useState("");
  const [rakeLF, setRakeLF] = useState("");
  const [eaveLF, setEaveLF] = useState("");
  const [flashingLF, setFlashingLF] = useState("");
  const [chimneys, setChimneys] = useState("");
  const [skylights, setSkylights] = useState("");

  // ── Material selections ────────────────────────────────────────────────
  const [shingleIdx, setShingleIdx] = useState(1);
  const [underlayIdx, setUnderlayIdx] = useState(2);
  const [iceWaterIdx, setIceWaterIdx] = useState(0);
  const [deckingIdx, setDeckingIdx] = useState(0);
  const [ridgeTypeIdx, setRidgeTypeIdx] = useState(0);
  const [ventIdx, setVentIdx] = useState(0);
  const [ventQty, setVentQty] = useState(1);

  // ── Labor ─────────────────────────────────────────────────────────────
  const [tearoffKey, setTearoffKey] = useState("Tear-off (1 layer)");
  const [installKey, setInstallKey] = useState("Install — Standard Pitch (≤6/12)");
  const [includeFlashing, setIncludeFlashing] = useState(true);
  const [markup, setMarkup] = useState(20);

  // ── Project linking ────────────────────────────────────────────────────
  const [targetProjectId, setTargetProjectId] = useState("new");
  const [saving, setSaving] = useState(false);
  const [jobName, setJobName] = useState("");

  // ── Address / map ──────────────────────────────────────────────────────
  const [selectedLocation, setSelectedLocation] = useState(null);
  const handleAddressSelect = useCallback((loc) => {
    setSelectedLocation(loc);
    if (!jobName && loc.address) setJobName(loc.address.split(",")[0]);
  }, [jobName]);

  const { data: projects = [] } = useQuery({
    queryKey: ["contractor-projects-roof"],
    queryFn: () => base44.entities.ContractorProject.list("-created_date", 100),
  });

  // ── Calculations ───────────────────────────────────────────────────────
  const totalFlatArea = planes.reduce((sum, p) => sum + calcPlaneArea(p), 0);
  const totalSquares = totalFlatArea / 100;

  const shingle = SHINGLE_TYPES[shingleIdx];
  const wasteFactor = 1 + shingle.waste_pct / 100;
  const shingleSquares = totalSquares * wasteFactor;

  const underlayment = UNDERLAYMENT_TYPES[underlayIdx];
  const iceWater = ICE_WATER_ZONES[iceWaterIdx];
  const decking = DECKING_TYPES[deckingIdx];
  const ridgeType = RIDGE_TYPES[ridgeTypeIdx];
  const vent = VENTILATION_TYPES[ventIdx];

  const ridgeLFn = parseFloat(ridgeLF) || 0;
  const hipLFn = parseFloat(hipLF) || 0;
  const valleyLFn = parseFloat(valleyLF) || 0;
  const eaveLFn = parseFloat(eaveLF) || 0;
  const flashingLFn = parseFloat(flashingLF) || 0;
  const chimneyN = parseInt(chimneys) || 0;
  const skylightN = parseInt(skylights) || 0;

  const matShingles = shingleSquares * shingle.unit_cost;
  const matUnderlayment = totalSquares * underlayment.cost_per_sq;
  const matDecking = totalSquares * decking.cost_per_sq;
  const matRidge = ridgeType.cost_per_lf > 0 ? (ridgeLFn + hipLFn) * ridgeType.cost_per_lf : 0;
  const matFlashing = includeFlashing ? (flashingLFn * 4.5 + chimneyN * 275 + skylightN * 350) : 0;
  const matVent = vent.per_lf ? (parseFloat(ventQty) || 0) * (vent.cost_per_lf || 0)
                : vent.per_unit ? (parseInt(ventQty) || 0) * (vent.cost_per_unit || 0)
                : 0;
  const matIceWater = iceWater.rows === null ? totalSquares * 55 : eaveLFn * iceWater.rows * (3 / 12) * 55;

  const totalMaterials = matShingles + matUnderlayment + matDecking + matRidge + matFlashing + matVent + matIceWater;

  const laborTearoff = (LABOR_RATES[tearoffKey]?.per_sq || 0) * totalSquares;
  const laborInstall = (LABOR_RATES[installKey]?.per_sq || 0) * totalSquares;
  const totalLabor = laborTearoff + laborInstall;

  const subtotal = (totalMaterials + totalLabor) * (1 + markup / 100);

  // ── Line items for estimate push ───────────────────────────────────────
  function buildLineItems() {
    const items = [];
    const mkItem = (title, description, qty, unit, unit_cost, cost_type = "material") => ({
      id: crypto.randomUUID(),
      parent_group: "Roofing",
      subgroup: cost_type === "labor" ? "Labor" : "Materials",
      title,
      description,
      quantity: Math.round(qty * 100) / 100,
      unit,
      unit_cost: Math.round(unit_cost * 100) / 100,
      markup_pct: markup,
      total: Math.round(qty * unit_cost * (1 + markup / 100) * 100) / 100,
      cost_type,
      is_allowance: false,
      internal_notes: "",
    });

    items.push(mkItem(`${shingle.label} Shingles`, `${shingleSquares.toFixed(2)} squares incl. ${shingle.waste_pct}% waste factor`, shingleSquares, "square", shingle.unit_cost));
    items.push(mkItem(`${underlayment.label}`, `Synthetic/felt underlayment over full deck`, totalSquares, "square", underlayment.cost_per_sq));
    if (matIceWater > 0) items.push(mkItem("Ice & Water Shield", `${iceWater.label} application`, totalSquares, "square", matIceWater / totalSquares));
    if (decking.cost_per_sq > 0) items.push(mkItem(`Roof Decking — ${decking.label}`, `Deck replacement/repair`, totalSquares, "square", decking.cost_per_sq));
    if (ridgeType.cost_per_lf > 0) items.push(mkItem(`${ridgeType.label}`, `Ridge + hip linear footage`, ridgeLFn + hipLFn, "lin ft", ridgeType.cost_per_lf));
    if (matFlashing > 0) items.push(mkItem("Flashing (Step, Counter, Valley, Chimney, Skylights)", `${flashingLFn} LF step flashing, ${chimneyN} chimneys, ${skylightN} skylights`, 1, "ls", matFlashing));
    if (matVent > 0) items.push(mkItem(`Ventilation — ${vent.label}`, `Attic ventilation system`, parseFloat(ventQty) || 0, vent.per_lf ? "lin ft" : "each", vent.per_lf ? (vent.cost_per_lf || 0) : (vent.cost_per_unit || 0)));
    if (laborTearoff > 0) items.push(mkItem(`Tear-Off — ${tearoffKey}`, `Remove and dispose of existing roofing`, totalSquares, "square", LABOR_RATES[tearoffKey]?.per_sq || 0, "labor"));
    items.push(mkItem(`Installation — ${installKey}`, `Complete roofing installation per specs`, totalSquares, "square", LABOR_RATES[installKey]?.per_sq || 0, "labor"));

    return items;
  }

  const pushToEstimate = async () => {
    if (totalFlatArea === 0) {
      toast({ title: "Enter at least one roof plane measurement", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const lineItems = buildLineItems();
      const grandTotal = lineItems.reduce((s, i) => s + i.total, 0);

      if (targetProjectId === "new") {
        // Create a new project + estimate
        const proj = await base44.entities.ContractorProject.create({
          client_name: jobName || "Roofing Job",
          project_type: "Roofing",
          status: "draft",
          description: `Generated from Roof Measurement Tool. Total area: ${totalFlatArea.toFixed(0)} sq ft (${totalSquares.toFixed(2)} squares).`,
        });
        await base44.entities.Estimate.create({
          project_id: proj.id,
          type: "original",
          status: "draft",
          title: `Roofing Estimate — ${shingle.label}`,
          line_items: lineItems,
          grand_total: grandTotal,
          default_markup_pct: markup,
          notes: `Roof area: ${totalFlatArea.toFixed(0)} sq ft | ${totalSquares.toFixed(2)} squares | Pitch: see planes`,
        });
        await base44.entities.ContractorProject.update(proj.id, {
          original_estimate_total: grandTotal,
          adjusted_total: grandTotal,
        });
        qc.invalidateQueries(["contractor-projects"]);
        toast({ title: "New project + estimate created!", description: `Navigate to Projects to view ${jobName || "Roofing Job"}` });
        window.open(`/estimator/projects/${proj.id}`, "_blank");
      } else {
        // Append to existing project's estimate
        const estimates = await base44.entities.Estimate.filter({ project_id: targetProjectId });
        const existing = estimates.find(e => e.type === "original" && e.status !== "superseded");

        if (existing) {
          const merged = [...(existing.line_items || []), ...lineItems];
          const newTotal = merged.reduce((s, i) => s + i.total, 0);
          await base44.entities.Estimate.update(existing.id, {
            line_items: merged,
            grand_total: newTotal,
          });
          await base44.entities.ContractorProject.update(targetProjectId, {
            original_estimate_total: newTotal,
            adjusted_total: newTotal,
          });
        } else {
          await base44.entities.Estimate.create({
            project_id: targetProjectId,
            type: "original",
            status: "draft",
            title: `Roofing Estimate — ${shingle.label}`,
            line_items: lineItems,
            grand_total: grandTotal,
            default_markup_pct: markup,
            notes: `Roof area: ${totalFlatArea.toFixed(0)} sq ft | ${totalSquares.toFixed(2)} squares`,
          });
          await base44.entities.ContractorProject.update(targetProjectId, {
            original_estimate_total: grandTotal,
            adjusted_total: grandTotal,
          });
        }
        qc.invalidateQueries(["estimates", targetProjectId]);
        qc.invalidateQueries(["contractor-project", targetProjectId]);
        toast({ title: "Line items added to estimate!", description: `${lineItems.length} roofing line items pushed.` });
        window.open(`/estimator/projects/${targetProjectId}`, "_blank");
      }
    } catch (err) {
      toast({ title: "Failed to push estimate", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Plane management ───────────────────────────────────────────────────
  const updatePlane = (id, field, val) => setPlanes(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  const addPlane = () => setPlanes(prev => [...prev, { ...newPlane(), label: `Roof Plane ${prev.length + 1}` }]);
  const removePlane = (id) => setPlanes(prev => prev.filter(p => p.id !== id));

  const avgPitch = planes[0]?.pitch || "6/12";
  const pitchAngle = pitchToAngle(avgPitch);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
            <Triangle className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-secondary">Roof Measurement & Estimator</h1>
            <p className="text-sm text-gray-500">Comprehensive residential & commercial roof measurement tool — push directly to any estimate</p>
          </div>
        </div>
      </div>

      {/* ── Address + Satellite Map ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
        <div className="flex items-center gap-2 px-5 py-4 bg-secondary/5 border-b border-gray-100">
          <MapPin className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-secondary">Property Lookup</h2>
          <span className="text-xs text-gray-400 ml-1">— search the address to view the roof from above</span>
        </div>
        <div className="p-4 space-y-3">
          <AddressSearchBar onSelect={handleAddressSelect} />
          {selectedLocation && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span><strong>{selectedLocation.address}</strong> — use the satellite view below to measure the roof planes</span>
            </div>
          )}
          <SatelliteMap
            lat={selectedLocation?.lat}
            lng={selectedLocation?.lng}
            address={selectedLocation?.address}
          />
          {selectedLocation && (
            <p className="text-xs text-gray-400 text-center">
              💡 Tip: Use the <strong>+</strong> zoom to get close to the roof. Count roof planes and estimate width × length from the grid, then enter measurements in the Roof Planes section below.
            </p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* ── LEFT COLUMN: Inputs ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* ── Roof Planes ── */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-secondary/5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-secondary">Roof Planes</h2>
                <span className="text-xs text-gray-400 ml-1">(measure each flat footprint — pitch multiplier applied automatically)</span>
              </div>
              <Button size="sm" variant="outline" onClick={addPlane} className="gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Plane
              </Button>
            </div>
            <div className="p-5 space-y-3">
              {planes.map((plane, idx) => (
                <div key={plane.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <input
                      value={plane.label}
                      onChange={(e) => updatePlane(plane.id, "label", e.target.value)}
                      className="font-semibold text-secondary text-sm bg-transparent border-b border-dashed border-gray-300 focus:outline-none focus:border-primary w-40"
                    />
                    {planes.length > 1 && (
                      <button onClick={() => removePlane(plane.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Width (ft)</label>
                      <Input
                        type="number"
                        value={plane.width}
                        onChange={(e) => updatePlane(plane.id, "width", e.target.value)}
                        placeholder="0"
                        className="h-9 text-sm text-center"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Length (ft)</label>
                      <Input
                        type="number"
                        value={plane.length}
                        onChange={(e) => updatePlane(plane.id, "length", e.target.value)}
                        placeholder="0"
                        className="h-9 text-sm text-center"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Pitch</label>
                      <Select value={plane.pitch} onValueChange={(v) => updatePlane(plane.id, "pitch", v)}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(PITCH_MULTIPLIERS).map(p => (
                            <SelectItem key={p} value={p}>{p} ({pitchToAngle(p)}°)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Shape</label>
                      <Select value={plane.shape} onValueChange={(v) => updatePlane(plane.id, "shape", v)}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rectangle">Rectangle / Hip</SelectItem>
                          <SelectItem value="triangle">Gable Triangle</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <span>Flat area: <strong>{((parseFloat(plane.width)||0)*(parseFloat(plane.length)||0)*(plane.shape==="triangle"?0.5:1)).toFixed(0)} sq ft</strong></span>
                    <span>→ Pitched area: <strong className="text-primary">{calcPlaneArea(plane).toFixed(0)} sq ft</strong></span>
                    <span>Multiplier: <strong>{PITCH_MULTIPLIERS[plane.pitch]}</strong></span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div className="text-sm text-gray-600">
                  Total Roof Area: <span className="font-bold text-secondary">{totalFlatArea.toFixed(0)} sq ft</span>
                  <span className="ml-2 text-primary font-bold">({totalSquares.toFixed(2)} squares)</span>
                </div>
                <div className="text-xs text-gray-400">1 square = 100 sq ft</div>
              </div>
            </div>
          </div>

          {/* ── Linear Measurements ── */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 bg-secondary/5 border-b border-gray-100">
              <Calculator className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-secondary">Linear Measurements</h2>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: "Ridge (LF)", value: ridgeLF, set: setRidgeLF, icon: "—", tip: "Horizontal ridge beam at peak" },
                { label: "Hip (LF)", value: hipLF, set: setHipLF, icon: "↗", tip: "Diagonal hip rafters" },
                { label: "Valley (LF)", value: valleyLF, set: setValleyLF, icon: "↙", tip: "Inside valley intersections" },
                { label: "Rake (LF)", value: rakeLF, set: setRakeLF, icon: "↖", tip: "Gable end sloped edges" },
                { label: "Eave (LF)", value: eaveLF, set: setEaveLF, icon: "⟵", tip: "Bottom horizontal edge — drip edge" },
                { label: "Step Flashing (LF)", value: flashingLF, set: setFlashingLF, icon: "⌁", tip: "Walls, dormers, etc." },
              ].map(({ label, value, set, tip }) => (
                <div key={label}>
                  <label className="text-xs text-gray-500 block mb-1">
                    {label} <span className="text-gray-300 ml-1" title={tip}><Info className="w-3 h-3 inline" /></span>
                  </label>
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder="0"
                    className="h-9 text-sm text-center"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Chimneys (qty)</label>
                <Input type="number" value={chimneys} onChange={(e) => setChimneys(e.target.value)} placeholder="0" className="h-9 text-sm text-center" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Skylights (qty)</label>
                <Input type="number" value={skylights} onChange={(e) => setSkylights(e.target.value)} placeholder="0" className="h-9 text-sm text-center" />
              </div>
            </div>
          </div>

          {/* ── Materials ── */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 bg-secondary/5 border-b border-gray-100">
              <Layers className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-secondary">Material Specifications</h2>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Shingle / Roofing Product</label>
                <Select value={String(shingleIdx)} onValueChange={(v) => setShingleIdx(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SHINGLE_TYPES.map((s, i) => <SelectItem key={i} value={String(i)}>{s.label} — ${s.unit_cost}/sq</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Underlayment</label>
                <Select value={String(underlayIdx)} onValueChange={(v) => setUnderlayIdx(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNDERLAYMENT_TYPES.map((u, i) => <SelectItem key={i} value={String(i)}>{u.label} — ${u.cost_per_sq}/sq</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Ice & Water Shield</label>
                <Select value={String(iceWaterIdx)} onValueChange={(v) => setIceWaterIdx(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICE_WATER_ZONES.map((z, i) => <SelectItem key={i} value={String(i)}>{z.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Roof Decking</label>
                <Select value={String(deckingIdx)} onValueChange={(v) => setDeckingIdx(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DECKING_TYPES.map((d, i) => <SelectItem key={i} value={String(i)}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Ridge Cap</label>
                <Select value={String(ridgeTypeIdx)} onValueChange={(v) => setRidgeTypeIdx(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RIDGE_TYPES.map((r, i) => <SelectItem key={i} value={String(i)}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Ventilation</label>
                <div className="flex gap-2">
                  <Select value={String(ventIdx)} onValueChange={(v) => setVentIdx(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VENTILATION_TYPES.map((v, i) => <SelectItem key={i} value={String(i)}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {VENTILATION_TYPES[ventIdx].cost !== 0 && (
                    <Input type="number" value={ventQty} onChange={(e) => setVentQty(e.target.value)} className="w-20 text-sm text-center" placeholder="Qty" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Labor ── */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 bg-secondary/5 border-b border-gray-100">
              <Wind className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-secondary">Labor</h2>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Tear-Off</label>
                <Select value={tearoffKey} onValueChange={setTearoffKey}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LABOR_RATES).filter(([k]) => k.startsWith("Tear")).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{k} — ${v.per_sq}/sq</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Installation</label>
                <Select value={installKey} onValueChange={setInstallKey}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LABOR_RATES).filter(([k]) => k.startsWith("Install")).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{k} — ${v.per_sq}/sq</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
                <input
                  type="checkbox"
                  id="flashing"
                  checked={includeFlashing}
                  onChange={(e) => setIncludeFlashing(e.target.checked)}
                  className="accent-primary w-4 h-4"
                />
                <label htmlFor="flashing" className="text-sm text-gray-600 cursor-pointer">Include flashing & detail labor</label>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Markup %</label>
                <Input type="number" value={markup} onChange={(e) => setMarkup(Number(e.target.value))} className="h-9 text-sm text-center" />
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Summary & Push ── */}
        <div className="space-y-5">
          {/* Pitch Reference */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-secondary/5 border-b border-gray-100">
              <Triangle className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-secondary text-sm">Pitch Reference</h3>
            </div>
            <div className="p-4 space-y-1">
              {[
                { pitch: "2/12-4/12", label: "Low Slope", color: "bg-green-100 text-green-700", note: "Walk-able, standard labor" },
                { pitch: "5/12-6/12", label: "Standard", color: "bg-blue-100 text-blue-700", note: "Most common residential" },
                { pitch: "7/12-9/12", label: "Steep", color: "bg-yellow-100 text-yellow-800", note: "+$45/sq labor surcharge" },
                { pitch: "10/12-12/12", label: "Very Steep", color: "bg-orange-100 text-orange-700", note: "+$80/sq labor surcharge" },
                { pitch: "13/12+", label: "Extreme", color: "bg-red-100 text-red-700", note: "+$130/sq, safety gear req." },
              ].map((r) => (
                <div key={r.pitch} className="flex items-center gap-2 text-xs py-1 border-b border-gray-50 last:border-0">
                  <span className={`px-2 py-0.5 rounded-full font-semibold ${r.color} shrink-0`}>{r.pitch}</span>
                  <span className="font-medium text-secondary">{r.label}</span>
                  <span className="text-gray-400 ml-auto text-right">{r.note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden sticky top-4">
            <div className="flex items-center gap-2 px-4 py-3 bg-primary/5 border-b border-gray-100">
              <Calculator className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-secondary text-sm">Cost Breakdown</h3>
            </div>
            <div className="p-4 space-y-2">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Roof Summary</div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Area</span>
                <span className="font-semibold text-secondary">{totalFlatArea.toFixed(0)} sq ft</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Squares</span>
                <span className="font-semibold text-primary">{totalSquares.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Squares w/ Waste</span>
                <span className="font-semibold text-secondary">{shingleSquares.toFixed(2)}</span>
              </div>

              <div className="border-t border-gray-100 pt-2 mt-2 text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Materials</div>
              {[
                { label: "Shingles", val: matShingles },
                { label: "Underlayment", val: matUnderlayment },
                { label: "Ice & Water", val: matIceWater },
                { label: "Decking", val: matDecking },
                { label: "Ridge Cap", val: matRidge },
                { label: "Flashing", val: matFlashing },
                { label: "Ventilation", val: matVent },
              ].filter(r => r.val > 0).map(({ label, val }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-medium">${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-1 mt-1">
                <span>Materials Subtotal</span>
                <span>${totalMaterials.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>

              <div className="border-t border-gray-100 pt-2 mt-2 text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Labor</div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tear-Off</span>
                <span>${laborTearoff.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Installation</span>
                <span>${laborInstall.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-1 mt-1">
                <span>Labor Subtotal</span>
                <span>${totalLabor.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>

              <div className="border-t-2 border-secondary mt-3 pt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Before Markup ({markup}%)</span>
                  <span>${(totalMaterials + totalLabor).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-secondary">TOTAL ESTIMATE</span>
                  <span className="text-xl font-bold text-primary">${subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5 text-right">
                  ${(subtotal / Math.max(totalSquares, 0.01)).toFixed(0)}/square
                </div>
              </div>
            </div>

            {/* Push to Estimate */}
            <div className="p-4 border-t border-gray-100 space-y-3">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Push to Estimate</div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Target Project</label>
                <Select value={targetProjectId} onValueChange={setTargetProjectId}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">+ Create New Project</SelectItem>
                    {projects.filter(p => p.status !== "completed" && p.status !== "cancelled").map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.client_name} — {p.project_type || "Project"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {targetProjectId === "new" && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Job / Client Name</label>
                  <Input value={jobName} onChange={(e) => setJobName(e.target.value)} placeholder="e.g. Smith Residence" className="text-sm" />
                </div>
              )}
              <Button
                className="w-full bg-primary text-white gap-2"
                onClick={pushToEstimate}
                disabled={saving || totalFlatArea === 0}
              >
                {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Pushing…</> : <><ArrowRight className="w-4 h-4" /> Push to Estimate</>}
              </Button>
              <p className="text-xs text-gray-400 text-center">
                {targetProjectId === "new"
                  ? "Creates a new project + estimate with all line items."
                  : "Appends roofing line items to the existing estimate."}
              </p>
            </div>
          </div>

          {/* MA Code Notes */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-secondary/5 border-b border-gray-100 flex items-center gap-2">
              <Droplets className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-secondary text-sm">MA Code Reminders</h3>
            </div>
            <div className="p-4 space-y-2">
              {[
                { icon: CheckCircle2, color: "text-green-500", text: "Ice & Water Shield req. 24\" inside interior wall line (CMR 780)" },
                { icon: CheckCircle2, color: "text-green-500", text: "Min 2/12 pitch for asphalt shingles (GAF + MA code)" },
                { icon: AlertTriangle, color: "text-yellow-500", text: "Steep roof (>7/12) requires OSHA fall protection plan" },
                { icon: AlertTriangle, color: "text-yellow-500", text: "3+ layer tear-offs may require dumpster permit" },
                { icon: Info, color: "text-blue-400", text: "Roof permit required in MA for full replacement" },
                { icon: Info, color: "text-blue-400", text: "1:150 ventilation ratio required (attic)" },
              ].map(({ icon: Icon, color, text }, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                  <Icon className={`w-3.5 h-3.5 ${color} mt-0.5 shrink-0`} />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}