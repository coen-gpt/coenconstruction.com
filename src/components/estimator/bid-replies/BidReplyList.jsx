import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

function money(value) {
  return Number(value) ? `$${Number(value).toLocaleString()}` : "Needs review";
}

function dateLabel(value) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return `${formatDistanceToNow(date, { addSuffix: true })}`;
}

export default function BidReplyList({ replies }) {
  if (!replies.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <h3 className="font-bold text-gray-900">No pending scanned bid replies</h3>
        <p className="text-sm text-gray-500 mt-1">New MTO and SoW replies will appear here after the inbox scanner processes them.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Project / Request</th>
              <th className="px-4 py-3">Reply From</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {replies.map((reply) => (
              <tr key={reply.key} className="hover:bg-gray-50 align-top">
                <td className="px-4 py-3 min-w-[220px]">
                  <div className="font-semibold text-gray-900">{reply.project_title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{reply.source_type}</div>
                </td>
                <td className="px-4 py-3 min-w-[180px]">
                  <div className="font-medium text-gray-800">{reply.sender_name || "Unknown"}</div>
                  <div className="text-xs text-gray-500">{reply.sender_email}</div>
                </td>
                <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{money(reply.amount)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Badge variant={reply.quote_type === "official_quote" ? "default" : "outline"}>
                    {reply.quote_type === "official_quote" ? "Official" : "Quick quote"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{dateLabel(reply.received_date)}</td>
                <td className="px-4 py-3 min-w-[260px] text-gray-600">{reply.notes || reply.body_snippet || "No notes captured"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}