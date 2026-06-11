import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import SEOHead from "@/components/SEOHead";
import { LOCAL_BUSINESS, breadcrumbSchema } from "@/lib/schema";
import { WebsiteEvents, trackEvent } from "@/lib/analytics";
import AddressInput from "@/components/AddressInput";
import {
  Calculator, TrendingUp, Sparkles, Info, ArrowRight,
  UtensilsCrossed, Bath, Layers, Home, Plus, CheckCircle, Copy
} from "lucide-react";
import { motion } from "framer-motion";

// Project types matching screenshot icons
const PROJECT_TYPES = [
  { key: "kitchen_remodel", label: "Kitchen", Icon: UtensilsCrossed },
  { key: "bathroom_remodel", label: "Bathroom", Icon: Bath },
  { key: "deck_remodel", label: "Deck", Icon: Layers },
  { key: "home_addition", label: "Home Addition", Icon: Home },
  { key: "other", label: "Other", Icon: Plus },
];

// Cost data: perSqft OR flat ranges, plus add-ons and AI tips
const PROJECT_DATA = {
  kitchen_remodel: {
    sqftRange: [80, 400], defaultSqft: 180,
    costPerSqft: { standard: [150, 220], mid: [220, 320], premium: [320, 450] },
    addOns: [
      { label: "Kitchen Island", cost: 3000 },
      { label: "Custom Cabinetry", cost: 8000 },
      { label: "New Appliances", cost: 4000 },
      { label: "Open Concept Wall", cost: 2000 },
      { label: "Under-Cabinet Lighting", cost: 500 },
      { label: "Tile Backsplash", cost: 800 },
    ],
    tip: "Consider investing in durable countertops and quality cabinetry, as they can significantly enhance both the functionality and aesthetics of your kitchen while adding value to your home. Don't forget to allocate some of your budget for good lighting, as it can transform the space and create a welcoming atmosphere.",
  },
  bathroom_remodel: {
    sqftRange: [40, 200], defaultSqft: 80,
    costPerSqft: { standard: [200, 300], mid: [300, 450], premium: [450, 650] },
    addOns: [
      { label: "Walk-In Shower", cost: 5000 },
      { label: "Heated Floors", cost: 2500 },
      { label: "Double Vanity", cost: 3000 },
      { label: "Soaking Tub", cost: 4000 },
      { label: "Custom Tile", cost: 2000 },
      { label: "Smart Mirror", cost: 800 },
    ],
    tip: "Focus on waterproofing and quality fixtures first — these will save you money long-term. A walk-in shower can add more value than a tub in most markets. Good ventilation prevents mold and extends the life of your renovation.",
  },
  deck_remodel: {
    sqftRange: [100, 600], defaultSqft: 250,
    costPerSqft: { standard: [40, 70], mid: [70, 110], premium: [110, 160] },
    addOns: [
      { label: "Built-In Seating", cost: 2500 },
      { label: "Pergola", cost: 6000 },
      { label: "Outdoor Kitchen", cost: 8000 },
      { label: "Lighting Package", cost: 1500 },
      { label: "Privacy Screen", cost: 2000 },
      { label: "Fire Pit", cost: 3000 },
    ],
    tip: "Composite decking costs more upfront but requires far less maintenance than wood. In the Boston climate, proper drainage and spacing are essential. Consider adding lighting — it extends usable hours and dramatically improves curb appeal.",
  },
  home_addition: {
    sqftRange: [200, 1200], defaultSqft: 400,
    costPerSqft: { standard: [200, 280], mid: [280, 380], premium: [380, 520] },
    addOns: [
      { label: "Full Bathroom", cost: 15000 },
      { label: "HVAC Extension", cost: 5000 },
      { label: "Vaulted Ceiling", cost: 8000 },
      { label: "Custom Windows", cost: 4000 },
      { label: "Mudroom Entry", cost: 6000 },
      { label: "Laundry Room", cost: 5000 },
    ],
    tip: "Home additions offer some of the best ROI when they add a bedroom or bathroom. Ensure your addition matches the existing roofline and exterior materials for the best resale value. Permitting in Greater Boston can add 3–6 months, so plan ahead.",
  },
  other: {
    sqftRange: [100, 1000], defaultSqft: 300,
    costPerSqft: { standard: [50, 100], mid: [100, 180], premium: [180, 280] },
    addOns: [
      { label: "Interior Painting", cost: 3000 },
      { label: "Flooring Replacement", cost: 5000 },
      { label: "Window Replacement", cost: 6000 },
      { label: "Door Replacement", cost: 2500 },
      { label: "Insulation Upgrade", cost: 4000 },
      { label: "Electrical Update", cost: 5000 },
    ],
    tip: "For general renovation projects, prioritize work that improves energy efficiency and structural integrity first. These improvements often qualify for tax credits and will reduce your utility bills while increasing home value.",
  },
};

