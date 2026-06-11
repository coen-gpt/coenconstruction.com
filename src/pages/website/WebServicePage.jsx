import { Link, useParams } from "react-router-dom";
import { CheckCircle, ArrowRight, MapPin } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import { lazy, Suspense, useEffect } from "react";
import { WebsiteEvents } from "@/lib/analytics";
import { LOCAL_BUSINESS, breadcrumbSchema, serviceSchema } from "@/lib/schema";
import { REGIONS, slugify } from "@/data/townData";
import { useSiteContent } from "@/hooks/useSiteContent";

const RegionsStrip = lazy(() => import("@/components/website/RegionsStrip"));
const DesignPreviewCTA = lazy(() => import("@/components/website/DesignPreviewCTA"));
const Testimonials = lazy(() => import("@/components/website/Testimonials"));
const ContactForm = lazy(() => import("@/components/website/ContactForm"));

const serviceData = {
  "home-additions": {
    title: "Home Additions Boston MA",
    headline: "Transform Your Living Space With Home Additions in Boston",
    metaDesc: "Coen Construction specializes in home additions across Boston MA. Add square footage, bedroom suites, sunrooms, and more. Free estimates. Call (617) 857-COEN.",
    intro: "Your house should change with you as your requirements shift. Why relocate if you can expand? Home additions Boston offers the perfect approach to get more space, improve utility, and increase the value of your home while maintaining the comfort of the neighborhood you love.",
    body: `Coen Construction specializes in building and planning seamless home expansions that increase functionality and look. We customize every addition to fit the current style of your house, from basement finishing to new bedroom construction to kitchen expansion. Every improvement is made to fit well with careful design and professional building.

Our workmanship brings your vision to life with accuracy and care, from dormer extensions that increase curb appeal to open, welcoming family rooms ideal for entertaining. Home additions Boston are about more than generating additional room; they are about strengthening structure, increasing efficiency, and expanding your home's use.

Coen Construction stresses custom woodwork, structural upgrades, and energy-efficient solutions, including new windows and doors to increase utility and comfort. With years of experience in home additions Boston MA, we understand the challenges this area creates.`,
    features: ["Bedroom additions & suites", "Second-story additions", "Sunrooms & four-season rooms", "Family room expansions", "Dormer additions", "Kitchen expansions", "Basement finishing", "In-law suites"],
    img: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1600&q=80",
    related: [
      { label: "Kitchen Remodeling", path: "/services/kitchen-remodeling" },
      { label: "Bathroom Remodeling", path: "/services/bathroom-remodeling" },
      { label: "Decks & Pergolas", path: "/services/decks-porches-pergolas" },
    ],
  },
  "decks-porches-pergolas": {
    title: "Decks, Porches & Pergolas Boston MA",
    headline: "Build The Perfect Outdoor Retreat With Boston MA General Contractors",
    metaDesc: "Custom decks, porches, and pergolas in Boston MA. Coen Construction designs and builds outdoor living spaces built to last. Call (617) 857-COEN for a free estimate.",
    intro: "Your outdoor space is an extension of your home that offers a place to unwind, entertain, and connect with nature. Coen Construction helps homeowners convert their backyards into useful, enjoyable retreats.",
    body: `As trusted Boston MA general contractors, we design and build decks, porches, and Boston pergolas according to your taste and needs, therefore ensuring a seamless blend of beauty and practicality.

A deck may be the ideal outdoor meeting place for summer barbecues, morning coffee, or appreciating the fresh air. We provide a range of materials that can survive Boston's weather. Our porches offer a warm entrance or a comfortable area to enjoy the outdoors all year round, with choices for screened enclosures to keep insects away.

Pergolas create detail and shade, accentuating the uniqueness of your garden. Every house is different; hence, Coen Construction treats each project personally.`,
    features: ["Custom wood & composite decks", "Wraparound porches", "Screened-in porches", "Pergolas & arbors", "Gazebos", "Outdoor kitchens", "Built-in seating", "Lighting & electrical"],
    img: "https://images.unsplash.com/photo-1591123120675-6f7f1aae0e5b?w=1600&q=80",
    related: [
      { label: "Home Additions", path: "/services/home-additions" },
      { label: "Bathroom Remodeling", path: "/services/bathroom-remodeling" },
      { label: "Custom Carpentry", path: "/services/custom-carpentry" },
    ],
  },
  "siding": {
    title: "Siding Contractors Boston MA",
    headline: "Premium Siding Installation by Boston MA Siding Contractors",
    metaDesc: "Coen Construction are the leading siding contractors in Boston MA. We install vinyl, fiber cement, cedar, and composite siding. Free estimates. (617) 857-COEN.",
    intro: "The right siding protects your home from New England's harsh winters, improves energy efficiency, and dramatically boosts curb appeal. As expert siding contractors in Boston MA, Coen Construction delivers premium installation with lasting results.",
    body: `We work with all major siding materials including vinyl, James Hardie fiber cement, cedar, and engineered wood. Each material is selected to suit your home's style, your budget, and Boston's climate demands.

Our siding projects include full re-siding, partial replacement, repair, and trim work. We also handle windows and exterior doors as part of a complete exterior makeover. Every project starts with a thorough assessment and a detailed proposal, so you always know what you're getting.

As licensed siding contractors in Boston MA, we're committed to clean, precise installations that stand up to New England winters for decades.`,
    features: ["Vinyl siding", "James Hardie fiber cement", "Cedar & wood siding", "Engineered wood siding", "Trim & fascia work", "Siding repair & replacement", "Window & door installation", "Full exterior makeovers"],
    img: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=1600&q=80",
    related: [
      { label: "Home Additions", path: "/services/home-additions" },
      { label: "Bathroom Remodeling", path: "/services/bathroom-remodeling" },
      { label: "Decks & Pergolas", path: "/services/decks-porches-pergolas" },
    ],
  },
  "kitchen-remodeling": {
    title: "Kitchen Remodeling Boston MA",
    headline: "Expert Kitchen Remodeling Boston Homeowners Love",
    metaDesc: "Kitchen remodeling in Boston MA by Coen Construction. We design and build beautiful, functional kitchens that add value to your home. Call (617) 857-COEN.",
    intro: "Your kitchen is the heart of your home. A thoughtfully designed kitchen remodel can transform daily routines, increase home value, and create a space that truly reflects your lifestyle.",
    body: `Coen Construction brings years of kitchen remodeling experience to Boston and surrounding communities. We handle everything from cabinet installation and countertop selection to plumbing rough-in, lighting, and flooring — making us a true one-stop kitchen remodeling contractor in Boston MA.

Whether you're opening up a closed-off galley kitchen, adding a kitchen island, or doing a full gut renovation, our team works with you from the initial design concept to the final hardware installation. We partner with premium suppliers for cabinetry, quartz and granite countertops, and high-end appliances.

Our kitchen remodeling projects in Boston are built to last, with attention to every detail — from the straightness of grout lines to the precision of cabinet doors.`,
    features: ["Custom cabinet design & installation", "Quartz & granite countertops", "Kitchen island additions", "Open-concept conversions", "Lighting design", "Tile backsplash", "Plumbing & electrical", "Flooring installation"],
    img: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1600&q=80",
    related: [
      { label: "Home Additions", path: "/services/home-additions" },
      { label: "Custom Carpentry", path: "/services/custom-carpentry" },
      { label: "Bathroom Remodeling", path: "/services/bathroom-remodeling" },
    ],
  },
  "bathroom-remodeling": {
    title: "Bathroom Remodeling Boston MA",
    headline: "Expert Bathroom Remodeling Boston Homeowners Trust",
    metaDesc: "Bathroom remodeling in Boston MA by Coen Construction. We design and build beautiful, functional bathrooms that add value to your home. Call (617) 857-COEN.",
    intro: "Your bathroom is a personal sanctuary. A thoughtfully designed bathroom remodel can transform daily routines, increase home value, and create a spa-like space that truly reflects your lifestyle.",
    body: `Coen Construction brings years of bathroom remodeling experience to Boston and surrounding communities. We handle everything from fixture selection and tile work to plumbing rough-in, lighting design, and flooring — making us a true one-stop bathroom remodeling contractor in Boston MA.

Whether you're updating a master bath with a luxurious soaking tub and separate shower, refreshing a guest bathroom with new vanities and tile, or creating an accessible spa bathroom, our team works with you from the initial design concept to the final towel hook installation.

Our bathroom remodeling projects in Boston are built to last, with attention to every detail — from waterproofing to grout lines to cabinet hardware. We specialize in both traditional New England bathrooms and modern, minimalist designs.`,
    features: ["Custom vanity design & installation", "Tile & stone work (showers, floors, accents)", "Quartz & marble countertops", "Spa-style soaking tubs & walk-in showers", "Lighting design & ventilation", "Plumbing & electrical", "Heated floors & towel racks", "ADA-accessible bathrooms"],
    img: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1600&q=80",
    related: [
      { label: "Kitchen Remodeling", path: "/services/kitchen-remodeling" },
      { label: "Custom Carpentry", path: "/services/custom-carpentry" },
      { label: "Home Additions", path: "/services/home-additions" },
    ],
  },
  "snow-removal": {
    title: "Snow Removal Boston MA",
    headline: "Reliable Snow Removal for Greater Boston Homes & Small Properties",
    metaDesc: "Snow removal in Greater Boston by Coen Construction. Driveway clearing, walkway cleanup, ice management, and winter storm response. Call (617) 857-COEN.",
    intro: "New England winters can shut down driveways, walks, and job sites fast. Coen Construction provides dependable residential and small-property snow removal support so your home stays accessible, safer, and ready after storms.",
    body: `Coen Construction helps homeowners and small property owners across Greater Boston manage winter weather with responsive snow clearing, walkway cleanup, and ice control. Because we are a residential general contractor, we understand drainage, exterior surfaces, stairs, decks, and access points — not just plowing a path and leaving.

Our snow removal service is best for homeowners who want a reliable local team with construction-minded care around siding, trim, hardscape edges, decks, and garage approaches. We focus on practical access, safety, and clear communication before, during, and after storms.

Whether you need seasonal support, help after a major storm, or clearing around an active renovation site, our team brings the equipment, planning, and follow-through expected from a professional Greater Boston contractor.`,
    features: ["Driveway snow clearing", "Walkway & entry cleanup", "Ice management", "Storm response", "Garage and access clearing", "Small property support", "Renovation site winter access", "Seasonal planning"],
    img: "https://images.unsplash.com/photo-1486496146582-9ffcd0b2b2b7?w=1600&q=80",
    related: [
      { label: "Siding", path: "/services/siding" },
      { label: "Decks & Pergolas", path: "/services/decks-porches-pergolas" },
      { label: "Home Additions", path: "/services/home-additions" },
    ],
  },
  "custom-carpentry": {
    title: "Custom Carpentry Boston MA",
    headline: "Bespoke Custom Carpentry Services in Boston, MA",
    metaDesc: "Coen Construction offers expert custom carpentry services in Boston MA — built-ins, millwork, trim, stairs, and more. Family-owned since 2010. (617) 857-COEN.",
    intro: "Fine carpentry is the art that turns a house into a home. Our custom carpentry services in Boston MA bring character, warmth, and precision craftsmanship to every room.",
    body: `Founded in 2010, Coen Construction is a family business dedicated to the art and craft of fine carpentry and detailed residential construction. From grand homes to investment properties, we approach every project as a unique opportunity to apply classic woodworking techniques to modern aesthetics.

Our carpenters in Boston MA specialize in custom built-ins, coffered ceilings, wainscoting, crown molding, staircase refinishing, window seats, and more. We work in both traditional New England styles and contemporary designs, always matching the character of the home.

Every piece is custom-made and fitted by hand, ensuring a seamless result that looks like it was always part of the house.`,
    features: ["Built-in bookshelves & cabinetry", "Crown molding & trim", "Wainscoting & board-and-batten", "Coffered ceilings", "Staircase refinishing", "Window seats & benches", "Custom doors & frames", "Finish carpentry"],
    img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80",
    related: [
      { label: "Kitchen Remodeling", path: "/services/kitchen-remodeling" },
      { label: "Bathroom Remodeling", path: "/services/bathroom-remodeling" },
      { label: "Home Additions", path: "/services/home-additions" },
    ],
  },

};

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
        canonicalUrl={`https://www.coenconstruction.com/services/${service}`}
        structuredData={[LOCAL_BUSINESS, breadcrumbSchema([
          { name: "Services", url: "/services" },
          { name: data.title, url: `/services/${service}` }
        ]), serviceSchema({
          name: data.title,
          description: data.metaDesc,
          url: `https://www.coenconstruction.com/services/${service}`,
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
                <Link key={town} to={`/service-areas/${slugify(town)}`} className="flex items-center gap-1 bg-muted px-3 py-1.5 rounded text-xs font-medium text-gray-600 hover:text-primary hover:bg-primary/5 transition-colors">
                  <MapPin className="w-3 h-3" /> {town}
                </Link>
              ))}
              <Link to="/service-areas" className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold text-primary hover:underline">
                All 65+ communities <ArrowRight className="w-3 h-3" />
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