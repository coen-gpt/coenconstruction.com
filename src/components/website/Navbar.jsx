import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Phone, ChevronDown, Sparkles, Calculator } from "lucide-react";
import { useSiteContent } from "@/hooks/useSiteContent";
import { REGIONS, slugify } from "@/data/townData";

const services = [
{ label: "Home Additions", path: "/services/home-additions" },
{ label: "Decks, Porches & Pergolas", path: "/services/decks-porches-pergolas" },
{ label: "Siding", path: "/services/siding" },
{ label: "Kitchen Remodeling", path: "/services/kitchen-remodeling" },
{ label: "Bathroom Remodeling", path: "/services/bathroom-remodeling" },
{ label: "Custom Carpentry", path: "/services/custom-carpentry" },
{ label: "Snow Removal", path: "/services/snow-removal" }];


export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [areasOpen, setAreasOpen] = useState(false);
  const [mobileAreasOpen, setMobileAreasOpen] = useState(false);
  const [mobileRegionOpen, setMobileRegionOpen] = useState(null);
  const location = useLocation();
  const { data: c } = useSiteContent("navbar");

  const topBarText = c?.top_bar_text || "Serving Greater Boston Since 2010 | Licensed & Insured";
  const phone = c?.phone || "6178572636";
  const phoneDisplay = c?.phone ? c.phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3") : "(617) 857-COEN";
  const ctaPrimary = c?.cta_primary_label || "Free Design Preview";
  const ctaSecondary = c?.cta_secondary_label || "Contact Us";

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100">
      {/* Top bar */}
      <div className="bg-secondary text-white text-sm py-2 px-4 flex justify-between items-center">
        <span className="hidden sm:block">{topBarText}</span>
        <a href={`tel:${phone}`} className="flex items-center gap-2 font-semibold hover:text-primary transition-colors ml-auto">
          <Phone className="w-4 h-4" />
          {phoneDisplay}
        </a>
      </div>

      {/* Main nav */}
      <nav aria-label="Main navigation" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center flex-shrink-0">
          <img src="https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/bb1690db8_COENLogo.png" alt="Coen Construction" className="h-12 w-auto" width="180" height="48" loading="eager" fetchPriority="high" />
        </Link>

        {/* Desktop */}
        <div className="hidden lg:flex items-center gap-1">
          <Link to="/" className={`px-4 py-2 rounded font-medium text-sm transition-colors hover:text-primary ${location.pathname === "/" ? "text-primary" : "text-gray-700"}`}>Home</Link>

          {/* Services dropdown */}
          <div className="relative" onMouseEnter={() => setServicesOpen(true)} onMouseLeave={() => setServicesOpen(false)}>
            <button className="px-4 py-2 rounded font-medium text-sm text-gray-700 hover:text-primary transition-colors flex items-center gap-1">
              Services <ChevronDown className="w-3 h-3" />
            </button>
            {servicesOpen &&
            <div className="absolute top-full left-0 bg-white shadow-xl rounded-lg border border-gray-100 min-w-[220px] py-2 z-50">
                <Link to="/services" className="block px-4 py-2.5 text-sm text-primary font-semibold hover:bg-muted transition-colors border-b border-gray-100 mb-1">
                  All Services Overview →
                </Link>
                {services.map((s) =>
              <Link key={s.path} to={s.path} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-muted hover:text-primary transition-colors">
                    {s.label}
                  </Link>
              )}
              </div>
            }
          </div>

          {/* Service Areas mega-menu */}
          <div className="relative" onMouseEnter={() => setAreasOpen(true)} onMouseLeave={() => setAreasOpen(false)}>
            <button className="px-4 py-2 rounded font-medium text-sm text-gray-700 hover:text-primary transition-colors flex items-center gap-1 whitespace-nowrap">
              Service Areas <ChevronDown className="w-3 h-3" />
            </button>
            {areasOpen && (
              <div className="absolute top-full left-0 bg-white shadow-2xl rounded-xl border border-gray-100 z-50" style={{ width: "620px" }}>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Serving Greater Boston & Beyond</span>
                    <Link to="/service-areas" className="text-primary text-xs font-semibold hover:underline" onClick={() => setAreasOpen(false)}>View All 65+ Areas →</Link>
                  </div>
                  <div className="grid grid-cols-3 gap-5">
                    {REGIONS.map(region => (
                      <div key={region.slug}>
                        <div className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 pb-1 border-b border-gray-100">{region.name}</div>
                        <div className="space-y-1">
                          {region.towns.slice(0, 6).map(town => (
                            <Link key={town} to={`/service-areas/${slugify(town)}`} onClick={() => setAreasOpen(false)}
                              className="block text-sm text-gray-600 hover:text-primary transition-colors py-0.5">
                              {town}
                            </Link>
                          ))}
                          <Link to="/service-areas" onClick={() => setAreasOpen(false)}
                            className="block text-xs text-primary font-semibold hover:underline pt-1">
                            +{region.towns.length - 6} more →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Link to="/about" className="px-3 py-2 rounded font-medium text-sm text-gray-700 hover:text-primary transition-colors">About</Link>
          <Link to="/gallery" className="text-gray-700 px-3 py-2 text-sm font-medium rounded hover:text-primary transition-colors whitespace-nowrap">Our Work</Link>
          <Link to="/blog" className="px-3 py-2 rounded font-medium text-sm text-gray-700 hover:text-primary transition-colors">Blog</Link>
          <Link to="/contact" className="px-3 py-2 rounded font-medium text-sm text-gray-700 hover:text-primary transition-colors">Contact</Link>
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <Link to="/budget-estimator" className="bg-secondary text-white px-4 py-2.5 rounded font-bold text-sm hover:bg-secondary/90 transition-colors flex items-center gap-1.5 whitespace-nowrap">
            <Calculator className="w-4 h-4" /> Estimator
          </Link>
          <Link to="/start" className="bg-primary text-white px-4 py-2.5 rounded font-bold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap">
            <Sparkles className="w-4 h-4" /> {ctaPrimary}
          </Link>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(!open)} className="lg:hidden p-2 text-gray-700">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {/* Mobile menu — fixed overlay so it scrolls independently on Android */}
      {open &&
      <div className="lg:hidden fixed inset-0 top-[calc(theme(spacing.8)+4rem)] z-40 bg-white overflow-y-auto overscroll-contain" style={{ top: "calc(2.5rem + 4rem)" }}>
        <div className="px-4 py-4 space-y-1 pb-12">
          <Link to="/" onClick={() => setOpen(false)} className="block py-2 text-gray-700 font-medium">Home</Link>
          <div className="py-2">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Services</div>
            <Link to="/services" onClick={() => setOpen(false)} className="block py-1.5 pl-3 text-primary font-semibold hover:text-primary/80">All Services Overview →</Link>
            {services.map((s) => <Link key={s.path} to={s.path} onClick={() => setOpen(false)} className="block py-1.5 pl-3 text-gray-700 hover:text-primary">{s.label}</Link>)}
          </div>
          <div className="py-2">
            <button
              className="flex items-center justify-between w-full text-xs font-bold text-gray-400 uppercase tracking-wider mb-1"
              onClick={() => setMobileAreasOpen(!mobileAreasOpen)}
            >
              <span>Service Areas</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${mobileAreasOpen ? "rotate-180" : ""}`} />
            </button>
            {mobileAreasOpen && (
              <div className="mt-2 space-y-2">
                <Link to="/service-areas" onClick={() => setOpen(false)} className="block py-1.5 pl-3 text-primary font-semibold text-sm">All Service Areas →</Link>
                {REGIONS.map(region => (
                  <div key={region.slug}>
                    <button
                      className="flex items-center justify-between w-full pl-3 py-1.5 text-sm font-semibold text-secondary"
                      onClick={() => setMobileRegionOpen(mobileRegionOpen === region.slug ? null : region.slug)}
                    >
                      {region.name}
                      <ChevronDown className={`w-3 h-3 mr-1 transition-transform ${mobileRegionOpen === region.slug ? "rotate-180" : ""}`} />
                    </button>
                    {mobileRegionOpen === region.slug && (
                      <div className="pl-5 mt-1 grid grid-cols-2 gap-x-2">
                        {region.towns.map(town => (
                          <Link key={town} to={`/service-areas/${slugify(town)}`} onClick={() => setOpen(false)}
                            className="block py-1 text-sm text-gray-600 hover:text-primary">
                            {town}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <Link to="/about" onClick={() => setOpen(false)} className="block py-2 text-gray-700 font-medium">About</Link>
          <Link to="/gallery" onClick={() => setOpen(false)} className="block py-2 text-gray-700 font-medium">Our Work</Link>
          <Link to="/blog" onClick={() => setOpen(false)} className="block py-2 text-gray-700 font-medium">Blog</Link>
          <Link to="/contact" onClick={() => setOpen(false)} className="block py-2 text-gray-700 font-medium">Contact</Link>
          <div className="pt-2 space-y-2">
            <Link to="/budget-estimator" onClick={() => setOpen(false)} className="block bg-secondary text-white text-center py-3 rounded font-semibold flex items-center justify-center gap-2">
              <Calculator className="w-4 h-4" /> Instant Estimator
            </Link>
            <Link to="/start" onClick={() => setOpen(false)} className="block bg-primary text-white text-center py-3 rounded font-semibold">Free Design Preview</Link>
            <a href="tel:6178572636" className="block border-2 border-secondary text-secondary text-center py-3 rounded font-semibold">(617) 857-COEN</a>
          </div>
        </div>
      </div>
      }
    </header>);

}