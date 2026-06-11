import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Search, RefreshCw, Map, CheckCircle, AlertCircle, Sparkles, BarChart3 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import SeoAuditCard from "@/components/seo/SeoAuditCard";
import SeoScoreBadge from "@/components/seo/SeoScoreBadge";
import NotFoundTracker from "@/components/seo/NotFoundTracker";
import SearchVisibility from "@/components/seo/SearchVisibility";

const TABS = ["Audit Results", "Search Visibility", "Keyword Research", "Sitemap", "404 Tracker"];

export default function AdminSEO() {
  const [tab, setTab] = useState("Audit Results");
  const [auditingPage, setAuditingPage] = useState(null);
  const [auditProgress, setAuditProgress] = useState({ done: 0, total: 0, failed: [] });
  const [keyword, setKeyword] = useState("");
  const [kwResult, setKwResult] = useState(null);
  const [kwLoading, setKwLoading] = useState(false);
  const [sitemapLoading, setSitemapLoading] = useState(false);
  const [sitemapResult, setSitemapResult] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: audits = [] } = useQuery({
    queryKey: ["seo-audits"],
    queryFn: () => base44.entities.SeoAudit.list("-created_date", 100),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SeoAudit.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seo-audits"] }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["seo-audits"] });

  const ALL_PAGES = [
    "Home",
    "Services",
    "Services: Home Additions",
    "Services: Decks, Porches & Pergolas",
    "Services: Siding",
    "Services: Kitchen Remodel",
    "Services: Custom Cabinetry",
    "Services: Snow Removal",
    "About",
    "Our Work",
    "Contact",
    "Service Areas",
    "Estimator",
    "Design Preview",
    "Financing",
    "Blog",
  ];

  const runFullAudit = async () => {
    setAuditProgress({ done: 0, total: ALL_PAGES.length, failed: [] });
    setTab("Audit Results");
    for (let i = 0; i < ALL_PAGES.length; i++) {
      const page = ALL_PAGES[i];
      setAuditingPage(page);
      const res = await base44.functions.invoke('runSeoAudit', { page });
      if (res.data?.success) {
        setAuditProgress(p => ({ ...p, done: p.done + 1 }));
        refresh();
      } else {
        setAuditProgress(p => ({ ...p, done: p.done + 1, failed: [...p.failed, page] }));
      }
    }
    setAuditingPage(null);
    toast({ title: "✅ Full Audit Complete", description: `All ${ALL_PAGES.length} pages analyzed.` });
  };

  const runSingleAudit = async (page) => {
    setAuditingPage(page);
    const res = await base44.functions.invoke('runSeoAudit', { page });
    setAuditingPage(null);
    if (res.data?.success) {
      toast({ title: "✅ Done", description: `${page} analyzed. Score: ${res.data.score}` });
      refresh();
    } else {
      toast({ title: "Audit Failed", description: res.data?.error || "Something went wrong.", variant: "destructive" });
    }
  };

  const isAuditing = auditingPage !== null;

  const runKeywordResearch = async () => {
    setKwLoading(true);
    const res = await base44.integrations.Core.InvokeLLM({
      model: 'claude_sonnet_4_6',
      prompt: `You are a local SEO and lead generation expert for Greater Boston construction companies. Perform deep keyword research for Coen Construction, a family-owned general contractor serving 90+ communities in Greater Boston, Metro West, and the South Shore.

Research topic: "${keyword || "home addition and remodeling contractor Greater Boston"}"

TARGET: Keywords that will rank in Google and drive qualified homeowner leads — people actively looking to hire a contractor (transactional intent) or researching projects (commercial intent).

PROVIDE:
- primary_keywords: 12-15 keywords with intent and competition difficulty (low/medium/high)
- long_tail: 8 long-tail variations that are easier to rank for
- local_keywords: 10 geo-targeted keywords (city/town specific, e.g. "deck builder Brookline MA")
- competitor_keywords: 5 comparison-style keywords (e.g. "best contractor Boston")
- seasonal_keywords: 6 seasonal search terms for New England construction cycles
- content_ideas: 8 blog post / landing page topics that could rank and generate leads
- review_keywords: 5 keywords related to reputation and reviews that build trust`,
      add_context_from_internet: false,
      response_json_schema: {
        type: "object",
        properties: {
          primary_keywords: { type: "array", items: { type: "object", properties: { keyword: { type: "string" }, intent: { type: "string" }, difficulty: { type: "string" } } } },
          long_tail: { type: "array", items: { type: "string" } },
          local_keywords: { type: "array", items: { type: "string" } },
          competitor_keywords: { type: "array", items: { type: "string" } },
          seasonal_keywords: { type: "array", items: { type: "string" } },
          content_ideas: { type: "array", items: { type: "string" } },
          review_keywords: { type: "array", items: { type: "string" } },
        }
      }
    });
    setKwResult(res);
    setKwLoading(false);
  };

  const generateSitemap = async () => {
    setSitemapLoading(true);
    setSitemapResult(null);
    const res = await base44.functions.invoke('generateSitemap', {});
    setSitemapResult(res.data);
    setSitemapLoading(false);
    if (res.data?.success) {
      toast({ title: "✅ Sitemap Generated", description: res.data.message });
    }
  };

  // Deduplicate — show latest audit per page
  const NAV_ORDER = [
    "Home", "Services", "Home Additions", "Decks, Porches & Pergolas", "Siding",
    "Kitchen Remodel", "Custom Cabinetry", "Snow Removal", "About", "Our Work",
    "Contact", "Estimator", "Design Preview", "Service Areas", "Financing", "Blog"
  ];

  const latestAudits = audits.reduce((acc, audit) => {
    if (!acc[audit.page]) acc[audit.page] = audit;
    return acc;
  }, {});
  const auditList = Object.values(latestAudits).filter(a => a.score > 0).sort((a, b) => {
    const ai = ALL_PAGES.indexOf(a.page);
    const bi = ALL_PAGES.indexOf(b.page);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const avgScore = auditList.length ? Math.round(auditList.reduce((s, a) => s + (a.score || 0), 0) / auditList.length) : null;
  const avgLocal = auditList.length ? Math.round(auditList.reduce((s, a) => s + (a.local_score || 0), 0) / auditList.length) : null;
  const avgTrust = auditList.length ? Math.round(auditList.reduce((s, a) => s + (a.trust_score || 0), 0) / auditList.length) : null;
  const avgLeads = auditList.length ? Math.round(auditList.reduce((s, a) => s + (a.lead_gen_score || 0), 0) / auditList.length) : null;

  const QUICK_PAGES = ["Home", "Services", "Services: Home Additions", "Services: Decks, Porches & Pergolas", "Services: Kitchen Remodel", "About", "Contact", "Service Areas", "Estimator", "Design Preview"];

  return (
    <div className="p-6 max-w-6xl mx-auto min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-secondary flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" /> SEO Command Center
            </h1>
            <p className="text-gray-500 text-sm mt-1">AI-powered SEO audits, apply changes to your live website instantly, and roll back with one click.</p>
          </div>
          <button
            onClick={runFullAudit}
            disabled={isAuditing}
            className="bg-primary text-white font-bold px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-60 text-sm"
          >
            {isAuditing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Auditing...</> : <><Search className="w-4 h-4" /> Run Full AI Audit</>}
          </button>
        </div>

        {/* Progress bar */}
        {isAuditing && auditProgress.total > 0 && (
          <div className="mt-4 bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-semibold text-secondary">Auditing: <span className="text-primary">{auditingPage}</span></span>
              <span className="text-gray-500">{auditProgress.done} / {auditProgress.total} pages</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(auditProgress.done / auditProgress.total) * 100}%` }}
              />
            </div>
            {auditProgress.failed.length > 0 && (
              <div className="text-xs text-red-500 mt-1">Failed: {auditProgress.failed.join(', ')}</div>
            )}
          </div>
        )}
        {avgScore !== null && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <SeoScoreBadge score={avgScore} label="Overall SEO" />
            <SeoScoreBadge score={avgLocal} label="Local SEO" />
            <SeoScoreBadge score={avgTrust} label="Trust Score" />
            <SeoScoreBadge score={avgLeads} label="Lead Gen" />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${tab === t ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Audit Results Tab */}
      {tab === "Audit Results" && (
        <div className="space-y-4">
          {/* Quick audit — compact inline */}
          <div className="flex items-center gap-2 mb-2">
            <select
              className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-primary"
              defaultValue=""
              onChange={e => e.target.value && runSingleAudit(e.target.value)}
              disabled={!!auditingPage}
            >
              <option value="">Audit a specific page…</option>
              {ALL_PAGES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {auditingPage && (
              <span className="text-xs text-primary font-semibold flex items-center gap-1 shrink-0">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {auditingPage}
              </span>
            )}
          </div>

          {auditList.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No audits yet</p>
              <p className="text-sm">Click "Run Full AI Audit" to analyze all pages.</p>
            </div>
          ) : (
            auditList.map(audit => (
              <SeoAuditCard
                key={audit.id}
                audit={audit}
                onDelete={(id) => deleteMutation.mutate(id)}
                onRefresh={refresh}
              />
            ))
          )}
        </div>
      )}

      {/* Keyword Research Tab */}
      {tab === "Keyword Research" && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-bold text-secondary mb-1">AI Keyword Research</h2>
            <p className="text-sm text-gray-500 mb-4">Discover high-value keywords for lead generation and local search dominance.</p>
            <div className="flex gap-2">
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runKeywordResearch()}
                placeholder="e.g. home addition Boston, deck builder Newton MA"
                className="flex-1 bg-white border border-gray-200 rounded px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-primary"
              />
              <button
                onClick={runKeywordResearch}
                disabled={kwLoading}
                className="bg-secondary text-white font-bold px-5 py-2.5 rounded-lg hover:bg-secondary/90 transition-colors flex items-center gap-2 disabled:opacity-60 text-sm whitespace-nowrap"
              >
                {kwLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Researching...</> : <><Search className="w-4 h-4" /> Research</>}
              </button>
            </div>
          </div>

          {kwResult && (
            <div className="grid md:grid-cols-2 gap-5">
              {kwResult.primary_keywords?.length > 0 && (
                <KwCard title="Primary Keywords" color="blue">
                  {kwResult.primary_keywords.map((kw, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                      <span className="text-gray-800">{kw.keyword}</span>
                      <div className="flex gap-1.5 shrink-0 ml-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${kw.intent === "transactional" ? "bg-green-100 text-green-700" : kw.intent === "commercial" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>{kw.intent}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${kw.difficulty === "low" ? "bg-green-100 text-green-700" : kw.difficulty === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{kw.difficulty}</span>
                      </div>
                    </div>
                  ))}
                </KwCard>
              )}
              {kwResult.local_keywords?.length > 0 && (
                <KwCard title="📍 Local Keywords" color="blue">
                  {kwResult.local_keywords.map((k, i) => <div key={i} className="text-sm text-gray-700 py-1 border-b border-gray-50 last:border-0">• {k}</div>)}
                </KwCard>
              )}
              {kwResult.long_tail?.length > 0 && (
                <KwCard title="Long-tail Keywords">
                  {kwResult.long_tail.map((k, i) => <div key={i} className="text-sm text-gray-700 py-1 border-b border-gray-50 last:border-0">• {k}</div>)}
                </KwCard>
              )}
              {kwResult.seasonal_keywords?.length > 0 && (
                <KwCard title="🍂 Seasonal Keywords">
                  {kwResult.seasonal_keywords.map((k, i) => <div key={i} className="text-sm text-gray-700 py-1 border-b border-gray-50 last:border-0">• {k}</div>)}
                </KwCard>
              )}
              {kwResult.competitor_keywords?.length > 0 && (
                <KwCard title="Competitor Keywords">
                  {kwResult.competitor_keywords.map((k, i) => <div key={i} className="text-sm text-gray-700 py-1 border-b border-gray-50 last:border-0">• {k}</div>)}
                </KwCard>
              )}
              {kwResult.review_keywords?.length > 0 && (
                <KwCard title="⭐ Review & Trust Keywords">
                  {kwResult.review_keywords.map((k, i) => <div key={i} className="text-sm text-gray-700 py-1 border-b border-gray-50 last:border-0">• {k}</div>)}
                </KwCard>
              )}
              {kwResult.content_ideas?.length > 0 && (
                <KwCard title="✍️ Content Ideas" fullWidth>
                  {kwResult.content_ideas.map((c, i) => <div key={i} className="text-sm text-primary py-1 border-b border-gray-50 last:border-0">→ {c}</div>)}
                </KwCard>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search Visibility Tab */}
      {tab === "Search Visibility" && <SearchVisibility />}

      {/* 404 Tracker Tab */}
      {tab === "404 Tracker" && <NotFoundTracker />}

      {/* Sitemap Tab */}
      {tab === "Sitemap" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-xl">
          <div className="flex items-center gap-2 mb-1">
            <Map className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-secondary">Sitemap Generator</h2>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Regenerates <code className="bg-muted px-1 rounded text-xs">/sitemap.xml</code> with all static pages, 90+ service area town pages, and published blog posts. Submit to Google Search Console after generating.
          </p>
          <button
            onClick={generateSitemap}
            disabled={sitemapLoading}
            className="bg-secondary text-white font-bold px-6 py-3 rounded-lg hover:bg-secondary/90 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {sitemapLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</> : <><Map className="w-4 h-4" /> Generate Sitemap</>}
          </button>
          {sitemapResult && (
            <div className={`mt-4 text-sm px-4 py-3 rounded-lg flex items-start gap-2 ${sitemapResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {sitemapResult.success ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <div>
                <div className="font-semibold">{sitemapResult.message || sitemapResult.error}</div>
                {sitemapResult.stats && (
                  <div className="text-xs mt-1 opacity-80">{sitemapResult.stats.static} static · {sitemapResult.stats.towns} towns · {sitemapResult.stats.blog} blog posts</div>
                )}
                {sitemapResult.file_url && (
                  <a href={sitemapResult.file_url} target="_blank" rel="noopener noreferrer" className="text-xs mt-2 block underline opacity-80 break-all">
                    View sitemap.xml ↗
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KwCard({ title, children, fullWidth }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 p-4 ${fullWidth ? 'md:col-span-2' : ''}`}>
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{title}</div>
      <div className="space-y-0">{children}</div>
    </div>
  );
}