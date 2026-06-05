import { TrendingUp, TrendingDown, Minus, Send, CheckCircle2, Percent } from "lucide-react";
import { ESTIMATE_STATUSES, getEstimateStatusMeta, RECENT_WINDOW_DAYS } from "@/lib/estimateStatus";

const money = (n) => `$${Math.round(n || 0).toLocaleString()}`;

function DeltaChip({ value, suffix = "%", positiveIsGood = true }) {
  const rounded = Math.round((value || 0) * 10) / 10;
  const isZero = rounded === 0;
  const isUp = rounded > 0;
  const good = positiveIsGood ? isUp : !isUp;
  const Icon = isZero ? Minus : isUp ? TrendingUp : TrendingDown;
  const tone = isZero ? "text-gray-400" : good ? "text-green-600" : "text-red-500";
  const sign = isUp ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${tone}`}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      {isZero ? "0" : `${sign}${rounded}`}
      {suffix}
    </span>
  );
}

function MetricCard({ icon: Icon, label, brandColor, children, accent }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 sm:p-5 border-l-4 ${accent || ""}`}>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${brandColor}15` }}
        >
          <Icon className="w-4 h-4" style={{ color: brandColor }} aria-hidden="true" />
        </div>
        <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide font-semibold leading-tight">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

/**
 * Top-row overview cards, computed only from customer Estimate data.
 * Pipeline (status counts) · Approval rate · Sent (30d) · Approved (30d).
 */
export default function QuoteMetricCards({ metrics, brandColor = "#E35235" }) {
  const { pipeline = {}, approvalRate, sent, approved } = metrics || {};
  const win = `vs prev ${RECENT_WINDOW_DAYS}d`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Pipeline overview — counts by status */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide font-semibold">
            Pipeline
          </span>
          <span className="ml-auto text-xs text-gray-400">{metrics?.total ?? 0} total</span>
        </div>
        <ul className="space-y-1.5">
          {ESTIMATE_STATUSES.map((s) => {
            const meta = getEstimateStatusMeta(s);
            return (
              <li key={s} className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${meta.dot}`} aria-hidden="true" />
                <span className="text-gray-600">{meta.label}</span>
                <span className="ml-auto font-bold text-secondary tabular-nums">{pipeline[s] || 0}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Approval rate */}
      <MetricCard icon={Percent} label="Approval rate (30d)" brandColor={brandColor} accent="border-l-green-500">
        <div className="text-2xl font-bold text-secondary">
          {Math.round(approvalRate?.value || 0)}%
        </div>
        <div className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
          <DeltaChip value={approvalRate?.deltaPp || 0} suffix="pts" />
          <span>{win}</span>
        </div>
      </MetricCard>

      {/* Sent (30d) */}
      <MetricCard icon={Send} label="Sent (30d)" brandColor={brandColor} accent="border-l-amber-500">
        <div className="text-2xl font-bold text-secondary">{sent?.count || 0}</div>
        <div className="text-sm font-semibold text-gray-500">{money(sent?.total)}</div>
        <div className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
          <DeltaChip value={sent?.deltaPct || 0} />
          <span>{win}</span>
        </div>
      </MetricCard>

      {/* Approved (30d) */}
      <MetricCard icon={CheckCircle2} label="Approved (30d)" brandColor={brandColor} accent="border-l-green-500">
        <div className="text-2xl font-bold text-secondary">{approved?.count || 0}</div>
        <div className="text-sm font-semibold text-gray-500">{money(approved?.total)}</div>
        <div className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
          <DeltaChip value={approved?.deltaPct || 0} />
          <span>{win}</span>
        </div>
      </MetricCard>
    </div>
  );
}
