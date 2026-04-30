/**
 * lib/schema.js — JSON-LD Structured Data Generators for Coen Construction
 *
 * Every generator returns a plain object (no @context wrapper needed except
 * when used standalone — combineSchemas() adds the wrapper for you).
 *
 * Usage:
 *   import { organizationSchema, breadcrumbFromPath } from "@/lib/schema";
 *   import { injectSchemas } from "@/lib/jsonld";
 *
 *   const schemas = injectSchemas(
 *     organizationSchema(),
 *     breadcrumbFromPath("/services/home-additions")
 *   );
 */

import { SITE_DOMAIN } from "@/lib/canonical";

// ─── Brand constants ──────────────────────────────────────────────────────────
const BRAND = {
  name:      "Coen Construction",
  url:       SITE_DOMAIN,
  logo:      "https://lirp.cdn-website.com/f12d7a07/dms3rep/multi/opt/site-logo-1920w.png",
  phone:     "+16178572636",
  email:     "info@coenconstruction.com",
  founding:  "2010",
  priceRange: "$$",
  address: {
    "@type":           "PostalAddress",
    streetAddress:     "387 Page Street Ste 10B",
    addressLocality:   "Stoughton",
    addressRegion:     "MA",
    postalCode:        "02072",
    addressCountry:    "US",
  },
  geo: { "@type": "GeoCoordinates", latitude: 42.1223, longitude: -71.1031 },
  sameAs: [
    "https://www.facebook.com/coenconstruction",
    "https://www.instagram.com/coenconstruction",
  ],
  hours: [
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday"], opens: "07:00", closes: "18:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "08:00", closes: "14:00" },
  ],
};

// ─── 1. Organization ─────────────────────────────────────────────────────────
/**
 * @param {object}   [opts]
 * @param {string[]} [opts.sameAs]     – Override / extend social profile URLs
 */
export function organizationSchema(opts = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name:    BRAND.name,
    url:     BRAND.url,
    logo:    { "@type": "ImageObject", url: BRAND.logo },
    telephone:    BRAND.phone,
    email:        BRAND.email,
    foundingDate: BRAND.founding,
    address:      BRAND.address,
    contactPoint: {
      "@type":        "ContactPoint",
      telephone:      BRAND.phone,
      contactType:    "customer service",
      areaServed:     "US",
      availableLanguage: "English",
    },
    sameAs: opts.sameAs ?? BRAND.sameAs,
  };
}

// ─── 2. WebSite ───────────────────────────────────────────────────────────────
/**
 * Includes a SearchAction so Google can show a sitelinks search box.
 * @param {object} [opts]
 * @param {string} [opts.searchUrl] – Override search URL template
 */
export function webSiteSchema(opts = {}) {
  const searchUrl = opts.searchUrl ?? `${BRAND.url}/?s={search_term_string}`;
  return {
    "@context": "https://schema.org",
    "@type":    "WebSite",
    name:  BRAND.name,
    url:   BRAND.url,
    potentialAction: {
      "@type":       "SearchAction",
      target:        { "@type": "EntryPoint", urlTemplate: searchUrl },
      "query-input": "required name=search_term_string",
    },
  };
}

// ─── 3. WebPage ───────────────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {string} opts.name
 * @param {string} opts.description
 * @param {string} opts.url          – Full canonical URL
 * @param {string} [opts.datePublished]
 * @param {string} [opts.dateModified]
 */
export function webPageSchema({ name, description, url, datePublished, dateModified } = {}) {
  return {
    "@context": "https://schema.org",
    "@type":    "WebPage",
    name,
    description,
    url,
    isPartOf:  { "@type": "WebSite", url: BRAND.url, name: BRAND.name },
    ...(datePublished && { datePublished }),
    ...(dateModified  && { dateModified }),
    publisher: { "@type": "Organization", name: BRAND.name, url: BRAND.url },
  };
}

// ─── 4. BreadcrumbList ────────────────────────────────────────────────────────
/**
 * Build from an explicit items array:
 *   breadcrumbSchema([{ name: "Services", url: "/services" }, { name: "Decks", url: "/services/decks-porches-pergolas" }])
 *
 * Home is always prepended automatically.
 *
 * @param {Array<{name: string, url: string}>} items
 */
export function breadcrumbSchema(items = []) {
  const all = [{ name: "Home", url: BRAND.url }, ...items.map(i => ({
    name: i.name,
    url:  i.url.startsWith("http") ? i.url : `${BRAND.url}${i.url}`,
  }))];
  return {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: all.map((item, idx) => ({
      "@type":   "ListItem",
      position:  idx + 1,
      name:      item.name,
      item:      item.url,
    })),
  };
}

