import { Link, useParams } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import { CheckCircle, ArrowRight, MapPin, Star, Phone } from "lucide-react";
import DesignPreviewCTA from "@/components/website/DesignPreviewCTA";
import Testimonials from "@/components/website/Testimonials";
import ContactForm from "@/components/website/ContactForm";
import TownMap from "@/components/website/TownMap";
import { getTownData, REGIONS, slugify } from "@/data/townData";
import { breadcrumbSchema, faqSchema, serviceSchema, localBusinessWithRegion } from "@/lib/schema";

// Region-specific CTA copy
const REGION_CTA = {
  "Greater Boston": {
    headline: (town) => `Expert Craftsmanship for Your Greater Boston Home in ${town}`,
    body: "We understand historic preservation requirements, Boston ISD permitting, and the unique challenges of urban renovation. Let's discuss your project.",
    primaryBtn: "Get Free Estimate",
    secondaryBtn: "Call (617) 857-COEN"
  },
  "Metro West": {
    headline: (town) => `Ready for Your ${town} Home Transformation?`,
    body: "Metro West homeowners trust Coen Construction for premium additions, luxury kitchens, and custom carpentry. Request a detailed estimate for your project.",
    primaryBtn: "Request Your Project Plan",
    secondaryBtn: "Speak with a Local Specialist"
  },
  "South Shore": {
    headline: (town) => `South Shore Dream Home? Get a Free Estimate for Your ${town} Property.`,
    body: "From coastal Capes to harbor estates, we specialize in coastal-grade materials, South Shore building codes, and the unique permit process for your town.",
    primaryBtn: "Get a Free South Shore Estimate",
    secondaryBtn: "Call Our South Shore Team"
  }
};

// Permit info per region
const REGION_PERMIT_INFO = {
  "Greater Boston": {
    intro: (town) => `${town} homeowners navigating home renovations must work within Boston-area building permit requirements. Coen Construction handles every permit on your behalf — from initial application to final inspection.`,
    points: [
      "Structural additions and home expansions require a full building permit from your local Inspectional Services Department (ISD).",
      "Historic district properties need additional review from the local Historic Commission or Preservation Board before work begins.",
      "All electrical, plumbing, and HVAC sub-permits are included in our full-service project management.",
      "Typical permit timelines in Greater Boston: 2–6 weeks depending on scope and local review board schedules."
    ]
  },
  "Metro West": {
    intro: (town) => `Every renovation in ${town} requires building permits from the town's Building Department. Coen Construction manages the entire permitting process so you never have to interact with the town office yourself.`,
    points: [
      "Home additions, decks, and structural changes require a building permit — we prepare and submit all documentation.",
      "Properties near conservation land or wetlands require Conservation Commission approval before construction.",
      "Historic Districts Commission review applies to many Metro West towns — we have extensive experience with these processes.",
      "Typical Metro West permit timelines: 2–4 weeks for standard renovations; 4–8 weeks for historic district review."
    ]
  },
  "South Shore": {
    intro: (town) => `${town} renovations often involve unique South Shore permit considerations — including coastal setbacks, FEMA flood zone requirements, and town-specific zoning bylaws. Coen Construction navigates all of these on your behalf.`,
    points: [
      "Coastal and waterfront properties must comply with the Massachusetts Wetlands Protection Act and may require Conservation Commission approval.",
      "FEMA flood zone properties have specific elevation and construction requirements — we ensure full compliance.",
      "Structural additions, decks, and exterior work require a building permit from your local Building Department.",
      "Typical South Shore permit timelines: 2–4 weeks for inland projects; 4–10 weeks for coastal/conservation-adjacent work."
    ]
  }
};

const SERVICE_LINKS = [
  { label: "Home Additions", path: "/services/home-additions" },
  { label: "Decks, Porches & Pergolas", path: "/services/decks-porches-pergolas" },
  { label: "Siding", path: "/services/siding" },
  { label: "Kitchen Remodeling", path: "/services/kitchen-remodeling" },
  { label: "Custom Carpentry", path: "/services/custom-carpentry" },
  { label: "Bathroom Remodeling", path: "/services/bathroom-remodeling" },
];

