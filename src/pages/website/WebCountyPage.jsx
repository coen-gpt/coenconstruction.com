import { Link, useParams } from "react-router-dom";
import { MapPin, ArrowRight, CheckCircle, Phone } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { lazy, Suspense } from "react";
import { localBusinessSchema, breadcrumbSchema } from "@/lib/schema";
import { getCountyList, slugify } from "@/data/townData";
import { serviceData, SERVICE_SLUGS } from "@/data/servicesData";

const Testimonials = lazy(() => import("@/components/website/Testimonials"));
const ContactForm = lazy(() => import("@/components/website/ContactForm"));
const DesignPreviewCTA = lazy(() => import("@/components/website/DesignPreviewCTA"));

const serviceLabel = (slug) => serviceData[slug].title.replace(/ Boston MA$/, "");

export default function WebCountyPage() {
  const { county } = useParams();
  const data = getCountyList().find(c => c.slug === county);

  if (!data) {
    return <div className="py-20 text-center"><h1 className="text-2xl font-bold text-secondary">County not found</h1><Link to="/service-areas" className="text-primary hover:underline mt-4 block">← All Service Areas</Link></div>;
  }

  const pageUrl = `https://coenconstruction.com/service-areas/county/${county}`;

  return (
    <>
      <SEOHead
        title={`${data.name} MA General Contractor`}
        description={`Coen Construction serves ${data.towns.length} ${data.name} communities — ${data.towns.slice(0, 5).join(", ")} & more. Home additions, kitchens, baths, decks, siding. Free estimates. (617) 857-COEN.`}
        keywords={[`general contractor ${data.name} MA`, `${data.name} home remodeling`, `${data.name} contractor near me`]}
        canonicalUrl={pageUrl}
        structuredData={[
          localBusinessSchema({
            areaServed: [
              { "@type": "County", name: data.name },
              ...data.towns.slice(0, 10).map(t => ({ "@type": "City", name: t, addressRegion: "MA" })),
            ],
          }),
          breadcrumbSchema([
            { name: "Service Areas", url: "/service-areas" },
            { name: data.name, url: `/service-areas/county/${county}` },
          ]),
        ]}
      />

      {/* Hero */}
      <section className="relative py-24 px-4 flex items-center" style={{ background: "linear-gradient(rgba(27,43,58,0.78), rgba(27,43,58,0.78)), url('https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1600&q=80') center/cover" }}>
        <div className="max-w-4xl mx-auto text-center text-white w-full">
          <nav className="flex items-center justify-center gap-1.5 text-white/60 text-xs mb-5">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link to="/service-areas" className="hover:text-white transition-colors">Service Areas</Link>
            <span>/</span>
            <span className="text-white">{data.name}</span>
          </nav>
          <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <MapPin className="w-4 h-4" /> {data.towns.length} Communities Served
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            General Contractor in <span className="text-primary">{data.name}, MA</span>
          </h1>
          <p className="text-white/85 text-lg max-w-2xl mx-auto mb-8">
            Home additions, kitchen and bathroom remodeling, decks, siding, and custom carpentry for {data.name} homeowners — family-owned and licensed since 2010.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/contact" className="bg-primary text-white font-bold px-8 py-3 rounded hover:bg-primary/90 transition-colors">Get Free Estimate</Link>
            <a href="tel:6178572636" className="border-2 border-white text-white font-bold px-8 py-3 rounded hover:bg-white/10 transition-colors">(617) 857-COEN</a>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <div>
              <h2 className="text-2xl font-bold text-secondary mb-4">{data.name} Communities We Serve</h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                From our Stoughton headquarters, Coen Construction serves homeowners across {data.name} with the same crew, the same standards, and the same one-business-day response. Select your community for local project details, permit guidance, and town-specific FAQs.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.towns.map(town => (
                  <Link key={town} to={`/service-areas/${slugify(town)}`} className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors group">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-primary">{town}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-secondary mb-4">Services Across {data.name}</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {SERVICE_SLUGS.map(s => (
                  <Link key={s} to={`/services/${s}`} className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors group">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-primary">{serviceLabel(s)}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400 ml-auto group-hover:text-primary" />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-muted rounded-xl p-6 sticky top-6">
              <Suspense fallback={<div className="h-64 animate-pulse bg-gray-100 rounded-lg" />}>
                <ContactForm title={`Free Estimate in ${data.name}`} subtitle="Respond within 1 business day." compact />
              </Suspense>
            </div>
            <div className="bg-secondary text-white rounded-xl p-6 text-center">
              <div className="text-sm text-white/80 mb-3">Free In-Home Estimates Across {data.name}</div>
              <a href="tel:6178572636" className="flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 rounded hover:bg-primary/90 transition-colors mb-3"><Phone className="w-4 h-4" /> (617) 857-COEN</a>
              <Link to="/start" className="block border border-white/30 text-white text-sm py-2.5 rounded hover:bg-white/10 transition-colors">Try Free Design Preview →</Link>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={<div className="h-32 bg-secondary/5" />}>
        <DesignPreviewCTA variant="banner" page={`county_${county}`} />
      </Suspense>

      <Suspense fallback={<div className="h-64 bg-white" />}>
        <Testimonials />
      </Suspense>
    </>
  );
}
