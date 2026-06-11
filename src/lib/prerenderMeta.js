/**
 * prerenderMeta — status-code hints for the prerender service (hadoSEO).
 *
 * Prerendered SPAs always return HTTP 200, so search engines see soft-404s
 * and JS redirects as plain pages. Prerender services (Prerender.io
 * convention, followed by compatible services) read these meta tags from
 * the rendered snapshot and replay them as real HTTP responses:
 *
 *   <meta name="prerender-status-code" content="301">
 *   <meta name="prerender-header" content="Location: https://...">
 */

function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function removeMeta(name) {
  document.querySelector(`meta[name="${name}"]`)?.remove();
}

/** Mark the current snapshot as a 301 redirect to `toPath` (site-relative). */
export function setPrerender301(toPath) {
  setMeta("prerender-status-code", "301");
  setMeta("prerender-header", `Location: https://coenconstruction.com${toPath}`);
}

/** Mark the current snapshot as a 404. */
export function setPrerender404() {
  setMeta("prerender-status-code", "404");
  removeMeta("prerender-header");
}

/** Clear any prerender status hints (call on normal pages / route change). */
export function clearPrerenderStatus() {
  removeMeta("prerender-status-code");
  removeMeta("prerender-header");
}
