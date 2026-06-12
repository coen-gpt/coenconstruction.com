import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { getPublicConfig } from "@/lib/publicConfig";

const SCRIPT_ID = "cf-turnstile-script";
let scriptPromise = null;

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const finish = () => {
      const poll = setInterval(() => {
        if (window.turnstile) {
          clearInterval(poll);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(poll);
        window.turnstile ? resolve() : reject(new Error("Turnstile failed to initialize"));
      }, 10000);
    };
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      finish();
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = finish;
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile script failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile bot protection.
 *
 * - Calls onVerify(token) when the challenge passes; onExpire() when the
 *   token expires or is reset.
 * - Site key comes from VITE_TURNSTILE_SITE_KEY or the publicConfig backend
 *   function (TURNSTILE_SITE_KEY app secret).
 * - If no site key is configured (or the script is blocked), it degrades to
 *   the legacy "I'm not a robot" checkbox so forms are never bricked —
 *   onVerify receives the sentinel "turnstile-not-configured".
 * - Bump `resetSignal` (any changing number) to force a fresh challenge,
 *   e.g. after a failed login attempt.
 */
export default function TurnstileWidget({
  onVerify,
  onExpire,
  theme = "light",
  resetSignal = 0,
  className = "",
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const callbacksRef = useRef({ onVerify, onExpire });
  callbacksRef.current = { onVerify, onExpire };
  const [mode, setMode] = useState("loading"); // loading | widget | fallback
  const [fallbackChecked, setFallbackChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
      if (!siteKey) siteKey = (await getPublicConfig()).turnstile_site_key;
      if (cancelled) return;
      if (!siteKey) {
        setMode("fallback");
        return;
      }
      try {
        await loadTurnstileScript();
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          size: "flexible",
          callback: (token) => callbacksRef.current.onVerify?.(token),
          "expired-callback": () => callbacksRef.current.onExpire?.(),
          "error-callback": () => callbacksRef.current.onExpire?.(),
        });
        setMode("widget");
      } catch {
        if (!cancelled) setMode("fallback");
      }
    })();
    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* widget already gone */
        }
        widgetIdRef.current = null;
      }
    };
  }, [theme]);

  useEffect(() => {
    if (!resetSignal) return;
    if (widgetIdRef.current !== null && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        /* ignore */
      }
    }
    setFallbackChecked(false);
    callbacksRef.current.onExpire?.();
  }, [resetSignal]);

  if (mode === "fallback") {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50 ${className}`}>
        <input
          type="checkbox"
          checked={fallbackChecked}
          onChange={(e) => {
            setFallbackChecked(e.target.checked);
            if (e.target.checked) {
              callbacksRef.current.onVerify?.("turnstile-not-configured");
            } else {
              callbacksRef.current.onExpire?.();
            }
          }}
          className="w-5 h-5 accent-orange-500 cursor-pointer shrink-0"
          id="turnstile-fallback-check"
        />
        <label htmlFor="turnstile-fallback-check" className="text-sm text-gray-700 cursor-pointer select-none flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-gray-400" /> I'm not a robot
        </label>
      </div>
    );
  }

  const chipClasses =
    theme === "dark"
      ? "rounded-lg border border-white/10 bg-white/5"
      : "rounded-lg border border-gray-200 bg-gray-50";

  return (
    <div className={className}>
      <div className={`${mode === "widget" ? chipClasses : ""} overflow-hidden`}>
        <div ref={containerRef} />
      </div>
      {mode === "loading" && (
        <div className={`h-[65px] animate-pulse flex items-center justify-center text-xs ${theme === "dark" ? "text-slate-500" : "text-gray-400"} ${chipClasses}`}>
          Loading security check…
        </div>
      )}
    </div>
  );
}