export default function WebTownPage() {
  const { town } = useParams();
  const data = getTownData(town);

  // Find region this town belongs to
  const region = REGIONS.find(r => r.name === data.region) || REGIONS[0];

  const regionCta = REGION_CTA[data.region] || REGION_CTA["Greater Boston"];
  const permitInfo = REGION_PERMIT_INFO[data.region] || REGION_PERMIT_INFO["Greater Boston"];

  // Sibling towns in same region (excluding current)
  const siblingTowns = region.towns
    .filter(t => t.toLowerCase().replace(/\s+/g, "-") !== town)
    .slice(0, 8);

  const localBusinessSchema = localBusinessWithRegion(data.name, data.region, data.county, town);

  return (
    <>
      <SEOHead
        title={`General Contractor in ${data.name} MA`}
        description={`Coen Construction — trusted general contractor in ${data.name}, MA. Home additions, decks, siding, kitchen remodeling & more. Free estimates. (617) 857-COEN.`}
        keywords={[`general contractor ${data.name} MA`, `best general contractor in ${data.name}`, `home additions ${data.name}`, `decks ${data.name} MA`, `siding ${data.name}`, `kitchen remodeling ${data.name}`, `${data.name} home renovation`]}
        canonicalUrl={`https://coenconstruction.com/service-areas/${town}`}
        structuredData={[localBusinessSchema, breadcrumbSchema([
          { name: "Service Areas", url: "/service-areas" },
          { name: region.name, url: `/service-areas/${region.slug}` },
          { name: `${data.name}, MA`, url: `/service-areas/${town}` }
        ]), ...(data.faqs?.length ? [faqSchema(data.faqs)] : []), serviceSchema({
          name: `General Contractor in ${data.name}, MA`,
          description: `Home additions, decks, siding, kitchen remodeling, and custom carpentry in ${data.name}, MA by Coen Construction.`,
          url: `https://coenconstruction.com/service-areas/${town}`,
        })]}
      />

      {/* Hero */}
      <section className="relative py-24 px-4 overflow-hidden">
        <img src={data.img} alt="" aria-hidden="true" fetchPriority="high" loading="eager" decoding="sync" width="1600" height="600" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-secondary/75" />
        <div className="relative max-w-4xl mx-auto text-center text-white">
          {/* Breadcrumb */}
          <nav className="flex items-center justify-center gap-1.5 text-white/60 text-xs mb-5">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link to="/service-areas" className="hover:text-white transition-colors">Service Areas</Link>
            <span>/</span>
            <Link to={`/service-areas/${region.slug}`} className="hover:text-white transition-colors">{region.name}</Link>
            <span>/</span>
            <span className="text-white">{data.name}</span>
          </nav>
          <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <MapPin className="w-4 h-4" /> {data.region} · {data.county}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            General Contractor in <span className="text-primary">{data.name}, MA</span>
          </h1>
          <p className="text-white/85 text-lg max-w-2xl mx-auto mb-8">{data.desc}</p>
          <p className="text-white/60 text-sm mb-8 font-medium">📍 Landmark: {data.landmark}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/contact" className="bg-primary text-white font-bold px-8 py-3 rounded hover:bg-primary/90 transition-colors">Get Free Estimate</Link>
            <a href="tel:6178572636" className="border-2 border-white text-white font-bold px-8 py-3 rounded hover:bg-white/10 transition-colors">(617) 857-COEN</a>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            {/* Intro */}
            <div>
              <span className="text-primary font-semibold text-sm uppercase tracking-widest">About This Area</span>
              <h2 className="text-2xl font-bold text-secondary mt-2 mb-4">Coen Construction in {data.name}, MA</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                {data.desc} As the trusted <Link to="/" className="text-primary hover:underline">Boston MA general contractor</Link>, Coen Construction has been serving {data.name} homeowners with premium craftsmanship since 2010.
              </p>
              <p className="text-gray-600 leading-relaxed">{data.history}</p>
            </div>

            {/* Services offered */}
            <div>
              <h2 className="text-2xl font-bold text-secondary mb-4">Services We Offer in {data.name}</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {SERVICE_LINKS.map(s => (
                  <Link key={s.path} to={s.path} className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors group">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-primary">{s.label}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400 ml-auto group-hover:text-primary" />
                  </Link>
                ))}
              </div>
            </div>

            {/* FAQs */}
            <div>
              <h2 className="text-2xl font-bold text-secondary mb-6">Frequently Asked Questions — {data.name}</h2>
              <div className="space-y-4">
                {data.faqs.map((faq, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-muted px-5 py-4">
                      <h3 className="font-semibold text-secondary text-sm">{faq.q}</h3>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-gray-600 text-sm leading-relaxed">{faq.a}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Map */}
            {data.gps_lat && (
              <div>
                <h2 className="text-2xl font-bold text-secondary mb-4">Explore {data.name} — Our Service Area</h2>
                <TownMap
                  townName={data.name}
                  gps_lat={data.gps_lat}
                  gps_lng={data.gps_lng}
                  pointsOfInterest={data.pointsOfInterest || []}
                />
              </div>
            )}

            {/* Permits & Zoning Section */}
            <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-secondary" />
                <span className="text-secondary font-semibold text-sm uppercase tracking-widest">Permits & Zoning in {data.name}</span>
              </div>
              <p className="text-gray-700 leading-relaxed mb-4 text-sm">{permitInfo.intro(data.name)}</p>
              <ul className="space-y-2">
                {permitInfo.points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>

            {/* Region-specific CTA */}
            <div className="bg-gradient-to-br from-secondary/5 to-primary/5 border border-primary/15 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-primary fill-primary" />
                <span className="text-primary font-semibold text-sm uppercase tracking-widest">Why {data.name} Homeowners Choose Us</span>
              </div>
              {data.local_usp && <p className="text-gray-700 leading-relaxed mb-3 text-sm">{data.local_usp}</p>}
              <h3 className="font-bold text-secondary text-base mb-2">{regionCta.headline(data.name)}</h3>
              <p className="text-gray-600 text-sm mb-4 leading-relaxed">{regionCta.body}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/contact" className="inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-2.5 rounded hover:bg-primary/90 transition-colors text-sm">
                  {regionCta.primaryBtn} <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="tel:6178572636" className="inline-flex items-center gap-2 border-2 border-secondary text-secondary font-bold px-6 py-2.5 rounded hover:bg-secondary hover:text-white transition-colors text-sm">
                  <Phone className="w-4 h-4" /> (617) 857-COEN
                </a>
              </div>
            </div>

            {/* Other towns in region */}

            <div className="border-t border-gray-100 pt-8">
              <h2 className="text-xl font-bold text-secondary mb-4">Explore Our Services</h2>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: "Home Additions", path: "/services/home-additions" },
                  { label: "Decks & Pergolas", path: "/services/decks-porches-pergolas" },
                  { label: "Siding", path: "/services/siding" },
                  { label: "Kitchen Remodeling", path: "/services/kitchen-remodeling" },
                  { label: "Custom Carpentry", path: "/services/custom-carpentry" },
                  { label: "Our Portfolio", path: "/gallery" },
                  { label: "Financing", path: "/financing" },
                  { label: "Blog & Tips", path: "/blog" },
                ].map(l => (
                  <Link key={l.path} to={l.path} className="flex items-center gap-1 bg-muted px-4 py-2 rounded text-sm font-medium text-gray-700 hover:text-primary hover:bg-primary/5 transition-colors">
                    {l.label} <ArrowRight className="w-3 h-3" />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-muted rounded-xl p-6 sticky top-6">
              <ContactForm title={`Free Estimate in ${data.name}`} subtitle="Respond within 1 business day." compact />
            </div>
            <div className="bg-secondary text-white rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-primary mb-1">Free</div>
              <div className="text-sm text-white/80 mb-3">In-Home Estimates in {data.name}</div>
              <a href="tel:6178572636" className="block bg-primary text-white font-bold py-3 rounded hover:bg-primary/90 transition-colors mb-3">(617) 857-COEN</a>
              <Link to="/start" className="block border border-white/30 text-white text-sm py-2.5 rounded hover:bg-white/10 transition-colors">Try Free Design Preview →</Link>
            </div>
            {/* Region nav */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-secondary text-sm mb-3 uppercase tracking-wide">More in {region.name}</h3>
              <div className="space-y-1.5">
                {region.towns.slice(0, 10).map(t => (
                  <Link key={t} to={`/service-areas/${slugify(t)}`} className={`flex items-center gap-2 text-sm py-1.5 px-2 rounded transition-colors ${slugify(t) === town ? "bg-primary/10 text-primary font-semibold" : "text-gray-600 hover:text-primary hover:bg-gray-50"}`}>
                    <MapPin className="w-3 h-3 shrink-0" /> {t}
                  </Link>
                ))}
                {region.towns.length > 10 && (
                  <Link to="/service-areas" className="flex items-center gap-1 text-xs text-primary hover:underline mt-2 px-2">
                    View all {region.towns.length} {region.name} towns <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <DesignPreviewCTA variant="banner" />

      <Testimonials />
    </>
  );
}