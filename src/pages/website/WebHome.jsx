import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { ArrowRight, Shield, Award, Users, Clock, CheckCircle, Sparkles } from "lucide-react";
import { lazy, Suspense } from "react";
import OptimizedImage from "@/components/website/OptimizedImage";
import { LOCAL_BUSINESS, breadcrumbSchema, faqSchema } from "@/lib/schema";
import { useAllSiteContent } from "@/hooks/useSiteContent";

const ServiceAreasSection = lazy(() => import("@/components/website/ServiceAreasSection"));
const DesignPreviewCTA = lazy(() => import("@/components/website/DesignPreviewCTA"));
const Testimonials = lazy(() => import("@/components/website/Testimonials"));
const ContactForm = lazy(() => import("@/components/website/ContactForm"));

const services = [
{
  title: "Home Additions",
  desc: "Expand your living space with seamlessly integrated additions that add value and comfort.",
  img: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/07dc013df_generated_image.png",
  path: "/services/home-additions",
  keyword: "home additions Boston"
},
{
  title: "Decks, Porches & Pergolas",
  desc: "Custom outdoor living spaces built to withstand New England's weather year-round.",
  img: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/219f371d9_generated_image.png",
  path: "/services/decks-porches-pergolas",
  keyword: "Boston pergolas"
},
{
  title: "Siding",
  desc: "Premium siding installation that boosts curb appeal and energy efficiency.",
  img: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/8ae785e3e_generated_image.png",
  path: "/services/siding",
  keyword: "siding contractors Boston MA"
},
{
  title: "Kitchen Remodeling",
  desc: "Transform your kitchen into the heart of your home with expert craftsmanship.",
  img: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/68b8020a4_generated_image.png",
  path: "/services/kitchen-remodeling",
  keyword: "kitchen remodeling Boston"
},
{
  title: "Custom Carpentry",
  desc: "Bespoke woodworking and finish carpentry tailored to your home's unique character.",
  img: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/7fc1d2c27_generated_image.png",
  path: "/services/custom-carpentry",
  keyword: "carpenter Boston"
},
{
  title: "Bathroom Remodeling",
  desc: "Transform your bathroom into a spa-like sanctuary with expert design and craftsmanship.",
  img: "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/83c1b495d_generated_image.png",
  path: "/services/bathroom-remodeling",
  keyword: "bathroom remodeling Boston"
}];


const stats = [
{ val: "15+", label: "Years in Business" },
{ val: "500+", label: "Projects Completed" },
{ val: "5★", label: "Average Rating" },
{ val: "100%", label: "Licensed & Insured" }];




