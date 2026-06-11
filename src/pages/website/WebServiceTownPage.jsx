import { Link, useParams } from "react-router-dom";
import { CheckCircle, ArrowRight, MapPin, Phone, Star } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { lazy, Suspense } from "react";
import { WebsiteEvents } from "@/lib/analytics";
import { breadcrumbSchema, faqSchema, serviceSchema, localBusinessWithRegion } from "@/lib/schema";
import { serviceData, SERVICE_SLUGS } from "@/data/servicesData";
import { getTownData, REGIONS, slugify } from "@/data/townData";
import { REGION_PERMIT_INFO } from "./WebTownPage";

const DesignPreviewCTA = lazy(() => import("@/components/website/DesignPreviewCTA"));
const Testimonials = lazy(() => import("@/components/website/Testimonials"));
const ContactForm = lazy(() => import("@/components/website/ContactForm"));

const serviceLabel = (slug) => serviceData[slug].title.replace(/ Boston MA$/, "");

function buildFaqs(label, townName, region) {
  return [
    { q: `Does Coen Construction offer ${label.toLowerCase()} in ${townName}, MA?`, a: `Yes — Coen Construction has provided ${label.toLowerCase()} for ${townName} homeowners since 2010. We handle design, permits, and construction with our own trusted crew. Call (617) 857-COEN for a free estimate.` },
    { q: `How much does ${label.toLowerCase()} cost in ${townName}?`, a: `Costs in ${townName} depend on scope, materials, and site conditions. Use our free Instant Budget Estimator for a realistic local price range, or request a free in-home estimate for an exact quote.` },
    { q: `Do I need a permit for ${label.toLowerCase()} in ${townName}?`, a: `Most ${label.toLowerCase()} projects in ${townName} require a building permit. Coen Construction manages the entire ${region} permitting process on your behalf — from application to final inspection.` },
    { q: `How soon can you start a project in ${townName}?`, a: `We respond to every ${townName} inquiry within 1 business day and can usually schedule your free in-home walkthrough within the week. Project start dates depend on scope and permit timelines.` },
  ];
}

