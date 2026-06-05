import { CheckCircle, XCircle, Shield, FileText, Lock, ArrowRight, ExternalLink, Phone } from "lucide-react";

const INS_STATUS = {
  valid:         { label: "Valid",          color: "text-green-600", bg: "bg-green-50 border-green-200" },
  expiring_soon: { label: "Expiring Soon",  color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  expired:       { label: "Expired",        color: "text-red-600",   bg: "bg-red-50 border-red-200" },
  pending:       { label: "Pending Review", color: "text-gray-500",  bg: "bg-gray-50 border-gray-200" },
};

export default function SubComplianceTab({ vendor, onGoToForms }) {
  if (!vendor) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
      <Shield className="w-10 h-10 text-gray-200 mx-auto mb-3" />
      <p className="text-gray-500 font-medium">Compliance info not available</p>
      <p className="text-gray-400 text-sm mt-1">Contact Coen Construction to link your vendor record.</p>
    </div>
  );

  const packetDone = vendor.packet_status === "completed";
  const insStatus = INS_STATUS[vendor.insurance_status] || INS_STATUS.pending;

  const items = [
    { key: "packet", label: "Subcontractor Agreement Signed", done: packetDone, signedAt: vendor.packet_signed_at },
    { key: "wc",     label: "Workers Comp Insurance",         done: !!vendor.workers_comp_url,   expiry: vendor.workers_comp_expiry, url: vendor.workers_comp_url },
    { key: "gl",     label: "General Liability Insurance",    done: !!vendor.liability_ins_url,  expiry: vendor.liability_ins_expiry, url: vendor.liability_ins_url },
    { key: "w9",     label: "W-9 Form",                       done: !!vendor.w9_url,             url: vendor.w9_url },
  ];

  const score = items.filter(i => i.done).length;

  return (
    <div className="space-y-4">
      {/* Overall packet status banner */}
      <div className={`rounded-2xl border p-4 flex items-center gap-4 ${packetDone ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-300"}`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${packetDone ? "bg-green-100" : "bg-amber-100"}`}>
          {packetDone ? <CheckCircle className="w-6 h-6 text-green-600" /> : <Lock className="w-6 h-6 text-amber-600" />}
        </div>
        <div className="flex-1">
          <div className={`font-bold text-sm ${packetDone ? "text-green-800" : "text-amber-900"}`}>
            {packetDone ? "Onboarding Complete" : "Onboarding Packet Required"}
          </div>
          <div className={`text-xs mt-0.5 ${packetDone ? "text-green-700" : "text-amber-700"}`}>
            {packetDone
              ? `Signed ${vendor.packet_signed_at ? new Date(vendor.packet_signed_at).toLocaleDateString() : ""}`
              : "You cannot receive bids or payments until your packet is complete."}
          </div>
        </div>
        {!packetDone && (
          <button
            onClick={onGoToForms}
            className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            Start Now <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Insurance combined status */}
      <div className={`rounded-2xl border p-4 ${insStatus.bg}`}>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-500" />
          <span className="font-semibold text-sm text-secondary">Insurance Status</span>
          <span className={`text-xs font-bold ml-auto ${insStatus.color}`}>{insStatus.label}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Combined Workers Comp + General Liability</p>
      </div>

      {/* Document checklist */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-secondary">Document Checklist</h2>
          <span className={`text-sm font-bold ${score === 4 ? "text-green-600" : "text-[#E35235]"}`}>{score}/4</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
          <div className="h-full bg-[#E35235] rounded-full transition-all" style={{ width: `${(score / 4) * 100}%` }} />
        </div>

        <div className="space-y-3">
          {items.map(item => (
            <div key={item.key} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
              {item.done
                ? <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                : <XCircle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />}
              <div className="flex-1">
                <div className={`text-sm font-medium ${item.done ? "text-gray-800" : "text-gray-500"}`}>{item.label}</div>
                {item.signedAt && <div className="text-xs text-gray-400">Signed {new Date(item.signedAt).toLocaleDateString()}</div>}
                {item.expiry && (
                  <div className={`text-xs ${new Date(item.expiry) < new Date() ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                    Expires {new Date(item.expiry).toLocaleDateString()}{new Date(item.expiry) < new Date() ? " — EXPIRED" : ""}
                  </div>
                )}
              </div>
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline shrink-0 flex items-center gap-0.5 mt-0.5">
                  View <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ))}
        </div>

        {!packetDone && (
          <button
            onClick={onGoToForms}
            className="mt-4 flex items-center justify-center gap-2 w-full bg-[#1B2B3A] text-white font-semibold py-3 rounded-xl text-sm hover:bg-[#1B2B3A]/90 transition-colors"
          >
            Complete Onboarding Forms <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Resources */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-secondary mb-3">Resources</h2>
        <a href="https://www.irs.gov/pub/irs-pdf/fw9.pdf" target="_blank" rel="noreferrer"
          className="flex items-center gap-3 py-2.5 border-b border-gray-50 text-sm text-blue-600 hover:underline">
          <FileText className="w-4 h-4 text-gray-400" /> Download IRS W-9 Form <ExternalLink className="w-3 h-3 ml-auto" />
        </a>
        <a href="mailto:coenconstruction@gmail.com"
          className="flex items-center gap-3 py-2.5 text-sm text-blue-600 hover:underline">
          <Phone className="w-4 h-4 text-gray-400" /> coenconstruction@gmail.com <ExternalLink className="w-3 h-3 ml-auto" />
        </a>
      </div>
    </div>
  );
}