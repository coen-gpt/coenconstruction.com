/**
 * lib/redirectMap.js — Centralized URL redirect management system
 *
 * Types:
 *   301 = Permanent (passes full SEO value to new URL)
 *   302 = Temporary (retains SEO value at old URL)
 *
 * To add a redirect:
 *   1. Add an entry to REDIRECTS below.
 *   2. The RedirectHandler component in App.jsx picks it up automatically.
 *
 * URL canonicalization rules (applied first, before redirect map):
 *   - Trailing slash removal  → /about/ → /about
 *   - www → non-www (handled at CDN/host level; documented here for reference)
 *   - HTTP → HTTPS (handled at CDN/host level)
 */

export const REDIRECTS = [
  // ── Service page renames ─────────────────────────────────────────────────
  { from: "/services/decks",             to: "/services/decks-porches-pergolas", type: 301 },
  { from: "/services/deck",              to: "/services/decks-porches-pergolas", type: 301 },
  { from: "/services/pergolas",          to: "/services/decks-porches-pergolas", type: 301 },
  { from: "/services/porches",           to: "/services/decks-porches-pergolas", type: 301 },
  { from: "/services/kitchens",          to: "/services/kitchen-remodeling",     type: 301 },
  { from: "/services/kitchen",           to: "/services/kitchen-remodeling",     type: 301 },
  { from: "/services/bathrooms",         to: "/services/bathroom-remodeling",    type: 301 },
  { from: "/services/bathroom",          to: "/services/bathroom-remodeling",    type: 301 },
  { from: "/services/additions",         to: "/services/home-additions",         type: 301 },
  { from: "/services/home-addition",     to: "/services/home-additions",         type: 301 },
  { from: "/services/carpentry",         to: "/services/custom-carpentry",       type: 301 },
  { from: "/services/snow",              to: "/services/snow-removal",           type: 301 },
  { from: "/services/siding-installation", to: "/services/siding",              type: 301 },

  // ── Old blog paths ───────────────────────────────────────────────────────
  { from: "/blog/index",                 to: "/blog",                            type: 301 },
  { from: "/news",                       to: "/blog",                            type: 301 },
  { from: "/articles",                   to: "/blog",                            type: 301 },

  // ── Old contact/lead paths ───────────────────────────────────────────────
  { from: "/get-a-quote",                to: "/contact",                         type: 301 },
  { from: "/free-estimate",              to: "/contact",                         type: 301 },
  { from: "/request-estimate",           to: "/contact",                         type: 301 },
  { from: "/quote",                      to: "/contact",                         type: 301 },
  { from: "/estimate",                   to: "/contact",                         type: 301 },

  // ── Old about/company paths ──────────────────────────────────────────────
  { from: "/about-us",                   to: "/about",                           type: 301 },
  { from: "/company",                    to: "/about",                           type: 301 },
  { from: "/team",                       to: "/about",                           type: 301 },

  // ── Old service area paths ───────────────────────────────────────────────
  { from: "/areas",                      to: "/service-areas",                   type: 301 },
  { from: "/locations",                  to: "/service-areas",                   type: 301 },
  { from: "/coverage",                   to: "/service-areas",                   type: 301 },

  // ── Gallery ──────────────────────────────────────────────────────────────
  { from: "/photos",                     to: "/gallery",                         type: 301 },
  { from: "/portfolio",                  to: "/gallery",                         type: 301 },
  { from: "/projects",                   to: "/gallery",                         type: 301 },

  // ── Design preview ───────────────────────────────────────────────────────
  { from: "/design",                     to: "/start",                           type: 301 },
  { from: "/design-preview",             to: "/start",                           type: 301 },
  { from: "/ai-design",                  to: "/start",                           type: 301 },

  // ── Financing ────────────────────────────────────────────────────────────
  { from: "/finance",                    to: "/financing",                       type: 301 },
  { from: "/payment-options",            to: "/financing",                       type: 301 },

  // ── Privacy / legal ─────────────────────────────────────────────────────
  { from: "/privacy",                    to: "/privacy-policy",                  type: 301 },
  { from: "/terms",                      to: "/privacy-policy",                  type: 301 },
];

/**
 * Normalize a path for comparison:
 *   - lowercase
 *   - remove trailing slash (except root "/")
 */
export function normalizePath(path) {
  const lower = path.toLowerCase();
  return lower.length > 1 && lower.endsWith("/") ? lower.slice(0, -1) : lower;
}

/**
 * Look up a redirect for the given pathname.
 * Returns { to, type } or null if no redirect found.
 */
export function findRedirect(pathname) {
  const normalized = normalizePath(pathname);

  // Exact match first
  const exact = REDIRECTS.find(r => normalizePath(r.from) === normalized);
  if (exact) return { to: exact.to, type: exact.type };

  // Trailing-slash canonicalization (always 301)
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return { to: pathname.slice(0, -1), type: 301 };
  }

  return null;
}