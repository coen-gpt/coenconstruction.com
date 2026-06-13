import { useState, useEffect } from "react";
import { ShieldCheck, Star, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AddressInput from "@/components/AddressInput";
import SmsOptInCheckbox, { SMS_CONSENT_TEXT_VERSION } from "@/components/sms/SmsOptInCheckbox";
import TurnstileWidget from "@/components/security/TurnstileWidget";
import { fetchClientIp } from "@/lib/clientIp";
import { WebsiteEvents, trackEvent } from "@/lib/analytics";
import BookWalkthroughCTA from "@/components/website/BookWalkthroughCTA";

export default function ContactForm({ title = "Get A Free Quote", subtitle = "", compact = false, source = "Contact Form" }) {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", address: "", projectType: "", details: "", smsOptIn: false });

  // Funnel measurement: how many visitors see a form vs. submit it
  useEffect(() => {
    trackEvent("contact_form_view", { source });
  }, [source]);
  const [submitted, setSubmitted] = useState(false);
  const [createdLead, setCreatedLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Cloudflare Turnstile — server-side verification before creating the lead
      const verify = await base44.functions.invoke("verifyTurnstile", { token: turnstileToken }).catch(() => null);
      if (verify?.data && verify.data.success === false) {
        setError("Security check failed. Please complete the verification and try again.");
        setLoading(false);
        return;
      }
      // A2P 10DLC: record IP + timestamp alongside the consent decision (true or false)
      const clientIp = verify?.data?.ip || await fetchClientIp();
      const normalizedPhone = form.phone.replace(/[\s().-]/g, '').trim();
      const smsFields = {
        sms_opt_in_status: form.smsOptIn,
        sms_opt_in_timestamp: new Date().toISOString(),
        sms_opt_in_ip: clientIp || undefined,
        ...(form.smsOptIn ? {
          phone_number: normalizedPhone,
          sms_opt_in_method: 'WEB_FORM',
          sms_consent_text_version: SMS_CONSENT_TEXT_VERSION,
        } : {}),
      };

      const createdLead = await base44.entities.Lead.create({
        full_name: form.fullName.trim(),
        email: form.email,
        phone: form.phone,
        address: form.address || undefined,
        project_type: form.projectType || "General Inquiry",
        message: form.details || undefined,
        source,
        status: "New",
        ...smsFields,
      });

      if (form.smsOptIn) {
        // SmsConsent is RLS-locked — dedupe + create happen server-side
        await base44.functions.invoke("recordSmsConsent", {
          phone_number: normalizedPhone,
          client_name: form.fullName.trim(),
          client_email: form.email,
          sms_consent_text_version: SMS_CONSENT_TEXT_VERSION,
          sms_opt_in_ip: clientIp || undefined,
          source_lead_id: createdLead.id,
        }).catch((err) => console.error("SMS consent record failed", err));
      }
      WebsiteEvents.contactFormSubmitted(source, form.projectType);
      setCreatedLead(createdLead);
      setSubmitted(true);
    } catch (err) {
      console.error("Contact form submission failed", err);
      setError("We could not submit your request. Please call (617) 857-COEN or try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <BookWalkthroughCTA
        lead={createdLead}
        title="Thank You!"
        subtitle="Your request is in — we'll be in touch within 1 business day."
      />
    );
  }

  return (
    <div>
      {title && <h3 className={`font-bold text-secondary mb-1 ${compact ? "text-lg" : "text-2xl"}`}>{title}</h3>}
      {subtitle && <p className="text-gray-500 text-sm mb-4">{subtitle}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Full Name *</label>
          <input required className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Email *</label>
          <input type="email" required className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Phone *</label>
          <input type="tel" required className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          {/* A2P 10DLC: OPTIONAL SMS consent, directly below the phone field.
              Carriers reject campaigns that make consent a condition of submission. */}
          <div className="mt-2">
            <SmsOptInCheckbox
              id="sms-opt-in-contact"
              checked={form.smsOptIn}
              onCheckedChange={(checked) => setForm({ ...form, smsOptIn: checked })}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Property Address <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
          <AddressInput value={form.address} onChange={val => setForm({...form, address: val})} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Project Type <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
          <select className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.projectType} onChange={e => setForm({...form, projectType: e.target.value})}>
            <option value="">-- Select --</option>
            <option>Home Addition</option>
            <option>Kitchen Remodel</option>
            <option>Bathroom Remodel</option>
            <option>Deck / Porch / Pergola</option>
            <option>Siding</option>
            <option>Custom Carpentry</option>
            <option>Snow Removal</option>
            <option>Full Home Renovation</option>
            <option>General Inquiry</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Project Details <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
          <textarea rows={compact ? 3 : 4} className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none" value={form.details} onChange={e => setForm({...form, details: e.target.value})} />
        </div>

        <TurnstileWidget
          onVerify={setTurnstileToken}
          onExpire={() => setTurnstileToken("")}
        />
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded p-2">{error}</p>}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-primary" /> Licensed MA #CS-107247</span>
          <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-primary" /> 5★ Rated, 500+ Projects</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-primary" /> 1-Day Response</span>
        </div>
        <button type="submit" disabled={loading || !turnstileToken} className="w-full bg-primary text-white font-bold py-3 rounded hover:bg-primary/90 transition-colors text-sm disabled:opacity-60">
          {loading ? "Submitting..." : "Get My Free Quote"}
        </button>
        <p className="text-xs text-gray-400 text-center">No obligation. We respond within 1 business day.</p>
      </form>
    </div>
  );
}