import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { Calculator, TrendingUp, Info, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Shared config from main calculator
const BASE_COST_NATIONAL = {
  kitchen_remodel:  { standard: [125, 175], mid_range: [200, 275], premium: [350, 500] },
  bathroom_remodel: { standard: [150, 200], mid_range: [250, 350], premium: [450, 650] },
  deck_remodel:     { standard: [30,  50],  mid_range: [60,  90],  premium: [100, 150] },
  home_addition:    { standard: [150, 200], mid_range: [225, 300], premium: [350, 500] },
  siding:           { standard: [5,   10],  mid_range: [12,  20],  premium: [25,  40]  },
  roofing:          { standard: [5,   10],  mid_range: [12,  18],  premium: [20,  35]  },
  windows_doors:    { standard: [75,  125], mid_range: [150, 225], premium: [275, 400] },
  other:            { standard: [75,  125], mid_range: [150, 225], premium: [275, 400] },
};

const MATERIAL_LEVELS = [
  { value: 'standard',  label: 'Standard',  idx: 0, color: 'text-blue-600'  },
  { value: 'mid_range', label: 'Mid-Range', idx: 1, color: 'text-amber-600' },
  { value: 'premium',   label: 'Premium',   idx: 2, color: 'text-purple-600'},
];

// Default sqft estimates per project type (used when user didn't specify)
const DEFAULT_SQFT = {
  kitchen_remodel: 180, bathroom_remodel: 90, deck_remodel: 300,
  home_addition: 500, siding: 1800, roofing: 1800, windows_doors: 200, other: 300,
};

function formatMoney(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
}

// Derive a rough sqft from budget_range midpoints and project type
function estimateSqft(projectType, budgetRange) {
  const defaults = DEFAULT_SQFT[projectType] || 300;
  if (!budgetRange) return defaults;
  // Use budget to back-calculate approximate sqft at mid_range cost
  const midCosts = BASE_COST_NATIONAL[projectType]?.mid_range || [150, 225];
  const midRate = (midCosts[0] + midCosts[1]) / 2;
  const budgetMidpoints = {
    under_25k: 20000, '25k_50k': 37500, '50k_100k': 75000,
    '100k_200k': 150000, over_200k: 250000,
  };
  const budgetMid = budgetMidpoints[budgetRange];
  if (!budgetMid || !midRate) return defaults;
  const derived = Math.round(budgetMid / midRate / 10) * 10;
  const cap = DEFAULT_SQFT[projectType] * 3;
  return Math.min(Math.max(derived, 50), cap);
}

export default function ProjectBudgetWidget({ project }) {
  const projectType = project.project_type || 'other';
  const sqft = estimateSqft(projectType, project.budget_range);

  const [materialIdx, setMaterialIdx] = useState(1); // default mid_range
  const [locationMultiplier, setLocationMultiplier] = useState(1.0);
  const [locationLabel, setLocationLabel] = useState('');
  const [loadingLoc, setLoadingLoc] = useState(false);

  const material = MATERIAL_LEVELS[materialIdx].value;
  const costs = BASE_COST_NATIONAL[projectType]?.[material] || [100, 200];
  const totalMin = Math.round(costs[0] * sqft * locationMultiplier);
  const totalMax = Math.round(costs[1] * sqft * locationMultiplier);
  const totalMid = Math.round((totalMin + totalMax) / 2);

  // Fetch location multiplier from project address once
  useEffect(() => {
    const location = project.address || project.zip_code;
    if (!location) return;
    setLoadingLoc(true);
    base44.integrations.Core.InvokeLLM({
      prompt: `You are a construction cost expert. Given this exact address or location: "${location}", identify the specific city/town and state, then provide a construction cost multiplier relative to the US national average (1.0 = average). Use the actual city/town from the address. Example: Boston MA = 1.30, rural Mississippi = 0.70, NYC = 1.65. Respond with ONLY a JSON object: {"city_label": "City, ST", "base_multiplier": 1.30}`,
      response_json_schema: {
        type: 'object',
        properties: {
          city_label: { type: 'string' },
          base_multiplier: { type: 'number' }
        }
      }
    }).then(result => {
      if (result?.base_multiplier) {
        setLocationMultiplier(result.base_multiplier);
        setLocationLabel(result.city_label || '');
      }
    }).finally(() => setLoadingLoc(false));
  }, [project.address, project.zip_code]);

  const currentMat = MATERIAL_LEVELS[materialIdx];

  return (
    <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
      <h3 className="font-heading text-base font-bold mb-4 flex items-center gap-2">
        <Calculator className="w-4 h-4 text-primary" />
        Budget Estimate
      </h3>

      {/* Price display */}
      <motion.div
        key={`${totalMin}-${totalMax}`}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-white mb-4"
      >
        <div className="flex items-center justify-between mb-1 text-xs text-white/70">
          <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Estimated Range</span>
          {loadingLoc && <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Localizing…</span>}
          {!loadingLoc && locationLabel && <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{locationLabel}</span>}
        </div>
        <div className="mb-1">
          <span className="font-heading text-3xl font-bold">{formatMoney(totalMin)}</span>
          <span className="text-white/50 text-xl mx-2">–</span>
          <span className="font-heading text-3xl font-bold">{formatMoney(totalMax)}</span>
        </div>
        <p className="text-white/60 text-xs">Midpoint: {formatMoney(totalMid)} · ~{sqft.toLocaleString()} sq ft estimate</p>
      </motion.div>

      {/* Material Quality Slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Material Quality</p>
          <span className={`text-xs font-bold ${currentMat.color}`}>{currentMat.label}</span>
        </div>
        <Slider
          min={0} max={2} step={1}
          value={[materialIdx]}
          onValueChange={([v]) => setMaterialIdx(v)}
          className="w-full mb-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Standard</span>
          <span>Mid-Range</span>
          <span>Premium</span>
        </div>
      </div>

      <div className="mt-4 flex gap-2 text-xs text-muted-foreground p-3 rounded-xl bg-muted">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Estimate based on your project type, location, and budget inputs. Actual costs vary. Request a free on-site quote for accuracy.</p>
      </div>
    </div>
  );
}