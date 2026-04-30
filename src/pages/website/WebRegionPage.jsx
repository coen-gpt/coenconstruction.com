import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { MapPin, ChevronRight, ArrowRight, CheckCircle, Phone } from "lucide-react";
import { REGIONS, slugify, getTownData } from "@/data/townData";
import { LOCAL_BUSINESS, breadcrumbSchema } from "@/lib/schema";
import ContactForm from "@/components/website/ContactForm";

const REGION_HERO_IMGS = {
  "greater-boston": "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1600&q=80",
  "metro-west": "https://images.unsplash.com/photo-1575517111839-3a3843ee7f5d?w=1600&q=80",
  "south-shore": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80"
};

const REGION_CTAS = {
  "greater-boston": {
    headline: "Serving Greater Boston's Most Historic Homes",
    subtext: "From Cambridge triple-deckers to Charlestown rowhouses — we understand historic preservation, tight lots, and Boston ISD permitting.",
    cta: "Get Your Boston Area Estimate",
    ctaPhone: "Schedule a Greater Boston Consultation"
  },
  "metro-west": {
    headline: "Metro West's Trusted Home Renovation Experts",
    subtext: "From Lexington Colonials to Weston estates — we deliver premium craftsmanship worthy of Metro West's most prestigious neighborhoods.",
    cta: "Request Your Metro West Project Plan",
    ctaPhone: "Talk to a Metro West Specialist"
  },
  "south-shore": {
    headline: "Built for the South Shore's Coastal Environment",
    subtext: "From Hingham harbor estates to Plymouth coastal Capes — we specialize in coastal-grade materials and local permit expertise.",
    cta: "Get a Free South Shore Estimate",
    ctaPhone: "Speak with Our South Shore Team"
  }
};

const REGION_SERVICES = {
  "greater-boston": ["Home Additions & Second-Story Expansions", "Triple-Decker Siding & Exterior Renovation", "Kitchen Remodeling", "Custom Carpentry & Trim", "Decks & Roof Decks", "Historic Preservation-Compliant Renovations"],
  "metro-west": ["Luxury Home Additions", "Estate Kitchen & Bath Remodeling", "Premium Custom Carpentry", "Deck & Pergola Construction", "Siding Installation", "Conservation-Adjacent Project Expertise"],
  "south-shore": ["Coastal-Grade Siding (James Hardie)", "Waterfront Deck & Porch Additions", "Home Additions", "Kitchen Remodeling", "Custom Carpentry", "FEMA Flood Zone & Conservation-Compliant Work"]
};

