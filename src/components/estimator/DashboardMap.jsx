import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function loadMapsScript() {
  if (window.google?.maps) return Promise.resolve();
  const existing = document.getElementById("google-maps-script");
  if (existing) {
    // Script already injected — wait for it or resolve if already loaded
    if (window.google?.maps) return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve);
      existing.addEventListener("error", reject);
    });
  }
  return new Promise((resolve, reject) => {
    const callbackName = "__gm_dashboard_cb__";
    window[callbackName] = () => {
      delete window[callbackName];
      resolve();
    };
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

const STATUS_PIN_COLORS = {
  approved:       "#16a34a", // green
  in_progress:    "#ea580c", // orange
  sent:           "#7c3aed", // purple
  pending_review: "#7c3aed",
  draft:          "#2563eb", // blue
  walkthrough:    "#ca8a04", // yellow
  modify:         "#f97316", // orange
  completed:      "#6b7280", // gray
  cancelled:      "#dc2626", // red
  denied:         "#dc2626",
  imported:       "#0d9488", // teal
};

const STATUS_LEGEND = [
  { status: "approved",    label: "Approved",    color: "#16a34a" },
  { status: "in_progress", label: "In Progress", color: "#ea580c" },
  { status: "sent",        label: "Sent/Pending", color: "#7c3aed" },
  { status: "draft",       label: "Draft",        color: "#2563eb" },
  { status: "walkthrough", label: "Walkthrough",  color: "#ca8a04" },
  { status: "completed",   label: "Completed",    color: "#6b7280" },
];

function makeSvgPin(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.33 14 22 14 22s14-12.67 14-22C28 6.27 21.73 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

export default function DashboardMap({ projects }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodedCount, setGeocodedCount] = useState(0);

  // Projects that have GPS coords stored (gps_lat / gps_lng)
  const geoProjects = projects.filter((p) => p.gps_lat && p.gps_lng);
  // Projects with an address but no GPS — we'll geocode them on the fly
  const needsGeo = projects.filter((p) => !p.gps_lat && (p.client_address || p.client_city));

  const initMap = () => {
    if (!mapRef.current || !window.google?.maps) return;
    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 42.36, lng: -71.06 }, // Boston area default
      zoom: 10,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
      ],
    });
    infoWindowRef.current = new window.google.maps.InfoWindow();
    setMapReady(true);
  };

  // Init map once Maps script is ready
  useEffect(() => {
    loadMapsScript().then(initMap).catch(console.error);
  }, []);

  // Place markers once map is ready + projects change
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    let hasAny = false;

    const addMarker = (lat, lng, project) => {
      const color = STATUS_PIN_COLORS[project.status] || "#6b7280";
      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map: mapInstance.current,
        title: project.client_name,
        icon: {
          url: makeSvgPin(color),
          scaledSize: new window.google.maps.Size(28, 36),
          anchor: new window.google.maps.Point(14, 36),
        },
      });

      marker.addListener("click", () => {
        const value = project.adjusted_total || project.original_estimate_total;
        infoWindowRef.current.setContent(`
          <div style="font-family:sans-serif;padding:4px 2px;min-width:160px">
            <div style="font-weight:700;font-size:13px;color:#1B2B3A">${project.client_name}</div>
            <div style="font-size:11px;color:#666;margin-top:2px">${project.project_type || ""}</div>
            <div style="font-size:11px;color:#666">${project.client_address || project.client_city || ""}</div>
            <div style="margin-top:6px;display:flex;align-items:center;gap:6px">
              <span style="background:${color};color:white;font-size:10px;font-weight:600;padding:2px 8px;border-radius:99px">
                ${(project.status || "").replace(/_/g, " ")}
              </span>
              ${value ? `<span style="font-size:12px;font-weight:700;color:#E35235">$${value.toLocaleString()}</span>` : ""}
            </div>
          </div>
        `);
        infoWindowRef.current.open(mapInstance.current, marker);
      });

      markersRef.current.push(marker);
      bounds.extend({ lat, lng });
      hasAny = true;
    };

    // Already-geocoded projects
    geoProjects.forEach((p) => addMarker(p.gps_lat, p.gps_lng, p));

    // Geocode the rest (batch, rate-limited)
    if (needsGeo.length > 0) {
      setGeocoding(true);
      const geocoder = new window.google.maps.Geocoder();
      let done = 0;
      const total = needsGeo.length;

      needsGeo.forEach((p, i) => {
        const address = [p.client_address, p.client_city, p.client_zipcode].filter(Boolean).join(", ");
        setTimeout(() => {
          geocoder.geocode({ address }, (results, status) => {
            if (status === "OK" && results[0]) {
              const loc = results[0].geometry.location;
              addMarker(loc.lat(), loc.lng(), p);
              if (hasAny && markersRef.current.length > 1) {
                mapInstance.current.fitBounds(bounds);
              }
            }
            done++;
            setGeocodedCount(done);
            if (done === total) setGeocoding(false);
          });
        }, i * 200); // 200ms between requests to avoid rate limits
      });
    }

    if (hasAny) {
      if (markersRef.current.length === 1) {
        mapInstance.current.setCenter(bounds.getCenter());
        mapInstance.current.setZoom(13);
      } else {
        mapInstance.current.fitBounds(bounds);
      }
    }
  }, [mapReady, projects.length]);

  const activeStatuses = [...new Set(projects.map((p) => p.status))];
  const legendItems = STATUS_LEGEND.filter((l) => activeStatuses.includes(l.status));

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 bg-secondary/5 border-b border-gray-100">
        <MapPin className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-secondary">Job Map</h2>
        <span className="text-xs text-gray-400 ml-1">— {geoProjects.length + needsGeo.length} project{(geoProjects.length + needsGeo.length) !== 1 ? "s" : ""}</span>
        {geocoding && (
          <span className="ml-auto text-xs text-gray-400 animate-pulse">
            Locating {geocodedCount}/{needsGeo.length}…
          </span>
        )}
      </div>

      {/* Map */}
      <div ref={mapRef} className="w-full h-72 sm:h-80" />

      {/* Legend */}
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