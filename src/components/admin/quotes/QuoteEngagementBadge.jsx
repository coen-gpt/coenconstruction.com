import { Eye, MailOpen, MailQuestion } from "lucide-react";
import { format } from "date-fns";

const fmt = (d) => {
  if (!d) return null;
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? null : format(date, "MMM d, h:mm a");
};

/**
 * Engagement pill for a sent quote: did the customer open the email / view
 * the quote? Hidden for drafts and decided quotes — the status badge already
 * tells that story. Hover shows timestamps and any reminders sent.
 */
export default function QuoteEngagementBadge({ row, className = "" }) {
  if (row.status !== "sent") return null;

  const viewed = fmt(row.viewed_at);
  const opened = fmt(row.opened_at);

  const meta = viewed
    ? { label: "Viewed", Icon: Eye, badge: "bg-emerald-50 text-emerald-700 border border-emerald-200" }
    : opened
      ? { label: "Opened", Icon: MailOpen, badge: "bg-sky-50 text-sky-700 border border-sky-200" }
      : { label: "Not opened", Icon: MailQuestion, badge: "bg-gray-50 text-gray-500 border border-gray-200" };

  const details = [
    row.sent_at ? `Sent ${fmt(row.sent_at)}` : null,
    opened ? `Opened ${opened}${row.open_count > 1 ? ` (${row.open_count}×)` : ""}` : "Email not opened yet",
    viewed ? `Viewed ${viewed}${row.view_count > 1 ? ` (${row.view_count}×)` : ""}` : null,
    row.nudge_count ? `${row.nudge_count} reminder${row.nudge_count !== 1 ? "s" : ""} sent (last ${fmt(row.last_nudged_at) || "—"})` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { Icon } = meta;
  return (
    <span
      title={details}
      aria-label={`Engagement: ${meta.label}`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${meta.badge} ${className}`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {meta.label}
      {row.nudge_count > 0 ? <span className="text-[9px] opacity-70">· {row.nudge_count} nudge{row.nudge_count !== 1 ? "s" : ""}</span> : null}
    </span>
  );
}
