import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import adminEntities from '@/api/adminEntities';
import { Link } from "react-router-dom";
import { Shield, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, ChevronRight, DollarSign } from "lucide-react";
import { useCompanyBrand } from "@/hooks/useCompanyBrand";

function calcMargin(estimate) {
  if (!estimate?.line_items?.length) return null;
  const laborCost = estimate.line_items
    .filter(i => i.cost_type === "labor")
    .reduce((s, i) => s + (i.unit_cost * i.quantity || 0), 0);
  const materialCost = estimate.line_items
    .filter(i => i.cost_type === "material")
    .reduce((s, i) => s + (i.unit_cost * i.quantity || 0), 0);
  const subCost = estimate.line_items
    .filter(i => i.cost_type === "subcontractor")
    .reduce((s, i) => s + (i.unit_cost * i.quantity || 0), 0);
  const totalCost = laborCost + materialCost + subCost;
  const revenue = estimate.grand_total || 0;
  const gp = revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0;
  return { gp: Math.round(gp * 10) / 10, revenue, totalCost, laborCost, materialCost, subCost };
}

export default function MarginGuard() {
  const [minGP, setMinGP] = useState(15);
  const { brandColor } = useCompanyBrand();

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-margin"],
    queryFn: () => adminEntities.ContractorProject.filter({ status: ["draft", "pending_review", "approved", "in_progress"] }),
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates-margin"],
    queryFn: () => base44.entities.Estimate.list("-updated_date", 200),
  });

  // Latest estimate per project
  const projectEstimates = projects.map(project => {
    const projectEstList = estimates
      .filter(e => e.project_id === project.id && e.type === "original")
      .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date));
    const latest = projectEstList[0];
    const margin = latest ? calcMargin(latest) : null;
    return { project, estimate: latest, margin };
  }).filter(pe => pe.estimate && pe.margin);

  const below = projectEstimates.filter(pe => pe.margin.gp < minGP);
  const healthy = projectEstimates.filter(pe => pe.margin.gp >= minGP);

  const avgGP = projectEstimates.length
    ? projectEstimates.reduce((s, pe) => s + pe.margin.gp, 0) / projectEstimates.length
    : 0;

  const totalRevenue = projectEstimates.reduce((s, pe) => s + pe.margin.revenue, 0);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: brandColor + "20" }}>
          <Shield className="w-5 h-5" style={{ color: brandColor }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-secondary">Margin Guard</h1>
          <p className="text-sm text-gray-500">Live GP% across all active estimates — flags bids below your floor</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Avg GP%", value: `${avgGP.toFixed(1)}%`, icon: TrendingUp, color: avgGP >= minGP ? "text-green-600" : "text-red-500" },
          { label: "Total Pipeline", value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: "text-secondary" },
          { label: "Healthy Bids", value: healthy.length, icon: CheckCircle, color: "text-green-600" },
          { label: "Below Floor", value: below.length, icon: AlertTriangle, color: below.length > 0 ? "text-red-500" : "text-gray-400" },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-gray-500">{stat.label}</span>
            </div>
            <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* GP Floor slider */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-secondary">Minimum GP% Floor</label>
          <span className="text-lg font-bold" style={{ color: brandColor }}>{minGP}%</span>
        </div>
        <input
          type="range" min={5} max={40} value={minGP}
          onChange={e => setMinGP(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>5%</span><span>40%</span>
        </div>
      </div>

      {/* Below floor */}
      {below.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-bold text-red-500 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" /> {below.length} bid{below.length > 1 ? "s" : ""} below {minGP}% GP floor
          </h2>
          <div className="space-y-2">
            {below.map(({ project, estimate, margin }) => (
              <MarginRow key={project.id} project={project} estimate={estimate} margin={margin} minGP={minGP} />
            ))}
          </div>
        </div>
      )}

      {/* Healthy */}
      {healthy.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-green-600 flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4" /> {healthy.length} bid{healthy.length > 1 ? "s" : ""} above floor
          </h2>
          <div className="space-y-2">
            {healthy.map(({ project, estimate, margin }) => (
              <MarginRow key={project.id} project={project} estimate={estimate} margin={margin} minGP={minGP} />
            ))}
          </div>
        </div>
      )}

      {projectEstimates.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No estimates with line-item costs found.</p>
          <p className="text-xs mt-1">Add labor/material costs to your estimates to see GP tracking.</p>
        </div>
      )}
    </div>
  );
}

function MarginRow({ project, estimate, margin, minGP }) {
  const ok = margin.gp >= minGP;
  const gap = margin.gp - minGP;
  return (
    <Link
      to={`/estimator/projects/${project.id}`}
      className="flex items-center gap-4 bg-white border rounded-xl px-5 py-4 hover:shadow-sm transition-shadow"
      style={{ borderColor: ok ? "#d1fae5" : "#fee2e2" }}
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-secondary truncate">{project.client_name}</div>
        <div className="text-xs text-gray-400 truncate">{project.project_type} · {project.client_city || project.client_address}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs text-gray-400">Revenue</div>
        <div className="font-semibold text-secondary text-sm">${margin.revenue.toLocaleString()}</div>
      </div>
      <div className="text-right shrink-0 w-20">
        <div className="text-xs text-gray-400">GP%</div>
        <div className={`text-lg font-bold ${ok ? "text-green-600" : "text-red-500"}`}>{margin.gp}%</div>
        {!ok && <div className="text-xs text-red-400">{Math.abs(gap).toFixed(1)}% below floor</div>}
      </div>
      {ok
        ? <TrendingUp className="w-4 h-4 text-green-500 shrink-0" />
        : <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />
      }
      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
    </Link>
  );
}