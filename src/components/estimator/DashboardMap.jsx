import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Fix default marker icon paths broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Leaflet CSS
if (!document.getElementById("leaflet-css")) {
  const link = document.createElement("link");
  link.id = "leaflet-css";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

const STATUS_PIN_COLORS = {
  approved:       "#16a34a",
  in_progress:    "#ea580c",
  sent:           "#7c3aed",
  pending_review: "#7c3aed",
  draft:          "#2563eb",
  walkthrough:    "#ca8a04",
  modify:         "#f97316",
  completed:      "#6b7280",
  cancelled:      "#dc2626",
  denied:         "#dc2626",
  imported:       "#0d9488",
};

const STATUS_LEGEND = [
  { status: "approved",    label: "Approved",     color: "#16a34a" },
  { status: "in_progress", label: "In Progress",  color: "#ea580c" },
  { status: "sent",        label: "Sent/Pending", color: "#7c3aed" },
  { status: "draft",       label: "Draft",        color: "#2563eb" },
  { status: "walkthrough", label: "Walkthrough",  color: "#ca8a04" },
  { status: "completed",   label: "Completed",    color: "#6b7280" },
];

function makeIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.33 14 22 14 22s14-12.67 14-22C28 6.27 21.73 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`;
  return L.icon({
    iconUrl: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  });
}

// Geocode addresses using OpenStreetMap Nominatim (free, no key needed)
async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "en", "User-Agent": "CovenConstructionApp/1.0" } });
  const data = await res.json();
  if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  return null;
}

function FitBounds({ markers }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 13);
    } else {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [markers.length]);
  return null;
}

export default function DashboardMap({ projects }) {
  const [markers, setMarkers] = useState([]);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodedCount, setGeocodedCount] = useState(0);
  const geocodedIdsRef = useRef(new Set());

  useEffect(() => {
    if (projects.length === 0) return;

    const withCoords = projects.filter((p) => p.gps_lat && p.gps_lng);
    const needsGeo = projects.filter(
      (p) => !p.gps_lat && (p.client_address || p.client_city) && !geocodedIdsRef.current.has(p.id)
    );

    // Add already-geocoded markers immediately (reset markers to avoid duplicates)
    const initial = withCoords.map((p) => ({ lat: p.gps_lat, lng: p.gps_lng, project: p }));
    setMarkers(initial);
    setGeocodedCount(0);

    if (needsGeo.length === 0) return;
    setGeocoding(true);
    let done = 0;

    needsGeo.forEach((p, i) => {
      const address = [p.client_address, p.client_city, p.client_zipcode, "MA"].filter(Boolean).join(", ");
      setTimeout(async () => {
        const coords = await geocodeAddress(address);
        done++;
        setGeocodedCount(done);
        geocodedIdsRef.current.add(p.id);
        if (coords) {
          setMarkers((prev) => [...prev, { lat: coords.lat, lng: coords.lng, project: p }]);
        }
        if (done === needsGeo.length) setGeocoding(false);
      }, i * 300); // 300ms between requests to respect Nominatim rate limit
    });
  }, [projects.length]);

  const activeStatuses = [...new Set(projects.map((p) => p.status))];
  const legendItems = STATUS_LEGEND.filter((l) => activeStatuses.includes(l.status));
  const total = projects.filter((p) => p.gps_lat || p.client_address || p.client_city).length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 bg-secondary/5 border-b border-gray-100">
        <MapPin className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-secondary">Job Map</h2>
        <span className="text-xs text-gray-400 ml-1">— {total} project{total !== 1 ? "s" : ""}</span>
        {geocoding && (
          <span className="ml-auto text-xs text-gray-400 animate-pulse">
            Locating {geocodedCount}/{projects.filter((p) => !p.gps_lat && (p.client_address || p.client_city)).length}…
          </span>
        )}
      </div>

      <div className="w-full h-72 sm:h-80">
        <MapContainer
          center={[42.36, -71.06]}
          zoom={10}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds markers={markers} />
          {markers.map(({ lat, lng, project }, idx) => {
            const color = STATUS_PIN_COLORS[project.status] || "#6b7280";
            const value = project.adjusted_total || project.original_estimate_total;
            return (
              <Marker key={idx} position={[lat, lng]} icon={makeIcon(color)}>
                <Popup>
                  <div style={{ minWidth: 150 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#1B2B3A" }}>{project.client_name}</div>
                    {project.project_type && <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{project.project_type}</div>}
                    <div style={{ fontSize: 11, color: "#666" }}>{project.client_address || project.client_city || ""}</div>
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ background: color, color: "white", fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99 }}>
                        {(project.status || "").replace(/_/g, " ")}
                      </span>
                      {value ? <span style={{ fontSize: 12, fontWeight: 700, color: "#E35235" }}>${value.toLocaleString()}</span> : null}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {legendItems.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-5 py-3 border-t border-gray-100 bg-gray-50">
          {legendItems.map((l) => (
            <div key={l.status} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: l.color }} />
              <span className="text-xs text-gray-600">{l.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}