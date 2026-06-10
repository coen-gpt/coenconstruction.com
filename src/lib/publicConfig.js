import { base44 } from "@/api/base44Client";

// Browser-safe config (Google Maps key, Turnstile site key) served from
// backend app secrets via the publicConfig function — build-time VITE_* vars
// aren't reliably available in Base44 git deploys. Fetched once per page load.
let cache = null;

export async function getPublicConfig() {
  if (!cache) {
    cache = base44.functions
      .invoke("publicConfig", {})
      .then((res) => res?.data || {})
      .catch(() => {
        cache = null; // allow a retry on the next call
        return {};
      });
  }
  return cache;
}
