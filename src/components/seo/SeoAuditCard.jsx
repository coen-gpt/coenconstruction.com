import { useState } from "react";
import {
  ChevronDown, ChevronUp, Trash2, RefreshCw, CheckCircle,
  RotateCcw, TrendingUp, Zap, Sparkles, AlertTriangle, Link2, Code, ExternalLink
} from "lucide-react";
import SeoScoreBadge from "./SeoScoreBadge";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function SeoAuditCard({ audit, onDelete, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [applying, setApplying] = useState(false);
  const [reverting, setReverting] = useState(false);
  const { toast } = useToast();

  const reviewItems = audit.suggestion_review?.items || [];
  const pendingItems = reviewItems
    .filter(s => s.status === "pending")
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
    })
    .slice(0, 5); // Only show top 5
  const appliedCount = reviewItems.filter(s => s.status === "applied").length;
  const alreadyDoneCount = reviewItems.filter(s => s.status === "already_implemented").length;
  const pendingAll = reviewItems.filter(s => s.status === "pending");

  const handleApplyAll = async () => {
    setApplying(true);
    const allPendingIds = reviewItems.filter(s => s.status === "pending").map(s => s.id);
    const res = await base44.functions.invoke("reviewAndApplySeoSuggestions", {
      audit_id: audit.id,
      apply: true,
      selected_suggestions: allPendingIds,
    });
    setApplying(false);
    if (res.data?.success) {
      toast({ title: "✅ SEO improvements applied!", description: res.data.message });
      onRefresh();
    } else {
      toast({ title: "Failed", description: res.data?.error || "Unknown error", variant: "destructive" });
    }
  };

  const handleRunReview = async () => {
    setApplying(true);
    const res = await base44.functions.invoke("reviewAndApplySeoSuggestions", {
      audit_id: audit.id,
      apply: false,
    });
    setApplying(false);
    if (res.data?.success) {
      toast({ title: "✅ Review complete", description: `Found ${res.data.suggestions?.filter(s => s.status === "pending").length || 0} improvements to make.` });
      onRefresh();
    } else {
      toast({ title: "Review Failed", description: res.data?.error, variant: "destructive" });
    }
  };

  const handleRevert = async () => {
    setReverting(true);
    const res = await base44.functions.invoke("revertSeoChanges", { audit_id: audit.id });
    setReverting(false);
    if (res.data?.success) {
      toast({ title: "↩️ Reverted", description: res.data.message });
      onRefresh();
    } else {
      toast({ title: "Error", description: res.data?.error, variant: "destructive" });
    }
  };

  const hasReview = reviewItems.length > 0;
  const hyperlinkKws = audit.hyperlinked_keywords || [];
  const hasSchema = !!audit.schema_json;
  const [schemaExpanded, setSchemaExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      {/* Collapsed header row */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <SeoScoreBadge score={audit.score} size="sm" />
          <div className="text-left min-w-0">
            <div className="font-semibold text-secondary dark:text-gray-200 text-sm">{audit.page}</div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs">
              {appliedCount > 0 && (
                <span className="text-green-600 font-semibold flex items-center gap-0.5">
                  <CheckCircle className="w-3 h-3" /> {appliedCount} applied
                </span>
              )}
              {pendingAll.length > 0 && (
                <span className="text-amber-600 font-semibold flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" /> {pendingAll.length} to fix
                </span>
              )}
              {!hasReview && audit.issues?.length > 0 && (
                <span className="text-gray-400">{audit.issues.length} issues found</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onDelete(audit.id); }}
            className="text-gray-300 hover:text-red-400 transition-colors p-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-5 space-y-5">

          {/* Score row */}
          <div className="grid grid-cols-4 gap-2">
            <SeoScoreBadge score={audit.score} label="SEO" />
            <SeoScoreBadge score={audit.local_score} label="Local" />
            <SeoScoreBadge score={audit.trust_score} label="Trust" />
            <SeoScoreBadge score={audit.lead_gen_score} label="Leads" />
          </div>

          {/* Meta tags — the most important quick win */}
          {(audit.suggested_title || audit.suggested_description) && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-green-700">
                <TrendingUp className="w-4 h-4" /> Suggested Meta Tags
              </div>
              {audit.suggested_title && (
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase mb-0.5">Title <span className="font-normal text-gray-400">({audit.suggested_title.length}/60 chars)</span></div>
                  <div className="text-sm text-gray-800 bg-white border border-green-200 rounded-lg px-3 py-2">{audit.suggested_title}</div>
                </div>
              )}
              {audit.suggested_description && (
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase mb-0.5">Description <span className="font-normal text-gray-400">({audit.suggested_description.length}/155 chars)</span></div>
                  <div className="text-sm text-gray-800 bg-white border border-green-200 rounded-lg px-3 py-2">{audit.suggested_description}</div>
                </div>
              )}
            </div>
          )}

          {/* Top action items */}
          {hasReview ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-secondary dark:text-gray-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Top Improvements
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="text-green-600 font-semibold">{alreadyDoneCount} already done</span>
                  {appliedCount > 0 && <span className="text-blue-600 font-semibold">{appliedCount} applied</span>}
                </div>
              </div>

              {pendingItems.length === 0 ? (
                <div className="text-center py-6 text-sm text-green-600 font-semibold flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" /> All improvements applied — great job!
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {pendingItems.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-amber-700 mb-0.5 uppercase">{item.priority} priority · {item.category}</div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{item.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {pendingAll.length > 5 && (
                    <p className="text-xs text-gray-400 text-center">+ {pendingAll.length - 5} more lower-priority suggestions</p>
                  )}
                  <button
                    onClick={handleApplyAll}
                    disabled={applying}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 text-sm"
                  >
                    {applying
                      ? <><RefreshCw className="w-4 h-4 animate-spin" /> Applying…</>
                      : <><Zap className="w-4 h-4" /> Apply All {pendingAll.length} Improvements</>}
                  </button>
                </>
              )}

              <button
                onClick={handleRunReview}
                disabled={applying}
                className="w-full text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors"
              >
                {applying ? "Running…" : "↺ Re-run AI review"}
              </button>
            </div>
          ) : (
            /* First-time: prompt to run review */
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center space-y-3">
              <p className="text-sm text-gray-500">AI will check your live page and identify exactly what needs fixing.</p>
              <button
                onClick={handleRunReview}
                disabled={applying}
                className="flex items-center justify-center gap-2 bg-secondary text-white font-bold px-6 py-2.5 rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-60 text-sm mx-auto"
              >
                {applying
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Checking live page…</>
                  : <><Sparkles className="w-4 h-4" /> Analyze &amp; Get Action Plan</>}
              </button>
            </div>
          )}

          {/* Hyperlinked Keywords */}
          {hyperlinkKws.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-bold text-secondary flex items-center gap-2">
                <Link2 className="w-4 h-4 text-blue-500" /> Internal Link Opportunities
              </div>
              <div className="grid gap-1.5">
                {hyperlinkKws.slice(0, 6).map((kw, i) => (
                  <div key={i} className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          kw.keyword_type === 'service' ? 'bg-primary/10 text-primary' :
                          kw.keyword_type === 'location' || kw.keyword_type === 'service_area' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{kw.keyword_type}</span>
                        <a href={kw.url} target="_blank" className="text-sm font-semibold text-blue-700 hover:underline flex items-center gap-1">
                          "{kw.anchor_text}" <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                        <span className="text-xs text-gray-400">→ {kw.url}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{kw.context}</p>
                    </div>
                  </div>
                ))}
                {hyperlinkKws.length > 6 && (
                  <p className="text-xs text-gray-400 text-center">+ {hyperlinkKws.length - 6} more link opportunities</p>
                )}
              </div>
            </div>
          )}

          {/* Schema Markup */}
          {hasSchema && (
            <div className="space-y-2">
              <button
                onClick={() => setSchemaExpanded(!schemaExpanded)}
                className="w-full flex items-center justify-between text-sm font-bold text-secondary bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 hover:bg-purple-100 transition-colors"
              >
                <span className="flex items-center gap-2"><Code className="w-4 h-4 text-purple-600" /> Schema Markup (JSON-LD) — Ready to Apply</span>
                {schemaExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {schemaExpanded && (
                <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                  <pre className="text-xs text-green-400 whitespace-pre-wrap break-all">{audit.schema_json?.slice(0, 1500)}{audit.schema_json?.length > 1500 ? '\n... (truncated)' : ''}</pre>
                </div>
              )}
              <p className="text-xs text-gray-400">Includes: LocalBusiness + areaServed (65 towns), Service, FAQPage, BreadcrumbList schema. Click "Apply" to push to AppSettings.</p>
            </div>
          )}

          {/* Revert (compact) */}
          {history.length > 0 && (
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-400">Last applied: v{history[history.length - 1]?.version}</span>
              <button
                onClick={handleRevert}
                disabled={reverting}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-orange-600 border border-gray-200 hover:border-orange-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {reverting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Revert Last Change
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}