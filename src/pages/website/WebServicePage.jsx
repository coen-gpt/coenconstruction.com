import { Link, useParams } from "react-router-dom";
import { CheckCircle, ArrowRight, MapPin } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { lazy, Suspense, useEffect } from "react";
import { WebsiteEvents } from "@/lib/analytics";
import { LOCAL_BUSINESS, breadcrumbSchema, serviceSchema } from "@/lib/schema";
import { REGIONS, slugify } from "@/data/townData";
import { useSiteContent } from "@/hooks/useSiteContent";
import { serviceData } from "@/data/servicesData";

const RegionsStrip = lazy(() => import("@/components/website/RegionsStrip"));
const DesignPreviewCTA = lazy(() => import("@/components/website/DesignPreviewCTA"));
const Testimonials = lazy(() => import("@/components/website/Testimonials"));
const ContactForm = lazy(() => import("@/components/website/ContactForm"));



const SERVICE_CMS_KEYS = {
  "home-additions": "service_home_additions",
  "decks-porches-pergolas": "service_decks",
  "siding": "service_siding",
  "kitchen-remodeling": "service_kitchen",
  "bathroom-remodeling": "service_bathroom",
  "custom-carpentry": "service_carpentry",
  "snow-removal": "service_snow",
};

export default function WebServicePage() {
  const { service } = useParams();
  const baseData = serviceData[service];
  const { data: cms } = useSiteContent(SERVICE_CMS_KEYS[service]);

  useEffect(() => {
    if (service) WebsiteEvents.servicePageViewed(service);
  }, [service]);

  if (!baseData) return <div className="py-20 text-center"><h1 className="text-2xl font-bold text-secondary">Service not found</h1><Link to="/" className="text-primary hover:underline mt-4 block">← Back to Home</Link></div>;

  // Merge CMS overrides on top of static defaults
  const data = {
    ...baseData,
    headline: cms?.headline || baseData.headline,
    intro: cms?.intro || baseData.intro,
    img: cms?.image_url || baseData.img,
    metaTitle: cms?.meta_title || baseData.title,
    metaDesc: cms?.meta_description || baseData.metaDesc,
    body: [cms?.body1, cms?.body2, cms?.body3].filter(Boolean).join("\n\n") || baseData.body,
    features: [
      cms?.feature1, cms?.feature2, cms?.feature3, cms?.feature4,
      cms?.feature5, cms?.feature6, cms?.feature7, cms?.feature8,
    ].filter(Boolean).length > 0
      ? [cms?.feature1, cms?.feature2, cms?.feature3, cms?.feature4,
         cms?.feature5, cms?.feature6, cms?.feature7, cms?.feature8].filter(Boolean)
      : baseData.features,
  };

  return (
    <>
      <SEOHead
        title={data.metaTitle || data.title}
        description={data.metaDesc}
        keywords={[`${(data.metaTitle || data.title).replace(/ Boston MA$/, "")} Boston MA`, `${(data.metaTitle || data.title).toLowerCase()}`, "general contractor Greater Boston", "free estimate Boston contractor"]}
        canonicalUrl={`https://coenconstruction.com/services/${service}`}
        structuredData={[LOCAL_BUSINESS, breadcrumbSchema([
          { name: "Services", url: "/services" },
          { name: data.title, url: `/services/${service}` }
        ]), serviceSchema({
          name: data.title,
          description: data.metaDesc,
          url: `https://coenconstruction.com/services/${service}`,
          serviceTypes: data.features,
        })]}
      />

      {/* Hero */}
      <section className="relative py-28 px-4 overflow-hidden">
        <img
          src={data.img}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          loading="eager"
          decoding="sync"
          width="1600"
          height="600"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-secondary/75" />
        <div className="relative" />
        <div className="relative max-w-4xl mx-auto text-center text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{data.headline}</h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto mb-8">{data.intro}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/contact" onClick={() => WebsiteEvents.estimateCTAClicked(`service_${service}`)} className="bg-primary text-white font-bold px-8 py-3 rounded hover:bg-primary/90 transition-colors">Get Free Estimate</Link>
            <a href="tel:6178572636" onClick={() => WebsiteEvents.phoneClicked(`service_${service}`)} className="border-2 border-white text-white font-bold px-8 py-3 rounded hover:bg-white/10 transition-colors">(617) 857-COEN</a>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <div className="prose max-w-none text-gray-600 leading-relaxed space-y-4">
              {data.body.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
            </div>

            <h2 className="text-2xl font-bold text-secondary mt-10 mb-5">What's Included</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {data.features.map(f => (
                <div key={f} className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-gray-700 text-sm">{f}</span>
                </div>
              ))}
            </div>

            {/* Related */}
            <h2 className="text-xl font-bold text-secondary mt-10 mb-4">Related Services</h2>
            <div className="flex flex-wrap gap-3">
              {data.related.map(r => (
                <Link key={r.path} to={r.path} onClick={() => WebsiteEvents.relatedServiceClicked(service, r.path)} className="flex items-center gap-1 bg-muted px-4 py-2 rounded text-sm font-medium text-gray-700 hover:text-primary hover:bg-primary/5 transition-colors">
                  {r.label} <ArrowRight className="w-3 h-3" />
                </Link>
              ))}
            </div>

            {/* Towns where this service is offered */}
            <h2 className="text-xl font-bold text-secondary mt-10 mb-4">Where We Offer This Service</h2>
            <div className="flex flex-wrap gap-2">
              {REGIONS.flatMap(region => region.towns.slice(0, 4)).map(town => (
                <Link key={town} to={`/service-areas/${slugify(town)}/${service}`} className="flex items-center gap-1 bg-muted px-3 py-1.5 rounded text-xs font-medium text-gray-600 hover:text-primary hover:bg-primary/5 transition-colors">
                  <MapPin className="w-3 h-3" /> {town}
                </Link>
              ))}
              <Link to="/service-areas" className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold text-primary hover:underline">
                All 90+ communities <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-muted rounded-xl p-6">
              <Suspense fallback={<div className="h-64 animate-pulse bg-gray-100 rounded-lg" />}>
                <ContactForm title="Free Estimate" subtitle="No obligation. Respond within 1 day." compact />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={<div className="h-32 bg-white" />}>
        <div className="px-4 py-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <DesignPreviewCTA variant="inline" />
          </div>
        </div>
      </Suspense>

      <Suspense fallback={<div className="h-20 bg-muted" />}>
        <RegionsStrip bg="muted" />
      </Suspense>

      <Suspense fallback={<div className="h-64 bg-white" />}>
        <Testimonials darkBg={true} />
      </Suspense>
    </>
  );
}