const QUALITY_OPTIONS = [
  { key: "standard", label: "Standard", desc: "Builder-grade materials, functional & durable" },
  { key: "mid", label: "Mid-Range", desc: "Quality materials with upgraded finishes" },
  { key: "premium", label: "Premium", desc: "High-end materials, custom work & luxury finishes" },
];

function formatK(n) {
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function calcRange(projectKey, sqft, qualityKey, addOns) {
  const data = PROJECT_DATA[projectKey];
  if (!data) return { low: 0, high: 0, mid: 0 };
  const [lo, hi] = data.costPerSqft[qualityKey] || data.costPerSqft.mid;
  const addOnTotal = addOns.reduce((sum, a) => sum + a.cost, 0);
  const low = Math.round(sqft * lo + addOnTotal);
  const high = Math.round(sqft * hi + addOnTotal);
  return { low, high, mid: Math.round((low + high) / 2) };
}



// Section header
function SectionHeader({ num, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-primary font-bold text-sm">{num} ·</span>
      <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">{title}</span>
    </div>
  );
}

export default function BudgetEstimator() {
  const navigate = useNavigate();

  const [address, setAddress] = useState("");
  const [geocoded, setGeocoded] = useState(null);
  const [projectType, setProjectType] = useState("kitchen_remodel");
  const [sqft, setSqft] = useState(180);
  const [quality, setQuality] = useState("mid");
  const [selectedAddOns, setSelectedAddOns] = useState([]);

  // Contact / quote modal state
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const projectInfo = PROJECT_DATA[projectType];

  useEffect(() => {
    trackEvent("budget_estimator_opened");
  }, []);

  // Sync sqft when project changes
  useEffect(() => {
    setSqft(PROJECT_DATA[projectType]?.defaultSqft || 200);
    setSelectedAddOns([]);
  }, [projectType]);

  const selectedAddOnObjs = projectInfo.addOns.filter(a => selectedAddOns.includes(a.label));
  const estimate = calcRange(projectType, sqft, quality, selectedAddOnObjs);

  const toggleAddOn = (label) => {
    setSelectedAddOns(prev =>
      prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]
    );
  };

  const leadTypeMap = {
    kitchen_remodel: "Kitchen Remodel",
    bathroom_remodel: "Bathroom Remodel",
    deck_remodel: "Deck / Porch / Pergola",
    home_addition: "Home Addition",
    other: "General Inquiry",
  };

  const [copiedEstimate, setCopiedEstimate] = useState(false);
  const copyEstimate = async () => {
    const projectLabel = PROJECT_TYPES.find(p => p.key === projectType)?.label || "";
    const addOnList = selectedAddOnObjs.map(a => a.label).join(", ") || "None";
    const summary = `${projectLabel} estimate from Coen Construction: ${formatK(estimate.low)}–${formatK(estimate.high)} (midpoint ${formatK(estimate.mid)}) · ${sqft} sq ft · ${quality} quality · Add-ons: ${addOnList} · Get yours at https://coenconstruction.com/budget-estimator`;
    try {
      await navigator.clipboard.writeText(summary);
      setCopiedEstimate(true);
      setTimeout(() => setCopiedEstimate(false), 2500);
      trackEvent("budget_estimate_copied", { project_type: projectType });
    } catch {
      // Clipboard unavailable (e.g. insecure context) — fail silently
    }
  };

  const handleSubmitQuote = async () => {
    setSubmitError("");
    if (!/^\S+@\S+\.\S+$/.test(contact.email.trim())) {
      setSubmitError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    const projectLabel = PROJECT_TYPES.find(p => p.key === projectType)?.label || "";
    const addOnList = selectedAddOnObjs.map(a => a.label).join(", ") || "None";
    const notes = `[Budget Estimator] ${projectLabel} · ${sqft} sqft · ${quality} quality · Add-ons: ${addOnList} · Est: ${formatK(estimate.low)}–${formatK(estimate.high)}`;
    try {
      await base44.entities.Lead.create({
        full_name: contact.name,
        email: contact.email,
        phone: contact.phone,
        address,
        project_type: leadTypeMap[projectType] || "General Inquiry",
        message: notes,
        source: "Budget Estimator",
        status: "New",
      });
    } catch (err) {
      console.error("Budget estimator lead creation failed", err);
      setSubmitError("We couldn't submit your request. Please call (617) 857-COEN or try again.");
      setSubmitting(false);
      return;
    }
    WebsiteEvents.contactFormSubmitted("Budget Estimator", leadTypeMap[projectType]);
    setSubmitting(false);
    setSubmitted(true);

    const startTypeMap = { kitchen_remodel: "kitchen_remodel", bathroom_remodel: "bathroom_remodel", deck_remodel: "deck_remodel", home_addition: "home_addition", other: "other" };
    const params = new URLSearchParams({
      type: startTypeMap[projectType] || "",
      address,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      description: notes,
    });
    setTimeout(() => navigate(`/start?${params.toString()}`), 1800);
  };

  const [sqftRange] = [projectInfo.sqftRange];

  return (
    <div className="min-h-screen bg-gray-50">
      <SEOHead
        title="Instant Renovation Cost Estimator for Greater Boston"
        description="Free instant budget estimator for kitchen, bathroom, deck & home addition projects in Greater Boston. Get a realistic local price range in seconds — no sign-up needed."
        keywords={["renovation cost estimator Boston", "kitchen remodel cost Boston", "home addition cost MA", "deck cost calculator Boston"]}
        canonicalUrl="https://coenconstruction.com/budget-estimator"
        structuredData={[LOCAL_BUSINESS, breadcrumbSchema([
          { name: "Budget Estimator", url: "/budget-estimator" }
        ])]}
      />

      {/* Hero */}
      <div className="pt-20 pb-6 text-center px-4">
        <div className="inline-flex items-center gap-2 border border-primary/40 text-primary bg-primary/5 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
          <Calculator className="w-3.5 h-3.5" /> Instant Budget Estimator
        </div>
        <h1 className="text-4xl md:text-5xl font-heading font-bold text-gray-900 mb-3">
          What Will My Project <span className="text-primary italic">Cost?</span>
        </h1>
        <p className="text-gray-500 max-w-xl mx-auto text-base">
          Enter your location for real pricing in your market — costs can vary by 50%+ depending on where you live.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="max-w-6xl mx-auto px-4 pb-20 flex flex-col lg:flex-row gap-6 items-start">

        {/* LEFT — Inputs */}
        <div className="flex-1 space-y-4">

          {/* 1. Location */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <SectionHeader num="1" title="YOUR LOCATION" />
              <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Affects pricing</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">Enter your city, zip code, or full address for local pricing</p>
            <AddressInput value={address} onChange={setAddress} onGeocode={setGeocoded} />
            {geocoded && (
              <p className="text-xs text-primary mt-2 flex items-center gap-1">
                <span>💡</span> Costs in {geocoded.city}, {geocoded.state} run 25–40% above the national average due to high labor demand and strict permitting requirements in Greater Boston.
              </p>
            )}
          </div>

          {/* 2. Project Type */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <SectionHeader num="2" title="PROJECT TYPE" />
            <div className="flex gap-3 flex-wrap">
              {PROJECT_TYPES.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setProjectType(key)}
                  className={`flex flex-col items-center gap-1.5 px-5 py-4 rounded-xl border-2 transition-all min-w-[80px] ${
                    projectType === key
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Square Footage */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <SectionHeader num="3" title="SQUARE FOOTAGE" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Approximate size of the project area</span>
              <span className="text-3xl font-bold text-primary">{sqft} <span className="text-base font-normal text-gray-400">sq ft</span></span>
            </div>
            <input
              type="range"
              min={projectInfo.sqftRange[0]}
              max={projectInfo.sqftRange[1]}
              value={sqft}
              onChange={e => setSqft(Number(e.target.value))}
              aria-label="Project square footage"
              className="w-full accent-primary h-2 rounded"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{projectInfo.sqftRange[0]} sq ft</span>
              <span>{projectInfo.sqftRange[1]} sq ft</span>
            </div>
          </div>

          {/* 4. Material Quality */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <SectionHeader num="4" title="MATERIAL QUALITY" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {QUALITY_OPTIONS.map(({ key, label, desc }) => (
                <button
                  key={key}
                  onClick={() => setQuality(key)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    quality === key
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className={`font-bold text-sm mb-1 ${quality === key ? "text-primary" : "text-gray-800"}`}>{label}</div>
                  <div className="text-xs text-gray-500 leading-relaxed">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 5. Add-On Features */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <SectionHeader num="5" title="ADD-ON FEATURES" />
            <p className="text-xs text-primary mb-3">Prices shown are national averages</p>
            <div className="grid grid-cols-2 gap-2">
              {projectInfo.addOns.map(({ label, cost }) => {
                const active = selectedAddOns.includes(label);
                return (
                  <button
                    key={label}
                    onClick={() => toggleAddOn(label)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                      active
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <span className="font-medium">{label}</span>
                    <span className={`font-bold text-xs ${active ? "text-primary" : "text-gray-400"}`}>
                      +{formatK(cost)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT — Sticky Summary */}
        <div className="w-full lg:w-80 xl:w-96 lg:sticky lg:top-20 space-y-4">

          {/* Estimate Card */}
          <div className="bg-primary rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-2 text-white/70 text-sm mb-3">
              <TrendingUp className="w-4 h-4" /> Estimated Project Range
            </div>
            <div className="flex items-end gap-2 mb-1">
              <span className="text-4xl font-bold">{formatK(estimate.low)}</span>
              <span className="text-2xl font-light text-white/60 mb-1">–</span>
              <span className="text-4xl font-bold">{formatK(estimate.high)}</span>
            </div>
            <p className="text-white/60 text-xs mb-5">
              {address ? "Local pricing applied" : "National avg · add location for local pricing"}
            </p>

            {/* Progress bar */}
            <div className="h-1.5 bg-white/20 rounded-full mb-4">
              <div className="h-full bg-white rounded-full" style={{ width: `${Math.min(100, (sqft / projectInfo.sqftRange[1]) * 100)}%` }} />
            </div>

            <div className="flex justify-between text-sm text-white/80 mb-2">
              <span>Base Construction</span>
              <span>{formatK(estimate.low)}–{formatK(estimate.high - selectedAddOnObjs.reduce((s, a) => s + a.cost, 0))}</span>
            </div>
            {selectedAddOnObjs.length > 0 && (
              <div className="flex justify-between text-sm text-white/80 mb-2">
                <span>Add-Ons</span>
                <span>+{formatK(selectedAddOnObjs.reduce((s, a) => s + a.cost, 0))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-white border-t border-white/20 pt-2 mt-2">
              <span>Midpoint Estimate</span>
              <span>{formatK(estimate.mid)}</span>
            </div>
            <button
              onClick={copyEstimate}
              className="mt-4 w-full text-xs font-semibold text-white/80 hover:text-white border border-white/25 rounded-lg py-2 flex items-center justify-center gap-1.5 transition-colors"
            >
              {copiedEstimate ? <><CheckCircle className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Estimate Summary</>}
            </button>
          </div>

          {/* AI Tip */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-primary font-bold text-sm mb-2">
              <Sparkles className="w-4 h-4" /> AI Contractor Tip
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{projectInfo.tip}</p>
          </div>

          {/* Disclaimer */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex gap-2">
            <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">
              Rough estimate for budgeting only. Actual costs vary by site conditions, final scope, permit fees, and contractor availability. A free on-site consultation provides an accurate quote.
            </p>
          </div>

          {/* CTA */}
          {!showQuoteForm ? (
            <button
              onClick={() => setShowQuoteForm(true)}
              className="w-full bg-primary text-white font-bold py-4 rounded-xl text-base hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              Get a Real Quote — It's Free <ArrowRight className="w-4 h-4" />
            </button>
          ) : submitted ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white border border-green-200 rounded-2xl p-6 text-center shadow-sm">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="font-bold text-secondary">You're all set!</p>
              <p className="text-sm text-gray-500 mt-1">We'll be in touch within 1 business day. Taking you to your free Design Preview…</p>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="font-bold text-secondary text-sm">Get a Real Quote From Our Team</h3>
              <input type="text" placeholder="Full Name *" value={contact.name} onChange={e => setContact(c => ({ ...c, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
              <input type="email" placeholder="Email *" value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
              <input type="tel" placeholder="Phone *" value={contact.phone} onChange={e => setContact(c => ({ ...c, phone: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
              {submitError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2">{submitError}</p>}
              <button
                onClick={handleSubmitQuote}
                disabled={!contact.name || !contact.email || !contact.phone || submitting}
                className="w-full bg-primary text-white font-bold py-3 rounded-xl text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? "Saving…" : <><ArrowRight className="w-4 h-4" /> Submit & Start Design Preview</>}
              </button>
              <p className="text-xs text-gray-400 text-center">No obligation · Free consultation</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}