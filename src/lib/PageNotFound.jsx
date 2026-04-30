import { Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useEffect } from "react";
import { Home, Phone, ArrowRight, Hammer, TreePine, ChefHat, Snowflake, Layers } from "lucide-react";
import { base44 } from "@/api/base44Client";

const POPULAR_PAGES = [
  { label: "Home Additions", path: "/services/home-additions", icon: Home },
  { label: "Decks & Pergolas", path: "/services/decks-porches-pergolas", icon: TreePine },
  { label: "Kitchen Remodeling", path: "/services/kitchen-remodeling", icon: ChefHat },
  { label: "Siding", path: "/services/siding", icon: Layers },
  { label: "Custom Carpentry", path: "/services/custom-carpentry", icon: Hammer },
  { label: "Snow Removal", path: "/services/snow-removal", icon: Snowflake },
];

const NAV_LINKS = [
  { label: "Home", path: "/" },
  { label: "Services", path: "/services" },
  { label: "Service Areas", path: "/service-areas" },
  { label: "Gallery", path: "/gallery" },
  { label: "Blog", path: "/blog" },
  { label: "About", path: "/about" },
  { label: "Contact", path: "/contact" },
];

export default function PageNotFound() {
  const location = useLocation();

  // Track 404 for monitoring
  useEffect(() => {
    base44.functions.invoke("track404", { path: location.pathname, referrer: document.referrer || "" })
      .catch(() => {}); // silent fail — never break the page
  }, [location.pathname]);

  return (
    <>
      <Helmet>
        <title>Page Not Found (404) | Coen Construction</title>
        <meta name="description" content="The page you're looking for doesn't exist. Browse our services or contact Coen Construction for help." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header strip */}
        <div className="bg-secondary px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-white font-bold text-lg">Coen Construction</span>
          </Link>
        </div>

        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-2xl w-full text-center">
            {/* 404 visual */}
            <div className="mb-8">
              <div className="text-8xl font-bold text-primary/20 leading-none">404</div>
              <div className="w-16 h-1 bg-primary mx-auto mt-2 mb-6 rounded"></div>
              <h1 className="text-3xl md:text-4xl font-bold text-secondary mb-3">
                Page Not Found
              </h1>
              <p className="text-gray-600 text-lg leading-relaxed">
                Looks like this page got a renovation and moved. The URL{" "}
                <code className="bg-gray-200 px-2 py-0.5 rounded text-sm font-mono text-gray-700">
                  {location.pathname}
                </code>{" "}
                doesn't exist.
              </p>
            </div>

            {/* Quick nav actions */}
            <div className="flex flex-wrap gap-3 justify-center mb-10">
              <Link
                to="/"
                className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-5 py-3 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Home className="w-4 h-4" /> Back to Home
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 bg-secondary text-white font-semibold px-5 py-3 rounded-lg hover:bg-secondary/90 transition-colors"
              >
                <Phone className="w-4 h-4" /> Contact Us
              </Link>
              <a
                href="tel:+16178572636"
                className="inline-flex items-center gap-2 border-2 border-secondary text-secondary font-semibold px-5 py-3 rounded-lg hover:bg-secondary hover:text-white transition-colors"
              >
                (617) 857-COEN
              </a>
            </div>

            {/* Popular services */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 text-left">
              <h2 className="text-base font-bold text-secondary mb-4 uppercase tracking-widest text-xs">
                Our Popular Services
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {POPULAR_PAGES.map(({ label, path, icon: Icon }) => (
                  <Link
                    key={path}
                    to={path}
                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary font-medium transition-colors group"
                  >
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="group-hover:underline">{label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Site navigation */}
            <div className="text-sm text-gray-500">
              <span className="font-semibold text-gray-700">Quick links: </span>
              {NAV_LINKS.map((link, i) => (
                <span key={link.path}>
                  <Link to={link.path} className="text-primary hover:underline font-medium">
                    {link.label}
                  </Link>
                  {i < NAV_LINKS.length - 1 && <span className="mx-2 text-gray-300">·</span>}
                </span>
              ))}
            </div>
          </div>
        </main>

        {/* Footer strip */}
        <div className="bg-secondary/5 border-t border-gray-200 px-6 py-4 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Coen Construction — Greater Boston General Contractor
        </div>
      </div>
    </>
  );
}