export default function WebRegionPage() {
  const params = useParams();
  // Support both explicit routes (no param) and dynamic :region param
  const region = params.region || window.location.pathname.split("/service-areas/")[1]?.split("/")[0];
  const regionData = REGIONS.find(r => r.slug === region);

  if (!regionData) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold text-secondary">Region not found</h1>
        <Link to="/service-areas" className="text-primary hover:underline mt-4 inline-block">View all service areas</Link>
      </div>
    );
  }

  const heroImg = REGION_HERO_IMGS[region] || REGION_HERO_IMGS["greater-boston"];
  const ctas = REGION_CTAS[region] || REGION_CTAS["greater-boston"];
  const services = REGION_SERVICES[region] || REGION_SERVICES["greater-boston"];

  const regionSchema = {
    ...LOCAL_BUSINESS,
    "areaServed": [
      { "@type": "State", "name": "Massachusetts" },
      { "@type": "AdministrativeArea", "name": regionData.name },
      ...regionData.towns.map(town => ({ "@type": "City", "name": town, "addressRegion": "MA" }))
    ],
    "makesOffer": services.map(s => ({
      "@type": "Offer",
      "itemOffered": {
        "@type": "Service",
        "name": `${s} in ${regionData.name}`,
        "serviceType": "Construction",
        "areaServed": regionData.name
      }
    }))
  };

  const featuredTowns = regionData.towns.slice(0, 9);

  return (
    <>
      <Helmet>
        <title>{regionData.name} General Contractor | Coen Construction | Home Additions, Decks & Remodeling</title>
        <meta name="description" content={`Coen Construction serves all of ${regionData.name} — ${regionData.towns.slice(0, 5).join(", ")}, and more. Home additions, decks, siding, kitchen remodeling & custom carpentry. Free estimates. (617) 857-COEN.`} />
        <meta name="keywords" content={`general contractor ${regionData.name} MA, home additions ${regionData.name}, renovation contractor ${regionData.name}, ${regionData.towns.slice(0, 4).map(t => `contractor ${t} MA`).join(", ")}`} />
        <link rel="canonical" href={`https://www.coenconstruction.com/service-areas/${region}`} />
        <script type="application/ld+json">{JSON.stringify(regionSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema([
          { name: "Home", url: "https://www.coenconstruction.com" },
          { name: "Service Areas", url: "https://www.coenconstruction.com/service-areas" },
          { name: regionData.name, url: `https://www.coenconstruction.com/service-areas/${region}` }
        ]))}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative py-24 px-4 overflow-hidden">
        <img src={heroImg} alt="" aria-hidden="true" fetchpriority="high" loading="eager" decoding="sync" width="1600" height="600" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-secondary/75" />
        <div className="relative max-w-4xl mx-auto text-center text-white">
          <nav className="flex items-center justify-center gap-1.5 text-white/60 text-xs mb-5">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link to="/service-areas" className="hover:text-white transition-colors">Service Areas</Link>
            <span>/</span>
            <span className="text-white">{regionData.name}</span>
          </nav>
          <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <MapPin className="w-4 h-4" /> {regionData.towns.length} Communities Served
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            General Contractor in <span className="text-primary">{regionData.name}</span>
          </h1>
          <p className="text-white/85 text-lg max-w-2xl mx-auto mb-8">{ctas.subtext}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/contact" className="bg-primary text-white font-bold px-8 py-3 rounded hover:bg-primary/90 transition-colors">{ctas.cta}</Link>
            <a href="tel:6178572636" className="border-2 border-white text-white font-bold px-8 py-3 rounded hover:bg-white/10 transition-colors">(617) 857-COEN</a>
          </div>
        </div>
      </section>

      {/* Services in this region */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-primary font-semibold text-sm uppercase tracking-widest">What We Do</span>
            <h2 className="text-3xl font-bold text-secondary mt-2">{ctas.headline}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {services.map((s, i) => (
              <div key={i} className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl hover:border-primary hover:bg-primary/5 transition-colors">
                <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-gray-700">{s}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              { label: "Home Additions", path: "/services/home-additions" },
              { label: "Decks & Pergolas", path: "/services/decks-porches-pergolas" },
              { label: "Siding", path: "/services/siding" },
              { label: "Kitchen Remodeling", path: "/services/kitchen-remodeling" },
              { label: "Custom Carpentry", path: "/services/custom-carpentry" },
            ].map(s => (
              <Link key={s.path} to={s.path} className="flex items-center gap-1.5 bg-muted px-4 py-2 rounded-full text-sm font-medium text-gray-700 hover:text-primary hover:bg-primary/5 transition-colors border border-gray-200">
                {s.label} <ArrowRight className="w-3 h-3" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Town Grid */}
      <section className="py-14 px-4 bg-muted">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-primary font-semibold text-sm uppercase tracking-widest">Browse By Town</span>
            <h2 className="text-3xl font-bold text-secondary mt-2">All {regionData.name} Communities We Serve</h2>
            <p className="text-gray-500 text-sm mt-2 max-w-xl mx-auto">{regionData.desc}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {regionData.towns.map(town => (
              <Link
                key={town}
                to={`/service-areas/${slugify(town)}`}
                className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors group"
              >
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-sm font-medium text-gray-700 group-hover:text-primary leading-tight">{town}</span>
                <ChevronRight className="w-3 h-3 text-gray-300 ml-auto group-hover:text-primary shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Other Regions */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-secondary mb-3">Explore Other Regions</h2>
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {REGIONS.filter(r => r.slug !== region).map(r => (
              <Link key={r.slug} to={`/service-areas/${r.slug}`} className="flex items-center gap-2 border-2 border-secondary text-secondary font-semibold px-6 py-3 rounded-lg hover:bg-secondary hover:text-white transition-colors">
                <MapPin className="w-4 h-4" /> {r.name} <ChevronRight className="w-4 h-4" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 px-4 bg-muted">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-secondary">{ctas.cta}</h2>
            <p className="text-gray-500 mt-2 text-sm">Call <a href="tel:6178572636" className="text-primary font-semibold hover:underline">(617) 857-COEN</a> or fill out the form. We respond within 1 business day.</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <ContactForm title={`Free Estimate — ${regionData.name}`} subtitle={`Serving all ${regionData.towns.length} ${regionData.name} communities.`} />
          </div>
        </div>
      </section>
    </>
  );
}