/**
 * Breadcrumb — semantic breadcrumb trail with JSON-LD schema injection.
 *
 * Usage A — auto-generate from current URL path:
 *   <Breadcrumb />
 *
 * Usage B — custom hierarchy:
 *   <Breadcrumb items={[
 *     { label: "Services", href: "/services" },
 *     { label: "Home Additions" }          ← no href = current page
 *   ]} />
 *
 * Usage C — label overrides for ugly slugs:
 *   <Breadcrumb labelMap={{ "home-additions": "Home Additions Contractor" }} />
 */

import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { Helmet } from "react-helmet";
import { breadcrumbSchema } from "@/lib/schema";
import { SITE_DOMAIN } from "@/lib/canonical";

// Human-readable labels for URL segments used site-wide
const DEFAULT_LABEL_MAP = {
  "service-areas":           "Service Areas",
  "services":                "Services",
  "home-additions":          "Home Additions",
  "decks-porches-pergolas":  "Decks, Porches & Pergolas",
  "siding":                  "Siding",
  "kitchen-remodeling":      "Kitchen Remodeling",
  "custom-carpentry":        "Custom Carpentry",
  "snow-removal":            "Snow Removal",
  "greater-boston":          "Greater Boston",
  "metro-west":              "Metro West",
  "south-shore":             "South Shore",
  "blog":                    "Blog",
  "about":                   "About Coen Construction",
  "gallery":                 "Our Work",
  "contact":                 "Contact Us",
  "financing":               "Financing",
  "budget-estimator":        "Instant Budget Estimator",
  "start":                   "Free Design Preview",
  "privacy-policy":          "Privacy Policy",
  "sitemap":                 "Sitemap",
};

/**
 * @param {object}  [props]
 * @param {Array<{label: string, href?: string}>} [props.items]  – Custom hierarchy (no Home needed)
 * @param {Record<string,string>} [props.labelMap]               – Extra slug → label overrides
 * @param {string}  [props.className]
 * @param {boolean} [props.light]   – White text variant (for dark hero backgrounds)
 */
export default function Breadcrumb({ items, labelMap = {}, className = "", light = false }) {
  const location = useLocation();

  // Build display items
  let crumbs; // [{ label, href }]

  if (items) {
    // Custom hierarchy provided — prepend Home
    crumbs = [
      { label: "Home", href: "/" },
      ...items,
    ];
  } else {
    // Auto-generate from pathname
    const segments = location.pathname.replace(/^\/|\/$/g, "").split("/").filter(Boolean);
    const merged = { ...DEFAULT_LABEL_MAP, ...labelMap };
    let cumPath = "";
    crumbs = [
      { label: "Home", href: "/" },
      ...segments.map((seg, i) => {
        cumPath += `/${seg}`;
        const label = merged[seg]
          ?? seg.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const isLast = i === segments.length - 1;
        return { label, href: isLast ? undefined : cumPath };
      }),
    ];
  }

  // Build JSON-LD schema items (all get URLs — current page uses SITE_DOMAIN + current path)
  const schemaItems = crumbs.map((c, i) => ({
    name: c.label,
    url: c.href
      ? (c.href.startsWith("http") ? c.href : `${SITE_DOMAIN}${c.href}`)
      : `${SITE_DOMAIN}${location.pathname}`,
  }));

  // Strip the leading "Home" from schemaItems since breadcrumbSchema prepends it
  const schema = breadcrumbSchema(schemaItems.slice(1));

  const textBase  = light ? "text-white/60" : "text-gray-400";
  const textHover = light ? "hover:text-white" : "hover:text-primary";
  const textCurrent = light ? "text-white/90" : "text-gray-600";
  const chevronColor = light ? "text-white/30" : "text-gray-300";

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </Helmet>

      <nav aria-label="Breadcrumb" className={`${className}`}>
        <ol
          className="flex flex-wrap items-center gap-1 text-sm"
          itemScope
          itemType="https://schema.org/BreadcrumbList"
        >
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <li
                key={i}
                className="flex items-center gap-1"
                itemScope
                itemProp="itemListElement"
                itemType="https://schema.org/ListItem"
              >
                {/* Chevron separator — not before first item */}
                {i > 0 && <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${chevronColor}`} />}

                {isLast || !crumb.href ? (
                  // Current page — not a link
                  <span
                    className={`font-medium ${textCurrent}`}
                    aria-current="page"
                    itemProp="name"
                  >
                    {i === 0 && <Home className="w-3.5 h-3.5 inline-block mr-0.5 -mt-0.5" />}
                    {i > 0 ? crumb.label : ""}
                    <meta itemProp="position" content={String(i + 1)} />
                  </span>
                ) : (
                  // Ancestor — link
                  <Link
                    to={crumb.href}
                    className={`${textBase} ${textHover} transition-colors`}
                    itemProp="item"
                  >
                    <span itemProp="name">
                      {i === 0 ? <Home className="w-3.5 h-3.5 inline-block" aria-label="Home" /> : crumb.label}
                    </span>
                    <meta itemProp="position" content={String(i + 1)} />
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}