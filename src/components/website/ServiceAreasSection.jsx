import { Link } from "react-router-dom";
import { MapPin, ArrowRight, ChevronRight } from "lucide-react";
import { useState } from "react";
import { REGIONS, slugify } from "@/data/townData";

// LocalBusiness areaServed schema — all towns across all regions
const allTowns = REGIONS.flatMap(r => r.towns);
const areaServedSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Coen Construction",
  "url": "https://coenconstruction.com",
  "telephone": "+16178572636",
  "areaServed": allTowns.map(town => ({
    "@type": "City",
    "name": town,
    "addressRegion": "MA",
    "addressCountry": "US"
  }))
};

const REGION_COLORS = [
  { tab: "text-primary border-primary bg-primary/5", badge: "bg-primary/10 text-primary" },
  { tab: "text-primary border-primary bg-primary/5", badge: "bg-primary/10 text-primary" },
  { tab: "text-primary border-primary bg-primary/5", badge: "bg-primary/10 text-primary" },
];

export default function ServiceAreasSection({ darkBg = false }) {
  const [activeRegion, setActiveRegion] = useState(0);
  const region = REGIONS[activeRegion];

  const sectionBg = darkBg ? "bg-secondary" : "bg-white";
  const headingColor = darkBg ? "text-white" : "text-secondary";
  const subColor = darkBg ? "text-white/70" : "text-gray-500";
  const badgeColor = darkBg ? "text-primary" : "text-primary";
  const tabBase = darkBg
    ? "text-white/70 border-white/20 hover:border-white hover:text-white"
    : "text-gray-500 border-gray-200 hover:border-primary hover:text-primary";
  const tabActive = darkBg
    ? "border-primary text-white bg-white/10"
    : "border-primary text-primary bg-primary/5";
  const pillBase = darkBg
    ? "bg-white/10 border-white/20 text-white hover:bg-white hover:text-primary hover:border-white"
    : "bg-muted border-gray-200 text-gray-700 hover:bg-primary hover:text-white hover:border-primary";

  return (
    <section className={`py-16 px-4 ${sectionBg}`}>
      {/* Inject areaServed schema */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(areaServedSchema) }} />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <span className={`font-semibold text-sm uppercase tracking-widest ${badgeColor}`}>Where We Work</span>
          <h2 className={`text-3xl md:text-4xl font-bold mt-2 mb-3 ${headingColor}`}>
            Serving 65+ Communities Across Greater Boston
          </h2>
          <p className={`max-w-2xl mx-auto text-sm md:text-base ${subColor}`}>
            From Cambridge to Plymouth, Metro West to the South Shore — Coen Construction brings premium craftsmanship to homeowners across three major regions.
          </p>
        </div>

        {/* Region Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {REGIONS.map((r, i) => (
            <button
              key={r.slug}
              onClick={() => setActiveRegion(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border font-semibold text-sm transition-colors ${
                activeRegion === i ? tabActive : tabBase
              }`}
            >
              {r.name}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeRegion === i
                  ? (darkBg ? "bg-primary text-white" : "bg-primary text-white")
                  : (darkBg ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600")
              }`}>
                {r.towns.length}
              </span>
            </button>
          ))}
        </div>

        {/* Active Region Info */}
        <div className="mb-6 text-center">
          <p className={`text-sm ${subColor}`}>{region.desc}</p>
        </div>

        {/* Town Pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {region.towns.map(town => (
            <Link
              key={town}
              to={`/service-areas/${slugify(town)}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${pillBase}`}
            >
              <MapPin className="w-3 h-3 shrink-0" />
              {town}
            </Link>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-white/10">
          <Link
            to={`/service-areas#${region.slug}`}
            className={`inline-flex items-center gap-2 font-bold px-6 py-3 rounded-lg text-sm transition-colors ${
              darkBg
                ? "bg-white text-secondary hover:bg-white/90"
                : "bg-secondary text-white hover:bg-secondary/90"
            }`}
          >
            View All {region.towns.length} {region.name} Communities <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/service-areas"
            className={`inline-flex items-center gap-1 text-sm font-semibold transition-colors ${
              darkBg ? "text-white/70 hover:text-white" : "text-gray-500 hover:text-primary"
            }`}
          >
            Browse All 3 Regions <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* "Don't see your town" note */}
        <p className={`text-center text-xs mt-5 ${subColor}`}>
          Don't see your town?{" "}
          <Link to="/contact" className={`font-semibold hover:underline ${darkBg ? "text-white" : "text-primary"}`}>
            Contact us
          </Link>{" "}
          — we serve many surrounding communities too.
        </p>
      </div>
    </section>
  );
}