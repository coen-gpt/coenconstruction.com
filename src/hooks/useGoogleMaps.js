import { useState, useEffect } from "react";

const isReady = () => !!(window.google?.maps?.places && window.google?.maps?.Map);

export default function useGoogleMaps() {
  const [loaded, setLoaded] = useState(isReady());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!GOOGLE_MAPS_API_KEY) { setFailed(true); return; }
    if (isReady()) { setLoaded(true); return; }

    const existing = document.getElementById("google-maps-script");
    if (existing) {
      // Script already injected — check immediately then poll
      if (isReady()) { setLoaded(true); return; }
      const poll = setInterval(() => {
        if (isReady()) { setLoaded(true); clearInterval(poll); }
      }, 100);
      existing.addEventListener("error", () => { setFailed(true); clearInterval(poll); });
      return () => clearInterval(poll);
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,maps,geometry&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => setFailed(true);
    script.onload = () => {
      const poll = setInterval(() => {
        if (isReady()) { setLoaded(true); clearInterval(poll); }
      }, 100);
    };
    document.head.appendChild(script);
  }, []);

  return { loaded, failed };
}