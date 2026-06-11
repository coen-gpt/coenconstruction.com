import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, MousePointerClick, Eye, ArrowUpDown, RefreshCw } from "lucide-react";

const PERIODS = [
  { label: "7 days", days: 7 },
  { label: "28 days", days: 28 },
  { label: "90 days", days: 90 },
];

export default function SearchVisibility() {
  const [days, setDays] = useState(28);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["search-visibility", days],
    queryFn: async () => {
      const res = await base44.functions.invoke("getSearchVisibility", {
        siteUrl: "https://coenconstruction.com/",
        days,
      });
      return res.data;
    },
    staleTime: 1000 * 60 * 30, // cache 30min
  });

  const dailyChart = (data?.daily || []).map((r) => ({
    date: r.keys[0].slice(5), // MM-DD
    clicks: r.clicks,
    impressions: r.impressions,
  }));

  const topQueries = data?.queries || [];
  const topPages = data?.pages || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-secondary">Search Visibility</h2>
          <p className="text-sm text-gray-500">Live data from Google Search Console</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${days === p.days ? "bg-white text-secondary shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm">
          Failed to load search data: {error.message}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              icon={<MousePointerClick className="w-5 h-5 text-primary" />}
              label="Total Clicks"
              value={(data?.totals?.clicks || 0).toLocaleString()}
              bg="bg-primary/5"
            />
            <KpiCard
              icon={<Eye className="w-5 h-5 text-blue-500" />}
              label="Impressions"
              value={(data?.totals?.impressions || 0).toLocaleString()}
              bg="bg-blue-50"
            />
            <KpiCard
              icon={<TrendingUp className="w-5 h-5 text-green-500" />}
              label="Avg CTR"
              value={
                data?.totals?.impressions
                  ? `${((data.totals.clicks / data.totals.impressions) * 100).toFixed(1)}%`
                  : "—"
              }
              bg="bg-green-50"
            />
            <KpiCard
              icon={<ArrowUpDown className="w-5 h-5 text-purple-500" />}
              label="Queries"
              value={topQueries.length}
              bg="bg-purple-50"
            />
          </div>

          {/* Daily Chart */}
          {dailyChart.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Clicks & Impressions Over Time</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dailyChart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(9,73%,53%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(9,73%,53%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gImpr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="impressions" stroke="#3b82f6" fill="url(#gImpr)" strokeWidth={1.5} name="Impressions" />
                  <Area type="monotone" dataKey="clicks" stroke="hsl(9,73%,53%)" fill="url(#gClicks)" strokeWidth={2} name="Clicks" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Queries & Pages */}
          <div className="grid md:grid-cols-2 gap-5">
            {/* Top Queries */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Top Search Queries</h3>
              <div className="space-y-2">
                {topQueries.slice(0, 15).map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">{row.keys[0]}</div>
                      <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                        <span>{row.clicks} clicks</span>
                        <span>{row.impressions.toLocaleString()} impr.</span>
                        <span>pos {row.position.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="w-16 shrink-0">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.min((row.impressions / (topQueries[0]?.impressions || 1)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Pages */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Top Pages by Clicks</h3>
              <div className="space-y-2">
                {topPages.slice(0, 15).map((row, i) => {
                  const path = row.keys[0].replace("https://coenconstruction.com", "") || "/";
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-800 truncate">{path}</div>
                        <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                          <span>{row.clicks} clicks</span>
                          <span>{row.impressions.toLocaleString()} impr.</span>
                          <span>CTR {(row.ctr * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="w-16 shrink-0">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full"
                            style={{ width: `${Math.min((row.clicks / (topPages[0]?.clicks || 1)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, bg }) {
  return (
    <div className={`${bg} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-gray-500 font-medium">{label}</span></div>
      <div className="text-2xl font-bold text-secondary">{value}</div>
    </div>
  );
}