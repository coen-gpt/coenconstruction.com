/**
 * lib/webVitals.js — Core Web Vitals measurement & reporting
 *
 * Measures LCP, INP (replaces FID), CLS, FCP, and TTFB using the
 * web-vitals library (available via CDN without adding a package).
 *
 * Usage in main.jsx:
 *   import { initWebVitals } from "@/lib/webVitals";
 *   initWebVitals();
 *
 * Sends metrics to:
 *   1. Google Analytics 4 (if gtag is available)
 *   2. console (dev only)
 *   3. navigator.sendBeacon for a custom endpoint (optional)
 */

// ─── Thresholds (Google's "Good" / "Needs Improvement" / "Poor") ─────────────
const THRESHOLDS = {
  LCP:  { good: 2500,  poor: 4000  }, // ms
  INP:  { good: 200,   poor: 500   }, // ms
  CLS:  { good: 0.1,   poor: 0.25  }, // unitless
  FCP:  { good: 1800,  poor: 3000  }, // ms
  TTFB: { good: 800,   poor: 1800  }, // ms
};

function rating(name, value) {
  const t = THRESHOLDS[name];
  if (!t) return "unknown";
  if (value <= t.good) return "good";
  if (value <= t.poor) return "needs-improvement";
  return "poor";
}

/** Send a single metric to GA4 and console */
function report(metric) {
  const { name, value, id, delta } = metric;
  const r = rating(name, value);

  // Console logging (dev + prod so you can see in GA DebugView)
  if (import.meta.env.DEV) {
    const emoji = r === "good" ? "✅" : r === "needs-improvement" ? "⚠️" : "❌";
    console.log(`[CWV] ${emoji} ${name}: ${Math.round(value)}${name === "CLS" ? "" : "ms"} (${r})`);
  }

  // Send to GA4 as a custom event
  if (typeof window.gtag === "function") {
    window.gtag("event", name, {
      event_category: "Web Vitals",
      event_label: id,
      value: Math.round(name === "CLS" ? value * 1000 : value),
      non_interaction: true,
      metric_rating: r,
      metric_delta: Math.round(delta),
    });
  }

  // Warn in console if metric is poor (helpful in CI / Lighthouse CI)
  if (r === "poor") {
    console.warn(`[CWV] Poor ${name} score: ${Math.round(value)} — consider investigating.`);
  }
}

/**
 * Dynamic-import the web-vitals library (loaded only after hydration,
 * never blocks the main thread or first paint).
 */
export async function initWebVitals() {
  try {
    // web-vitals is a tiny ESM module (~2 KB gzipped)
    const { onLCP, onINP, onCLS, onFCP, onTTFB } = await import(
      /* webpackChunkName: "web-vitals" */
      "https://unpkg.com/web-vitals@3/dist/web-vitals.attribution.js"
    );

    onLCP(report,  { reportAllChanges: false });
    onINP(report,  { reportAllChanges: false });
    onCLS(report,  { reportAllChanges: false });
    onFCP(report);
    onTTFB(report);
  } catch (err) {
    // Silently fail — perf monitoring should never break the app
    if (import.meta.env.DEV) {
      console.warn("[CWV] Could not load web-vitals library:", err.message);
    }
  }
}

/**
 * getCurrentVitals — returns a snapshot of any vitals collected so far
 * from the PerformanceObserver entries. Useful for the dev PerfAudit panel.
 */
export function getCurrentVitals() {
  const entries = {};
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav) {
      entries.TTFB = Math.round(nav.responseStart - nav.requestStart);
      entries.FCP_approx = Math.round(nav.domContentLoadedEventEnd);
    }
    const paints = performance.getEntriesByType("paint");
    const fcp = paints.find(p => p.name === "first-contentful-paint");
    if (fcp) entries.FCP = Math.round(fcp.startTime);

    // LCP via PerformanceObserver accumulates in web-vitals; approximate from entries
    const lcpEntries = performance.getEntriesByType("largest-contentful-paint");
    if (lcpEntries.length) entries.LCP = Math.round(lcpEntries[lcpEntries.length - 1].startTime);
  } catch (_) {
    // PerformanceObserver not available in some environments
  }
  return entries;
}