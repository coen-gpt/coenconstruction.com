import { CheckCircle, Award, Users, Home } from "lucide-react";
import RegionsStrip from "@/components/website/RegionsStrip";
import { LOCAL_BUSINESS, breadcrumbSchema } from "@/lib/schema";
import DesignPreviewCTA from "@/components/website/DesignPreviewCTA";
import Testimonials from "@/components/website/Testimonials";
import ContactForm from "@/components/website/ContactForm";
import { useAllSiteContent } from "@/hooks/useSiteContent";
import SEOHead from "@/components/SEOHead";

export default function WebAbout() {
  const { data: allContent } = useAllSiteContent();
  const heroC = allContent?.about_hero?.value;
  const mainC = allContent?.about_main?.value;
  const valuesC = allContent?.about_values?.value;

  const hero = {
    badge: heroC?.badge || "Our Story",
    headline: heroC?.headline || "About Coen Construction",
    subtext: heroC?.subtext || "Building Better Homes With Precision And Passion — serving Greater Boston since 2010.",
    bg_image: heroC?.bg_image || "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1600&q=80",
  };

  const main = {
    badge: mainC?.badge || "Family-Owned Since 2010",
    headline: mainC?.headline || "Dedicated to Exceptional Craftsmanship",
    paragraph1: mainC?.paragraph1 || "Coen Construction is committed to providing professional building and great service around Metro West and South Shore. Originally a family-owned company established in 2010, we approach every project with years of expertise and an excellent dedication to quality, realizing your idea for home improvement.",
    paragraph2: mainC?.paragraph2 || "We specialize in residential improvements, including decks, porches, pergolas, house expansions, doors, windows, and siding. Our professional staff can assist you whether you want to add more living space, improve the outside of your house, or design a personalized outdoor hideaway.",
    paragraph3: mainC?.paragraph3 || "In addition to exterior work, we do whole-house renovation projects. We offer careful design and professional craftsmanship in every aspect, from kitchen remodeling and bathroom renovations to total home conversions.",
    features: [
      mainC?.feature1 || "Licensed & fully insured in Massachusetts",
      mainC?.feature2 || "Family-owned and operated since 2010",
      mainC?.feature3 || "Transparent pricing with detailed proposals",
      mainC?.feature4 || "High-quality materials with lasting results",
      mainC?.feature5 || "Professional snow removal across Greater Boston",
    ],
    image_url: mainC?.image_url || "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/7a0faf8b7_generated_image.png",
  };

  const values = {
    headline: valuesC?.headline || "Why Boston Homeowners Choose Us",
    items: [
      { icon: Award, title: valuesC?.value1_title || "Quality First", desc: valuesC?.value1_desc || "We use only premium materials and proven construction techniques to ensure your home investment lasts for decades." },
      { icon: Users, title: valuesC?.value2_title || "Customer-Centered", desc: valuesC?.value2_desc || "Every project begins with listening. We take time to understand your vision, budget, and timeline before picking up a single tool." },
      { icon: Home, title: valuesC?.value3_title || "Seamless Results", desc: valuesC?.value3_desc || "Every addition or renovation is designed to blend perfectly with your existing home — in style, structure, and character." },
    ],
  };

  return (
    <>
      <SEOHead
        title="About Coen Construction | Boston MA General Contractor Since 2010"
        description="Learn about Coen Construction — a family-owned Boston MA general contractor founded in 2010. We specialize in home additions, decks, siding, remodeling, and custom carpentry across Greater Boston."
        canonicalUrl="https://www.coenconstruction.com/about"
        structuredData={[LOCAL_BUSINESS, breadcrumbSchema([
          { name: "Home", url: "https://www.coenconstruction.com" },
          { name: "About", url: "https://www.coenconstruction.com/about" }
        ])]}
      />

      {/* Hero */}
      <section className="relative py-24 px-4 flex items-center overflow-hidden">
        <img src={hero.bg_image} alt="" aria-hidden="true" fetchPriority="high" loading="eager" decoding="sync" width="1600" height="400" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-secondary/75" />
        <div className="relative max-w-4xl mx-auto text-center">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest">{hero.badge}</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-2 mb-5">{hero.headline}</h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">{hero.subtext}</p>
        </div>
      </section>

      {/* Main content */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-primary font-semibold text-sm uppercase tracking-widest">{main.badge}</span>
            <h2 className="text-3xl font-bold text-secondary mt-2 mb-5">{main.headline}</h2>
            <p className="text-gray-600 leading-relaxed mb-4">{main.paragraph1}</p>
            <p className="text-gray-600 leading-relaxed mb-4">{main.paragraph2}</p>
            <p className="text-gray-600 leading-relaxed mb-6">{main.paragraph3}</p>
            <div className="space-y-2">
              {main.features.filter(Boolean).map(f => (
                <div key={f} className="flex items-center gap-2 text-gray-700">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm">{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <img src={main.image_url} alt="Coen Construction family-owned Boston general contractor" width="640" height="384" loading="lazy" decoding="async" className="rounded-xl shadow-xl w-full h-96 object-cover" />
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 px-4 bg-muted">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-secondary">{values.headline}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {values.items.map(v => (
              <div key={v.title} className="bg-white rounded-xl p-6 shadow-sm text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <v.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-bold text-secondary text-lg mb-2">{v.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RegionsStrip bg="muted" />

      <DesignPreviewCTA variant="banner" />

      <Testimonials darkBg={true} />

      <section className="py-16 px-4 bg-muted">
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-8">
          <ContactForm title="Start Your Project Today" subtitle="Get a free, no-obligation estimate from Boston's most trusted general contractor." />
        </div>
      </section>
    </>
  );
}