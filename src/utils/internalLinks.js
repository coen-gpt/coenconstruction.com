// Maps keywords to internal site URLs
// Longer/more specific phrases must come first to avoid partial matches
export const INTERNAL_LINKS = [
  { keyword: "home additions in boston", url: "/services/home-additions" },
  { keyword: "home addition boston", url: "/services/home-additions" },
  { keyword: "home additions boston", url: "/services/home-additions" },
  { keyword: "home additions", url: "/services/home-additions" },
  { keyword: "home addition", url: "/services/home-additions" },
  { keyword: "second story addition", url: "/services/home-additions" },
  { keyword: "second-story addition", url: "/services/home-additions" },
  { keyword: "decks, porches & pergolas", url: "/services/decks-porches-pergolas" },
  { keyword: "decks and pergolas", url: "/services/decks-porches-pergolas" },
  { keyword: "deck construction", url: "/services/decks-porches-pergolas" },
  { keyword: "pergola", url: "/services/decks-porches-pergolas" },
  { keyword: "custom deck", url: "/services/decks-porches-pergolas" },
  { keyword: "deck installation", url: "/services/decks-porches-pergolas" },
  { keyword: "kitchen remodeling boston", url: "/services/kitchen-remodeling" },
  { keyword: "kitchen remodel boston", url: "/services/kitchen-remodeling" },
  { keyword: "kitchen remodeling", url: "/services/kitchen-remodeling" },
  { keyword: "kitchen remodel", url: "/services/kitchen-remodeling" },
  { keyword: "bathroom remodeling", url: "/services/bathroom-remodeling" },
  { keyword: "bathroom remodel", url: "/services/bathroom-remodeling" },
  { keyword: "siding contractors boston", url: "/services/siding" },
  { keyword: "siding installation", url: "/services/siding" },
  { keyword: "fiber cement siding", url: "/services/siding" },
  { keyword: "james hardie", url: "/services/siding" },
  { keyword: "vinyl siding", url: "/services/siding" },
  { keyword: "custom carpentry", url: "/services/custom-carpentry" },
  { keyword: "finish carpentry", url: "/services/custom-carpentry" },
  { keyword: "bespoke woodworking", url: "/services/custom-carpentry" },
  { keyword: "snow removal boston", url: "/services/snow-removal" },
  { keyword: "snow removal", url: "/services/snow-removal" },
  { keyword: "free design preview", url: "/start" },
  { keyword: "ai design preview", url: "/start" },
  { keyword: "design preview tool", url: "/start" },
  { keyword: "free estimate", url: "/contact" },
  { keyword: "free consultation", url: "/contact" },
  { keyword: "contact us", url: "/contact" },
  { keyword: "contact coen construction", url: "/contact" },
  { keyword: "service areas", url: "/service-areas" },
  { keyword: "greater boston", url: "/service-areas" },
  { keyword: "coen construction", url: "/about" },
  { keyword: "our portfolio", url: "/gallery" },
  { keyword: "project gallery", url: "/gallery" },
  { keyword: "financing options", url: "/financing" },
  { keyword: "renovation loan", url: "/financing" },
];

/**
 * Injects internal hyperlinks into a plain text paragraph.
 * Each keyword is replaced at most once per paragraph.
 * Returns an array of React-renderable parts (strings + <a> elements).
 */
export function injectLinks(text, linkComponent) {
  let remaining = text;
  const parts = [];
  const used = new Set();

  // Try to find and replace keywords (case-insensitive, first occurrence only per paragraph)
  for (const { keyword, url } of INTERNAL_LINKS) {
    if (used.has(url)) continue; // only one link per destination per paragraph
    const idx = remaining.toLowerCase().indexOf(keyword.toLowerCase());
    if (idx === -1) continue;

    // Text before keyword
    if (idx > 0) parts.push(remaining.slice(0, idx));
    // The matched keyword text (preserve original casing)
    const matched = remaining.slice(idx, idx + keyword.length);
    parts.push({ text: matched, url });
    remaining = remaining.slice(idx + keyword.length);
    used.add(url);
  }

  if (remaining) parts.push(remaining);
  return parts;
}