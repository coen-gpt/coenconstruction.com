import { useEffect, useState } from "react";
import { getPublicConfig } from "@/lib/publicConfig";

// Last-known Coen logo so public pages never flash an empty header while
// publicConfig loads (or if it fails). The live logo from Company Profile
// always wins once fetched.
const FALLBACK_LOGO =
  "https://media.base44.com/images/public/69cf342e607cf2b57ec285ff/bb1690db8_COENLogo.png";
const FALLBACK_NAME = "Coen Construction";

export function usePublicBrand() {
  const [brand, setBrand] = useState({
    logoUrl: FALLBACK_LOGO,
    companyName: FALLBACK_NAME,
    brandColor: "#E35235",
    phone: "",
    email: "",
  });

  useEffect(() => {
    let alive = true;
    getPublicConfig().then((cfg) => {
      if (!alive) return;
      setBrand({
        logoUrl: cfg.logo_url || FALLBACK_LOGO,
        companyName: cfg.company_name || FALLBACK_NAME,
        brandColor: cfg.brand_color || "#E35235",
        phone: cfg.company_phone || "",
        email: cfg.company_email || "",
      });
    });
    return () => { alive = false; };
  }, []);

  return brand;
}

/**
 * The company logo from Company Profile, usable on any page (public or
 * authenticated — branding is served by the public publicConfig function).
 *
 * The logo is navy, so on dark/navy/brand-color headers pass `onDark` to
 * convert it to white (brightness-0 invert) so it stands out instead of
 * disappearing into the header.
 */
export default function BrandLogo({ onDark = false, className = "h-10", style }) {
  const { logoUrl, companyName } = usePublicBrand();
  return (
    <img
      src={logoUrl}
      alt={companyName}
      style={style}
      className={`${className} w-auto object-contain ${onDark ? "brightness-0 invert" : ""}`}
    />
  );
}
