/**
 * seoSchemas.js — Helper functions for generating common JSON-LD structured data.
 * Import these and pass the result to SEOHead's `structuredData` prop.
 */

const SITE_DOMAIN = "https://www.coenconstruction.com";
const SITE_NAME = "Coen Construction";
const LOGO_URL = "https://lirp.cdn-website.com/f12d7a07/dms3rep/multi/opt/site-logo-1920w.png";

// ─── Organization ────────────────────────────────────────────────────────────
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": SITE_NAME,
    "url": SITE_DOMAIN,
    "logo": LOGO_URL,
    "telephone": "+16178572636",
    "email": "info@coenconstruction.com",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "387 Page Street Ste 10B",
      "addressLocality": "Stoughton",
      "addressRegion": "MA",
      "postalCode": "02072",
      "addressCountry": "US"
    },
    "sameAs": [
      "https://www.facebook.com/coenconstruction",
      "https://www.instagram.com/coenconstruction",
      "https://www.angi.com/write-review/11070437"
    ]
  };
}

// ─── WebPage ─────────────────────────────────────────────────────────────────
export function webPageSchema({ title, description, url, breadcrumbs = [] }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": title,
    "description": description,
    "url": url || SITE_DOMAIN,
    ...(breadcrumbs.length > 0 && { "breadcrumb": breadcrumbSchema(breadcrumbs) })
  };
}

// ─── Article / BlogPosting ───────────────────────────────────────────────────
export function articleSchema({ title, description, url, image, datePublished, dateModified }) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": title,
    "description": description,
    "url": url,
    "image": image,
    "datePublished": datePublished,
    "dateModified": dateModified || datePublished,
    "author": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_DOMAIN
    },
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "logo": { "@type": "ImageObject", "url": LOGO_URL }
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": url }
  };
}

// ─── BreadcrumbList ──────────────────────────────────────────────────────────
// items: [{ name: string, url: string }]
export function breadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": item.name,
      "item": item.url
    }))
  };
}

// ─── FAQPage ─────────────────────────────────────────────────────────────────
// faqs: [{ q: string, a: string }]
export function faqPageSchema(faqs) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a }
    }))
  };
}

// ─── Service / Product ───────────────────────────────────────────────────────
export function servicePageSchema({ name, description, url, areaServed = "Greater Boston, MA" }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": name,
    "description": description,
    "url": url,
    "serviceType": "Home Improvement",
    "areaServed": areaServed,
    "provider": {
      "@type": "GeneralContractor",
      "name": SITE_NAME,
      "telephone": "+16178572636",
      "url": SITE_DOMAIN
    }
  };
}

// ─── AggregateRating ─────────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {number} opts.ratingValue   - Average rating, e.g. 4.9
 * @param {number} opts.reviewCount   - Number of reviews
 * @param {number} [opts.bestRating]  - Max possible rating (default 5)
 * @param {number} [opts.worstRating] - Min possible rating (default 1)
 */
export function aggregateRatingSchema({ ratingValue, reviewCount, bestRating = 5, worstRating = 1 }) {
  return {
    "@type": "AggregateRating",
    "ratingValue": String(ratingValue),
    "reviewCount": String(reviewCount),
    "bestRating": String(bestRating),
    "worstRating": String(worstRating),
  };
}

// ─── Individual Review ────────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {string} opts.author         - Reviewer name
 * @param {string} opts.reviewBody     - Review text
 * @param {number} opts.ratingValue    - Rating given (1-5)
 * @param {string} [opts.datePublished] - ISO date string
 * @param {object} [opts.itemReviewed]  - The thing being reviewed (defaults to Coen Construction)
 */
export function reviewSchema({ author, reviewBody, ratingValue, datePublished, itemReviewed }) {
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    "author": { "@type": "Person", "name": author },
    "reviewBody": reviewBody,
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": String(ratingValue),
      "bestRating": "5",
      "worstRating": "1",
    },
    ...(datePublished ? { "datePublished": datePublished } : {}),
    "itemReviewed": itemReviewed || {
      "@type": "GeneralContractor",
      "name": SITE_NAME,
      "url": SITE_DOMAIN,
    },
  };
}

/**
 * Build a full LocalBusiness-with-reviews schema block for embedding in a page.
 * Combines AggregateRating + individual Review[] under one entity.
 *
 * @param {object[]} reviews  - Array of { author, reviewBody, ratingValue, datePublished }
 * @param {object}   [aggregate] - { ratingValue, reviewCount } — calculated from reviews if omitted
 */
export function reviewsSchema(reviews, aggregate) {
  const rating = aggregate?.ratingValue
    || (reviews.length ? (reviews.reduce((s, r) => s + (r.ratingValue || r.rating || 5), 0) / reviews.length).toFixed(1) : 5);
  const count = aggregate?.reviewCount || reviews.length;

  return {
    "@context": "https://schema.org",
    "@type": "GeneralContractor",
    "name": SITE_NAME,
    "url": SITE_DOMAIN,
    "telephone": "+16178572636",
    "aggregateRating": aggregateRatingSchema({ ratingValue: rating, reviewCount: count }),
    "review": reviews.map(r => ({
      "@type": "Review",
      "author": { "@type": "Person", "name": r.author || r.name },
      "reviewBody": r.reviewBody || r.text,
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": String(r.ratingValue || r.rating || 5),
        "bestRating": "5",
        "worstRating": "1",
      },
      ...(r.datePublished ? { "datePublished": r.datePublished } : {}),
    })),
  };
}

// ─── LocalBusiness (full) ────────────────────────────────────────────────────
export function localBusinessSchema({ areaServed } = {}) {
  return {
    "@context": "https://schema.org",
    "@type": ["GeneralContractor", "LocalBusiness"],
    "name": SITE_NAME,
    "url": SITE_DOMAIN,
    "logo": LOGO_URL,
    "telephone": "+16178572636",
    "email": "info@coenconstruction.com",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "387 Page Street Ste 10B",
      "addressLocality": "Stoughton",
      "addressRegion": "MA",
      "postalCode": "02072",
      "addressCountry": "US"
    },
    "geo": { "@type": "GeoCoordinates", "latitude": 42.1223, "longitude": -71.1031 },
    "openingHoursSpecification": [
      { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "07:00", "closes": "18:00" },
      { "@type": "OpeningHoursSpecification", "dayOfWeek": "Saturday", "opens": "08:00", "closes": "14:00" }
    ],
    "priceRange": "$$",
    "foundingDate": "2010",
    "areaServed": areaServed || "Greater Boston, MA",
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "5", "reviewCount": "87" },
    "sameAs": [
      "https://www.facebook.com/coenconstruction",
      "https://www.instagram.com/coenconstruction"
    ]
  };
}