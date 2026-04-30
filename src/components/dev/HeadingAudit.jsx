/**
 * HeadingAudit — development-only component that warns about heading hierarchy violations.
 *
 * Checks:
 *   • More than one <h1> on the page
 *   • Skipped heading levels (e.g. H1 → H3 with no H2 between)
 *
 * Renders nothing in production. Drop it once anywhere in the app tree, e.g. in App.jsx
 * inside a {import.meta.env.DEV && <HeadingAudit />} guard.
 *
 * Usage in App.jsx:
 *   import HeadingAudit from "@/components/dev/HeadingAudit";
 *   // inside AuthenticatedApp, after <Routes>:
 *   {import.meta.env.DEV && <HeadingAudit />}
 */

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

function audit() {
  const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  const violations = [];

  // 1. Multiple H1s
  const h1s = headings.filter(h => h.tagName === "H1");
  if (h1s.length > 1) {
    violations.push({
      type: "multiple-h1",
      message: `${h1s.length} <h1> elements found on this page. There should be exactly one.`,
      elements: h1s.map(h => h.textContent?.trim().slice(0, 60)),
    });
  }
  if (h1s.length === 0) {
    violations.push({ type: "no-h1", message: "No <h1> found on this page.", elements: [] });
  }

  // 2. Skipped levels
  const levels = headings.map(h => parseInt(h.tagName[1]));
  for (let i = 1; i < levels.length; i++) {
    const diff = levels[i] - levels[i - 1];
    if (diff > 1) {
      violations.push({
        type: "skipped-level",
        message: `Heading level skipped: <h${levels[i - 1]}> → <h${levels[i]}> (skipped h${levels[i - 1] + 1})`,
        elements: [
          headings[i - 1].textContent?.trim().slice(0, 60),
          headings[i].textContent?.trim().slice(0, 60),
        ],
      });
    }
  }

  return violations;
}

export default function HeadingAudit() {
  const location = useLocation();
  const [violations, setViolations] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Wait for React to finish rendering
    const timer = setTimeout(() => {
      const v = audit();
      setViolations(v);
      if (v.length > 0) {
        console.groupCollapsed(`[HeadingAudit] ${v.length} violation(s) on ${location.pathname}`);
        v.forEach(viol => console.warn(viol.message, viol.elements));
        console.groupEnd();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (!import.meta.env.DEV || violations.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        left: "16px",
        zIndex: 9999,
        fontFamily: "monospace",
        fontSize: "12px",
        maxWidth: "400px",
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: "#f59e0b",
          color: "#000",
          border: "none",
          padding: "6px 12px",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: "bold",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        ⚠ Heading issues ({violations.length})
      </button>

      {open && (
        <div style={{
          marginTop: "6px",
          background: "#1e1e1e",
          color: "#f8f8f2",
          border: "2px solid #f59e0b",
          borderRadius: "8px",
          padding: "12px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontWeight: "bold", marginBottom: "8px", color: "#f59e0b" }}>
            Heading Audit — {location.pathname}
          </div>
          {violations.map((v, i) => (
            <div key={i} style={{ marginBottom: "10px", borderTop: i > 0 ? "1px solid #333" : "none", paddingTop: i > 0 ? "8px" : 0 }}>
              <div style={{ color: "#ff6b6b", marginBottom: "4px" }}>✗ {v.message}</div>
              {v.elements.length > 0 && (
                <ul style={{ margin: "0 0 0 12px", padding: 0, color: "#ccc" }}>
                  {v.elements.map((el, j) => <li key={j}>"{el}"</li>)}
                </ul>
              )}
            </div>
          ))}
          <div style={{ marginTop: "8px", color: "#666", fontSize: "10px" }}>
            Dev-only — not visible in production
          </div>
        </div>
      )}
    </div>
  );
}