import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Instagram, Star, Calculator } from "lucide-react";
import { useSiteContent } from "@/hooks/useSiteContent";
import { REGIONS, slugify } from "@/data/townData";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const serviceLinks = [
  { label: "Home Additions", path: "/services/home-additions" },
  { label: "Decks, Porches & Pergolas", path: "/services/decks-porches-pergolas" },
  { label: "Siding Contractors", path: "/services/siding" },
  { label: "Kitchen Remodeling", path: "/services/kitchen-remodeling" },
  { label: "Bathroom Remodeling", path: "/services/bathroom-remodeling" },
  { label: "Custom Carpentry", path: "/services/custom-carpentry" },
  { label: "Snow Removal", path: "/services/snow-removal" },
];



const quickLinks = [
  { label: "Home", path: "/" },
  { label: "About Us", path: "/about" },
  { label: "Our Work", path: "/gallery" },
  { label: "Financing", path: "/financing" },
  { label: "Blog", path: "/blog" },
  { label: "Contact Us", path: "/contact" },
  { label: "Free Design Preview", path: "/start" },
  { label: "Instant Budget Estimator", path: "/budget-estimator" },
];

export default function Footer() {
  const { data: c } = useSiteContent("footer");
  const { data: blogPosts = [] } = useQuery({
    queryKey: ["blog-posts-footer"],
    queryFn: () => base44.entities.BlogPost.filter({ published: true }, "-created_date", 5),
  });

  const tagline = c?.tagline || "Boston's trusted general contractors since 2010. Family-owned, precision-built, and committed to your vision.";
  const address = c?.address || "387 Page Street Ste 10B\nStoughton, MA 02072";
  const phone = c?.phone || "6178572636";
  const phoneDisplay = c?.phone ? c.phone : "(617) 857-COEN";
  const email = c?.email || "info@coenconstruction.com";
  const ctaHeadline = c?.cta_headline || "Ready to Transform Your Home?";
  const ctaSubtext = c?.cta_subtext || "Try our Free AI Design Preview tool and see your renovation before it begins.";
  const copyright = c?.copyright || `© ${new Date().getFullYear()} Coen Construction. All Rights Reserved. | Licensed & Insured | MA Contractor Reg. #CS-107247`;
  const instagramUrl = c?.instagram_url || "https://www.instagram.com/coenconstruction";
  const angiUrl = c?.angi_url || "https://www.angi.com/write-review/11070437";

  return (
    <footer className="bg-secondary text-white">
      {/* Budget Estimator CTA Banner */}
      <div className="bg-primary py-10 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Calculator className="w-4 h-4" /> Free Tool — No Sign-Up Needed
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Wondering What Your Project Will Cost?</h2>
          <p className="text-white/90 mb-6 text-lg">Get a realistic price range for your Greater Boston renovation in seconds — tailored to local labor and material costs.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/budget-estimator" className="bg-white text-primary font-bold px-8 py-3 rounded hover:bg-gray-100 transition-colors flex items-center gap-2 justify-center">
              <Calculator className="w-4 h-4" /> Try the Instant Estimator
            </Link>
            <a href="tel:6178572636" className="border-2 border-white text-white font-bold px-8 py-3 rounded hover:bg-white/10 transition-colors">
              Call (617) 857-COEN
            </a>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
        {/* Brand */}
          <div className="flex flex-col items-start sm:items-start">
            <div className="mb-4">
              <img src="https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/bb1690db8_COENLogo.png" alt="Coen Construction" className="h-12 w-auto brightness-0 invert" width="180" height="48" loading="lazy" />
            </div>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">{tagline}</p>
          <div className="space-y-2 text-sm text-gray-300">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>{address.split("\n").map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}</span>
            </div>
            <a href={`tel:${phone}`} className="flex items-center gap-2 hover:text-primary transition-colors">
              <Phone className="w-4 h-4 text-primary" />
              {phoneDisplay}
            </a>
            <a href={`mailto:${email}`} className="flex items-center gap-2 hover:text-primary transition-colors">
              <Mail className="w-4 h-4 text-primary" />
              {email}
            </a>
          </div>
          <div className="flex gap-3 mt-4">
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-white/10 rounded flex items-center justify-center hover:bg-primary transition-colors">
              <Instagram className="w-4 h-4" />
            </a>
            <a href={angiUrl} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-white/10 rounded flex items-center justify-center hover:bg-primary transition-colors">
              <Star className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex flex-col items-start">
          <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Quick Links</h3>
          <ul className="space-y-2">
            {quickLinks.map(l => (
              <li key={l.path}>
                <Link to={l.path} className="text-gray-300 text-sm hover:text-primary transition-colors">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Services */}
        <div className="flex flex-col items-start">
          <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Our Services</h3>
          <ul className="space-y-2">
            {serviceLinks.map(l => (
              <li key={l.path}>
                <Link to={l.path} className="text-gray-300 text-sm hover:text-primary transition-colors">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Resources & Insights */}
        <div className="flex flex-col items-start">
          <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Resources & Insights</h3>
          <ul className="space-y-2">
            {blogPosts.length > 0 ? (
              blogPosts.slice(0, 5).map(post => (
                <li key={post.id}>
                  <Link to={`/blog/${post.slug}`} className="text-gray-300 text-sm hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </Link>
                </li>
              ))
            ) : (
              <li className="text-gray-400 text-xs italic">No posts yet</li>
            )}
          </ul>
          {blogPosts.length > 0 && (
            <Link to="/blog" className="text-primary text-xs font-semibold hover:underline mt-3 inline-block">
              View All Posts →
            </Link>
          )}
        </div>

        </div>

      {/* Service Areas by Region */}
      <div className="border-t border-white/10 px-4 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">Service Areas</h3>
            <Link to="/service-areas" className="text-primary text-xs font-semibold hover:underline">View All 65+ Communities →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {REGIONS.map(region => (
              <div key={region.slug}>
                <div className="text-xs font-bold text-primary uppercase tracking-wider mb-3 pb-1.5 border-b border-white/10">{region.name}</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {region.towns.slice(0, 10).map(town => (
                    <Link key={town} to={`/service-areas/${slugify(town)}`}
                      className="text-gray-400 text-xs hover:text-primary transition-colors truncate">
                      {town}
                    </Link>
                  ))}
                </div>
                {region.towns.length > 10 && (
                  <Link to="/service-areas" className="text-primary text-xs font-semibold hover:underline mt-2 inline-block">
                    +{region.towns.length - 10} more →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 py-5 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2 text-gray-400 text-xs">
          <span>{copyright}</span>
          <nav aria-label="Legal and account links" className="flex gap-4">
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/sitemap" className="hover:text-primary transition-colors">Sitemap</Link>
            <Link to="/admin" className="hover:text-primary transition-colors">Admin Login</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}