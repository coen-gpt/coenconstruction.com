import { useState, useEffect } from "react";
import { getPublicConfig } from "@/lib/publicConfig";

const isReady = () => !!(window.google?.maps?.places && window.google?.maps?.Map);

export default function useGoogleMaps() {
  const [loaded, setLoaded] = useState(isReady());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timers = [];

    const pollUntilReady = () => {
      const poll = setInterval(() => {
        if (isReady()) {
          clearInterval(poll);
          if (!cancelled) setLoaded(true);
        }
      }, 100);
      timers.push(poll);
    };

    (async () => {
      if (isReady()) {
        setLoaded(true);
        return;
      }

      const existing = document.getElementById("google-maps-script");
      if (existing) {
        // Script already injected by another component — wait for it
        pollUntilReady();
        existing.addEventListener("error", () => {
          if (!cancelled) setFailed(true);
        });
        return;
      }

      // Build-time env var when available, otherwise the GOOGLE_MAPS_API_KEY
      // app secret served by the publicConfig backend function (Base44 git
      // deploys don't reliably inject VITE_* vars at build time).
      let apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) apiKey = (await getPublicConfig()).google_maps_api_key;
      if (cancelled) return;
      if (!apiKey) {
        setFailed(true);
        return;
      }

      // Another component may have injected it while we awaited the config
      if (document.getElementById("google-maps-script")) {
        pollUntilReady();
        return;
      }

      const script = document.createElement("script");
      script.id = "google-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,maps&loading=async`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        if (!cancelled) setFailed(true);
      };
      script.onload = pollUntilReady;
      document.head.appendChild(script);
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearInterval);
    };
  }, []);

  return { loaded, failed };
}
