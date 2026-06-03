import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const KEYS = ["tracking_gtag_ids", "tracking_google_site_verification", "tracking_custom_head", "tracking_custom_body_start", "tracking_custom_footer"];

function useTrackingSettings() {
  return useQuery({
    queryKey: ["tracking-settings-public"],
    queryFn: async () => {
      const all = await base44.entities.AppSettings.list();
      const map = {};
      for (const s of all) {
        if (KEYS.includes(s.key)) map[s.key] = s.value;
      }
      return map;
    },
    staleTime: 5 * 60 * 1000, // cache 5 min
  });
}

function injectScript(src, id) {
  if (document.getElementById(id)) return;
  const el = document.createElement("script");
  el.async = true;
  el.src = src;
  el.id = id;
  document.head.appendChild(el);
}

function injectInlineScript(code, id) {
  if (document.getElementById(id)) return;
  const el = document.createElement("script");
  el.id = id;
  el.textContent = code;
  document.head.appendChild(el);
}

function injectHtml(html, containerId, target = "head") {
  if (document.getElementById(containerId)) return;
  const wrapper = document.createElement("div");
  wrapper.id = containerId;
  // Parse and append script/link/meta/noscript nodes properly
  const temp = document.createElement("div");
  temp.innerHTML = html;
  Array.from(temp.childNodes).forEach(node => {
    if (node.nodeName === "SCRIPT") {
      const s = document.createElement("script");
      if (node.src) s.src = node.src;
      else s.textContent = node.textContent;
      Array.from(node.attributes).forEach(a => s.setAttribute(a.name, a.value));
      wrapper.appendChild(s);
    } else {
      wrapper.appendChild(node.cloneNode(true));
    }
  });
  if (target === "head") {
    document.head.appendChild(wrapper);
  } else if (target === "body_start") {
    document.body.insertBefore(wrapper, document.body.firstChild);
  } else {
    document.body.appendChild(wrapper);
  }
}

export default function useTrackingInjection() {
  const { data: settings } = useTrackingSettings();

  useEffect(() => {
    if (!settings) return;

    // ── Google Tag IDs ──────────────────────────────────────────
    const ids = (settings.tracking_gtag_ids || "AW-17966183673\nG-GB8MPBHVKF")
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);

    if (ids.length > 0) {
      // Load the gtag script using the first ID
      injectScript(`https://www.googletagmanager.com/gtag/js?id=${ids[0]}`, "gtag-script");

      // Init dataLayer and configure all IDs
      const configCalls = ids.map(id => `gtag('config', '${id}');`).join("\n");
      injectInlineScript(
        `window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\n${configCalls}`,
        "gtag-init"
      );
    }

    // ── Google Search Console verification ──────────────────────
    if (settings.tracking_google_site_verification?.trim()) {
      const content = settings.tracking_google_site_verification.trim();
      let meta = document.querySelector('meta[name="google-site-verification"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "google-site-verification");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    }

    // ── Custom head code ────────────────────────────────────────
    if (settings.tracking_custom_head?.trim()) {
      injectHtml(settings.tracking_custom_head, "custom-head-code", "head");
    }

    // ── Custom body start code ──────────────────────────────────
    if (settings.tracking_custom_body_start?.trim()) {
      injectHtml(settings.tracking_custom_body_start, "custom-body-start-code", "body_start");
    }

    // ── Custom footer code ──────────────────────────────────────
    if (settings.tracking_custom_footer?.trim()) {
      injectHtml(settings.tracking_custom_footer, "custom-footer-code", "body_end");
    }
  }, [settings]);
}