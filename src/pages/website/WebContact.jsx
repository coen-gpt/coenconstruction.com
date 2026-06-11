import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { WebsiteEvents } from "@/lib/analytics";
import { LOCAL_BUSINESS, breadcrumbSchema } from "@/lib/schema";
import SEOHead from "@/components/SEOHead";
import ContactForm from "@/components/website/ContactForm";
import DesignPreviewCTA from "@/components/website/DesignPreviewCTA";
import Testimonials from "@/components/website/Testimonials";
import { useSiteContent } from "@/hooks/useSiteContent";

export default function WebContact() {
  const { data: heroC } = useSiteContent("contact_hero");
  const { data: infoC } = useSiteContent("contact_info");

  const hero = {
    badge: heroC?.badge || "Get In Touch",
    headline: heroC?.headline || "Contact Us",
    subtext: heroC?.subtext || "Expert Craftsmanship Starts With A Conversation",
  };
  const info = {
    headline: infoC?.headline || "Let's Talk About Your Project",
    intro_text: infoC?.intro_text || "Are you ready to begin your next house renovation task? Coen Construction is here to assist you, whether it's building a custom deck, porch, or pergola, remodeling your house, or improving your exterior.",
    hours: infoC?.hours || "Mon–Fri 7am–6pm | Sat 8am–2pm",
    note: infoC?.note || "We'll gladly arrange a time to evaluate your space and provide a free estimate — no pressure, no obligation.",
  };

  return (
    <>
      <SEOHead
        title="Contact Us — Free Estimates, Call (617) 857-COEN"
        description="Contact Coen Construction for a free estimate on home additions, decks, siding, remodeling, and more across Greater Boston. Call (617) 857-COEN or submit online."
        keywords={["contact Coen Construction", "free estimate Boston contractor", "general contractor near me Boston"]}
        canonicalUrl="https://www.coenconstruction.com/contact"
        structuredData={[LOCAL_BUSINESS, breadcrumbSchema([
          { name: "Contact", url: "/contact" }
        ])]}
      />

      <section className="relative min-h-[340px] py-24 px-4 flex items-center overflow-hidden">
        <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80" alt="" aria-hidden="true" fetchPriority="high" loading="eager" decoding="sync" width="1600" height="400" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-secondary/75" />
        <div className="relative max-w-4xl mx-auto text-center w-full">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest">{hero.badge}</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-2 mb-5">{hero.headline}</h1>
          <p className="text-white/80 text-lg">{hero.subtext}</p>
        </div>
      </section>

      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-bold text-secondary mb-4">{info.headline}</h2>
            <p className="text-gray-600 leading-relaxed mb-6">{info.intro_text}</p>
            <div className="space-y-4 mb-8">
              <a href="tel:6178572636" onClick={() => WebsiteEvents.phoneClicked('contact')} className="flex items-center gap-4 p-4 bg-muted rounded-xl hover:bg-primary/5 transition-colors group">
                <div className="w-10 h-10 bg-primary rounded flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Call Us</div>
                  <div className="font-bold text-secondary group-hover:text-primary">(617) 857-COEN</div>
                </div>
              </a>
              <a href="mailto:info@coenconstruction.com" className="flex items-center gap-4 p-4 bg-muted rounded-xl hover:bg-primary/5 transition-colors group">
                <div className="w-10 h-10 bg-primary rounded flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Email Us</div>
                  <div className="font-bold text-secondary group-hover:text-primary">info@coenconstruction.com</div>
                </div>
              </a>
              <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
                <div className="w-10 h-10 bg-primary rounded flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Office</div>
                  <div className="font-bold text-secondary">387 Page Street Ste 10B, Stoughton, MA 02072</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
                <div className="w-10 h-10 bg-primary rounded flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Hours</div>
                  <div className="font-bold text-secondary">{info.hours}</div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-sm text-gray-700"><strong>Scheduling A Consultation:</strong> {info.note}</p>
            </div>
          </div>
          <div className="bg-muted rounded-xl p-6">
            <ContactForm title="Get Your Free Quote" subtitle="Fill out the form and we'll respond within 1 business day." />
          </div>
        </div>
      </section>

      <section className="py-10 px-4">
         <div className="max-w-7xl mx-auto">
           <DesignPreviewCTA variant="inline" />
         </div>
       </section>

       <Testimonials darkBg={false} />
       </>);

      }