/**
 * Dynamic Open Graph image generator
 * GET /api/functions/ogImage?title=...&description=...&type=article|default&date=...&category=...
 *
 * Returns a 1200×630 SVG (served as image/svg+xml).
 * Compatible with all OG scrapers (Facebook, Twitter/X, LinkedIn, Slack, etc.).
 * In-process cache keyed by query string (1-hour TTL).
 */

// ─── Brand tokens ────────────────────────────────────────────────────────────
const NAVY     = "#1B2B3A";
const RED      = "#E35235";
const RED_DARK = "#C04528";
const WHITE    = "#FFFFFF";
const GRAY     = "#94A3B8";
const SITE_NAME = "Coen Construction";
const SITE_URL  = "coenconstruction.com";
const TAGLINE   = "Greater Boston General Contractor";

// ─── In-process cache ────────────────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ─── Helpers ─────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(str, max) {
  const s = String(str || "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** Naive word-wrap: splits text into lines of ~maxChars each */
function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line.trim());
  return lines;
}

// ─── Templates ───────────────────────────────────────────────────────────────

function blogTemplate({ title, description, date, category }) {
  const t = truncate(title, 80);
  const d = truncate(description, 130);

  const titleLines = wrapText(t, 38);
  const titleFontSize = titleLines.length > 3 ? 52 : titleLines.length > 2 ? 58 : 66;
  const titleLineH = titleFontSize * 1.18;

  const descLines = d ? wrapText(d, 62) : [];

  let titleY = 200;
  const titleSvg = titleLines.map((line, i) =>
    `<text x="80" y="${titleY + i * titleLineH}" font-size="${titleFontSize}" font-weight="800" fill="${WHITE}" font-family="system-ui, -apple-system, sans-serif">${esc(line)}</text>`
  ).join("\n    ");

  const afterTitle = titleY + titleLines.length * titleLineH + 24;
  const descSvg = descLines.slice(0, 2).map((line, i) =>
    `<text x="80" y="${afterTitle + i * 38}" font-size="28" fill="${GRAY}" font-family="system-ui, -apple-system, sans-serif">${esc(line)}</text>`
  ).join("\n    ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${NAVY}"/>
      <stop offset="100%" stop-color="#0F1C28"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Decorative circles -->
  <circle cx="1100" cy="80" r="200" fill="${RED}" fill-opacity="0.06"/>
  <circle cx="1050" cy="550" r="120" fill="${RED}" fill-opacity="0.04"/>

  <!-- Left red accent bar -->
  <rect x="0" y="80" width="8" height="200" rx="4" fill="${RED}"/>

  <!-- Category badge -->
  ${category ? `<rect x="80" y="100" width="${Math.min(category.length * 14 + 40, 360)}" height="44" rx="6" fill="${RED}"/>
  <text x="100" y="130" font-size="22" font-weight="700" fill="${WHITE}" font-family="system-ui, -apple-system, sans-serif">${esc(truncate(category, 24))}</text>` : ""}

  <!-- Date -->
  ${date ? `<text x="${category ? Math.min(category.length * 14 + 140, 460) : 80}" y="128" font-size="22" fill="${GRAY}" font-family="system-ui, -apple-system, sans-serif">${esc(date)}</text>` : ""}

  <!-- Title -->
  ${titleSvg}

  <!-- Description -->
  ${descSvg}

  <!-- Footer divider -->
  <line x1="80" y1="572" x2="1120" y2="572" stroke="${RED}" stroke-width="2" opacity="0.6"/>

  <!-- Footer: site name -->
  <text x="80" y="608" font-size="26" font-weight="700" fill="${WHITE}" font-family="system-ui, -apple-system, sans-serif">${esc(SITE_NAME)}</text>

  <!-- Footer: URL -->
  <text x="1120" y="608" font-size="22" fill="${GRAY}" text-anchor="end" font-family="system-ui, -apple-system, sans-serif">${esc(SITE_URL)}</text>
</svg>`;
}

function defaultTemplate({ title, description }) {
  const t = truncate(title, 60);
  const d = truncate(description, 130);

  const titleLines = wrapText(t, 34);
  const titleFontSize = titleLines.length > 2 ? 60 : 72;
  const titleLineH = titleFontSize * 1.18;

  const descLines = d ? wrapText(d, 62) : [];

  let titleY = 230;
  const titleSvg = titleLines.map((line, i) =>
    `<text x="112" y="${titleY + i * titleLineH}" font-size="${titleFontSize}" font-weight="800" fill="${WHITE}" font-family="system-ui, -apple-system, sans-serif">${esc(line)}</text>`
  ).join("\n    ");

  const afterTitle = titleY + titleLines.length * titleLineH + 24;
  const descSvg = descLines.slice(0, 2).map((line, i) =>
    `<text x="112" y="${afterTitle + i * 38}" font-size="28" fill="${GRAY}" font-family="system-ui, -apple-system, sans-serif">${esc(line)}</text>`
  ).join("\n    ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${NAVY}"/>
      <stop offset="100%" stop-color="#0F1C28"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Decorative shape top-right -->
  <circle cx="1150" cy="-50" r="280" fill="${RED}" fill-opacity="0.07"/>
  <circle cx="900"  cy="600" r="180" fill="${RED}" fill-opacity="0.04"/>

  <!-- Left red accent bar -->
  <rect x="0" y="120" width="12" height="260" rx="6" fill="${RED}"/>

  <!-- Top label -->
  <text x="112" y="170" font-size="22" font-weight="600" fill="${RED}" letter-spacing="4" font-family="system-ui, -apple-system, sans-serif">${esc(TAGLINE.toUpperCase())}</text>

  <!-- Title -->
  ${titleSvg}

  <!-- Description -->
  ${descSvg}

  <!-- Footer divider -->
  <line x1="80" y1="572" x2="1120" y2="572" stroke="${RED}" stroke-width="2" opacity="0.6"/>

  <!-- Footer: site name -->
  <text x="80" y="608" font-size="26" font-weight="700" fill="${WHITE}" font-family="system-ui, -apple-system, sans-serif">${esc(SITE_NAME)}</text>

  <!-- CTA pill -->
  <rect x="840" y="582" width="280" height="42" rx="21" fill="${RED}"/>
  <text x="980" y="609" font-size="19" font-weight="600" fill="${WHITE}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">Free Estimates · (617) 857-COEN</text>
</svg>`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const url = new URL(req.url);
  const cacheKey = url.search;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    return new Response(cached.svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600, immutable",
        "X-Cache": "HIT",
      },
    });
  }

  const title       = url.searchParams.get("title")       || SITE_NAME;
  const description = url.searchParams.get("description") || "Greater Boston's trusted general contractor since 2010. Home additions, decks, siding & more.";
  const type        = url.searchParams.get("type")        || "default";
  const date        = url.searchParams.get("date")        || "";
  const category    = url.searchParams.get("category")    || "";

  const svg = type === "article"
    ? blogTemplate({ title, description, date, category })
    : defaultTemplate({ title, description });

  cache.set(cacheKey, { svg, expires: Date.now() + CACHE_TTL });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, immutable",
      "X-Cache": "MISS",
    },
  });
});