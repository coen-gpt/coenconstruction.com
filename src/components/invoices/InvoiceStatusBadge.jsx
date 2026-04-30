const STATUS_MAP = {
  pending_review: { label: "Pending Review", cls: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
  approved:       { label: "Approved",       cls: "bg-blue-50 text-blue-700 border border-blue-200" },
  outstanding:    { label: "Outstanding",    cls: "bg-orange-50 text-orange-700 border border-orange-200" },
  paid:           { label: "Paid",           cls: "bg-green-50 text-green-700 border border-green-200" },
  rejected:       { label: "Rejected",       cls: "bg-red-50 text-red-700 border border-red-200" },
  on_hold:        { label: "On Hold",        cls: "bg-gray-100 text-gray-600 border border-gray-200" },
};

export default function InvoiceStatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pending_review;
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}