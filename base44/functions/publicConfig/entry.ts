// Public, non-secret frontend configuration.
//
// The site is built by Base44 from GitHub, so build-time VITE_* env vars are
// not always available. This endpoint serves the browser-safe keys from app
// secrets instead: the Google Maps JS key is referrer-restricted and the
// Turnstile site key is public by design. Secrets (TURNSTILE_SECRET_KEY etc.)
// are NEVER returned here.
Deno.serve(() => {
  return Response.json({
    google_maps_api_key:
      Deno.env.get("GOOGLE_MAPS_API_KEY") ||
      Deno.env.get("VITE_GOOGLE_MAPS_API_KEY") ||
      null,
    turnstile_site_key:
      Deno.env.get("TURNSTILE_SITE_KEY") ||
      Deno.env.get("VITE_TURNSTILE_SITE_KEY") ||
      null,
  });
});
