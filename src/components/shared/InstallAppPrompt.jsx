import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

/*
 * PWA install prompt for the internal apps. Mounted on the employee login
 * screen, which serves /admin, /estimator, and /field — the surface is
 * derived from the URL so Android installs the right "app" (name, icon,
 * start_url come from the per-surface manifest in /public).
 *
 * Android/Chrome: captures beforeinstallprompt and triggers the native
 * install sheet. iOS Safari has no install API, so we show the
 * Share → Add to Home Screen steps instead.
 */

const SURFACES = {
  field: { label: "Coen Field", manifest: "/manifest-field.json" },
  estimator: { label: "Coen Estimator", manifest: "/manifest-estimator.json" },
  admin: { label: "Coen Admin", manifest: "/manifest-admin.json" },
};

function detectSurface() {
  const path = window.location.pathname;
  if (path.startsWith("/field")) return "field";
  if (path.startsWith("/estimator")) return "estimator";
  return "admin";
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports as Mac but has touch
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isMobile() {
  return isIos() || /Android/i.test(navigator.userAgent);
}

export default function InstallAppPrompt() {
  const [surface] = useState(detectSurface);
  const [installEvent, setInstallEvent] = useState(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(`pwa-install-dismissed-${detectSurface()}`) === "1"
  );

  const { label, manifest } = SURFACES[surface];

  // Point the page at this surface's manifest and register the (no-cache)
  // service worker Chrome requires for installability. The public marketing
  // site never mounts this component, so it stays uninstallable.
  useEffect(() => {
    if (!isMobile() || isStandalone()) return;

    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = manifest;

    // Older iOS ignores the manifest and reads these meta tags instead.
    for (const [name, content] of [
      ["apple-mobile-web-app-capable", "yes"],
      ["mobile-web-app-capable", "yes"],
      ["apple-mobile-web-app-title", label],
      ["apple-mobile-web-app-status-bar-style", "black-translucent"],
    ]) {
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = name;
        document.head.appendChild(meta);
      }
      meta.content = content;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onPrompt = (e) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [manifest, label]);

  if (!isMobile() || isStandalone() || dismissed) return null;

  const ios = isIos();
  // On Android, wait for the browser to confirm installability (and hide
  // entirely if it never does — e.g. already installed).
  if (!ios && !installEvent) return null;

  const dismiss = () => {
    localStorage.setItem(`pwa-install-dismissed-${surface}`, "1");
    setDismissed(true);
  };

  const install = async () => {
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setDismissed(true);
    setInstallEvent(null);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div
        className="max-w-md mx-auto rounded-2xl shadow-2xl p-4 text-white"
        style={{ background: "#1B2B3A", border: "1px solid rgba(255,255,255,0.12)" }}
      >
        <div className="flex items-start gap-3">
          <img
            src="/icons/app-192.png"
            alt=""
            className="w-12 h-12 rounded-xl flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Install {label}</p>
            {ios ? (
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Tap <Share className="w-3.5 h-3.5 inline -mt-0.5" aria-label="Share" /> Share,
                then <SquarePlus className="w-3.5 h-3.5 inline -mt-0.5" aria-label="Add" />{" "}
                <span className="font-semibold">Add to Home Screen</span> for one-tap access.
              </p>
            ) : (
              <p className="text-xs text-slate-300 mt-1">
                Add it to your home screen for one-tap access.
              </p>
            )}
            {!ios && (
              <button
                onClick={install}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "#E35235" }}
              >
                <Download className="w-4 h-4" />
                Install App
              </button>
            )}
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="text-slate-400 hover:text-white p-1 -m-1 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
