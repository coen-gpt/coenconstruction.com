import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Save, RefreshCw, Check, Eye, AlertCircle } from "lucide-react";

const PAGES_WITH_META = [
  { path: "/", label: "Home", key: "home_meta" },
  { path: "/about", label: "About", key: "about_meta" },
  { path: "/contact", label: "Contact", key: "contact_meta" },
  { path: "/gallery", label: "Gallery", key: "gallery_meta" },
  { path: "/financing", label: "Financing", key: "financing_meta" },
  { path: "/blog", label: "Blog", key: "blog_meta" },
  { path: "/service-areas", label: "Service Areas", key: "service_areas_meta" },
  { path: "/services/home-additions", label: "Home Additions", key: "service_home_additions_meta" },
  { path: "/services/decks-porches-pergolas", label: "Decks, Porches & Pergolas", key: "service_decks_meta" },
  { path: "/services/siding", label: "Siding", key: "service_siding_meta" },
  { path: "/services/kitchen-remodeling", label: "Kitchen Remodeling", key: "service_kitchen_meta" },
  { path: "/services/bathroom-remodeling", label: "Bathroom Remodeling", key: "service_bathroom_meta" },
  { path: "/services/custom-carpentry", label: "Custom Carpentry", key: "service_carpentry_meta" },
  { path: "/services/snow-removal", label: "Snow Removal", key: "service_snow_meta" },
  { path: "/start", label: "Design Preview", key: "start_meta" },
  { path: "/budget-estimator", label: "Budget Estimator", key: "budget_estimator_meta" },
];

