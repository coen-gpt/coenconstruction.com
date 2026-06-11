import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import {
  Calculator, ArrowRight, Sparkles,
  Home, UtensilsCrossed, Bath, Fence, PlusCircle,
  Loader2, TrendingUp, Info, MapPin, CheckCircle2, AlertCircle
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

// ─── Static Config ────────────────────────────────────────────────────────────

const PROJECT_TYPES = [
  { value: 'kitchen_remodel',  label: 'Kitchen',       icon: UtensilsCrossed, sqftRange: [80, 400],   sqftDefault: 180 },
  { value: 'bathroom_remodel', label: 'Bathroom',      icon: Bath,            sqftRange: [40, 200],   sqftDefault: 90  },
  { value: 'deck_remodel',     label: 'Deck',          icon: Fence,           sqftRange: [100, 800],  sqftDefault: 300 },
  { value: 'home_addition',    label: 'Home Addition', icon: Home,            sqftRange: [200, 1500], sqftDefault: 500 },
  { value: 'other',            label: 'Other',         icon: PlusCircle,      sqftRange: [100, 1000], sqftDefault: 300 },
];

const MATERIAL_LEVELS = [
  { value: 'standard',  label: 'Standard',  description: 'Builder-grade materials, functional & durable',    color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200'    },
  { value: 'mid_range', label: 'Mid-Range', description: 'Quality materials with upgraded finishes',          color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200'  },
  { value: 'premium',   label: 'Premium',   description: 'High-end materials, custom work & luxury finishes', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200'},
];

const FEATURES_BY_TYPE = {
  kitchen_remodel:  [
    { id: 'island',          label: 'Kitchen Island',        baseMin: 3000,  baseMax: 8000  },
    { id: 'custom_cab',      label: 'Custom Cabinetry',      baseMin: 8000,  baseMax: 20000 },
    { id: 'appliances',      label: 'New Appliances',        baseMin: 4000,  baseMax: 12000 },
    { id: 'open_concept',    label: 'Open Concept Wall',     baseMin: 2000,  baseMax: 8000  },
    { id: 'under_cabinet',   label: 'Under-Cabinet Lighting',baseMin: 500,   baseMax: 1500  },
    { id: 'tile_backsplash', label: 'Tile Backsplash',       baseMin: 800,   baseMax: 3000  },
  ],
  bathroom_remodel: [
    { id: 'walkin_shower',   label: 'Walk-In Shower',        baseMin: 3000,  baseMax: 9000  },
    { id: 'soaking_tub',     label: 'Soaking Tub',           baseMin: 1500,  baseMax: 6000  },
    { id: 'double_vanity',   label: 'Double Vanity',         baseMin: 1200,  baseMax: 5000  },
    { id: 'heated_floor',    label: 'Heated Floors',         baseMin: 1500,  baseMax: 4000  },
    { id: 'smart_toilet',    label: 'Smart Toilet',          baseMin: 800,   baseMax: 3000  },
    { id: 'steam',           label: 'Steam Shower',          baseMin: 2500,  baseMax: 7000  },
  ],
  deck_remodel:     [
    { id: 'pergola',         label: 'Pergola / Shade',       baseMin: 3000,  baseMax: 10000 },
    { id: 'builtin_grill',   label: 'Built-In Grill',        baseMin: 2000,  baseMax: 8000  },
    { id: 'lighting',        label: 'Deck Lighting',         baseMin: 500,   baseMax: 2500  },
    { id: 'hot_tub',         label: 'Hot Tub Ready',         baseMin: 1500,  baseMax: 4000  },
    { id: 'composite',       label: 'Composite Decking',     baseMin: 3000,  baseMax: 8000  },
    { id: 'railings',        label: 'Glass Railings',        baseMin: 2000,  baseMax: 6000  },
  ],
  home_addition:    [
    { id: 'master_bath',     label: 'Full Bathroom',         baseMin: 8000,  baseMax: 20000 },
    { id: 'walkin_closet',   label: 'Walk-In Closet',        baseMin: 2000,  baseMax: 7000  },
    { id: 'vaulted',         label: 'Vaulted Ceilings',      baseMin: 3000,  baseMax: 8000  },
    { id: 'bonus_room',      label: 'Bonus / Loft Room',     baseMin: 5000,  baseMax: 15000 },
    { id: 'garage',          label: 'Attached Garage Bay',   baseMin: 15000, baseMax: 40000 },
    { id: 'hvac',            label: 'HVAC Extension',        baseMin: 3000,  baseMax: 8000  },
  ],
  other:            [
    { id: 'demo',            label: 'Demolition Work',       baseMin: 1000,  baseMax: 5000  },
    { id: 'electrical',      label: 'Electrical Upgrade',    baseMin: 2000,  baseMax: 6000  },
    { id: 'plumbing',        label: 'Plumbing Work',         baseMin: 2000,  baseMax: 8000  },
    { id: 'flooring',        label: 'New Flooring',          baseMin: 3000,  baseMax: 10000 },
    { id: 'windows',         label: 'New Windows',           baseMin: 2000,  baseMax: 8000  },
    { id: 'painting',        label: 'Interior Painting',     baseMin: 1000,  baseMax: 4000  },
  ],
};

// National baseline cost per sqft — AI multiplier adjusts these
const BASE_COST_NATIONAL = {
  kitchen_remodel:  { standard: [125, 175], mid_range: [200, 275], premium: [350, 500] },
  bathroom_remodel: { standard: [150, 200], mid_range: [250, 350], premium: [450, 650] },
  deck_remodel:     { standard: [30,  50],  mid_range: [60,  90],  premium: [100, 150] },
  home_addition:    { standard: [150, 200], mid_range: [225, 300], premium: [350, 500] },
  other:            { standard: [75,  125], mid_range: [150, 225], premium: [275, 400] },
};

function formatMoney(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000)      return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BudgetCalculator() {
  const [projectType, setProjectType] = useState('kitchen_remodel');
  const [sqft, setSqft]               = useState(180);
  const [material, setMaterial]       = useState('mid_range');
  const [features, setFeatures]       = useState([]);

  // Location state
  const [locationInput, setLocationInput]     = useState('');
  const [locStatus, setLocStatus]             = useState('idle'); // idle | loading | success | error
  const [locationLabel, setLocationLabel]     = useState('');    // "Portland, OR"
  const [locationMultiplier, setLocationMultiplier] = useState(1.0);
  const [locationNote, setLocationNote]       = useState('');    // short market note
  const [locationFeatureMults, setLocationFeatureMults] = useState({}); // { featureId: multiplier }

  // AI insight
  const [aiInsight, setAiInsight]   = useState('');
  const [loadingAI, setLoadingAI]   = useState(false);

  const locDebounce     = useRef(null);
  const insightDebounce = useRef(null);
  const lastLookupRef   = useRef('');

  const currentType = PROJECT_TYPES.find(p => p.value === projectType);
  const featureList = FEATURES_BY_TYPE[projectType] || [];

  // Reset sqft + features when project type changes
  useEffect(() => {
    setSqft(currentType.sqftDefault);
    setFeatures([]);
    setAiInsight('');
    setLocationFeatureMults({});
  }, [projectType]);

  // Debounce location lookup
  useEffect(() => {
    clearTimeout(locDebounce.current);
    const trimmed = locationInput.trim();
    if (trimmed.length < 4) {
      if (trimmed.length === 0) {
        setLocStatus('idle');
        setLocationLabel('');
        setLocationMultiplier(1.0);
        setLocationNote('');
        setLocationFeatureMults({});
      }
      return;
    }
    locDebounce.current = setTimeout(() => fetchLocationPricing(trimmed), 900);
    return () => clearTimeout(locDebounce.current);
  }, [locationInput, projectType]);

  // Debounce AI insight
  useEffect(() => {
    clearTimeout(insightDebounce.current);
    insightDebounce.current = setTimeout(fetchAIInsight, 1000);
    return () => clearTimeout(insightDebounce.current);
  }, [projectType, sqft, material, features, locationMultiplier]);

  // ── Location pricing fetch ──
  const fetchLocationPricing = async (address) => {
    const cacheKey = `${address}__${projectType}`;
    if (lastLookupRef.current === cacheKey) return;
    lastLookupRef.current = cacheKey;

    setLocStatus('loading');

    const featIds = featureList.map(f => f.id);
    const prompt = `You are a construction cost data expert with access to current regional pricing.

A homeowner is planning a ${currentType.label} near this location: "${address}"

Using current (2024-2025) regional construction cost data for that metro area or state, provide:
1. A cost multiplier relative to the US national average (1.0 = average). For example: San Francisco = 1.55, rural Mississippi = 0.70, NYC = 1.65, Dallas = 0.95, Chicago = 1.15.
2. A short 1-sentence note about the local market (labor costs, material availability, permit costs, etc.)
3. Individual multipliers for each of these add-on features in that region: ${featIds.join(', ')}

Base your multipliers on actual regional construction cost indexes, local labor rates, and material costs for that area.

Respond ONLY with valid JSON in this exact shape:
{
  "city_label": "City, ST",
  "base_multiplier": 1.05,
  "market_note": "One sentence about local costs.",
  "feature_multipliers": {
    ${featIds.map(id => `"${id}": 1.0`).join(',\n    ')}
  }
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          city_label:          { type: 'string' },
          base_multiplier:     { type: 'number' },
          market_note:         { type: 'string' },
          feature_multipliers: { type: 'object' }
        }
      }
    }).catch((err) => {
      console.error('Location pricing lookup failed', err);
      return null;
    });

    if (result?.base_multiplier) {
      setLocationMultiplier(result.base_multiplier);
      setLocationLabel(result.city_label || address);
      setLocationNote(result.market_note || '');
      setLocationFeatureMults(result.feature_multipliers || {});
      setLocStatus('success');
    } else {
      setLocStatus('error');
      setLocationMultiplier(1.0);
    }
  };

  // ── AI insight fetch ──
  const fetchAIInsight = async () => {
    setLoadingAI(true);
    const featLabels = features.map(fid => featureList.find(x => x.id === fid)?.label).filter(Boolean);
    const loc = locationLabel ? ` in the ${locationLabel} area` : '';
    const prompt = `You are an experienced general contractor. A homeowner is planning a ${currentType.label}${loc} — ${sqft} sq ft, ${material.replace('_', '-')} quality${featLabels.length ? `, with: ${featLabels.join(', ')}` : ''}.

Give a single helpful 2-sentence tip specific to this project type${locationLabel ? ' and this region' : ''}. Be conversational and practical. No markdown. Under 60 words.`;

    const result = await base44.integrations.Core.InvokeLLM({ prompt }).catch((err) => {
      console.error('AI insight fetch failed', err);
      return '';
    });
    setAiInsight(typeof result === 'string' ? result : '');
    setLoadingAI(false);
  };

  // ── Compute costs ──
  const [baseLow, baseHigh] = BASE_COST_NATIONAL[projectType][material];
  const locMult = locationMultiplier;

  const baseMin = Math.round(baseLow  * sqft * locMult);
  const baseMax = Math.round(baseHigh * sqft * locMult);

  const featureCostMin = features.reduce((acc, fid) => {
    const f = featureList.find(x => x.id === fid);
    if (!f) return acc;
    const fm = locationFeatureMults[fid] ?? locMult;
    return acc + Math.round(f.baseMin * fm);
  }, 0);
  const featureCostMax = features.reduce((acc, fid) => {
    const f = featureList.find(x => x.id === fid);
    if (!f) return acc;
    const fm = locationFeatureMults[fid] ?? locMult;
    return acc + Math.round(f.baseMax * fm);
  }, 0);

  const totalMin = baseMin + featureCostMin;
  const totalMax = baseMax + featureCostMax;
  const totalMid = Math.round((totalMin + totalMax) / 2);

  const maxScale = Math.max(totalMax * 1.2, 200000);
  const barPct   = Math.min((totalMid / maxScale) * 100, 100);

  const toggleFeature = (id) => {
    setFeatures(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  // Feature display cost (location-adjusted)
  const featureDisplayCost = (f) => {
    const fm = locationFeatureMults[f.id] ?? locMult;
    return `+${formatMoney(Math.round(f.baseMin * fm))}`;
  };

  return (
    <section className="py-24 px-6 bg-background" id="calculator">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-5">
            <Calculator className="w-4 h-4" />
            Instant Budget Estimator
          </div>
          <h2 className="font-heading text-3xl md:text-5xl mb-4">
            What Will My Project <span className="text-primary italic">Cost?</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Enter your location for real pricing in your market — costs can vary by 50%+ depending on where you live.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">

          {/* ── Left: Controls ── */}
          <div className="lg:col-span-3 space-y-6">

            {/* ① Location */}
            <div className="p-6 rounded-2xl bg-card border-2 border-primary/30 shadow-sm">
              <h3 className="font-semibold mb-1 flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                <span>1</span> · Your Location
                <span className="ml-auto text-xs font-normal normal-case text-primary bg-primary/10 px-2 py-0.5 rounded-full">Affects pricing</span>
              </h3>
              <p className="text-xs text-muted-foreground mb-3">Enter your city, zip code, or full address for local pricing</p>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. Boston, MA  or  02101  or  123 Main St, Newton MA"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  className="pl-9 pr-10 rounded-xl h-12"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {locStatus === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  {locStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {locStatus === 'error'   && <AlertCircle  className="w-4 h-4 text-destructive" />}
                </div>
              </div>

              {/* Location status banner */}
              <AnimatePresence>
                {locStatus === 'loading' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="mt-3 flex items-center gap-2 text-sm text-primary">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Fetching real construction costs for your area…
                  </motion.div>
                )}
                {locStatus === 'success' && locationNote && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="mt-3 p-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-800 flex gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
                    <div>
                      <span className="font-semibold">{locationLabel}</span>
                      {locMult !== 1.0 && (
                        <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-100">
                          {locMult > 1 ? `+${Math.round((locMult - 1) * 100)}% vs national avg` : `${Math.round((1 - locMult) * 100)}% below national avg`}
                        </span>
                      )}
                      <p className="text-green-700 text-xs mt-1">{locationNote}</p>
                    </div>
                  </motion.div>
                )}
                {locStatus === 'error' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="mt-3 flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    Couldn't find pricing for that location. Using national averages.
                  </motion.div>
                )}
                {locStatus === 'idle' && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs text-muted-foreground">
                    💡 Costs in Boston, MA run 25–40% above the national average due to high labor demand and strict permitting requirements in Greater Boston.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* ② Project Type */}
            <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                <span>2</span> · Project Type
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {PROJECT_TYPES.map(pt => (
                  <button key={pt.value} onClick={() => setProjectType(pt.value)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                      projectType === pt.value
                        ? 'border-primary bg-primary/5 text-primary shadow-sm'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground'
                    }`}
                  >
                    <pt.icon className="w-5 h-5" />
                    <span className="text-xs leading-tight text-center">{pt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ③ Square Footage */}
            <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
              <h3 className="font-semibold mb-1 flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                <span>3</span> · Square Footage
              </h3>
              <div className="flex items-end justify-between mb-5">
                <p className="text-muted-foreground text-sm">Approximate size of the project area</p>
                <span className="font-heading text-3xl text-primary">
                  {sqft.toLocaleString()} <span className="text-base font-body text-muted-foreground">sq ft</span>
                </span>
              </div>
              <Slider min={currentType.sqftRange[0]} max={currentType.sqftRange[1]} step={10}
                value={[sqft]} onValueChange={([v]) => setSqft(v)} className="w-full" />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>{currentType.sqftRange[0]} sq ft</span>
                <span>{currentType.sqftRange[1].toLocaleString()} sq ft</span>
              </div>
            </div>

            {/* ④ Material Quality */}
            <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                <span>4</span> · Material Quality
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {MATERIAL_LEVELS.map(m => (
                  <button key={m.value} onClick={() => setMaterial(m.value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      material === m.value ? m.bg + ' shadow-sm' : 'border-border bg-background hover:border-muted-foreground/30'
                    }`}
                  >
                    <p className={`font-semibold text-sm mb-1 ${material === m.value ? m.color : 'text-foreground'}`}>{m.label}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{m.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ⑤ Add-On Features */}
            <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
              <h3 className="font-semibold mb-1 flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                <span>5</span> · Add-On Features
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Prices shown are {locStatus === 'success' ? <span className="text-green-700 font-medium">adjusted for {locationLabel}</span> : 'national averages'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {featureList.map(f => {
                  const selected = features.includes(f.id);
                  return (
                    <button key={f.id} onClick={() => toggleFeature(f.id)}
                      className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                        selected
                          ? 'border-primary bg-primary/5 text-primary shadow-sm'
                          : 'border-border bg-background text-foreground hover:border-primary/30'
                      }`}
                    >
                      <span className="text-sm font-medium">{f.label}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {featureDisplayCost(f)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Right: Estimate Panel ── */}
          <div className="lg:col-span-2 lg:sticky lg:top-24 space-y-5">

            {/* Price Card */}
            <motion.div
              key={`${totalMin}-${totalMax}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="p-7 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-2xl shadow-primary/25"
            >
              {/* Location badge */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-primary-foreground/70 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  Estimated Project Range
                </div>
                {locStatus === 'success' && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1 bg-white/20 text-white text-xs px-2.5 py-1 rounded-full">
                    <MapPin className="w-3 h-3" />
                    {locationLabel}
                  </motion.div>
                )}
              </div>

              <div className="mb-1">
                <span className="font-heading text-4xl md:text-5xl font-bold">{formatMoney(totalMin)}</span>
                <span className="text-primary-foreground/60 text-2xl mx-2">–</span>
                <span className="font-heading text-4xl md:text-5xl font-bold">{formatMoney(totalMax)}</span>
              </div>
              <p className="text-primary-foreground/60 text-sm mb-6">
                {locStatus === 'success' ? `Local pricing · ${locationLabel}` : 'National avg · add location for local pricing'}
              </p>

              {/* Multiplier indicator */}
              {locStatus === 'success' && locMult !== 1.0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="mb-4 p-2.5 rounded-xl bg-white/10 text-xs text-white/80 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  Local cost index: <strong className="text-white">{locMult.toFixed(2)}×</strong> national average
                  {locMult > 1
                    ? ` — your market runs ${Math.round((locMult - 1) * 100)}% above average`
                    : ` — your market is ${Math.round((1 - locMult) * 100)}% below average`}
                </motion.div>
              )}

              {/* Bar */}
              <div className="h-2 rounded-full bg-primary-foreground/20 overflow-hidden mb-6">
                <motion.div className="h-full rounded-full bg-primary-foreground"
                  animate={{ width: `${barPct}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
              </div>

              {/* Breakdown */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-primary-foreground/80">
                  <span>Base Construction</span>
                  <span>{formatMoney(baseMin)}–{formatMoney(baseMax)}</span>
                </div>
                {featureCostMin > 0 && (
                  <div className="flex justify-between text-primary-foreground/80">
                    <span>Selected Features</span>
                    <span>+{formatMoney(featureCostMin)}–{formatMoney(featureCostMax)}</span>
                  </div>
                )}
                {locStatus === 'success' && locMult !== 1.0 && (
                  <div className="flex justify-between text-primary-foreground/60 text-xs">
                    <span>Location adjustment</span>
                    <span>{locMult > 1 ? '+' : ''}{Math.round((locMult - 1) * 100)}%</span>
                  </div>
                )}
                <div className="border-t border-primary-foreground/20 pt-2 flex justify-between font-semibold">
                  <span>Midpoint Estimate</span>
                  <span>{formatMoney(totalMid)}</span>
                </div>
              </div>
            </motion.div>

            {/* AI Insight */}
            <div className="p-5 rounded-2xl bg-card border border-border shadow-sm min-h-[110px]">
              <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                AI Contractor Tip
              </div>
              <AnimatePresence mode="wait">
                {loadingAI ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing your selections…
                  </motion.div>
                ) : aiInsight ? (
                  <motion.p key={aiInsight} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="text-sm text-muted-foreground leading-relaxed">
                    {aiInsight}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>

            {/* Disclaimer */}
            <div className="flex gap-2 text-xs text-muted-foreground p-3 rounded-xl bg-muted">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Rough estimate for budgeting only. Actual costs vary by site conditions, final scope, permit fees, and contractor availability. A free on-site consultation provides an accurate quote.</p>
            </div>

            {/* CTA */}
            <Link to="/start">
              <Button size="lg" className="w-full rounded-xl py-6 gap-2 shadow-lg shadow-primary/20 text-base">
                Get a Real Quote — It's Free
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}