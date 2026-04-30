/**
 * NotFoundTracker — admin panel for viewing 404 hits.
 * Shown inside Admin > SEO tab.
 */
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { REDIRECTS } from "@/lib/redirectMap";

export default function NotFoundTracker() {
  const { data: settings = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["404-log"],
    queryFn: () => base44.entities.AppSettings.filter({ key: "404_log" }),
  });

  const log = settings[0]?.value ? JSON.parse(settings[0].value) : [];

  // Flag paths that already have a redirect configured
  const redirectedPaths = new Set(REDIRECTS.map(r => r.from));

  if (isLoading) {
    return <div className="py-8 text-center text-gray-400 text-sm">Loading 404 log...</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-secondary">404 Error Tracker</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {log.length} unique path{log.length !== 1 ? "s" : ""} — fix by adding to{" "}
            <code className="bg-gray-100 px-1 rounded">lib/redirectMap.js</code>
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {log.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm">
          No 404s recorded yet. They'll appear here automatically.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                <th className="py-2 text-left font-semibold">Path</th>
                <th className="py-2 text-left font-semibold hidden sm:table-cell">First Seen</th>
                <th className="py-2 text-left font-semibold hidden sm:table-cell">Last Seen</th>
                <th className="py-2 text-center font-semibold">Hits</th>
                <th className="py-2 text-left font-semibold hidden md:table-cell">Referrers</th>
                <th className="py-2 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry, i) => {
                const hasRedirect = redirectedPaths.has(entry.path);
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs text-gray-700 font-mono">{entry.path}</code>
                        <a
                          href={entry.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-300 hover:text-primary transition-colors"
                          title="Open path"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400 text-xs hidden sm:table-cell">
                      {entry.first_seen ? new Date(entry.first_seen).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : entry.date}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400 text-xs hidden sm:table-cell">
                      {entry.last_seen ? new Date(entry.last_seen).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-center">
                      <span className={`inline-block font-bold text-xs px-2 py-0.5 rounded-full ${entry.count >= 10 ? "bg-red-100 text-red-700" : entry.count >= 3 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>
                        {entry.count}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400 text-xs hidden md:table-cell max-w-[180px] truncate">
                      {entry.referrers?.length > 0 ? entry.referrers[0] : "—"}
                    </td>
                    <td className="py-2.5 text-center">
                      {hasRedirect ? (
                        <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                          ✓ Redirected
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-orange-600 font-semibold justify-center">
                          <AlertTriangle className="w-3 h-3" /> Fix needed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
        To fix a 404: add <code className="bg-gray-100 px-1 rounded">{"{ from: '/old-path', to: '/new-path', type: 301 }"}</code> to <code className="bg-gray-100 px-1 rounded">lib/redirectMap.js</code>
      </div>
    </div>
  );
}