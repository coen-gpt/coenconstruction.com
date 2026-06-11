import { Link } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import { ArrowRight, CheckCircle, Home, Hammer, Layers, ChefHat, Wrench, Droplet, Snowflake } from "lucide-react";
import RegionsStrip from "@/components/website/RegionsStrip";
import { LOCAL_BUSINESS, breadcrumbSchema } from "@/lib/schema";
import DesignPreviewCTA from "@/components/website/DesignPreviewCTA";
import Testimonials from "@/components/website/Testimonials";
import ContactForm from "@/components/website/ContactForm";
import { WebsiteEvents } from "@/lib/analytics";

const services = [
  {
    icon: Home,
    title: "Home Additions",
    slug: "home-additions",
    tagline: "Add Space. Add Value. Add Life.",
    description:
      "Whether you need a new bedroom suite, a sunroom, a second-story addition, or an in-law suite, Coen Construction builds seamless home additions that feel like they were always part of your home. We serve homeowners across Greater Boston, including Newton, Cambridge, Brookline, and Lexington.",
    highlights: ["Second-story additions", "Dormer & attic conversions", "In-law suites", "Sunrooms & family rooms"],
    cta: "Explore Home Additions",
  },
  {
    icon: Layers,
    title: "Decks, Porches & Pergolas",
    slug: "decks-porches-pergolas",
    tagline: "Bring Your Outdoor Vision to Life.",
    description:
      "From a custom composite deck in Somerville to a screened-in porch in Needham, we design and build outdoor living spaces built to withstand New England's seasons. Our pergolas, gazebos, and wraparound porches are crafted to complement your home's architecture and maximize outdoor enjoyment.",
    highlights: ["Custom wood & composite decks", "Screened-in porches", "Pergolas & arbors", "Outdoor kitchens & lighting"],
    cta: "Explore Decks & Pergolas",
  },
  {
    icon: Wrench,
    title: "Siding",
    slug: "siding",
    tagline: "Protect & Beautify Your Home's Exterior.",
    description:
      "As expert siding contractors serving Boston, Cambridge, Somerville, Brookline, and beyond, we install and replace vinyl, James Hardie fiber cement, cedar, and engineered wood siding. A new siding installation dramatically improves curb appeal, energy efficiency, and weather protection.",
    highlights: ["James Hardie fiber cement", "Vinyl siding", "Cedar & wood siding", "Full exterior makeovers"],
    cta: "Explore Siding",
  },
  {
    icon: ChefHat,
    title: "Kitchen Remodeling",
    slug: "kitchen-remodeling",
    tagline: "The Heart of Your Home, Reimagined.",
    description:
      "From full gut renovations to cabinet refreshes, our kitchen remodeling team works with homeowners in Boston, Newton, Brookline, and Cambridge to create functional, beautiful kitchens. We handle everything — cabinets, countertops, plumbing, electrical, and flooring — under one roof.",
    highlights: ["Custom cabinetry", "Quartz & granite countertops", "Open-concept conversions", "Lighting & tile backsplash"],
    cta: "Explore Kitchen Remodeling",
  },
  {
    icon: Hammer,
    title: "Custom Carpentry",
    slug: "custom-carpentry",
    tagline: "Handcrafted Detail. Lasting Character.",
    description:
      "Our custom carpentry team specializes in built-ins, crown molding, wainscoting, coffered ceilings, staircase refinishing, and fine finish work. Every piece is custom-made and hand-fitted to your home. We proudly serve carpenters' clients throughout Greater Boston from our base in Stoughton, MA.",
    highlights: ["Built-in bookshelves & cabinetry", "Crown molding & trim", "Wainscoting & board-and-batten", "Staircase refinishing"],
    cta: "Explore Custom Carpentry",
  },
  {
    icon: Snowflake,
    title: "Snow Removal",
    slug: "snow-removal",
    tagline: "Stay Clear Through New England Storms.",
    description:
      "Residential snow removal and winter access support for Greater Boston homeowners, including driveways, walkways, entry areas, and small-property storm cleanup with contractor-level care around your home.",
    highlights: ["Driveways & walkways", "Ice management", "Storm response", "Renovation site access"],
    cta: "Explore Snow Removal",
  },
  {
    icon: Droplet,
    title: "Bathroom Remodeling",
    slug: "bathroom-remodeling",
    tagline: "Transform Your Personal Sanctuary.",
    description:
      "From master bath renovations to guest bathroom updates, our bathroom remodeling team works with homeowners in Boston, Newton, Brookline, and Cambridge to create functional, beautiful bathrooms. We handle everything — vanities, tile, plumbing, electrical, and flooring — under one roof.",
    highlights: ["Custom vanities & countertops", "Tile & stone work", "Spa-style showers & tubs", "Lighting & ventilation design"],
    cta: "Explore Bathroom Remodeling",
  },
];

