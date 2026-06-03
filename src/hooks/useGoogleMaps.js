import { useState, useEffect } from "react";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function useGoogleMaps() {
  const [loaded, setLoaded] = useState(!!(window.google?.maps?.places));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) { setFailed(true); return; }
    if (window.google?.maps?.places) { setLoaded(true); return; }

    const existing = document.getElementById("google-maps-script");
    if (existing) {
      const poll = setInterval(() => {
        if (window.google?.maps?.places) { setLoaded(true); clearInterval(poll); }
      }, 100);
      existing.addEventListener("error", () => { setFailed(true); clearInterval(poll); });
      return () => clearInterval(poll);
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => setFailed(true);
    script.onload = () => {
      const poll = setInterval(() => {
        if (window.google?.maps?.places) { setLoaded(true); clearInterval(poll); }
      }, 100);
    };
    document.head.appendChild(script);
  }, []);

  return { loaded, failed };
}