import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Search, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";

const QUICK_LOOKUPS = [
  "Minimum ceiling height for habitable rooms",
  "Smoke detector placement requirements",
  "Egress window minimum size",
  "Stair riser and tread dimensions",
  "Deck ledger board connection requirements",
  "Bathroom exhaust fan requirements",
  "GFCI outlet requirements",
  "Load-bearing wall header sizes",
  "Minimum bathroom clearances",
  "Fire blocking requirements in framing",
];

export default function CodeLookup() {
  const { brandColor } = useCompanyBrand();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [expandedHistory, setExpandedHistory] = useState(null);

  const handleSearch = async (q) => {
    const question = q || query;
    if (!question.trim()) return;
    setLoading(true);
    setResult(null);

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert U.S. building code consultant specializing in IRC (International Residential Code) and IBC (International Building Code). 

Answer this building code question clearly and concisely for a contractor:
"${question}"

Format your answer with:
1. A direct answer/requirement
2. The specific code section(s) that apply (e.g. IRC R302.1, IBC 1004.1)
3. Key exceptions or special conditions
4. A practical note for contractors

Be specific with numbers, dimensions, and requirements. If state-specific variances commonly apply, note that.`,
      response_json_schema: {
        type: "object",
        properties: {
          answer: { type: "string" },
          code_sections: { type: "array", items: { type: "string" } },
          exceptions: { type: "string" },
          contractor_note: { type: "string" },
        },
      },
    });

    const entry = { question, ...response, timestamp: new Date().toISOString() };
    setResult(entry);
    setHistory(prev => [entry, ...prev.slice(0, 9)]);
    setLoading(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: brandColor + "20" }}>
          <BookOpen className="w-5 h-5" style={{ color: brandColor }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-secondary">IRC / IBC Code Lookup</h1>
          <p className="text-sm text-gray-500">AI-powered building code reference — IRC, IBC, NEC</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Ask a code question (e.g. minimum stair width, egress requirements...)"
            className="flex-1"
          />
          <Button onClick={() => handleSearch()} disabled={loading || !query.trim()} className="gap-2 shrink-0">
            {loading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Looking up..." : "Look Up"}
          </Button>
        </div>

        {/* Quick lookups */}
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-2">Common lookups:</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_LOOKUPS.map(q => (
              <button
                key={q}
                onClick={() => { setQuery(q); handleSearch(q); }}
                className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-primary/10 hover:text-primary rounded-full text-gray-600 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result */}
      {loading && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <Sparkles className="w-8 h-8 mx-auto mb-3 animate-pulse" style={{ color: brandColor }} />
          <p className="text-sm text-gray-500">Consulting IRC/IBC code database...</p>
        </div>
      )}

      {result && !loading && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4" style={{ color: brandColor }} />
            <span className="font-semibold text-secondary text-sm">"{result.question}"</span>
          </div>

          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <div className="text-xs font-bold text-primary uppercase tracking-wide mb-1">Answer</div>
              <p className="text-sm text-secondary leading-relaxed">{result.answer}</p>
            </div>

            {result.code_sections?.length > 0 && (
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Code Sections</div>
                <div className="flex flex-wrap gap-2">
                  {result.code_sections.map((s, i) => (
                    <span key={i} className="text-xs bg-secondary/10 text-secondary px-2.5 py-1 rounded-full font-mono font-semibold">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {result.exceptions && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <div className="text-xs font-bold text-yellow-700 mb-1">Exceptions / Conditions</div>
                <p className="text-xs text-yellow-800">{result.exceptions}</p>
              </div>
            )}

            {result.contractor_note && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div className="text-xs font-bold text-blue-700 mb-1">Contractor Note</div>
                <p className="text-xs text-blue-800">{result.contractor_note}</p>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 mt-4">⚠ Always verify with your local AHJ — code adoption varies by jurisdiction.</p>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">Recent Lookups</h2>
          <div className="space-y-2">
            {history.slice(1).map((entry, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                  onClick={() => setExpandedHistory(expandedHistory === i ? null : i)}
                >
                  <span className="text-sm text-secondary truncate">{entry.question}</span>
                  {expandedHistory === i ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 ml-2" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-2" />}
                </button>
                {expandedHistory === i && (
                  <div className="px-4 pb-3 border-t border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-600 mt-2">{entry.answer}</p>
                    {entry.code_sections?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {entry.code_sections.map((s, j) => (
                          <span key={j} className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded font-mono">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}