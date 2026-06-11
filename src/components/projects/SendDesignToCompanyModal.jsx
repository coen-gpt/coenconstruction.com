import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { DesignPreviewEvents } from "@/lib/analytics";
import { X, Send, Loader2, Check } from "lucide-react";

// This modal renders on the public shared-design page where visitors are
// anonymous — an authenticated CompanyProfile fetch always 401'd there.
const COMPANY_NAME = "Coen Construction";

export default function SendDesignToCompanyModal({ project, aiDesigns, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const companyName = COMPANY_NAME;

  const handleSend = async () => {
    if (!project) return;
    setLoading(true);
    setError("");

    try {
      await base44.functions.invoke("sendDesignToAdmin", {
        projectId: project.id,
        userEmail: project.email?.toLowerCase(),
        userName: project.full_name,
        userPhone: project.phone,
        userAddress: project.address,
        projectType: project.project_type,
        aiDesigns: aiDesigns || [],
        budgetRange: project.budget_range,
      });

      DesignPreviewEvents.designShared(project.project_type);
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || "Failed to send design");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        {!success ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-secondary">Send Design</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  Send AI-generated design concepts to <span className="font-bold">{companyName}</span>
                </p>
              </div>

              {project && (
                <div className="space-y-3 text-sm">
                  {/* Contact details are omitted from the sanitized shared-design payload */}
                  {(project.full_name || project.email) && (
                    <div>
                      <div className="text-gray-500 text-xs uppercase font-semibold">Contact</div>
                      {project.full_name && <div className="font-medium text-gray-900">{project.full_name}</div>}
                      {project.email && <div className="text-gray-600">{project.email}</div>}
                      {project.phone && <div className="text-gray-600">{project.phone}</div>}
                    </div>
                  )}
                  {aiDesigns?.length > 0 && (
                    <div>
                      <div className="text-gray-500 text-xs uppercase font-semibold">Designs to Send</div>
                      <div className="font-medium text-gray-900">{aiDesigns.length} concept{aiDesigns.length !== 1 ? 's' : ''}</div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Design
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-secondary mb-2">Design Sent!</h3>
            <p className="text-sm text-gray-600">
              {companyName} has been notified about the design concepts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}