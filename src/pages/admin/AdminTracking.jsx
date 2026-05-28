import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Save, Check, RefreshCw, Code, Tag, Info } from "lucide-react";

const SETTINGS_KEYS = [
  "tracking_gtag_ids",
  "tracking_google_site_verification",
  "tracking_custom_head",
  "tracking_custom_body_start",
  "tracking_custom_footer",
];

function useTrackingSettings() {
  return useQuery({
    queryKey: ["tracking-settings"],
    queryFn: async () => {
      const all = await base44.entities.AppSettings.list();
      const map = {};
      for (const s of all) {
        if (SETTINGS_KEYS.includes(s.key)) map[s.key] = s;
      }
      return map;
    },
  });
}

async function saveSetting(existing, key, value) {
  if (existing?.id) {
    await base44.entities.AppSettings.update(existing.id, { value });
  } else {
    await base44.entities.AppSettings.create({ key, value });
  }
}

export default function AdminTracking() {
  const queryClient = useQueryClient();
  const { data: settings = {}, isLoading } = useTrackingSettings();

  const [gtagIds, setGtagIds] = useState("AW-17966183673\nG-GB8MPBHVKF");
  const [gscVerification, setGscVerification] = useState("");
  const [customHead, setCustomHead] = useState("");
  const [customBodyStart, setCustomBodyStart] = useState("");
  const [customFooter, setCustomFooter] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (settings.tracking_gtag_ids?.value) setGtagIds(settings.tracking_gtag_ids.value);
      if (settings.tracking_google_site_verification?.value) setGscVerification(settings.tracking_google_site_verification.value);
      if (settings.tracking_custom_head?.value) setCustomHead(settings.tracking_custom_head.value);
      if (settings.tracking_custom_body_start?.value) setCustomBodyStart(settings.tracking_custom_body_start.value);
      if (settings.tracking_custom_footer?.value) setCustomFooter(settings.tracking_custom_footer.value);
    }
  }, [isLoading, settings]);

  const handleSave = async () => {
    setSaving(true);
    await Promise.all([
      saveSetting(settings.tracking_gtag_ids, "tracking_gtag_ids", gtagIds),
      saveSetting(settings.tracking_google_site_verification, "tracking_google_site_verification", gscVerification.trim()),
      saveSetting(settings.tracking_custom_head, "tracking_custom_head", customHead),
      saveSetting(settings.tracking_custom_body_start, "tracking_custom_body_start", customBodyStart),
      saveSetting(settings.tracking_custom_footer, "tracking_custom_footer", customFooter),
    ]);
    queryClient.invalidateQueries({ queryKey: ["tracking-settings"] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const parsedIds = gtagIds.split("\n").map(s => s.trim()).filter(Boolean);

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-3xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-secondary">Tracking & Custom Code</h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-1">Manage Google Tag IDs and inject custom code into your website's head, body, and footer.</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 sm:py-20 text-gray-400 text-xs sm:text-sm">Loading...</div>
      ) : (
        <div className="space-y-4 sm:space-y-6">

          {/* Google Tag IDs */}
          <div className="bg-card rounded-lg sm:rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 md:p-6">
            <div className="flex items-center gap-2 mb-1">
              <Tag className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <h2 className="font-bold text-secondary text-sm sm:text-base">Google Tag IDs</h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">Enter one ID per line (e.g. <code className="bg-muted px-1 rounded text-[10px] sm:text-xs">AW-17966183673</code> or <code className="bg-muted px-1 rounded text-[10px] sm:text-xs">G-XXXXXXXX</code>). These are loaded on every page of your website.</p>
            <textarea
              rows={4}
              value={gtagIds}
              onChange={e => setGtagIds(e.target.value)}
              placeholder={"AW-17966183673\nG-GB8MPBHVKF"}
              className="w-full bg-white border border-gray-200 rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-800 font-mono resize-none focus:outline-none focus:border-primary"
            />
            {parsedIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {parsedIds.map(id => (
                  <span key={id} className="text-[10px] sm:text-xs bg-primary/10 text-primary px-2 py-1 rounded font-mono break-all">{id}</span>
                ))}
              </div>
            )}
          </div>


          {/* Google Search Console */}
          <div className="bg-card rounded-lg sm:rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 md:p-6">
            <div className="flex items-center gap-2 mb-1">
              <Tag className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <h2 className="font-bold text-secondary text-sm sm:text-base">Google Search Console Verification</h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mb-3">Paste only the verification token from your <code className="bg-muted px-1 rounded text-[10px] sm:text-xs">google-site-verification</code> meta tag. The site injects the correct meta tag on public pages.</p>
            <input
              value={gscVerification}
              onChange={e => setGscVerification(e.target.value)}
              placeholder="abc123-google-verification-token"
              className="w-full bg-white border border-gray-200 rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-800 font-mono focus:outline-none focus:border-primary"
            />
          </div>
          {/* Custom Head Code */}
          <div className="bg-card rounded-lg sm:rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 md:p-6">
            <div className="flex items-center gap-2 mb-1">
              <Code className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <h2 className="font-bold text-secondary text-sm sm:text-base">Custom &lt;head&gt; Code</h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mb-3">Injected inside <code className="bg-muted px-1 rounded text-[10px] sm:text-xs">&lt;head&gt;</code> — ideal for meta tags, fonts, or tracking pixels that must load first.</p>
            <textarea
              rows={4}
              value={customHead}
              onChange={e => setCustomHead(e.target.value)}
              placeholder={"<!-- Custom head code -->\n<meta name=\"example\" content=\"value\" />"}
              className="w-full bg-white border border-gray-200 rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-800 font-mono resize-y focus:outline-none focus:border-primary"
            />
          </div>

          {/* Custom Body Start Code */}
          <div className="bg-card rounded-lg sm:rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 md:p-6">
            <div className="flex items-center gap-2 mb-1">
              <Code className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <h2 className="font-bold text-secondary text-sm sm:text-base">Custom Body Code (top of &lt;body&gt;)</h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mb-3">Injected right after <code className="bg-muted px-1 rounded text-[10px] sm:text-xs">&lt;body&gt;</code> opens — ideal for Google Tag Manager noscript snippets or body-level pixels.</p>
            <textarea
              rows={4}
              value={customBodyStart}
              onChange={e => setCustomBodyStart(e.target.value)}
              placeholder={"<!-- e.g. GTM noscript -->\n<noscript>...</noscript>"}
              className="w-full bg-white border border-gray-200 rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-800 font-mono resize-y focus:outline-none focus:border-primary"
            />
          </div>

          {/* Custom Footer Code */}
          <div className="bg-card rounded-lg sm:rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 md:p-6">
            <div className="flex items-center gap-2 mb-1">
              <Code className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <h2 className="font-bold text-secondary text-sm sm:text-base">Custom Footer Code (end of &lt;body&gt;)</h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mb-3">Injected before <code className="bg-muted px-1 rounded text-[10px] sm:text-xs">&lt;/body&gt;</code> — great for chat widgets, deferred scripts, or conversion tracking snippets.</p>
            <textarea
              rows={4}
              value={customFooter}
              onChange={e => setCustomFooter(e.target.value)}
              placeholder={"<!-- e.g. chat widget or deferred script -->\n<script>...</script>"}
              className="w-full bg-white border border-gray-200 rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-800 font-mono resize-y focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-start gap-2 flex-1 bg-blue-50 border border-blue-100 rounded-lg p-2 sm:p-3 text-[10px] sm:text-xs text-blue-700">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Changes take effect immediately on page load. Google Tag IDs are loaded as gtag.js scripts. Custom code is injected via React into the DOM.</span>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 bg-primary text-white font-bold px-4 sm:px-6 py-2 sm:py-3 rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 touch-manipulation"
            >
              {saved ? <><Check className="w-4 h-4" /> Saved!</> : saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save All</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}