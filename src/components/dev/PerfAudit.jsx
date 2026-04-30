/**
 * PerfAudit — dev-only Core Web Vitals & performance checklist panel.
 *
 * Shows a floating button in the bottom-right corner (DEV mode only).
 * Click to expand a checklist of CWV best practices and live metric readings.
 *
 * Drop anywhere in App.jsx inside an {import.meta.env.DEV && <PerfAudit />} guard.
 */

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getCurrentVitals } from "@/lib/webVitals";

// ─── Static checklist items ──────────────────────────────────────────────────
function runChecks() {
  const results = [];

  // 1. LCP image has fetchpriority=high
  const heroImgs = document.querySelectorAll('section img, [class*="hero"] img');
  const hasFetchPriority = Array.from(heroImgs).some(
    img => img.getAttribute("fetchpriority") === "high" || img.getAttribute("loading") === "eager"
  );
  results.push({
    label: "LCP image has fetchpriority=high or loading=eager",
    pass: hasFetchPriority || heroImgs.length === 0,
  });

  // 2. All non-hero images have loading=lazy
  const allImgs = document.querySelectorAll("img");
  const lazyCount = Array.from(allImgs).filter(img =>
    img.getAttribute("loading") === "lazy" || img.getAttribute("fetchpriority") === "high"
  ).length;
  results.push({
    label: `Images lazy-loaded (${lazyCount}/${allImgs.length} have loading attr)`,
    pass: allImgs.length === 0 || lazyCount / allImgs.length > 0.8,
  });

  // 3. Images have explicit width + height (prevents CLS)
  const imgsWithDims = Array.from(allImgs).filter(
    img => img.getAttribute("width") && img.getAttribute("height")
  );
  results.push({
    label: `Images have explicit width+height (${imgsWithDims.length}/${allImgs.length})`,
    pass: allImgs.length === 0 || imgsWithDims.length / allImgs.length > 0.7,
  });

  // 4. Images have non-empty alt text
  const imgsWithAlt = Array.from(allImgs).filter(img => img.alt && img.alt.trim().length > 0);
  results.push({
    label: `Images have alt text (${imgsWithAlt.length}/${allImgs.length})`,
    pass: allImgs.length === 0 || imgsWithAlt.length / allImgs.length > 0.9,
  });

  // 5. preconnect hints present
  const preconnects = document.querySelectorAll('link[rel="preconnect"]');
  results.push({
    label: `Preconnect hints present (${preconnects.length} found)`,
    pass: preconnects.length >= 2,
  });

  // 6. Font preload hints present
  const fontPreloads = document.querySelectorAll('link[rel="preload"][as="font"]');
  results.push({
    label: `Critical fonts preloaded (${fontPreloads.length} found)`,
    pass: fontPreloads.length >= 1,
  });

  // 7. No render-blocking scripts (no sync scripts in <head> without defer/async)
  const headScripts = document.querySelectorAll("head script[src]:not([async]):not([defer]):not([type='module'])");
  results.push({
    label: `No render-blocking scripts in <head> (${headScripts.length} found)`,
    pass: headScripts.length === 0,
  });

  // 8. Single H1
  const h1s = document.querySelectorAll("h1");
  results.push({
    label: `Single H1 on page (found ${h1s.length})`,
    pass: h1s.length === 1,
  });

  // 9. Canonical tag present
  const canonical = document.querySelector('link[rel="canonical"]');
  results.push({
    label: "Canonical link tag present",
    pass: !!canonical,
  });

  // 10. Meta description present & not too long
  const metaDesc = document.querySelector('meta[name="description"]');
  const descLen = metaDesc?.content?.length ?? 0;
  results.push({
    label: `Meta description present & ≤160 chars (${descLen} chars)`,
    pass: !!metaDesc && descLen > 0 && descLen <= 160,
  });

  return results;
}

function RatingBadge({ value, unit = "ms", thresholds }) {
  if (value == null) return <span style={{ color: "#666" }}>—</span>;
  const { good, poor } = thresholds;
  const color = value <= good ? "#22c55e" : value <= poor ? "#f59e0b" : "#ef4444";
  return (
    <span style={{ color, fontWeight: "bold" }}>
      {Math.round(value)}{unit}
    </span>
  );
}

const VITAL_THRESHOLDS = {
  LCP:  { good: 2500, poor: 4000 },
  FCP:  { good: 1800, poor: 3000 },
  TTFB: { good: 800,  poor: 1800 },
};

export default function PerfAudit() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState([]);
  const [vitals, setVitals] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setChecks(runChecks());
      setVitals(getCurrentVitals());
    }, 800);
    return () => clearTimeout(timer);
  }, [location.pathname, open]);

  if (!import.meta.env.DEV) return null;

  const failCount = checks.filter(c => !c.pass).length;

  return (
    <div style={{ position: "fixed", bottom: "16px", right: "16px", zIndex: 9998, fontFamily: "monospace", fontSize: "12px", maxWidth: "420px" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: failCount === 0 ? "#22c55e" : failCount <= 3 ? "#f59e0b" : "#ef4444",
          color: "#000",
          border: "none",
          padding: "6px 12px",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: "bold",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        ⚡ Perf ({failCount > 0 ? `${failCount} issues` : "all good"})
      </button>

      {open && (
        <div style={{
          marginTop: "6px",
          background: "#1e1e1e",
          color: "#f8f8f2",
          border: `2px solid ${failCount === 0 ? "#22c55e" : "#f59e0b"}`,
          borderRadius: "8px",
          padding: "14px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          maxHeight: "70vh",
          overflowY: "auto",
        }}>
          {/* Live CWV readings */}
          <div style={{ fontWeight: "bold", color: "#60a5fa", marginBottom: "10px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>
            Core Web Vitals — {location.pathname}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "14px" }}>
            {Object.entries(VITAL_THRESHOLDS).map(([name, t]) => (
              <div key={name} style={{ background: "#2d2d2d", borderRadius: "6px", padding: "8px", textAlign: "center" }}>
                <div style={{ color: "#aaa", fontSize: "10px", marginBottom: "4px" }}>{name}</div>
                <RatingBadge value={vitals[name]} thresholds={t} unit={name === "CLS" ? "" : "ms"} />
              </div>
            ))}
          </div>

          {/* Checklist */}
          <div style={{ fontWeight: "bold", color: "#60a5fa", marginBottom: "8px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>
            Checklist ({checks.filter(c => c.pass).length}/{checks.length} pass)
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", space: "4px" }}>
            {checks.map((c, i) => (
              <li key={i} style={{ padding: "4px 0", borderBottom: "1px solid #333", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <span style={{ color: c.pass ? "#22c55e" : "#ef4444", flexShrink: 0 }}>{c.pass ? "✓" : "✗"}</span>
                <span style={{ color: c.pass ? "#ccc" : "#fca5a5" }}>{c.label}</span>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: "10px", color: "#555", fontSize: "10px" }}>
            Dev-only — not visible in production · Refresh metrics after page settles
          </div>
        </div>
      )}
    </div>
  );
}