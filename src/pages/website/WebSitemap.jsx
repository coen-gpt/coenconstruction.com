import { Link } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import { Home, Wrench, MapPin, BookOpen, FileText, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { REGIONS, slugify } from "@/data/townData";

const BASE_URL = "https://www.coenconstruction.com";

const services = [
  { label: "Home Additions", path: "/services/home-additions" },
  { label: "Decks, Porches & Pergolas", path: "/services/decks-porches-pergolas" },
  { label: "Siding", path: "/services/siding" },
  { label: "Kitchen Remodeling", path: "/services/kitchen-remodeling" },
  { label: "Bathroom Remodeling", path: "/services/bathroom-remodeling" },
  { label: "Custom Carpentry", path: "/services/custom-carpentry" },
  { label: "Snow Removal", path: "/services/snow-removal" },
];



const mainPages = [
  { label: "Home", path: "/", priority: "1.0", changefreq: "weekly" },
  { label: "About Us", path: "/about", priority: "0.8", changefreq: "monthly" },
  { label: "Gallery / Our Work", path: "/gallery", priority: "0.8", changefreq: "monthly" },
  { label: "Financing", path: "/financing", priority: "0.7", changefreq: "monthly" },
  { label: "Blog", path: "/blog", priority: "0.8", changefreq: "weekly" },
  { label: "Contact Us", path: "/contact", priority: "0.9", changefreq: "monthly" },
  { label: "Service Areas", path: "/service-areas", priority: "0.9", changefreq: "monthly" },
  { label: "Privacy Policy", path: "/privacy-policy", priority: "0.3", changefreq: "yearly" },
];

function SectionBlock({ icon: Icon, title, links, cols = 2 }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-secondary">{title}</h2>
        <span className="ml-auto text-xs text-gray-400">{links.length} pages</span>
      </div>
      <ul className={`grid grid-cols-1 sm:grid-cols-${cols} gap-1.5`}>
        {links.map(({ label, path }) => (
          <li key={path}>
            <Link
              to={path}
              className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary transition-colors group"
            >
              <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-primary shrink-0" />
              <span>{label}</span>
              <span className="text-xs text-gray-300 hidden sm:block truncate">{BASE_URL}{path}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RegionSectionBlock({ icon: Icon, region }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-base font-bold text-secondary">{region.name}</h3>
        <span className="ml-auto text-xs text-gray-400">{region.towns.length} communities</span>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
        {region.towns.map(town => (
          <li key={town}>
            <Link to={`/service-areas/${slugify(town)}`}
              className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-primary transition-colors group">
              <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-primary shrink-0" />
              {town}, MA
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function WebSitemap() {
  const serviceLinks = services.map(s => ({ label: s.label, path: s.path }));
  const totalTowns = REGIONS.reduce((acc, r) => acc + r.towns.length, 0);

  const { data: blogPosts = [] } = useQuery({
    queryKey: ["sitemap-blog"],
    queryFn: () => base44.entities.BlogPost.filter({ published: true }, '-created_date'),
  });

  const blogLinks = blogPosts.map(p => ({ label: p.title, path: `/blog/${p.slug}` }));

  return (
    <>
      <SEOHead
        title="Sitemap"
        description="A complete directory of all pages on the Coen Construction website — services, service areas, resources, and more."
        canonicalUrl="https://www.coenconstruction.com/sitemap"
      />

      {/* Hero */}
      <section className="bg-secondary text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest">Site Navigation</span>
          <h1 className="text-4xl font-bold mt-2 mb-3">Sitemap</h1>
          <p className="text-white/75 text-base max-w-2xl">
            A complete directory of all pages on the Coen Construction website. Find services, service areas, resources, and more.
          </p>
        </div>
      </section>

      {/* Sitemap Content */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-6xl mx-auto">

          {/* Main Pages */}
          <SectionBlock
            icon={Home}
            title="Main Pages"
            links={mainPages}
            cols={2}
          />

          {/* Services */}
          <SectionBlock
            icon={Wrench}
            title="Services"
            links={serviceLinks}
            cols={2}
          />

          {/* Blog Posts */}
          {blogLinks.length > 0 && (
            <SectionBlock
              icon={BookOpen}
              title="Blog Posts"
              links={blogLinks}
              cols={2}
            />
          )}

          {/* Service Areas by Region */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b-2 border-gray-200">
              <MapPin className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-secondary">Service Areas</h2>
              <span className="ml-auto text-xs text-gray-400">{totalTowns} communities</span>
            </div>
            <div className="mb-4">
              <Link to="/service-areas" className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline">
                <ExternalLink className="w-3 h-3" /> View All Service Areas Overview
              </Link>
            </div>
            {REGIONS.map(region => (
              <RegionSectionBlock key={region.slug} icon={MapPin} region={region} />
            ))}
          </div>

        </div>
      </section>

      {/* XML Sitemap Note */}
      <section className="py-8 px-4 bg-muted border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <FileText className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-secondary">XML Sitemap for Google: </span>
              The machine-readable sitemap is available at{" "}
              <a href={`${BASE_URL}/sitemap.xml`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                {BASE_URL}/sitemap.xml
              </a>
              {" "}— submit it in{" "}
              <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                Google Search Console
              </a>{" "}
              to accelerate indexing.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}