export default function WebServiceTownPage() {
  const { town, service } = useParams();
  const svc = serviceData[service];
  const data = getTownData(town);
  const region = REGIONS.find(r => r.name === data.region) || REGIONS[0];
  const permitInfo = REGION_PERMIT_INFO[data.region] || REGION_PERMIT_INFO["Greater Boston"];

  if (!svc) {
    return <div className="py-20 text-center"><h1 className="text-2xl font-bold text-secondary">Page not found</h1><Link to={`/service-areas/${town}`} className="text-primary hover:underline mt-4 block">← Back to {data.name}</Link></div>;
  }

  const label = serviceLabel(service);
  const pageUrl = `https://coenconstruction.com/service-areas/${town}/${service}`;
  const faqs = buildFaqs(label, data.name, data.region);
  const siblingTowns = region.towns.filter(t => slugify(t) !== town).slice(0, 8);
  const otherServices = SERVICE_SLUGS.filter(s => s !== service);

  return (
    <>
      <SEOHead
        title={`${label} in ${data.name} MA`}
        description={`${label} in ${data.name}, MA by Coen Construction — trusted ${data.region} general contractor since 2010. Local permits handled, free estimates. (617) 857-COEN.`}
        keywords={[`${label.toLowerCase()} ${data.name} MA`, `${label.toLowerCase()} near me ${data.name}`, `${data.name} ${label.toLowerCase()} contractor`, `best ${label.toLowerCase()} ${data.name}`]}
        canonicalUrl={pageUrl}
        structuredData={[
          localBusinessWithRegion(data.name, data.region, data.county, town),
          breadcrumbSchema([
            { name: "Service Areas", url: "/service-areas" },
            { name: `${data.name}, MA`, url: `/service-areas/${town}` },
            { name: label, url: `/service-areas/${town}/${service}` },
          ]),
          faqSchema(faqs),
          serviceSchema({
            name: `${label} in ${data.name}, MA`,
            description: `${label} for ${data.name} homeowners by Coen Construction.`,
            url: pageUrl,
            areaServed: `${data.name}, MA`,
            serviceTypes: svc.features,
          }),
        ]}
      />

      {/* Hero */}
      <section className="relative py-24 px-4 overflow-hidden">
        <img src={svc.img} alt="" aria-hidden="true" fetchPriority="high" loading="eager" decoding="sync" width="1600" height="600" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-secondary/75" />
        <div className="relative max-w-4xl mx-auto text-center text-white">
          <nav className="flex items-center justify-center gap-1.5 text-white/60 text-xs mb-5">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link to="/service-areas" className="hover:text-white transition-colors">Service Areas</Link>
            <span>/</span>
            <Link to={`/service-areas/${town}`} className="hover:text-white transition-colors">{data.name}</Link>
            <span>/</span>
            <span className="text-white">{label}</span>
          </nav>
          <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <MapPin className="w-4 h-4" /> {data.name} · {data.region}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {label} in <span className="text-primary">{data.name}, MA</span>
          </h1>
          <p className="text-white/85 text-lg max-w-2xl mx-auto mb-8">{svc.intro}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/contact" onClick={() => WebsiteEvents.estimateCTAClicked(`service_town_${service}_${town}`)} className="bg-primary text-white font-bold px-8 py-3 rounded hover:bg-primary/90 transition-colors">Get Free Estimate</Link>
            <a href="tel:6178572636" onClick={() => WebsiteEvents.phoneClicked(`service_town_${service}_${town}`)} className="border-2 border-white text-white font-bold px-8 py-3 rounded hover:bg-white/10 transition-colors">(617) 857-COEN</a>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <div>
              <span className="text-primary font-semibold text-sm uppercase tracking-widest">
                {data.region} ·{" "}
                {data.county?.endsWith("County") ? (
                  <Link to={`/service-areas/county/${data.county.toLowerCase().replace(/ county$/, "").replace(/\s+/g, "-")}`} className="hover:underline">{data.county}</Link>
                ) : data.county}
              </span>
              <h2 className="text-2xl font-bold text-secondary mt-2 mb-4">{label} for {data.name} Homeowners</h2>
              <div className="prose max-w-none text-gray-600 leading-relaxed space-y-4">
                {svc.body.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
                <p>
                  {data.desc} {data.local_usp || `As your local ${data.region} general contractor, we know ${data.name}'s housing stock, permit office, and neighborhood character — and we build accordingly.`}
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-secondary mb-5">What's Included</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {svc.features.map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-gray-700 text-sm">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Permits */}
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

            {/* FAQs */}
            <div>
              <h2 className="text-2xl font-bold text-secondary mb-6">{label} in {data.name} — FAQs</h2>
              <div className="space-y-4">
                {faqs.map((faq, i) => (
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

            {/* Other services in this town */}
            <div>
              <h2 className="text-xl font-bold text-secondary mb-4">More Services in {data.name}</h2>
              <div className="flex flex-wrap gap-3">
                {otherServices.map(s => (
                  <Link key={s} to={`/service-areas/${town}/${s}`} className="flex items-center gap-1 bg-muted px-4 py-2 rounded text-sm font-medium text-gray-700 hover:text-primary hover:bg-primary/5 transition-colors">
                    {serviceLabel(s)} <ArrowRight className="w-3 h-3" />
                  </Link>
                ))}
                <Link to={`/service-areas/${town}`} className="flex items-center gap-1 px-4 py-2 rounded text-sm font-semibold text-primary hover:underline">
                  All services in {data.name} <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Same service nearby */}
            <div className="border-t border-gray-100 pt-8">
              <h2 className="text-xl font-bold text-secondary mb-4">{label} in Nearby Towns</h2>
              <div className="flex flex-wrap gap-2">
                {siblingTowns.map(t => (
                  <Link key={t} to={`/service-areas/${slugify(t)}/${service}`} className="flex items-center gap-1 bg-muted px-3 py-1.5 rounded text-xs font-medium text-gray-600 hover:text-primary hover:bg-primary/5 transition-colors">
                    <MapPin className="w-3 h-3" /> {t}
                  </Link>
                ))}
                <Link to={`/services/${service}`} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold text-primary hover:underline">
                  {label} overview <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-muted rounded-xl p-6 sticky top-6">
              <Suspense fallback={<div className="h-64 animate-pulse bg-gray-100 rounded-lg" />}>
                <ContactForm title={`Free ${label} Estimate`} subtitle={`Serving ${data.name} — respond within 1 business day.`} compact />
              </Suspense>
            </div>
            <div className="bg-secondary text-white rounded-xl p-6 text-center">
              <Star className="w-6 h-6 text-primary mx-auto mb-2 fill-primary" />
              <div className="text-sm text-white/80 mb-3">Free In-Home Estimates in {data.name}</div>
              <a href="tel:6178572636" className="block bg-primary text-white font-bold py-3 rounded hover:bg-primary/90 transition-colors mb-3 flex items-center justify-center gap-2"><Phone className="w-4 h-4" /> (617) 857-COEN</a>
              <Link to="/start" className="block border border-white/30 text-white text-sm py-2.5 rounded hover:bg-white/10 transition-colors">Try Free Design Preview →</Link>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={<div className="h-32 bg-secondary/5" />}>
        <DesignPreviewCTA variant="banner" page={`service_town_${service}_${town}`} />
      </Suspense>

      <Suspense fallback={<div className="h-64 bg-white" />}>
        <Testimonials />
      </Suspense>
    </>
  );
}
