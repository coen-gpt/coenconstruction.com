export default function SeoScoreBadge({ score, label, size = "md" }) {
  const color = score >= 80 ? "text-green-700 bg-green-50 border-green-200"
    : score >= 60 ? "text-yellow-700 bg-yellow-50 border-yellow-200"
    : "text-red-700 bg-red-50 border-red-200";

  const bar = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500";

  if (size === "sm") {
    return (
      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${color}`}>{score ?? "?"}</span>
    );
  }

  return (
    <div className={`rounded-xl border p-3 text-center ${color}`}>
      <div className="text-2xl font-black">{score ?? "?"}</div>
      <div className="text-xs font-semibold mt-0.5">{label}</div>
      <div className="mt-2 h-1.5 rounded-full bg-black/10 overflow-hidden">
        <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${score ?? 0}%` }} />
      </div>
    </div>
  );
}