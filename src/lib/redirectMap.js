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

import { REGIONS, slugify } from "@/data/townData";

const TOWN_SLUGS = new Set(REGIONS.flatMap(r => r.towns.map(slugify)));

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
  // NOTE: /terms is a real route (WebTerms) — do not redirect it.
  { from: "/privacy",                    to: "/privacy-policy",                  type: 301 },

  // ── Legacy Duda-era URLs (still indexed by Google/Bing — see 404 log) ────
  { from: "/home",                       to: "/",                                type: 301 },
  { from: "/website",                    to: "/",                                type: 301 },
  { from: "/book-a-consultation",        to: "/contact",                         type: 301 },

  // ── Legacy Base44 PascalCase page routes (normalizePath lowercases) ──────
  { from: "/budgetestimator",            to: "/budget-estimator",                type: 301 },
  { from: "/myprojects",                 to: "/my-projects",                     type: 301 },
  { from: "/estimateapproval",           to: "/estimate-approval",               type: 301 },
  { from: "/startproject",               to: "/start",                           type: 301 },
  { from: "/customerportal",             to: "/customer-portal",                 type: 301 },
  { from: "/bookwalkthrough",            to: "/book-walkthrough",                type: 301 },
];

// ── Legacy service/town URL patterns (old flat Duda URLs) ────────────────────
// The previous website used root-level combos like /general-contractor-newton-ma,
// /brookline-siding, /siding-contractors-everett, /kitchen-remodeling-newton-ma.
// Town-specific URLs go to the matching town page; Boston-wide ones go to the
// service page. Keywords are ordered longest-first so e.g. "siding-contractors"
// wins over "siding".
// [legacy keyword, Boston-wide service page, canonical service slug for town pages]
const SERVICE_KEYWORDS = [
  ["decks--porches--pergolas",  "/services/decks-porches-pergolas", "decks-porches-pergolas"],
  ["decks-porches-pergolas",    "/services/decks-porches-pergolas", "decks-porches-pergolas"],
  ["siding-contractors",        "/services/siding",                 "siding"],
  ["kitchen-remodeling",        "/services/kitchen-remodeling",     "kitchen-remodeling"],
  ["kitchen-remodel",           "/services/kitchen-remodeling",     "kitchen-remodeling"],
  ["bathroom-remodeling",       "/services/bathroom-remodeling",    "bathroom-remodeling"],
  ["bathroom-remodel",          "/services/bathroom-remodeling",    "bathroom-remodeling"],
  ["home-additions",            "/services/home-additions",         "home-additions"],
  ["custom-carpentry",          "/services/custom-carpentry",       "custom-carpentry"],
  ["snow-removal",              "/services/snow-removal",           "snow-removal"],
  ["carpenters",                "/services/custom-carpentry",       "custom-carpentry"],
  ["carpenter",                 "/services/custom-carpentry",       "custom-carpentry"],
  ["pergolas",                  "/services/decks-porches-pergolas", "decks-porches-pergolas"],
  ["siding",                    "/services/siding",                 "siding"],
];

function stripMa(slug) {
  return slug.replace(/-ma$/, "");
}

function legacyPatternRedirect(normalized) {
  const p = normalized.slice(1); // drop leading "/"
  if (!p || p.includes("/")) return null;

  // /general-contractor(s)-<town>(-ma)
  const gc = p.match(/^general-contractors?-(.+)$/);
  if (gc) {
    const town = stripMa(gc[1]);
    if (TOWN_SLUGS.has(town)) return { to: `/service-areas/${town}`, type: 301 };
    if (town === "boston") return { to: "/", type: 301 };
  }

  for (const [kw, servicePath, serviceSlug] of SERVICE_KEYWORDS) {
    if (p === kw) return { to: servicePath, type: 301 };
    // /<keyword>-<town>(-ma)  e.g. /siding-contractors-everett
    if (p.startsWith(kw + "-")) {
      const rest = stripMa(p.slice(kw.length + 1));
      if (TOWN_SLUGS.has(rest)) return { to: `/service-areas/${rest}/${serviceSlug}`, type: 301 };
      if (rest === "boston") return { to: servicePath, type: 301 };
    }
    // /<town>-<keyword>  e.g. /brookline-siding, /boston-pergolas
    if (p.endsWith("-" + kw)) {
      const rest = p.slice(0, -(kw.length + 1));
      if (TOWN_SLUGS.has(rest)) return { to: `/service-areas/${rest}/${serviceSlug}`, type: 301 };
      if (rest === "boston") return { to: servicePath, type: 301 };
    }
  }
  return null;
}

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

  // Legacy Duda-era flat URLs (service/town combos)
  const legacy = legacyPatternRedirect(normalized);
  if (legacy) return legacy;

  // Trailing-slash canonicalization (always 301)
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return { to: pathname.slice(0, -1), type: 301 };
  }

  return null;
}