export default function MetaTagsEditor() {
  const [selectedPage, setSelectedPage] = useState(PAGES_WITH_META[0]);
  const [localData, setLocalData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(null);

  const { data: allContent = {} } = useQuery({
    queryKey: ["site-content-meta"],
    queryFn: async () => {
      const result = {};
      for (const page of PAGES_WITH_META) {
        const res = await base44.functions.invoke("getSiteContent", { key: page.key }).catch(() => ({}));
        result[page.key] = res.data?.value || {};
      }
      return result;
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const saved = allContent[selectedPage.key] || {};
    setLocalData({
      title: saved.title || "",
      description: saved.description || "",
      canonical_url: saved.canonical_url || selectedPage.path,
      robots: saved.robots || "index, follow",
      og_title: saved.og_title || "",
      og_description: saved.og_description || "",
      og_image: saved.og_image || "",
      keywords: saved.keywords || "",
    });
  }, [selectedPage, allContent]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke("saveSiteContent", {
        key: selectedPage.key,
        value: localData,
      });
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  const handleCopy = (field) => {
    const text = localData[field] || "";
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const charCounts = {
    title: { current: (localData.title || "").length, optimal: { min: 30, max: 60 } },
    description: { current: (localData.description || "").length, optimal: { min: 120, max: 160 } },
  };

  const getStatusClass = (field, count) => {
    if (count.current < count.optimal.min) return "text-orange-600";
    if (count.current > count.optimal.max) return "text-orange-600";
    return "text-green-600";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page Selector */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white shrink-0">
        <h2 className="text-lg font-bold text-secondary mb-3">Meta Tags Manager</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
          {PAGES_WITH_META.map(page => (
            <button
              key={page.key}
              onClick={() => setSelectedPage(page)}
              className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors ${
                selectedPage.key === page.key
                  ? "bg-primary text-white"
                  : "bg-muted text-gray-700 hover:bg-gray-200"
              }`}
            >
              {page.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          {/* Current page info */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <div>
              <h3 className="text-lg font-bold text-secondary">{selectedPage.label}</h3>
              <p className="text-sm text-gray-500">{selectedPage.path}</p>
            </div>
            <a
              href={selectedPage.path}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline"
            >
              <Eye className="w-4 h-4" /> Preview
            </a>
          </div>

          {/* Meta Tags Fields */}
          <div className="space-y-5">
            {/* Title */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Title</label>
                <span className={`text-xs font-semibold ${getStatusClass("title", charCounts.title)}`}>
                  {charCounts.title.current} chars ({charCounts.title.optimal.min}-{charCounts.title.optimal.max} optimal)
                </span>
              </div>
              <input
                type="text"
                value={localData.title || ""}
                onChange={e => setLocalData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Page title for search results and browser tab"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Description (Meta)</label>
                <span className={`text-xs font-semibold ${getStatusClass("description", charCounts.description)}`}>
                  {charCounts.description.current} chars ({charCounts.description.optimal.min}-{charCounts.description.optimal.max} optimal)
                </span>
              </div>
              <textarea
                rows={3}
                value={localData.description || ""}
                onChange={e => setLocalData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Page description shown in search results"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>

            {/* Canonical URL */}
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-2">Canonical URL</label>
              <input
                type="text"
                value={localData.canonical_url || ""}
                onChange={e => setLocalData(prev => ({ ...prev, canonical_url: e.target.value }))}
                placeholder="https://www.coenconstruction.com/page"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
              <p className="text-xs text-gray-400 mt-1">Prevents duplicate content issues</p>
            </div>

            {/* Robots */}
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-2">Robots Meta</label>
              <input
                type="text"
                value={localData.robots || ""}
                onChange={e => setLocalData(prev => ({ ...prev, robots: e.target.value }))}
                placeholder="index, follow"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
              <p className="text-xs text-gray-400 mt-1">Controls search engine crawling. Common: "index, follow" or "noindex, nofollow"</p>
            </div>

            {/* Keywords */}
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-2">Keywords (CSV)</label>
              <input
                type="text"
                value={localData.keywords || ""}
                onChange={e => setLocalData(prev => ({ ...prev, keywords: e.target.value }))}
                placeholder="keyword1, keyword2, keyword3"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
              <p className="text-xs text-gray-400 mt-1">Note: Meta keywords have minimal SEO impact but still useful for organization</p>
            </div>

            {/* Social Tags */}
            <div className="border-t border-gray-200 pt-5 mt-5">
              <h4 className="text-sm font-bold text-secondary mb-4">Social Media Tags (Open Graph)</h4>

              <div className="space-y-4">
                {/* OG Title */}
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-2">OG Title</label>
                  <input
                    type="text"
                    value={localData.og_title || ""}
                    onChange={e => setLocalData(prev => ({ ...prev, og_title: e.target.value }))}
                    placeholder="Title for social sharing"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                  <p className="text-xs text-gray-400 mt-1">If empty, uses meta title</p>
                </div>

                {/* OG Description */}
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-2">OG Description</label>
                  <textarea
                    rows={3}
                    value={localData.og_description || ""}
                    onChange={e => setLocalData(prev => ({ ...prev, og_description: e.target.value }))}
                    placeholder="Description for social sharing"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                  <p className="text-xs text-gray-400 mt-1">If empty, uses meta description</p>
                </div>

                {/* OG Image */}
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-2">OG Image URL</label>
                  <input
                    type="text"
                    value={localData.og_image || ""}
                    onChange={e => setLocalData(prev => ({ ...prev, og_image: e.target.value }))}
                    placeholder="https://..."
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                  {localData.og_image && (
                    <img src={localData.og_image} alt="og preview" className="mt-2 h-24 w-auto rounded-lg border border-gray-200 object-cover" />
                  )}
                  <p className="text-xs text-gray-400 mt-1">Recommended: 1200x630px</p>
                </div>
              </div>
            </div>

            {/* Help */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-sm font-semibold text-blue-900 mb-1">SEO Tips</h5>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>• <strong>Title:</strong> 30-60 characters, include main keyword</li>
                    <li>• <strong>Description:</strong> 120-160 characters, compelling call-to-action</li>
                    <li>• <strong>Canonical URL:</strong> Use for all pages to avoid duplication</li>
                    <li>• <strong>OG Image:</strong> Used when sharing on social media</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Save Button */}
      <div className="border-t border-gray-200 bg-white px-6 py-4 shrink-0">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-white font-bold px-6 py-2.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 w-full justify-center sm:w-auto"
        >
          {saved ? (
            <><Check className="w-4 h-4" /> Saved!</>
          ) : saving ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</>
          ) : (
            <><Save className="w-4 h-4" /> Save Meta Tags</>
          )}
        </button>
      </div>
    </div>
  );
}