import { useState, useEffect, useRef } from "react";
import { X, CheckCircle, Zap, ArrowRight } from "lucide-react";
import { useSiteContent } from "@/hooks/useSiteContent";
import { base44 } from "@/api/base44Client";
import AddressInput from "@/components/AddressInput";
import TurnstileWidget from "@/components/security/TurnstileWidget";

export default function ExitIntentPopup() {
  const [visible, setVisible] = useState(false);
  const triggered = useRef(false);
  const { data: content } = useSiteContent("exit_intent");

  const [popupEnabled, setPopupEnabled] = useState(true);
  useEffect(() => {
    base44.entities.CompanyProfile.list().then((profiles) => {
      const profile = profiles?.[0];
      if (profile && profile.enable_exit_intent_popup === false) {
        setPopupEnabled(false);
      }
    }).catch(() => {});
  }, []);

  const headline = content?.headline || "One Last Step Before You Go";
  const subtext = content?.subtext || "Get your free estimate and see how Coen Construction can transform your space.";
  const offerBadge = content?.offer_badge || "Free Consultation";
  const buttonLabel = content?.button_label || "Get My Free Estimate";
  const campaignName = content?.campaign_name || "Exit Intent Popup";
  const disclaimerText = content?.disclaimer_text || "";
  const disclaimerLinkLabel = content?.disclaimer_link_label || "Terms & Conditions";
  const termsAndConditions = content?.terms_and_conditions || "";
  const imageUrl = content?.image_url || "";

  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem("exit_popup_dismissed")) return;

    const handleMouseLeave = (e) => {
      if (e.clientY <= 0 && !triggered.current) {
        triggered.current = true;
        setTimeout(() => setVisible(true), 200);
      }
    };

    const mobileTimer = setTimeout(() => {
      if (!triggered.current && !sessionStorage.getItem("exit_popup_dismissed")) {
        triggered.current = true;
        setVisible(true);
      }
    }, 45000);

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
      clearTimeout(mobileTimer);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem("exit_popup_dismissed", "1");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const verify = await base44.functions.invoke("verifyTurnstile", { token: turnstileToken }).catch(() => null);
    if (verify?.data && verify.data.success === false) {
      setLoading(false);
      return;
    }
    await base44.entities.Lead.create({
      full_name: form.name,
      email: form.email,
      phone: form.phone,
      address: form.address,
      source: "Exit Intent Popup",
      notes: campaignName !== "Exit Intent Popup" ? `Campaign: ${campaignName}` : undefined,
      status: "New",
    });
    setLoading(false);
    setSubmitted(true);
    sessionStorage.setItem("exit_popup_dismissed", "1");
  };

  if (!popupEnabled || !visible) return null;

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={dismiss}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className={`relative bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-2xl w-full overflow-hidden ${imageUrl ? "max-w-3xl" : "max-w-lg"}`}
          onClick={e => e.stopPropagation()}
        >
          {/* Top accent bar */}
          <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Left side - Image/Visual */}
            {imageUrl && (
              <div className="hidden md:block relative h-full min-h-72 overflow-hidden bg-gradient-to-br from-secondary/10 to-primary/10">
                <img src={imageUrl} alt="offer" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-secondary/20 to-transparent" />
              </div>
            )}

            {/* Right side - Form */}
            <div className="p-6 sm:p-8 flex flex-col justify-center relative">
              {/* Close button */}
              <button
                onClick={dismiss}
                className="absolute top-4 right-4 sm:top-5 sm:right-5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1.5 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              {submitted ? (
              <div className="text-center py-8">
              <div className="mb-4 flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full animate-pulse" />
                  <CheckCircle className="w-16 h-16 text-primary relative" />
                </div>
              </div>
              <h3 className="font-bold text-secondary text-xl mb-2">Thank You!</h3>
              <p className="text-gray-600 text-sm mb-5 leading-relaxed">
                We've received your request. Our team will contact you within 24 hours to discuss your project.
              </p>
              <button
                onClick={dismiss}
                className="w-full bg-primary text-white font-semibold py-3 rounded-lg hover:bg-primary/90 transition-all text-sm"
              >
                Close
              </button>
              </div>
              ) : (
              <div>
              {/* Header */}
              <div className="mb-5">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary font-bold px-3 py-1 rounded-full text-xs mb-3">
                  <Zap className="w-3.5 h-3.5" />
                  {offerBadge}
                </div>
                <h2 className="text-2xl font-bold text-secondary mb-2 leading-tight">{headline}</h2>
                <p className="text-gray-600 text-sm leading-relaxed">{subtext}</p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  required
                  placeholder="Full Name"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all bg-white"
                />
                <input
                  required
                  type="email"
                  placeholder="Email Address"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all bg-white"
                />
                <input
                  required
                  type="tel"
                  placeholder="Phone Number"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all bg-white"
                />
                <AddressInput
                  value={form.address}
                  onChange={val => setForm({ ...form, address: val })}
                />

                <TurnstileWidget
                  onVerify={setTurnstileToken}
                  onExpire={() => setTurnstileToken("")}
                />

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading || !turnstileToken}
                  className="w-full bg-gradient-to-r from-primary to-accent text-white font-bold py-3 rounded-lg hover:shadow-md hover:scale-105 transition-all text-sm disabled:opacity-60 disabled:scale-100 flex items-center justify-center gap-2 group mt-5"
                >
                  {loading ? "Submitting..." : (
                    <>
                      {buttonLabel}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>

                {/* Secondary action */}
                <button
                  type="button"
                  onClick={dismiss}
                  className="w-full text-gray-500 hover:text-gray-700 font-medium py-1.5 text-sm transition-colors"
                >
                  Maybe later
                </button>

                {/* Disclaimer */}
                {(disclaimerText || termsAndConditions) && (
                  <p className="text-xs text-gray-400 text-center leading-relaxed pt-1">
                    {disclaimerText}{disclaimerText && termsAndConditions ? " " : ""}
                    {termsAndConditions && (
                      <button
                        type="button"
                        onClick={() => setShowTermsModal(true)}
                        className="text-primary hover:underline font-semibold"
                      >
                        {disclaimerLinkLabel}
                      </button>
                    )}
                  </p>
                )}
              </form>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

    {showTermsModal && (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4" onClick={() => setShowTermsModal(false)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />
          <button
            onClick={() => setShowTermsModal(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1.5 transition-all z-10"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="p-6 sm:p-8 overflow-y-auto flex-1">
            <h3 className="text-2xl sm:text-3xl font-bold text-secondary mb-6">{disclaimerLinkLabel}</h3>
            <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap leading-relaxed">{termsAndConditions}</p>
          </div>
          <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
            <button
              onClick={() => setShowTermsModal(false)}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}