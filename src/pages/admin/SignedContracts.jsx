import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import adminEntities from "@/api/adminEntities";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileCheck, Search, PenLine, Printer, ExternalLink, CreditCard } from "lucide-react";

const TYPE_LABELS = { contract: "Contract", change_order: "Change Order" };
const VIA_LABELS = { customer_portal: "Customer Portal", approval_link: "Approval Link" };

const fmtUSD = (n) => (n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

/**
 * Signed Contracts — the immutable archive of every customer-executed
 * document (original contracts + change orders). Each record freezes the full
 * contract text, signature image, and payment-schedule snapshot exactly as
 * signed. Read-only: nothing here can be edited or deleted.
 *
 * Lives at /admin/contracts (gated by AdminUser.can_access_estimates).
 */
export default function SignedContracts() {
  const { brandColor } = useCompanyBrand();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewing, setViewing] = useState(null);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["signed-contracts"],
    queryFn: () => adminEntities.SignedContract.list("-created_date", 500),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts
      .filter(c => typeFilter === "all" || c.document_type === typeFilter)
      .filter(c => {
        if (!q) return true;
        return [c.client_name, c.client_email, c.project_address, c.project_type, c.signed_name]
          .some(v => (v || "").toLowerCase().includes(q));
      })
      .sort((a, b) => new Date(b.signed_at || b.created_date || 0) - new Date(a.signed_at || a.created_date || 0));
  }, [contracts, search, typeFilter]);

  const printContract = (c) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Signed ${TYPE_LABELS[c.document_type] || "Contract"} — ${c.client_name || ""}</title>
      <style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;color:#1B2B3A;line-height:1.55;font-size:13px}
      h1{font-size:18px} .meta{color:#666;font-size:12px;margin-bottom:24px} pre{white-space:pre-wrap;font-family:inherit}
      .sig{margin-top:32px;border-top:1px solid #ccc;padding-top:16px} img{max-width:320px;border:1px solid #ddd;border-radius:6px}</style>
      </head><body>
      <h1>Signed ${TYPE_LABELS[c.document_type] || "Contract"}</h1>
      <div class="meta">${c.client_name || ""} · ${c.project_address || ""}<br/>
      Signed ${fmtDate(c.signed_at)} via ${VIA_LABELS[c.signed_via] || "online"}${c.contract_version ? ` · Contract version ${c.contract_version}` : ""}</div>
      <pre>${(c.contract_text || "").replace(/</g, "&lt;")}</pre>
      ${(c.payment_schedule_snapshot || []).length ? `<h3>Exhibit B — Schedule of Payments</h3><pre>${c.payment_schedule_snapshot.join("\n").replace(/</g, "&lt;")}</pre>` : ""}
      <div class="sig"><strong>Signature</strong><br/>${c.signature_data ? `<img src="${c.signature_data}" alt="signature"/>` : "(no image)"}<br/>
      Printed name: ${c.signed_name || c.client_name || ""}<br/>Date: ${fmtDate(c.signed_at)}</div>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-secondary flex items-center gap-2">
            <FileCheck className="w-5 h-5" style={{ color: brandColor }} />
            Signed Contracts
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Every customer-executed contract and change order — the exact text, signature, and payment schedule as signed.
          </p>
        </div>
        <div className="text-sm text-gray-400">{rows.length} document{rows.length === 1 ? "" : "s"}</div>
      </div>

      {/* Search + type filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search client, email, address, project type…"
            className="pl-9"
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {[["all", "All"], ["contract", "Contracts"], ["change_order", "Change Orders"]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTypeFilter(val)}
              className={`px-3 py-1.5 font-medium transition-colors ${typeFilter === val ? "text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              style={typeFilter === val ? { backgroundColor: brandColor } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-16 text-center text-gray-400">Loading signed contracts…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl py-16 text-center text-gray-400">
          <PenLine className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="font-medium">No signed contracts {search || typeFilter !== "all" ? "match your filters" : "yet"}</p>
          <p className="text-xs mt-1">When a customer signs a contract or change order, the executed copy is archived here automatically.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="hidden md:grid grid-cols-[1.4fr_1.4fr_0.8fr_0.7fr_1fr_auto] gap-3 px-5 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wide">
            <span>Client</span><span>Project</span><span>Type</span><span>Amount</span><span>Signed</span><span></span>
          </div>
          <div className="divide-y divide-gray-100">
            {rows.map(c => (
              <button
                key={c.id}
                onClick={() => setViewing(c)}
                className="w-full grid grid-cols-1 md:grid-cols-[1.4fr_1.4fr_0.8fr_0.7fr_1fr_auto] gap-1 md:gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors items-center"
              >
                <span>
                  <span className="text-sm font-semibold text-secondary block">{c.client_name || "—"}</span>
                  <span className="text-xs text-gray-400">{c.client_email || ""}</span>
                </span>
                <span className="text-xs text-gray-500">{c.project_address || c.project_type || "—"}</span>
                <span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.document_type === "change_order" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                    {c.document_type === "change_order" ? `CO #${c.change_order_number || ""}` : "Contract"}
                  </span>
                </span>
                <span className="text-sm font-bold text-gray-700">${fmtUSD(c.contract_price)}</span>
                <span className="text-xs text-gray-500">{fmtDate(c.signed_at)}</span>
                <ExternalLink className="w-4 h-4 text-gray-300 justify-self-end hidden md:block" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Viewer */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5" style={{ color: brandColor }} />
                  Signed {TYPE_LABELS[viewing.document_type] || "Contract"} — {viewing.client_name}
                </DialogTitle>
              </DialogHeader>

              {/* Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  ["Amount", `$${fmtUSD(viewing.contract_price)}`],
                  ["Signed", fmtDate(viewing.signed_at)],
                  ["Via", VIA_LABELS[viewing.signed_via] || "Online"],
                  ["Version", viewing.contract_version || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 rounded-lg px-3 py-2">
                    <div className="text-gray-400 font-semibold uppercase tracking-wide text-[10px]">{k}</div>
                    <div className="text-secondary font-bold mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 -mt-1">
                {viewing.project_address}{viewing.project_type ? ` · ${viewing.project_type}` : ""}
                {viewing.project_id && (
                  <> · <Link to={`/estimator/projects/${viewing.project_id}`} className="underline hover:text-secondary">Open project</Link></>
                )}
              </div>

              {/* Contract text */}
              {viewing.contract_text ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-700 leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap">
                  {viewing.contract_text}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
                  No contract text snapshot was stored with this signature (signed before text archiving was added).
                </div>
              )}

              {/* Payment schedule snapshot */}
              {(viewing.payment_schedule_snapshot || []).length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-secondary flex items-center gap-1.5 mb-2">
                    <CreditCard className="w-3.5 h-3.5" /> Exhibit B — Schedule of Payments (as signed)
                  </p>
                  <ul className="space-y-1 text-xs text-gray-600">
                    {viewing.payment_schedule_snapshot.map((line, i) => <li key={i}>• {line}</li>)}
                  </ul>
                </div>
              )}

              {/* Signature */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-bold text-secondary flex items-center gap-1.5 mb-2">
                  <PenLine className="w-3.5 h-3.5" /> Signature
                </p>
                {viewing.signature_data ? (
                  <img src={viewing.signature_data} alt="Customer signature" className="max-w-xs border border-gray-100 rounded-lg bg-gray-50" />
                ) : (
                  <p className="text-xs text-gray-400">No signature image stored.</p>
                )}
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Printed name: <strong className="text-secondary">{viewing.signed_name || viewing.client_name || "—"}</strong></span>
                  <span>{fmtDate(viewing.signed_at)}</span>
                </div>
              </div>

              <Button onClick={() => printContract(viewing)} variant="outline" className="gap-2 w-full">
                <Printer className="w-4 h-4" /> Print / Save as PDF
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