/**
 * Auto-generate breadcrumbs from a URL pathname.
 *
 * "/services/home-additions" →
 *   Home > Services > Home Additions
 *
 * @param {string} pathname  – e.g. "/services/home-additions"
 * @param {Record<string,string>} [labelMap] – Override segment labels, e.g. { "home-additions": "Home Additions" }
 */
export function breadcrumbFromPath(pathname, labelMap = {}) {
  const segments = pathname.replace(/^\/|\/$/g, "").split("/").filter(Boolean);
  let cumPath = "";
  const items = segments.map(seg => {
    cumPath += `/${seg}`;
    const label = labelMap[seg]
      ?? seg.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    return { name: label, url: cumPath };
  });
  return breadcrumbSchema(items);
}

// ─── 5. Article / BlogPosting ─────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {string}          opts.headline
 * @param {string}          opts.description
 * @param {string}          opts.url
 * @param {string}          opts.image
 * @param {string}          opts.datePublished   – ISO date
 * @param {string}          [opts.dateModified]
 * @param {string|string[]} [opts.authors]       – Name(s)
 * @param {string}          [opts.section]       – articleSection / category
 * @param {string[]}        [opts.keywords]
 */
export function articleSchema({
  headline,
  description,
  url,
  image,
  datePublished,
  dateModified,
  authors = [],
  section,
  keywords = [],
} = {}) {
  const authorList = (Array.isArray(authors) ? authors : [authors]).filter(Boolean);
  const authorSchemas = authorList.length > 0
    ? authorList.map(n => ({ "@type": "Person", name: n }))
    : [{ "@type": "Organization", name: BRAND.name, url: BRAND.url }];

  return {
    "@context": "https://schema.org",
    "@type":    "BlogPosting",
    headline,
    description,
    url,
    image,
    datePublished,
    dateModified: dateModified ?? datePublished,
    author:    authorSchemas.length === 1 ? authorSchemas[0] : authorSchemas,
    publisher: {
      "@type": "Organization",
      name:    BRAND.name,
      logo:    { "@type": "ImageObject", url: BRAND.logo },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(section  && { articleSection: section }),
    ...(keywords.length && { keywords: keywords.join(", ") }),
  };
}

// ─── 6. Service (replaces old serviceSchema) ──────────────────────────────────
/**
 * @param {object} opts
 * @param {string}   opts.name
 * @param {string}   opts.description
 * @param {string}   opts.url
 * @param {string}   [opts.areaServed]
 * @param {string[]} [opts.serviceTypes]
 */
export function serviceSchema({ name, description, url, areaServed = "Greater Boston, MA", serviceTypes = [] } = {}) {
  return {
    "@context": "https://schema.org",
    "@type":    "Service",
    name,
    description,
    url,
    provider: {
      "@type":    "GeneralContractor",
      name:       BRAND.name,
      telephone:  BRAND.phone,
      url:        BRAND.url,
    },
    areaServed,
    serviceType: serviceTypes.length ? serviceTypes : "Home Improvement",
  };
}

// ─── 7. FAQPage ───────────────────────────────────────────────────────────────
/**
 * @param {Array<{q: string, a: string}>} faqs
 */
export function faqSchema(faqs = []) {
  return {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: faqs.map(f => ({
      "@type": "Question",
      name:    f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

// ─── 8. LocalBusiness ────────────────────────────────────────────────────────
/**
 * Standalone local business schema (also exported as a static constant for
 * convenience in pages that don't need customisation).
 *
 * @param {object} [opts]
 * @param {string} [opts.areaServed]
 * @param {Array}  [opts.makesOffer]
 * @param {number} [opts.ratingValue]
 * @param {number} [opts.reviewCount]
 */
export function localBusinessSchema({
  areaServed = "Greater Boston, MA",
  makesOffer,
  ratingValue = 5,
  reviewCount = 87,
} = {}) {
  return {
    "@context": "https://schema.org",
    "@type":    ["GeneralContractor", "LocalBusiness"],
    name:       BRAND.name,
    url:        BRAND.url,
    telephone:  BRAND.phone,
    email:      BRAND.email,
    address:    BRAND.address,
    geo:        BRAND.geo,
    logo:       BRAND.logo,
    foundingDate: BRAND.founding,
    priceRange:   BRAND.priceRange,
    openingHoursSpecification: BRAND.hours,
    areaServed,
    aggregateRating: {
      "@type":      "AggregateRating",
      ratingValue:  String(ratingValue),
      reviewCount:  String(reviewCount),
    },
    sameAs: BRAND.sameAs,
    hasMap: "https://maps.google.com/?q=387+Page+Street+Stoughton+MA",
    ...(makesOffer && { makesOffer }),
  };
}

/**
 * Backwards-compatible static export used by many existing pages.
 * Prefer localBusinessSchema() for new code.
 */
export const LOCAL_BUSINESS = localBusinessSchema();

// ─── 8b. LocalBusiness with Region (town pages) ───────────────────────────────
const REGION_CITIES = {
  "Greater Boston": [
    { "@type": "City", name: "Cambridge",  addressRegion: "MA" },
    { "@type": "City", name: "Somerville", addressRegion: "MA" },
    { "@type": "City", name: "Brookline",  addressRegion: "MA" },
    { "@type": "City", name: "Medford",    addressRegion: "MA" },
    { "@type": "City", name: "Boston",     addressRegion: "MA" },
  ],
  "Metro West": [
    { "@type": "City", name: "Newton",     addressRegion: "MA" },
    { "@type": "City", name: "Wellesley",  addressRegion: "MA" },
    { "@type": "City", name: "Lexington",  addressRegion: "MA" },
    { "@type": "City", name: "Framingham", addressRegion: "MA" },
    { "@type": "City", name: "Concord",    addressRegion: "MA" },
  ],
  "South Shore": [
    { "@type": "City", name: "Hingham",    addressRegion: "MA" },
    { "@type": "City", name: "Quincy",     addressRegion: "MA" },
    { "@type": "City", name: "Plymouth",   addressRegion: "MA" },
    { "@type": "City", name: "Duxbury",    addressRegion: "MA" },
    { "@type": "City", name: "Marshfield", addressRegion: "MA" },
  ],
};

const SERVICE_NAMES = [
  "Home Additions", "Kitchen Remodeling", "Deck Construction",
  "Siding Installation", "Custom Carpentry", "Bathroom Remodeling",
];

export function localBusinessWithRegion(townName, regionName, countyName, townSlug) {
  return localBusinessSchema({
    areaServed: [
      { "@type": "City",              name: townName,    addressRegion: "MA" },
      { "@type": "AdministrativeArea", name: regionName },
      { "@type": "County",            name: countyName  },
      ...(REGION_CITIES[regionName] ?? []),
    ],
    makesOffer: SERVICE_NAMES.map(s => ({
      "@type": "Offer",
      itemOffered: {
        "@type":      "Service",
        name:         `${s} in ${townName}, MA`,
        serviceType:  "Construction",
        areaServed:   { "@type": "City", name: townName, addressRegion: "MA" },
        provider: {
          "@type": "GeneralContractor",
          name:    BRAND.name,
          url:     `${BRAND.url}/service-areas/${townSlug}`,
        },
      },
    })),
  });
}

// ─── 9. HowTo ─────────────────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {string}   opts.name
 * @param {string}   [opts.description]
 * @param {string}   [opts.totalTime]   – ISO 8601 duration, e.g. "PT2H"
 * @param {string}   [opts.image]
 * @param {string[]} [opts.tools]       – Tool names
 * @param {string[]} [opts.supplies]    – Supply/material names
 * @param {Array<{name: string, text: string, image?: string}>} opts.steps
 */
export function howToSchema({ name, description, totalTime, image, tools = [], supplies = [], steps = [] } = {}) {
  return {
    "@context": "https://schema.org",
    "@type":    "HowTo",
    name,
    ...(description && { description }),
    ...(image       && { image }),
    ...(totalTime   && { totalTime }),
    ...(tools.length    && { tool:   tools.map(t => ({ "@type": "HowToTool",   name: t })) }),
    ...(supplies.length && { supply: supplies.map(s => ({ "@type": "HowToSupply", name: s })) }),
    step: steps.map((s, i) => ({
      "@type":    "HowToStep",
      position:  i + 1,
      name:       s.name,
      text:       s.text,
      ...(s.image && { image: s.image }),
    })),
  };
}

// ─── Article breadcrumb helper (used in SEOHead) ──────────────────────────────
/**
 * Build a BreadcrumbList specifically for article/blog pages.
 * Prepends Home automatically.
 *
 * @param {Array<{name: string, url: string}>} items
 */
export function buildArticleBreadcrumbs(items) {
  return breadcrumbSchema(items);
}