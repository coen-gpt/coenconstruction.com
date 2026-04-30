/**
 * Canonical URL utilities for Coen Construction
 * ─────────────────────────────────────────────────────────────────────────────
 * Rules enforced:
 *   • Always https
 *   • No www  (coenconstruction.com)
 *   • No trailing slash (except bare "/")
 *   • Lowercase path
 *   • Strip tracking query params (utm_*, fbclid, gclid, ref, source, etc.)
 *   • Keep pagination param (?page=N) — omit on page 1
 */

export const SITE_DOMAIN = "https://www.coenconstruction.com";

/** Query parameters that should never appear in a canonical URL */
const STRIP_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "msclkid", "twclid", "ttclid", "li_fat_id",
  "ref", "source", "affiliate", "campaign", "mc_eid", "mc_cid",
  "_ga", "_gl", "igshid", "s_kwcid",
]);

/**
 * Build a canonical URL.
 *
 * @param {string} pathname     - e.g. "/services/home-additions"
 * @param {object} [options]
 * @param {number} [options.page]    - Pagination: page number (omit or 1 = no param)
 * @param {string} [options.search]  - Raw query string from window.location.search
 *                                     to selectively forward non-tracking params
 * @returns {string} Full canonical URL
 */
export function getCanonicalUrl(pathname, { page, search } = {}) {
  // 1. Normalize path: lowercase, strip trailing slash (keep bare "/")
  let path = (pathname || "/").toLowerCase();
  if (path !== "/" && path.endsWith("/")) path = path.slice(0, -1);

  // 2. Build clean search params — strip tracking, keep allowed params
  const params = new URLSearchParams();

  if (search) {
    const incoming = new URLSearchParams(search);
    for (const [key, value] of incoming.entries()) {
      if (!STRIP_PARAMS.has(key) && key !== "page") {
        params.set(key, value);
      }
    }
  }

  // 3. Add pagination only for page 2+
  if (page && page > 1) params.set("page", String(page));

  const qs = params.toString();
  return `${SITE_DOMAIN}${path}${qs ? `?${qs}` : ""}`;
}

/**
 * Build rel="prev" and rel="next" link hrefs for paginated series.
 * Returns { prev: string|null, next: string|null }
 *
 * @param {string} pathname   - Base path without page param
 * @param {number} currentPage
 * @param {number} totalPages
 */
export function getPaginationLinks(pathname, currentPage, totalPages) {
  return {
    prev: currentPage > 1
      ? getCanonicalUrl(pathname, { page: currentPage - 1 })
      : null,
    next: currentPage < totalPages
      ? getCanonicalUrl(pathname, { page: currentPage + 1 })
      : null,
  };
}