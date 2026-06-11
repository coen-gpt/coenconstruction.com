/*
 * Minimal service worker — exists only to satisfy Chrome's PWA installability
 * check for the internal apps (/admin, /estimator, /field).
 *
 * Deliberately NO caching: every request goes straight to the network, so
 * deploys are picked up immediately and this worker can never serve stale
 * bundles (see base44 deploy pipeline notes).
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
