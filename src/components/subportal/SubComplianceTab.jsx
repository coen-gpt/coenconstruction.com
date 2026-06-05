import { CheckCircle2, Clock, AlertTriangle, XCircle, ChevronRight, FileText, Shield, PenLine, FileCheck, ExternalLink, ArrowRight, Phone } from "lucide-react";

const STEPS = [
  {
    key: "packet",
    step: 1,
    label: "Subcontractor Agreement",
    description: "Review and digitally sign the subcontractor terms & conditions.",
    icon: PenLine,
  },
  {
    key: "wc",
    step: 2,
    label: "Workers Comp Insurance",
    description: "Upload a current Workers Compensation certificate of insurance.",
    icon: Shield,
  },
  {
    key: "gl",
    step: 3,
    label: "General Liability Insurance",
    description: "Upload a current General Liability certificate of insurance.",
    icon: Shield,
  },
  {
    key: "w9",
    step: 4,
    label: "W-9 Tax Form",
    description: "Upload your completed IRS W-9 form for payment processing.",
    icon: FileText,
  },
];

function getItemStatus(key, vendor) {
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (key === "packet") {
    if (vendor.packet_status === "completed") return { type: "approved", label: "Approved", detail: vendor.packet_signed_at ? `Signed ${new Date(vendor.packet_signed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "Signed" };
    if (vendor.packet_status === "in_progress") return { type: "pending", label: "In Progress", detail: "Started but not yet signed" };
    return { type: "action", label: "Action Required", detail: "Signature needed to proceed" };
  }
  if (key === "wc") {
    if (!vendor.workers_comp_url) return { type: "action", label: "Action Required", detail: "Certificate not on file" };
    const exp = vendor.workers_comp_expiry ? new Date(vendor.workers_comp_expiry) : null;
    if (exp && exp < now) return { type: "expired", label: "Expired", detail: `Expired ${exp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` };
    if (exp && exp < soon) return { type: "expiring", label: "Expiring Soon", detail: `Expires ${exp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` };
    return { type: "approved", label: "On File", detail: vendor.workers_comp_expiry ? `Expires ${new Date(vendor.workers_comp_expiry).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "Current" };
  }
  if (key === "gl") {
    if (!vendor.liability_ins_url) return { type: "action", label: "Action Required", detail: "Certificate not on file" };
    const exp = vendor.liability_ins_expiry ? new Date(vendor.liability_ins_expiry) : null;
    if (exp && exp < now) return { type: "expired", label: "Expired", detail: `Expired ${exp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` };
    if (exp && exp < soon) return { type: "expiring", label: "Expiring Soon", detail: `Expires ${exp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` };
    return { type: "approved", label: "On File", detail: vendor.liability_ins_expiry ? `Expires ${new Date(vendor.liability_ins_expiry).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "Current" };
  }
  if (key === "w9") {
    if (!vendor.w9_url) return { type: "action", label: "Action Required", detail: "W-9 not on file" };
    return { type: "approved", label: "On File", detail: "Tax form received" };
  }
  return { type: "pending", label: "Pending", detail: "" };
}

const STATUS_CONFIG = {
  approved:  { icon: CheckCircle2,    iconColor: "text-green-500",  bg: "bg-green-50",   border: "border-green-200", badgeBg: "bg-green-100",  badgeText: "text-green-700",  stepBg: "bg-green-500" },
  pending:   { icon: Clock,           iconColor: "text-gray-400",   bg: "bg-gray-50",    border: "border-gray-200",  badgeBg: "bg-gray-100",   badgeText: "text-gray-600",   stepBg: "bg-gray-300" },
  action:    { icon: AlertTriangle,   iconColor: "text-amber-500",  bg: "bg-amber-50",   border: "border-amber-200", badgeBg: "bg-amber-100",  badgeText: "text-amber-700",  stepBg: "bg-amber-500" },
  expiring:  { icon: AlertTriangle,   iconColor: "text-amber-500",  bg: "bg-amber-50",   border: "border-amber-200", badgeBg: "bg-amber-100",  badgeText: "text-amber-700",  stepBg: "bg-amber-400" },
  expired:   { icon: XCircle,         iconColor: "text-red-500",    bg: "bg-red-50",     border: "border-red-200",   badgeBg: "bg-red-100",    badgeText: "text-red-700",    stepBg: "bg-red-500" },
};

function getDocUrl(key, vendor) {
  if (key === "wc") return vendor.workers_comp_url;
  if (key === "gl") return vendor.liability_ins_url;
  if (key === "w9") return vendor.w9_url;
  return null;
}

export default function SubComplianceTab({ vendor, onGoToForms }) {
  if (!vendor) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
      <Shield className="w-10 h-10 text-gray-200 mx-auto mb-3" />
      <p className="text-gray-500 font-medium">Compliance info not available</p>
      <p className="text-gray-400 text-sm mt-1">Contact Coen Construction to link your vendor record.</p>
    </div>
  );

  const statuses = STEPS.map(s => ({ ...s, status: getItemStatus(s.key, vendor) }));
  const approvedCount = statuses.filter(s => s.status.type === "approved").length;
  const hasIssues = statuses.some(s => ["action", "expired", "expiring"].includes(s.status.type));
  const allDone = approvedCount === 4;
  const pct = Math.round((approvedCount / 4) * 100);

  return (
    <div className="space-y-4">

      {/* ── Overall progress card ── */}
      <div className={`rounded-2xl border p-5 ${allDone ? "bg-green-50 border-green-200" : hasIssues ? "bg-amber-50 border-amber-200" : "bg-white border-gray-100 shadow-sm"}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className={`font-bold text-base ${allDone ? "text-green-800" : "text-[#1B2B3A]"}`}>
              {allDone ? "✅ All Requirements Met" : "Onboarding Progress"}
            </h2>
            <p className={`text-xs mt-0.5 ${allDone ? "text-green-700" : "text-gray-500"}`}>
              {allDone
                ? "You are fully compliant and cleared for projects."
                : `${approvedCount} of 4 requirements complete`}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${allDone ? "text-green-600" : pct >= 50 ? "text-amber-500" : "text-[#E35235]"}`}>{pct}%</div>
            <div className="text-xs text-gray-400">complete</div>
          </div>
        </div>

        {/* Progress bar with step ticks */}
        <div className="relative h-3 bg-white/60 rounded-full overflow-hidden border border-white/80 mb-1">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allDone ? "bg-green-500" : "bg-[#E35235]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          {STEPS.map(s => {
            const st = statuses.find(x => x.key === s.key).status;
            const cfg = STATUS_CONFIG[st.type];
            return (
              <div key={s.key} className="flex flex-col items-center gap-0.5">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center ${cfg.stepBg}`}>
                  {st.type === "approved" && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <span className="text-[9px] text-gray-400 hidden sm:block">{s.step}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Step-by-step status cards ── */}
      <div className="space-y-3">
        {statuses.map((item) => {
          const cfg = STATUS_CONFIG[item.status.type];
          const StatusIcon = cfg.icon;
          const StepIcon = item.icon;
          const docUrl = getDocUrl(item.key, vendor);
          const needsAction = ["action", "expired", "expiring"].includes(item.status.type);

          return (
            <div
              key={item.key}
              className={`rounded-2xl border p-4 transition-all ${cfg.bg} ${cfg.border}`}
            >
              <div className="flex items-start gap-3">
                {/* Step number circle */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.stepBg}`}>
                  {item.status.type === "approved"
                    ? <CheckCircle2 className="w-5 h-5 text-white" />
                    : <span className="text-white font-bold text-sm">{item.step}</span>}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[#1B2B3A] text-sm">{item.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.status.detail || item.description}</div>
                    </div>
                    {/* Status badge */}
                    <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}>
                      <StatusIcon className="w-3 h-3" />
                      {item.status.label}
                    </span>
                  </div>

                  {/* Action row */}
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    {docUrl && (
                      <a
                        href={docUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-white border border-blue-200 rounded-lg px-2.5 py-1 transition-colors"
                      >
                        <FileCheck className="w-3 h-3" /> View Document <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {needsAction && (
                      <button
                        onClick={onGoToForms}
                        className="inline-flex items-center gap-1 text-xs font-bold text-white bg-[#E35235] hover:bg-[#E35235]/90 rounded-lg px-2.5 py-1 transition-colors"
                      >
                        {item.status.type === "expired" || item.status.type === "expiring" ? "Upload Renewal" : "Complete Now"}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                    {item.key === "w9" && !vendor.w9_url && (
                      <a
                        href="https://www.irs.gov/pub/irs-pdf/fw9.pdf"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg px-2.5 py-1"
                      >
                        <FileText className="w-3 h-3" /> Download blank W-9
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CTA if anything needs attention ── */}
      {hasIssues && (
        <button
          onClick={onGoToForms}
          className="w-full flex items-center justify-center gap-2 bg-[#1B2B3A] hover:bg-[#1B2B3A]/90 text-white font-bold py-3.5 rounded-2xl text-sm transition-colors"
        >
          Open Onboarding Forms <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* ── Contact ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
        <Phone className="w-4 h-4 text-gray-400 shrink-0" />
        <div className="text-xs text-gray-500">
          Questions about your compliance status?{" "}
          <a href="mailto:coenconstruction@gmail.com" className="text-[#E35235] font-semibold hover:underline">coenconstruction@gmail.com</a>
          {" "}·{" "}
          <a href="tel:+16174126046" className="text-[#E35235] font-semibold hover:underline">(617) 412-6046</a>
        </div>
      </div>
    </div>
  );
}