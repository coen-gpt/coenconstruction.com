import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { RadialBarChart, RadialBar, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { CheckCircle2, AlertTriangle, Clock, ChevronRight, HardHat } from "lucide-react";

const STATUS_CONFIG = {
  completed: { label: "Complete",      color: "#10b981", bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200" },
  in_progress:{ label: "In Progress",  color: "#f97316", bg: "bg-orange-50",   text: "text-orange-700",  border: "border-orange-200" },
  not_started:{ label: "Not Started",  color: "#94a3b8", bg: "bg-slate-100",   text: "text-slate-600",   border: "border-slate-200" },
};

const DOC_CHECKS = [
  { key: "packet_status", label: "Subcontractor Agreement", valueCheck: v => ["completed", "approved"].includes(v.packet_status) },
  { key: "workers_comp_url", label: "Workers Comp",          valueCheck: v => !!v.workers_comp_url },
  { key: "liability_ins_url", label: "General Liability",    valueCheck: v => !!v.liability_ins_url },
  { key: "w9_url", label: "W-9 Form",                        valueCheck: v => !!v.w9_url },
];

function getCompletionScore(vendor) {
  const done = DOC_CHECKS.filter(c => c.valueCheck(vendor)).length;
  return { done, total: DOC_CHECKS.length, pct: Math.round((done / DOC_CHECKS.length) * 100) };
}

export default function SubOnboardingProgressWidget({ brandColor = "#E35235" }) {
  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["sub-onboarding-widget"],
    queryFn: () => base44.entities.Vendor.filter({ is_subcontractor: true }),
    staleTime: 60_000,
  });

  if (isLoading) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse h-48" />
  );

  const activeSubs = vendors.filter(v => v.active !== false);
  if (activeSubs.length === 0) return null;

  const fullyComplete  = activeSubs.filter(v => getCompletionScore(v).pct === 100);
  const inProgress     = activeSubs.filter(v => { const s = getCompletionScore(v); return s.pct > 0 && s.pct < 100; });
  const notStarted     = activeSubs.filter(v => getCompletionScore(v).pct === 0);

  const overallPct = activeSubs.length > 0
    ? Math.round(activeSubs.reduce((sum, v) => sum + getCompletionScore(v).pct, 0) / activeSubs.length)
    : 0;

  const chartData = [
    { name: "Complete",    value: fullyComplete.length,  fill: "#10b981" },
    { name: "In Progress", value: inProgress.length,     fill: "#f97316" },
    { name: "Not Started", value: notStarted.length,     fill: "#e2e8f0" },
  ].filter(d => d.value > 0);

  // Sort subs: not-started first, then in-progress, then complete
  const sorted = [...activeSubs].sort((a, b) => getCompletionScore(a).pct - getCompletionScore(b).pct);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50">
        <HardHat className="w-4 h-4 text-slate-400" />
        <h2 className="font-semibold text-slate-700 text-sm">Subcontractor Onboarding</h2>
        <span className="ml-auto text-xs text-slate-400">{activeSubs.length} active sub{activeSubs.length !== 1 ? "s" : ""}</span>
        <Link to="/estimator/vendors" className="text-xs font-semibold flex items-center gap-1 hover:underline ml-1" style={{ color: brandColor }}>
          Manage <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-50">

        {/* Left: Donut chart + overall stat */}
        <div className="flex items-center gap-4 p-5">
          <div className="relative w-28 h-28 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="68%"
                outerRadius="100%"
                data={chartData}
                startAngle={90}
                endAngle={-270}
                barSize={12}
              >
                <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "#f1f5f9" }}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </RadialBar>
                <Tooltip
                  formatter={(val, name) => [`${val} sub${val !== 1 ? "s" : ""}`, name]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-slate-800">{overallPct}%</span>
              <span className="text-[9px] text-slate-400 font-medium leading-tight">avg done</span>
            </div>
          </div>

          <div className="space-y-2 flex-1">
            {[
              { label: "Complete",    count: fullyComplete.length, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "In Progress", count: inProgress.length,    icon: Clock,        color: "text-orange-500",  bg: "bg-orange-50" },
              { label: "Not Started", count: notStarted.length,    icon: AlertTriangle,color: "text-slate-500",   bg: "bg-slate-100" },
            ].map(({ label, count, icon: Icon, color, bg }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="text-xs font-bold text-slate-700">{count}</span>
                  </div>
                  <div className="mt-0.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-1 rounded-full transition-all duration-500"
                      style={{
                        width: `${activeSubs.length > 0 ? (count / activeSubs.length) * 100 : 0}%`,
                        background: color.replace("text-", "").includes("emerald") ? "#10b981"
                          : color.includes("orange") ? "#f97316" : "#94a3b8"
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Per-sub progress bars */}
        <div className="p-5 space-y-3 max-h-56 overflow-y-auto">
          {sorted.map(v => {
            const { done, total, pct } = getCompletionScore(v);
            const cfg = pct === 100 ? STATUS_CONFIG.completed
              : pct > 0 ? STATUS_CONFIG.in_progress
              : STATUS_CONFIG.not_started;
            return (
              <div key={v.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-700 truncate max-w-[140px]">{v.company_name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      {done}/{total}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">{pct}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: cfg.color }}
                  />
                </div>
                {/* Missing items hint */}
                {pct < 100 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {DOC_CHECKS.filter(c => !c.valueCheck(v)).map(c => (
                      <span key={c.key} className="text-[9px] text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                        {c.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}