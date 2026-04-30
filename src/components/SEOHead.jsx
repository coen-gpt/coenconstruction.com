import { Helmet } from "react-helmet";
import { useLocation } from "react-router-dom";
import { getStaticOgImage } from "@/lib/ogImages";
import { getCanonicalUrl, getPaginationLinks, SITE_DOMAIN } from "@/lib/canonical";
import { buildHreflangLinks, getLangFromPath, stripLangPrefix } from "@/lib/i18n";

// ─── Site-wide constants ────────────────────────────────────────────────────
const SITE_NAME = "Coen Construction";
const DEFAULT_DESCRIPTION = "Greater Boston's trusted general contractor since 2010. Home additions, decks, siding, kitchen remodeling & custom carpentry. Free estimates. (617) 857-COEN.";
const DEFAULT_OG_IMAGE = "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&q=80";
const OG_IMAGE_FN = "/api/functions/ogImage";

/** Build a dynamic OG image URL via the ogImage backend function */
export function buildOgImageUrl({ title, description, type = "default", date = "", category = "" } = {}) {
  const params = new URLSearchParams();
  if (title)       params.set("title",       title);
  if (description) params.set("description", description);
  if (type)        params.set("type",        type);
  if (date)        params.set("date",        date);
  if (category)    params.set("category",    category);
  return `${OG_IMAGE_FN}?${params.toString()}`;
}
const TWITTER_HANDLE = "@coenconstruction";

// ─── Re-export schema helpers so existing consumers keep working ──────────────
export { articleSchema as buildArticleSchema, buildArticleBreadcrumbs } from "@/lib/schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Estimate reading time from raw text/HTML content. Returns e.g. "5 min read". */
export function estimateReadingTime(content = "") {
  const text = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(" ").filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SEOHead — drop-in per-page SEO component.
 *
 * @param {string}          title            - Page title (suffixed with site name)
 * @param {string}          description      - Meta description (max 160 chars)
 * @param {string[]}        keywords         - Array of keyword strings
 * @param {string}          canonicalUrl     - Full canonical URL (auto-generated if omitted)
 * @param {string}          ogImage          - OG/Twitter image URL
 * @param {string}          ogType           - "website" | "article"
 * @param {boolean}         noindex          - Add noindex,nofollow when true
 * @param {object|object[]} structuredData   - One or more JSON-LD objects
 *
 * Article-specific props (used when ogType="article"):
 * @param {string}          article.publishedTime  - ISO date string
 * @param {string}          [article.modifiedTime] - ISO date string
 * @param {string|string[]} [article.authors]      - Author name(s)
 * @param {string}          [article.section]      - Article category/section
 * @param {string[]}        [article.tags]         - Article tags
 *
 * Pagination props:
 * @param {number}          [page]       - Current page number (1-indexed)
 * @param {number}          [totalPages] - Total pages (enables prev/next links)
 */
export default function SEOHead({
  title,
  description,
  keywords = [],
  canonicalUrl,
  ogImage,
  ogType = "website",
  noindex = false,
  structuredData,
  article,
  page,
  totalPages,
  hreflang = true,  // set false to suppress hreflang on noindex pages
}) {
  const location = useLocation();
  const currentLang = getLangFromPath(location.pathname);

  const fullTitle = title
    ? `${title} | ${SITE_NAME}`
    : `${SITE_NAME} | Boston MA General Contractor`;
  const metaDesc = (description || DEFAULT_DESCRIPTION).slice(0, 160);

  // Build canonical: explicit override > auto-generated (strips tracking params, normalizes)
  const canonical = canonicalUrl || getCanonicalUrl(location.pathname, {
    page,
    search: location.search,
  });

  const isArticle = ogType === "article" && article;

  // Pagination prev/next (used by Bing; Google deprecated but harmless)
  const { prev: prevUrl, next: nextUrl } = (page && totalPages)
    ? getPaginationLinks(location.pathname, page, totalPages)
    : { prev: null, next: null };
  const keywordStr = keywords.join(", ");
  const robotsContent = noindex ? "noindex, nofollow" : "index, follow";

  // OG image priority:
  // 1. Explicit prop passed by the page
  // 2. Static file from /public/og/ registry (keyed by pathname)
  // 3. Dynamic branded SVG from ogImage backend function
  const image =
    ogImage ||
    getStaticOgImage(location.pathname) ||
    buildOgImageUrl({
      title: fullTitle,
      description: metaDesc,
      type: isArticle ? "article" : "default",
      date: isArticle && article?.publishedTime
        ? new Date(article.publishedTime).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : "",
      category: isArticle && article?.section ? article.section : "",
    });


  const authorList = isArticle
    ? (Array.isArray(article.authors) ? article.authors : [article.authors]).filter(Boolean)
    : [];

  // Support single object or array of structured data
  const schemas = structuredData
    ? Array.isArray(structuredData) ? structuredData : [structuredData]
    : [];

  // hreflang alternate links (only on indexable pages with multiple languages)
  const hreflangLinks = (!noindex && hreflang)
    ? buildHreflangLinks(stripLangPrefix(location.pathname), SITE_DOMAIN)
    : [];

  return (
    <Helmet>
      {/* Basic */}
      <title>{fullTitle}</title>
      <meta name="description" content={metaDesc} />
      {keywordStr && <meta name="keywords" content={keywordStr} />}
      <meta name="robots" content={robotsContent} />
      <link rel="canonical" href={canonical} />
      {prevUrl && <link rel="prev" href={prevUrl} />}
      {nextUrl && <link rel="next" href={nextUrl} />}

      {/* hreflang alternate links for international SEO */}
      {hreflangLinks.map(({ hreflang: hl, href }) => (
        <link key={hl} rel="alternate" hreflang={hl} href={href} />
      ))}

      {/* Content-Language meta */}
      <meta httpEquiv="content-language" content={currentLang.hreflang} />

      {/* Open Graph — base */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDesc} />
      <meta property="og:image" content={image} />

      {/* Open Graph — article-specific */}
      {isArticle && article.publishedTime && (
        <meta property="article:published_time" content={article.publishedTime} />
      )}
      {isArticle && (article.modifiedTime || article.publishedTime) && (
        <meta property="article:modified_time" content={article.modifiedTime || article.publishedTime} />
      )}
      {isArticle && article.section && (
        <meta property="article:section" content={article.section} />
      )}
      {isArticle && authorList.map((author, i) => (
        <meta key={i} property="article:author" content={author} />
      ))}
      {isArticle && (article.tags || []).map((tag, i) => (
        <meta key={i} property="article:tag" content={tag} />
      ))}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDesc} />
      <meta name="twitter:image" content={image} />

      {/* JSON-LD Structured Data */}
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}