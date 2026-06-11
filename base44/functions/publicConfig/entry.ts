import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Public, non-secret frontend configuration.
//
// The site is built by Base44 from GitHub, so build-time VITE_* env vars are
// not always available. This endpoint serves the browser-safe keys from app
// secrets instead: the Google Maps JS key is referrer-restricted and the
// Turnstile site key is public by design. Secrets (TURNSTILE_SECRET_KEY etc.)
// are NEVER returned here.
//
// Also serves the CompanyProfile branding (logo, name, brand color) so
// unauthenticated surfaces — public website, customer portal, sub portals,
// login pages — can render the uploaded logo without entity read access.
Deno.serve(async (req) => {
  let branding = {};
  try {
    const base44 = createClientFromRequest(req);
    const profiles = await base44.asServiceRole.entities.CompanyProfile.list();
    const company = profiles[0] || {};
    branding = {
      company_name: company.company_name || 'Coen Construction',
      logo_url: company.logo_url || null,
      brand_color: company.brand_color || '#E35235',
      company_phone: company.phone || '',
      company_email: company.email || '',
    };
  } catch (_) {
    // Branding is best-effort — never block the config keys on it.
  }

  return Response.json({
    google_maps_api_key:
      Deno.env.get("GOOGLE_MAPS_API_KEY") ||
      Deno.env.get("VITE_GOOGLE_MAPS_API_KEY") ||
      null,
    turnstile_site_key:
      Deno.env.get("TURNSTILE_SITE_KEY") ||
      Deno.env.get("VITE_TURNSTILE_SITE_KEY") ||
      null,
    ...branding,
  });
});
