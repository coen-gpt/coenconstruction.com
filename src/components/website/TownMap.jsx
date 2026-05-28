import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons broken by Vite/webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const mainIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const poiIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function TownMap({ townName, gps_lat, gps_lng, pointsOfInterest = [] }) {
  if (!gps_lat || !gps_lng) return null;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <div className="bg-secondary text-white px-4 py-3 flex items-center gap-2">
        <span className="text-lg">📍</span>
        <span className="font-semibold text-sm">Service Area Map — {townName}, MA</span>
        <span className="ml-auto text-xs text-white/60 hidden sm:block">Click markers for details</span>
      </div>
      <MapContainer
        center={[gps_lat, gps_lng]}
        zoom={13}
        style={{ height: "340px", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Main town marker */}
        <Marker position={[gps_lat, gps_lng]} icon={mainIcon}>
          <Popup>
            <div className="text-center">
              <strong className="text-red-600">📍 {townName}, MA</strong><br />
              <span className="text-xs text-gray-600">Coen Construction Service Area</span><br />
              <a href="tel:6178572636" className="text-xs text-blue-600 font-semibold">(617) 857-COEN</a>
            </div>
          </Popup>
        </Marker>

        {/* Points of interest */}
        {pointsOfInterest.map((poi, i) => (
          <Marker key={i} position={[poi.gps_lat, poi.gps_lng]} icon={poiIcon}>
            <Popup>
              <div>
                <strong className="text-blue-700">{poi.name}</strong>
                {poi.description && <p className="text-xs text-gray-600 mt-1 max-w-[180px]">{poi.description}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between text-xs text-gray-500 border-t border-gray-100">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> Coen Service Area</span>
          {pointsOfInterest.length > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Local Landmarks</span>}
        </div>
        <a href="/contact" className="text-primary font-semibold hover:underline">Get Free Estimate →</a>
      </div>
    </div>
  );
}