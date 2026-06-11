/**
 * Static OG Image Registry
 * ─────────────────────────────────────────────────────────────────────────────
 * Maps URL pathnames → absolute OG image URLs.
 *
 * HOW TO ADD A NEW IMAGE:
 *   1. Drop a 1200×630 PNG/JPG into /public/og/
 *   2. Add an entry below: { "/your-path": ogImg("your-file.png") }
 *
 * REQUIREMENTS per image:
 *   • Exactly 1200 × 630 px
 *   • Under 1 MB (Facebook hard limit)
 *   • PNG or JPG — no WebP (poor scraper support)
 *   • No transparent backgrounds (use a solid fill)
 */

const SITE_DOMAIN = "https://coenconstruction.com";

/** Builds the absolute URL for a file in /public/og/ */
export function ogImg(filename) {
  return `${SITE_DOMAIN}/og/${filename}`;
}

/**
 * Pathname → absolute OG image URL.
 * Keys are exact pathnames (no trailing slash).
 * Dynamic routes (e.g. /blog/:slug) are NOT listed here —
 * those get a dynamic SVG from the ogImage backend function.
 */
export const STATIC_OG_IMAGES = {
  // ── Core pages ─────────────────────────────────────────────────────────────
  "/":                        ogImg("home.png"),
  "/about":                   ogImg("about.png"),
  "/contact":                 ogImg("contact.png"),
  "/gallery":                 ogImg("gallery.png"),
  "/financing":               ogImg("financing.png"),
  "/blog":                    ogImg("blog.png"),
  "/services":                ogImg("services.png"),
  "/sitemap":                 ogImg("default.png"),
  "/privacy-policy":          ogImg("default.png"),

  // ── Service pages ───────────────────────────────────────────────────────────
  "/services/home-additions":          ogImg("services-home-additions.png"),
  "/services/kitchen-remodeling":      ogImg("services-kitchen-remodeling.png"),
  "/services/bathroom-remodeling":     ogImg("services-bathroom-remodeling.png"),
  "/services/decks-porches-pergolas":  ogImg("services-decks.png"),
  "/services/siding":                  ogImg("services-siding.png"),
  "/services/custom-carpentry":        ogImg("services-custom-carpentry.png"),
  "/services/snow-removal":            ogImg("services-snow-removal.png"),

  // ── Service area hub ────────────────────────────────────────────────────────
  "/service-areas":                    ogImg("service-areas.png"),
  "/service-areas/greater-boston":     ogImg("region-greater-boston.png"),
  "/service-areas/metro-west":         ogImg("region-metro-west.png"),
  "/service-areas/south-shore":        ogImg("region-south-shore.png"),

  // ── Budget / design tools ───────────────────────────────────────────────────
  "/start":            ogImg("design-preview.png"),
  "/budget-estimator": ogImg("budget-estimator.png"),
};

/**
 * Returns the best static OG image for a given pathname, or null if none exists.
 * Strips trailing slashes for consistent matching.
 *
 * @param {string} pathname - e.g. "/services/home-additions"
 * @returns {string|null}
 */
export function getStaticOgImage(pathname) {
  const clean = pathname.replace(/\/$/, "") || "/";
  return STATIC_OG_IMAGES[clean] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// OG IMAGE CHECKLIST
// ─────────────────────────────────────────────────────────────────────────────
// Place all files in /public/og/ (served at /og/* by Vite).
// Recommended tools: Figma, Canva, or Adobe Express (export at exactly 1200×630).
//
// PRIORITY 1 — High traffic / linked from Google:
//   default.png                   ← fallback for any unlisted page
//   home.png                      ← homepage (most shared)
//   services-home-additions.png   ← #1 revenue service
//   services-kitchen-remodeling.png
//   services-decks.png
//   services-siding.png
//   region-greater-boston.png
//
// PRIORITY 2 — Brand & trust pages:
//   about.png
//   contact.png
//   gallery.png
//   blog.png
//   design-preview.png
//
// PRIORITY 3 — Supporting pages:
//   services.png
//   financing.png
//   service-areas.png
//   region-metro-west.png
//   region-south-shore.png
//   services-bathroom-remodeling.png
//   services-custom-carpentry.png
//   services-snow-removal.png
//   budget-estimator.png
// ─────────────────────────────────────────────────────────────────────────────