export default function WebServices() {
  return (
    <>
      <SEOHead
        title="Construction & Remodeling Services in Greater Boston"
        description="Explore all services offered by Coen Construction — home additions, decks, siding, kitchen remodeling, bathroom remodeling, custom carpentry, and snow removal across Greater Boston, MA."
        keywords={["general contractor services Boston", "home remodeling Greater Boston", "construction services Boston MA"]}
        canonicalUrl="https://coenconstruction.com/services"
        structuredData={[LOCAL_BUSINESS, breadcrumbSchema([
          { name: "Services", url: "/services" }
        ])]}
      />

      {/* Hero */}
      <section className="relative py-28 px-4 overflow-hidden">
        <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80" alt="" aria-hidden="true" fetchPriority="high" loading="eager" decoding="sync" width="1600" height="600" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-secondary/75" />
        <div className="relative max-w-4xl mx-auto text-center text-white">
          <span className="inline-block bg-primary/20 border border-primary/30 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-4 uppercase tracking-widest">
            What We Do
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Full-Service <span className="text-primary">General Contractor</span> in Greater Boston
          </h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto mb-8">
            From{" "}
            <Link to="/services/home-additions" className="text-primary hover:underline">home additions</Link> and{" "}
            <Link to="/services/kitchen-remodeling" className="text-primary hover:underline">kitchen remodels</Link> to{" "}
            <Link to="/services/siding" className="text-primary hover:underline">siding</Link> and{" "}
            <Link to="/services/bathroom-remodeling" className="text-primary hover:underline">bathroom remodels</Link> — Coen Construction has been the trusted choice for Greater Boston homeowners since 2010.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/contact" onClick={() => WebsiteEvents.estimateCTAClicked('services_hero')} className="bg-primary text-white font-bold px-8 py-3 rounded hover:bg-primary/90 transition-colors">
              Get a Free Estimate
            </Link>
            <a href="tel:6178572636" onClick={() => WebsiteEvents.phoneClicked('services_hero')} className="border-2 border-white text-white font-bold px-8 py-3 rounded hover:bg-white/10 transition-colors">
              (617) 857-COEN
            </a>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-primary font-semibold text-sm uppercase tracking-widest">Our Services</span>
            <h2 className="text-3xl md:text-4xl font-bold text-secondary mt-2">
              Everything Your Home Needs, Under One Roof
            </h2>
            <p className="text-gray-500 mt-3 max-w-2xl mx-auto">
              We're a family-owned{" "}
              <Link to="/service-areas" className="text-primary hover:underline">Greater Boston general contractor</Link>{" "}
              serving homeowners across{" "}
              <Link to="/service-areas/boston" className="text-primary hover:underline">Boston</Link>,{" "}
              <Link to="/service-areas/cambridge" className="text-primary hover:underline">Cambridge</Link>,{" "}
              <Link to="/service-areas/newton" className="text-primary hover:underline">Newton</Link>,{" "}
              <Link to="/service-areas/brookline" className="text-primary hover:underline">Brookline</Link>, and dozens more communities.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.slug}
                  className="border border-gray-100 rounded-2xl p-7 shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">{service.tagline}</span>
                  <h3 className="text-xl font-bold text-secondary mb-3">{service.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4 flex-1">{service.description}</p>

                  <ul className="space-y-1.5 mb-6">
                    {service.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>

                  <Link
                    to={`/services/${service.slug}`}
                    onClick={() => WebsiteEvents.servicePageViewed(service.slug)}
                    className="flex items-center justify-center gap-2 bg-secondary text-white font-semibold py-2.5 rounded-lg hover:bg-secondary/90 transition-colors text-sm mt-auto"
                  >
                    {service.cta} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Coen strip */}
      <section className="py-14 px-4 bg-muted">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-secondary mb-3">
            Why Homeowners Across Greater Boston Choose Coen Construction
          </h2>
          <p className="text-gray-600 max-w-3xl mx-auto text-sm leading-relaxed mb-8">
            Since 2010, we've completed hundreds of projects — from{" "}
            <Link to="/services/home-additions" className="text-primary hover:underline">home additions in Newton</Link> to{" "}
            <Link to="/services/decks-porches-pergolas" className="text-primary hover:underline">custom decks in Somerville</Link> to{" "}
            <Link to="/services/siding" className="text-primary hover:underline">siding in Cambridge</Link>. We're fully licensed (MA Reg. #CS-107247), insured, and committed to on-time, on-budget delivery.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { stat: "15+", label: "Years in Business" },
              { stat: "500+", label: "Projects Completed" },
              { stat: "5★", label: "Google Rating" },
              { stat: "Free", label: "In-Home Estimates" },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-xl py-6 px-4 shadow-sm">
                <div className="text-3xl font-bold text-primary mb-1">{item.stat}</div>
                <div className="text-sm text-gray-600">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DesignPreviewCTA variant="banner" />

      <RegionsStrip bg="white" />

      <Testimonials />

      <section className="py-16 px-4 bg-muted">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-secondary">Ready to Start Your Project?</h2>
            <p className="text-gray-500 mt-2 text-sm">Free in-home estimates across Greater Boston. We respond within 1 business day.</p>
          </div>
          <div className="bg-white rounded-2xl p-8 shadow-sm">
            <ContactForm title="" subtitle="" />
          </div>
        </div>
      </section>
    </>
  );
}