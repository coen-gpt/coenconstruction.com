import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, RefreshCw, AlertCircle } from "lucide-react";

export default function EstimateApproval() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  const [status, setStatus] = useState("idle"); // idle | loading | success | error | expired
  const [action, setAction] = useState(null); // approve | deny | modify
  const [notes, setNotes] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [details, setDetails] = useState(null); // sanitized project + estimate from the backend
  const [detailsLoading, setDetailsLoading] = useState(true);

  // Load the estimate so the customer can see what they're approving.
  useEffect(() => {
    if (!token) { setStatus("error"); setDetailsLoading(false); return; }
    base44.functions.invoke("processApproval", { token, action: "view" })
      .then(res => setDetails(res.data))
      .catch(err => {
        const msg = err?.response?.data?.error || err.message || "";
        if (msg.toLowerCase().includes("expired")) setStatus("expired");
        else { setStatus("error"); setResultMessage("This link is invalid or has already been used. Please contact your estimator."); }
      })
      .finally(() => setDetailsLoading(false));
  }, [token]);

  const handleAction = async (selectedAction) => {
    if (selectedAction !== "approve" && !notes.trim() && selectedAction === "modify") {
      // notes recommended but not required for deny/modify
    }
    setAction(selectedAction);
    if (selectedAction !== "approve") return; // for deny/modify, show notes form first
    await submitAction(selectedAction, "");
  };

  const submitAction = async (act, notesText) => {
    setSubmitting(true);
    setStatus("loading");
    try {
      const res = await base44.functions.invoke("processApproval", {
        token,
        action: act,
        notes: notesText,
      });
      const labels = { approve: "Approved", deny: "Denied", modify: "Modifications Requested" };
      setResultMessage(labels[act]);
      setStatus("success");
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || "Something went wrong";
      if (msg.toLowerCase().includes("expired")) {
        setStatus("expired");
      } else {
        setStatus("error");
        setResultMessage(msg);
      }
    }
    setSubmitting(false);
  };

  if (!token) {
    return <ErrorScreen message="Invalid approval link. Please contact your estimator." />;
  }

  if (status === "expired") {
    return <ErrorScreen message="This approval link has expired. Please contact your estimator for a new one." />;
  }

  if (status === "error") {
    return <ErrorScreen message={resultMessage || "Something went wrong. Please try again or contact your estimator."} />;
  }

  if (status === "success") {
    const icons = {
      Approved: <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />,
      Denied: <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />,
      "Modifications Requested": <RefreshCw className="w-16 h-16 text-yellow-500 mx-auto mb-4" />,
    };
    const colors = {
      Approved: "text-green-700 bg-green-50",
      Denied: "text-red-700 bg-red-50",
      "Modifications Requested": "text-yellow-700 bg-yellow-50",
    };
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          {icons[resultMessage]}
          <h2 className={`text-2xl font-bold mb-2 px-4 py-2 rounded-lg inline-block ${colors[resultMessage]}`}>
            {resultMessage}
          </h2>
          <p className="text-gray-600 mt-4">
            {resultMessage === "Approved" && "Thank you! The estimate has been approved and the team has been notified."}
            {resultMessage === "Denied" && "Your response has been recorded. The estimating team will follow up with you."}
            {resultMessage === "Modifications Requested" && "Your modification request has been sent. The estimator will review your notes and follow up."}
          </p>
          <p className="text-sm text-gray-400 mt-6">You may close this window.</p>
        </div>
      </div>
    );
  }

  // Show notes form for deny / modify before submitting
  if (action && action !== "approve") {
    const isModify = action === "modify";
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            {isModify
              ? <RefreshCw className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
              : <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />}
            <h2 className="text-xl font-bold text-secondary">
              {isModify ? "Request Modifications" : "Deny Estimate"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isModify
                ? "Please describe what changes or modifications are needed."
                : "Please let us know why you're declining this estimate."}
            </p>
          </div>
          <Textarea
            rows={5}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={isModify
              ? "Describe the modifications needed (e.g. reduce deck size, change material selections, adjust labor costs)..."
              : "Reason for denial..."}
            className="mb-4"
          />
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setAction(null)}
              disabled={submitting}
            >
              ← Back
            </Button>
            <Button
              className={`flex-1 ${isModify ? "bg-yellow-500 hover:bg-yellow-600" : "bg-red-600 hover:bg-red-700"} text-white`}
              onClick={() => submitAction(action, notes)}
              disabled={submitting || !notes.trim()}
            >
              {submitting ? "Submitting…" : isModify ? "Submit Modifications" : "Confirm Denial"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (detailsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading your estimate…</p>
        </div>
      </div>
    );
  }

  const estimate = details?.estimate;
  const lineGroups = (estimate?.line_items || []).reduce((acc, item) => {
    const g = item.parent_group || "General";
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});
  const docLabel = estimate?.type === "change_order"
    ? `Change Order #${estimate.change_order_number || ""}`
    : "Project Estimate";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-lg w-full my-6">
        {/* Header */}
        <div className="bg-secondary rounded-t-2xl p-6 text-center">
          <h1 className="text-2xl font-bold text-primary">Coen Construction</h1>
          <p className="text-white/80 text-sm mt-1">Estimate Review Portal</p>
        </div>

        <div className="bg-white rounded-b-2xl shadow-xl p-4 sm:p-8">
          {/* Estimate summary so the customer knows exactly what they're approving */}
          {details && (
            <div className="mb-6">
              <div className="text-center mb-4">
                <div className="font-bold text-secondary text-lg">{docLabel}</div>
                <div className="text-sm text-gray-500">
                  {details.client_name}
                  {details.project_type ? ` · ${details.project_type}` : ""}
                </div>
                {details.client_address && (
                  <div className="text-xs text-gray-400 mt-0.5">{details.client_address}</div>
                )}
              </div>

              {estimate && (
                <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                    {Object.entries(lineGroups).map(([group, items]) => (
                      <div key={group}>
                        <div className="bg-gray-50 px-4 py-2 flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{group}</span>
                          <span className="text-xs font-bold text-primary">
                            ${items.reduce((s, i) => s + (i.total || 0), 0).toLocaleString()}
                          </span>
                        </div>
                        {items.map((item, idx) => (
                          <div key={idx} className="px-4 py-2.5 flex justify-between items-start gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-secondary">{item.title}</div>
                              {item.quantity && item.unit ? (
                                <div className="text-xs text-gray-400">{item.quantity} {item.unit}</div>
                              ) : null}
                            </div>
                            <span className="text-sm font-semibold text-gray-700 shrink-0">
                              ${(item.total || 0).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 bg-secondary">
                    <span className="text-white font-bold">Total</span>
                    <span className="text-primary font-bold text-xl">
                      ${(estimate.grand_total || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {estimate?.notes && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap mb-1">
                  <span className="font-semibold text-secondary block mb-1">Notes & Terms</span>
                  {estimate.notes}
                </div>
              )}
              {estimate?.valid_until && (
                <p className="text-xs text-blue-600 text-center mt-2">
                  This estimate is valid until {new Date(estimate.valid_until).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
          )}

          <p className="text-gray-600 text-center mb-6">
            Please review the estimate and select one of the options below.
          </p>

          <div className="space-y-4">
            {/* Approve */}
            <button
              onClick={() => handleAction("approve")}
              disabled={submitting}
              className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-400 transition-all text-left disabled:opacity-50"
            >
              <CheckCircle2 className="w-8 h-8 text-green-600 shrink-0" />
              <div>
                <div className="font-bold text-green-800 text-lg">Approve</div>
                <div className="text-sm text-green-700">I approve this estimate and authorize the work to proceed.</div>
              </div>
            </button>

            {/* Request Modifications */}
            <button
              onClick={() => handleAction("modify")}
              disabled={submitting}
              className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-yellow-200 bg-yellow-50 hover:bg-yellow-100 hover:border-yellow-400 transition-all text-left disabled:opacity-50"
            >
              <RefreshCw className="w-8 h-8 text-yellow-600 shrink-0" />
              <div>
                <div className="font-bold text-yellow-800 text-lg">Request Modifications</div>
                <div className="text-sm text-yellow-700">I need changes made before I can approve this estimate.</div>
              </div>
            </button>

            {/* Deny */}
            <button
              onClick={() => handleAction("deny")}
              disabled={submitting}
              className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-400 transition-all text-left disabled:opacity-50"
            >
              <XCircle className="w-8 h-8 text-red-600 shrink-0" />
              <div>
                <div className="font-bold text-red-800 text-lg">Deny</div>
                <div className="text-sm text-red-700">I do not wish to proceed with this estimate.</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-secondary mb-2">Link Error</h2>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}