export default function WebHome() {
  const { data: allContent } = useAllSiteContent();
  const hero = allContent?.home_hero?.value;
  const statsC = allContent?.home_stats?.value;
  const intro = allContent?.home_intro?.value;
  const ctaC = allContent?.home_cta?.value;

  const heroData = {
    badge: hero?.badge || "Boston's #1 Rated General Contractor",
    headline: hero?.headline || "Building Services Across Greater Boston",
    subtext: hero?.subtext || "We design and build with the finest products for long-lasting results. Family-owned since 2010, Coen Construction is the Boston MA general contractor residents trust.",
    cta_primary: hero?.cta_primary || "Book A Consultation",
    cta_secondary: hero?.cta_secondary || "Free Design Preview",
    bg_image: hero?.bg_image || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80",
  };

  const statsData = [
    { val: statsC?.stat1_val || "15+", label: statsC?.stat1_label || "Years in Business" },
    { val: statsC?.stat2_val || "500+", label: statsC?.stat2_label || "Projects Completed" },
    { val: statsC?.stat3_val || "5★", label: statsC?.stat3_label || "Average Rating" },
    { val: statsC?.stat4_val || "100%", label: statsC?.stat4_label || "Licensed & Insured" },
  ];

  const introData = {
    badge: intro?.badge || "Boston's Trusted Contractor",
    headline: intro?.headline || "Your Vision, Our Expertise",
    paragraph1: intro?.paragraph1 || "Your house is your most precious asset; cooperating with the right Boston MA general contractor guarantees that each renovation improves its beauty, use, and value.",
    paragraph2: intro?.paragraph2 || "Whether you need home additions in Boston, custom deck construction, or a full-scale makeover, we're here to deliver seamless, stress-free results.",
    features: [
      intro?.feature1 || "Free in-home estimates",
      intro?.feature2 || "Licensed & fully insured",
      intro?.feature3 || "Transparent pricing — no surprises",
      intro?.feature4 || "Quality materials, lasting results",
    ],
    image_url: intro?.image_url || "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/f9008aaf4_home_builders_boston-1920w.png",
    years_badge: intro?.years_badge || "15+",
  };

  const ctaData = {
    headline: ctaC?.headline || "Ready To Begin Your Project?",
    subtext: ctaC?.subtext || "Contact us today for a free, no-obligation estimate. Our team will work with you to understand your goals and provide honest, professional guidance every step of the way.",
  };

  return (
    <>
      <Helmet>
        <title>Coen Construction | Boston MA General Contractor | Home Additions, Decks, Remodeling</title>
        <meta name="description" content="Boston's trusted general contractor since 2010. Home additions, decks, siding, kitchen remodeling & custom carpentry. Call (617) 857-COEN." />
        <meta name="keywords" content="general contractor Boston MA, home additions Boston, decks Boston, siding contractors Boston, kitchen remodeling Boston, Boston pergolas" />
        <link rel="canonical" href="https://www.coenconstruction.com" />
        <meta property="og:title" content="Coen Construction | Boston MA General Contractor" />
        <meta property="og:description" content="Greater Boston's trusted general contractor since 2010. Home additions, decks, siding, remodeling." />
        <script type="application/ld+json">{JSON.stringify(LOCAL_BUSINESS)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema([
          { name: "Home", url: "https://www.coenconstruction.com" }
        ]))}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema([
          { q: "What areas does Coen Construction serve?", a: "Coen Construction serves all Greater Boston communities including Boston, Cambridge, Newton, Brookline, Somerville, Medford, Quincy, Waltham, Lexington, Needham, Wellesley, Arlington, and 40+ more towns." },
          { q: "Is Coen Construction licensed and insured?", a: "Yes. Coen Construction is fully licensed (MA Contractor Reg. #CS-108826) and insured in Massachusetts." },
          { q: "How do I get a free estimate from Coen Construction?", a: "Call us at (617) 857-COEN or fill out the contact form on our website. We respond within 1 business day and can typically schedule a free in-home estimate within 1 week." },
          { q: "What services does Coen Construction offer?", a: "We offer home additions, deck and pergola construction, siding installation, kitchen remodeling, bathroom remodeling, custom carpentry, and snow removal across Greater Boston." },
          { q: "How long has Coen Construction been in business?", a: "Coen Construction was founded in 2010 and has been serving Greater Boston homeowners for 15+ years." }
        ]))}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        {/* LCP image: real <img> tag so browser preload scanner can find it */}
        <img
          src={heroData.bg_image}
          alt=""
          aria-hidden="true"
          fetchpriority="high"
          loading="eager"
          decoding="sync"
          width="1600"
          height="900"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-secondary/75" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-5">
              <Award className="w-4 h-4" /> {heroData.badge}
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-5">
              {heroData.headline}
            </h1>
            <p className="text-white/85 text-lg md:text-xl mb-8 leading-relaxed">{heroData.subtext}</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/contact" className="bg-primary text-white font-bold px-8 py-4 rounded text-lg hover:bg-primary/90 transition-colors text-center">
                {heroData.cta_primary}
              </Link>
              <Link to="/start" className="flex items-center justify-center gap-2 bg-white/10 border-2 border-white text-white font-bold px-8 py-4 rounded text-lg hover:bg-white/20 transition-colors">
                <Sparkles className="w-5 h-5 text-primary" /> {heroData.cta_secondary}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-primary py-8 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {statsData.map((s) => (
            <div key={s.val}>
              <div className="text-3xl font-bold text-white">{s.val}</div>
              <div className="text-white/80 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Intro */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-primary font-semibold text-sm uppercase tracking-widest">{introData.badge}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-secondary mt-2 mb-5">{introData.headline}</h2>
            <p className="text-gray-600 leading-relaxed mb-4">{introData.paragraph1}</p>
            <p className="text-gray-600 leading-relaxed mb-6">{introData.paragraph2}</p>
            <div className="space-y-2 mb-6">
              {introData.features.filter(Boolean).map((f) => (
                <div key={f} className="flex items-center gap-2 text-gray-700">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm">{f}</span>
                </div>
              ))}
            </div>
            <Link to="/about" className="inline-flex items-center gap-2 text-primary font-semibold hover:underline">
              Learn More About Us <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="relative">
            <OptimizedImage src={introData.image_url} alt="Coen Construction Boston MA general contractor" className="rounded-xl shadow-xl w-full object-cover h-96" width={640} height={384} />
            <div className="absolute -bottom-4 -left-4 bg-primary text-white rounded-xl p-4 shadow-lg">
              <div className="text-2xl font-bold">{introData.years_badge}</div>
              <div className="text-sm text-white/90">Years of Excellence</div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-primary font-semibold text-sm uppercase tracking-widest">What We Do</span>
            <h2 className="text-3xl md:text-4xl font-bold text-secondary mt-2">Our Services</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">From outdoor living to full home renovations, we handle every aspect of your project with precision and care.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s) =>
            <Link key={s.path} to={s.path} className="group rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="h-48 overflow-hidden">
                  <OptimizedImage src={s.img} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" width={400} height={192} />
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-secondary text-lg mb-2 group-hover:text-primary transition-colors">{s.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-3">{s.desc}</p>
                  <span className="text-primary text-sm font-semibold flex items-center gap-1">Learn More <ArrowRight className="w-3 h-3" /></span>
                </div>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Design Preview Banner */}
      <Suspense fallback={<div className="h-32 bg-secondary/5" />}>
        <DesignPreviewCTA variant="banner" />
      </Suspense>

      {/* Testimonials */}
      <Suspense fallback={<div className="h-64 bg-white" />}>
        <Testimonials darkBg={true} />
      </Suspense>

      {/* Service Areas */}
      <Suspense fallback={<div className="h-48 bg-muted" />}>
        <ServiceAreasSection />
      </Suspense>

      {/* Contact + Form */}
      <section className="py-16 px-4 bg-muted">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-10 items-start">
          <div>
            <span className="text-primary font-semibold text-sm uppercase tracking-widest">Get Started</span>
            <h2 className="text-3xl font-bold text-secondary mt-2 mb-4">{ctaData.headline}</h2>
            <p className="text-gray-600 leading-relaxed mb-6">{ctaData.subtext}</p>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-secondary text-sm">Licensed & Insured</div>
                  <div className="text-gray-500 text-xs">MA Contractor Reg. #CS-107247</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-secondary text-sm">Fast Response</div>
                  <div className="text-gray-500 text-xs">We respond within 1 business day</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-secondary text-sm">Family-Owned Since 2010</div>
                  <div className="text-gray-500 text-xs">Personalized attention on every project</div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <Suspense fallback={<div className="h-64 bg-muted rounded-xl animate-pulse" />}>
              <ContactForm />
            </Suspense>
          </div>
        </div>
      </section>
    </>);

}