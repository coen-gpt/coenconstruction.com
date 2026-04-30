import { Link } from "react-router-dom";
import { MapPin, ChevronRight } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { REGIONS, slugify } from "@/data/townData";
import { LOCAL_BUSINESS, breadcrumbSchema } from "@/lib/schema";
import ContactForm from "@/components/website/ContactForm";

export default function WebServiceAreas() {
  return (
    <>
      <SEOHead
        title="Service Areas | Coen Construction | Greater Boston, Metro West & South Shore"
        description="Coen Construction serves Greater Boston, Metro West, and the South Shore — 65+ communities including Cambridge, Newton, Quincy, Plymouth, Hingham, and more. Call (617) 857-COEN."
        canonicalUrl="https://www.coenconstruction.com/service-areas"
        structuredData={[LOCAL_BUSINESS, breadcrumbSchema([
          { name: "Home", url: "https://www.coenconstruction.com" },
          { name: "Service Areas", url: "https://www.coenconstruction.com/service-areas" }
        ])]}
      />

      {/* Hero */}
      <section className="relative py-24 px-4 flex items-center" style={{ background: "linear-gradient(rgba(27,43,58,0.78), rgba(27,43,58,0.78)), url('https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1600&q=80') center/cover" }}>
        <div className="max-w-4xl mx-auto text-center text-white">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest">Where We Work</span>
          <h1 className="text-4xl md:text-5xl font-bold mt-2 mb-5">Service Areas</h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">Coen Construction proudly serves homeowners across Greater Boston, Metro West, and the South Shore — 65+ communities and growing.</p>
        </div>
      </section>

      {/* Region Sections */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto space-y-16">
          {REGIONS.map((region, ri) => (
            <div key={region.slug}>
              {/* Region Header */}
              <div className={`flex items-center gap-4 mb-8 pb-4 border-b-2 border-primary`}>
                <div>
                  <Link to={`/service-areas/${region.slug}`} className="hover:text-primary transition-colors group">
                    <h2 className="text-2xl md:text-3xl font-bold text-secondary group-hover:text-primary">{region.name}</h2>
                  </Link>
                  <p className="text-gray-500 text-sm mt-1">{region.desc}</p>
                </div>
                <Link to={`/service-areas/${region.slug}`} className="ml-auto text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-semibold whitespace-nowrap hover:bg-primary hover:text-white transition-colors">
                  {region.towns.length} communities →
                </Link>
              </div>

              {/* Town Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {region.towns.map(town => (
                  <Link
                    key={town}
                    to={`/service-areas/${slugify(town)}`}
                    className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors group"
                  >
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-primary leading-tight">{town}</span>
                    <ChevronRight className="w-3 h-3 text-gray-300 ml-auto group-hover:text-primary shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Cross-links to services */}
      <section className="py-14 px-4 bg-muted">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-secondary mb-3">Our Services — Available Everywhere We Serve</h2>
          <p className="text-gray-500 text-sm mb-8 max-w-2xl mx-auto">
            From Greater Boston to the South Shore, every community we serve gets the same premium craftsmanship.{" "}
            <Link to="/services" className="text-primary hover:underline font-medium">View all services →</Link>
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: "Home Additions", path: "/services/home-additions" },
              { label: "Decks & Pergolas", path: "/services/decks-porches-pergolas" },
              { label: "Siding", path: "/services/siding" },
              { label: "Kitchen Remodeling", path: "/services/kitchen-remodeling" },
              { label: "Custom Carpentry", path: "/services/custom-carpentry" },
              { label: "Bathroom Remodeling", path: "/services/bathroom-remodeling" },
            ].map(s => (
              <Link key={s.path} to={s.path} className="bg-white border border-gray-200 hover:border-primary hover:text-primary text-gray-700 px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm">
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-secondary">Don't See Your Town?</h2>
            <p className="text-gray-500 mt-2 text-sm">We likely serve your area. Call us at <a href="tel:6178572636" className="text-primary font-semibold hover:underline">(617) 857-COEN</a> or fill out the form below — we respond within 1 business day.</p>
          </div>
          <div className="bg-muted rounded-xl p-6">
            <ContactForm title="Get a Free Estimate" subtitle="Serving 65+ Greater Boston communities." />
          </div>
        </div>
      </section>
    </>
  );
}