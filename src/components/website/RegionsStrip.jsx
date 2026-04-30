import { Link } from "react-router-dom";
import { MapPin, ArrowRight } from "lucide-react";
import { REGIONS, slugify } from "@/data/townData";

/**
 * Compact service-area regions strip — used across main pages.
 * Shows all 3 regions with town counts + a few sample towns.
 * bg: "white" | "muted" | "secondary"
 */
export default function RegionsStrip({ bg = "muted" }) {
  const bgClass = bg === "white" ? "bg-white" : bg === "secondary" ? "bg-secondary" : "bg-muted";
  const headingColor = bg === "secondary" ? "text-white" : "text-secondary";
  const subColor = bg === "secondary" ? "text-white/70" : "text-gray-500";
  const cardBg = bg === "secondary" ? "bg-white/10 border-white/20" : "bg-white border-gray-100";
  const cardHeading = bg === "secondary" ? "text-white" : "text-secondary";
  const badgeColor = bg === "secondary" ? "bg-primary/80 text-white" : "bg-primary/10 text-primary";
  const townColor = bg === "secondary" ? "text-white/80 hover:text-white" : "text-gray-600 hover:text-primary";
  const linkColor = bg === "secondary" ? "text-white font-semibold hover:underline" : "text-primary font-semibold hover:underline";

  return (
    <section className={`py-14 px-4 ${bgClass}`}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <span className="text-primary font-semibold text-xs uppercase tracking-widest">Where We Work</span>
          <h2 className={`text-2xl md:text-3xl font-bold mt-1 mb-2 ${headingColor}`}>
            Serving 65+ Communities Across 3 Regions
          </h2>
          <p className={`text-sm max-w-xl mx-auto ${subColor}`}>
            From Cambridge to Plymouth — Greater Boston, Metro West, and the South Shore.{" "}
            <Link to="/service-areas" className={linkColor}>View all service areas →</Link>
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {REGIONS.map(region => (
            <div key={region.slug} className={`rounded-xl border p-5 ${cardBg}`}>
              <div className="flex items-start justify-between mb-3">
                <h3 className={`font-bold text-base ${cardHeading}`}>{region.name}</h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                  {region.towns.length} towns
                </span>
              </div>
              <p className={`text-xs mb-3 leading-relaxed ${subColor}`}>{region.desc}</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {region.towns.slice(0, 6).map(town => (
                  <Link
                    key={town}
                    to={`/service-areas/${slugify(town)}`}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-transparent hover:border-primary/30 transition-colors ${townColor}`}
                  >
                    <MapPin className="w-2.5 h-2.5 shrink-0" />{town}
                  </Link>
                ))}
                {region.towns.length > 6 && (
                  <span className={`text-xs px-2 py-1 ${subColor}`}>+{region.towns.length - 6} more</span>
                )}
              </div>
              <Link
                to={`/service-areas#${region.slug}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                All {region.name} communities <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}