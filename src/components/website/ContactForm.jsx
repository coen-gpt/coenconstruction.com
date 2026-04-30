import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AddressInput from "@/components/AddressInput";

export default function ContactForm({ title = "Get A Free Quote", subtitle = "", compact = false, source = "Contact Form" }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", address: "", projectType: "", details: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isHuman, setIsHuman] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await base44.entities.Lead.create({
      full_name: `${form.firstName} ${form.lastName}`.trim(),
      email: form.email,
      phone: form.phone,
      address: form.address,
      project_type: form.projectType || undefined,
      message: form.details,
      source,
      status: "New",
    });
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-secondary mb-2">Thank You!</h3>
        <p className="text-gray-600">We'll be in touch within 1 business day to schedule your free consultation.</p>
      </div>
    );
  }

  return (
    <div>
      {title && <h3 className={`font-bold text-secondary mb-1 ${compact ? "text-lg" : "text-2xl"}`}>{title}</h3>}
      {subtitle && <p className="text-gray-500 text-sm mb-4">{subtitle}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-2"}`}>
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">First Name *</label>
            <input required className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Last Name *</label>
            <input required className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Email *</label>
          <input type="email" required className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Phone *</label>
          <input type="tel" required className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Property Address *</label>
          <AddressInput value={form.address} onChange={val => setForm({...form, address: val})} required />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Project Type *</label>
          <select required className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.projectType} onChange={e => setForm({...form, projectType: e.target.value})}>
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
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Project Details *</label>
          <textarea required rows={compact ? 3 : 4} className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none" value={form.details} onChange={e => setForm({...form, details: e.target.value})} />
        </div>
        <div className="flex items-center gap-3 p-3 rounded border border-gray-200 bg-gray-50">
          <input
            type="checkbox"
            id="human-check-contact"
            checked={isHuman}
            onChange={(e) => setIsHuman(e.target.checked)}
            className="w-5 h-5 accent-orange-500 cursor-pointer"
          />
          <label htmlFor="human-check-contact" className="text-sm text-gray-700 cursor-pointer select-none">
            I'm not a robot / I confirm I am a real person
          </label>
        </div>
        <button type="submit" disabled={loading || !isHuman} className="w-full bg-primary text-white font-bold py-3 rounded hover:bg-primary/90 transition-colors text-sm disabled:opacity-60">
          {loading ? "Submitting..." : "Get My Free Quote"}
        </button>
        <p className="text-xs text-gray-400 text-center">No obligation. We respond within 1 business day.</p>
      </form>
    </div>
  );
}