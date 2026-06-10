/**
 * Shows the three gate status indicators for a sub invoice.
 * gate1 = packet + insurance, gate2 = doc + amount, gate3 = PM approval
 */
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

function GateChip({ pass, warn, label }) {
  if (warn) return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold">
      <AlertTriangle className="w-3 h-3" /> {label}
    </span>
  );
  if (pass) return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
      <CheckCircle2 className="w-3 h-3" /> {label}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
      <XCircle className="w-3 h-3" /> {label}
    </span>
  );
}

export default function GateStatusBadges({ invoice, vendor }) {
  const reasons = invoice.gate_blocked_reasons || [];

  const insuranceExpired = vendor?.insurance_status === "expired" ||
    reasons.some(r => r.toLowerCase().includes("insurance expired"));
  const insuranceExpiringSoon = !insuranceExpired &&
    (vendor?.insurance_status === "expiring_soon" ||
     reasons.some(r => r.toLowerCase().includes("expiring soon")));
  const packetOk = ["completed", "approved"].includes(vendor?.packet_status);
  const gate1Fail = reasons.some(r =>
    r.toLowerCase().includes("packet") ||
    r.toLowerCase().includes("insurance expired") ||
    r.toLowerCase().includes("certificate not on file") ||
    r.toLowerCase().includes("vendor record not linked")
  );

  const gate2Fail = reasons.some(r =>
    r.toLowerCase().includes("no invoice document") ||
    r.toLowerCase().includes("amount is $0")
  );

  const gate3Fail = reasons.some(r => r.toLowerCase().includes("awaiting pm approval"));
  const gate3Pass = invoice.pm_approval_status === "approved";

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <GateChip
        pass={!gate1Fail && !insuranceExpired}
        warn={insuranceExpiringSoon}
        label="G1: Packet"
      />
      <GateChip
        pass={!gate2Fail}
        label="G2: Invoice Doc"
      />
      <GateChip
        pass={gate3Pass}
        label="G3: PM Approved"
      />
      {invoice.ready_for_payment && (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">
          ✓ PAYABLE
        </span>
      )}
    </div>
  );
}