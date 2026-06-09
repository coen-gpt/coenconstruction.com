import { AlertTriangle, DollarSign, FileText, PackageSearch } from "lucide-react";

function StatCard({ label, value, icon: Icon, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    red: "bg-red-50 text-red-700 border-red-200",
    green: "bg-green-50 text-green-700 border-green-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <Icon className="h-6 w-6 opacity-70" />
      </div>
    </div>
  );
}

export default function BidReplyStats({ replies }) {
  const missingAmount = replies.filter((reply) => !reply.amount).length;
  const officialQuotes = replies.filter((reply) => reply.quote_type === "official_quote").length;
  const totalValue = replies.reduce((sum, reply) => sum + (Number(reply.amount) || 0), 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <StatCard label="Pending Replies" value={replies.length} icon={AlertTriangle} tone="red" />
      <StatCard label="Official Quotes" value={officialQuotes} icon={FileText} tone="blue" />
      <StatCard label="Missing Amount" value={missingAmount} icon={PackageSearch} tone="slate" />
      <StatCard label="Quoted Value" value={`$${totalValue.toLocaleString()}`} icon={DollarSign} tone="green" />
    </div>
  );
}