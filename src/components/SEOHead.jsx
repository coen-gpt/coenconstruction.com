import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getStaticOgImage } from "@/lib/ogImages";
import { getCanonicalUrl, getPaginationLinks, SITE_DOMAIN } from "@/lib/canonical";
import { buildHreflangLinks, getLangFromPath, stripLangPrefix } from "@/lib/i18n";
import { useSiteContent } from "@/hooks/useSiteContent";

const SITE_NAME = "Coen Construction";
const DEFAULT_DESCRIPTION = "Greater Boston's trusted general contractor since 2010. Home additions, decks, siding, kitchen remodeling & custom carpentry. Free estimates. (617) 857-COEN.";
const OG_IMAGE_FN = "/api/functions/ogImage";

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

const META_KEY_BY_PATH = {
  "/": "home_meta",
  "/about": "about_meta",
  "/contact": "contact_meta",
  "/gallery": "gallery_meta",
  "/financing": "financing_meta",
  "/blog": "blog_meta",
  "/service-areas": "service_areas_meta",
  "/services/home-additions": "service_home_additions_meta",
  "/services/decks-porches-pergolas": "service_decks_meta",
  "/services/siding": "service_siding_meta",
  "/services/kitchen-remodeling": "service_kitchen_meta",
  "/services/bathroom-remodeling": "service_bathroom_meta",
  "/services/custom-carpentry": "service_carpentry_meta",
  "/services/snow-removal": "service_snow_meta",
  "/start": "start_meta",
  "/budget-estimator": "budget_estimator_meta",
};

export { articleSchema as buildArticleSchema, buildArticleBreadcrumbs } from "@/lib/schema";

export function estimateReadingTime(content = "") {
  const text = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(" ").filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

function setMeta(name, content, attr = "name") {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel, href, extra = {}) {
  if (!href) return;
  const selector = Object.entries(extra).reduce((s, [k, v]) => `${s}[${k}="${v}"]`, `link[rel="${rel}"]`);
  let el = document.querySelector(selector) || document.querySelector(`link[rel="${rel}"][href="${href}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
  Object.entries(extra).forEach(([k, v]) => el.setAttribute(k, v));
}

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
  hreflang = true,
}) {
  const location = useLocation();
  const schemaTagsRef = useRef([]);

  const currentLang = getLangFromPath(location.pathname);
  const cleanPath = stripLangPrefix(location.pathname).replace(/\/$/, "") || "/";
  const { data: metaOverride } = useSiteContent(META_KEY_BY_PATH[cleanPath]);
  const effectiveTitle = metaOverride?.title || title;
  const fullTitle = effectiveTitle ? `${effectiveTitle} | ${SITE_NAME}` : `${SITE_NAME} | Boston MA General Contractor`;
  const metaDesc = (metaOverride?.description || description || DEFAULT_DESCRIPTION).slice(0, 160);
  const canonical = metaOverride?.canonical_url
    ? (metaOverride.canonical_url.startsWith("http") ? metaOverride.canonical_url : `${SITE_DOMAIN}${metaOverride.canonical_url}`)
    : canonicalUrl || getCanonicalUrl(location.pathname, { page, search: location.search });
  const isArticle = ogType === "article" && article;
  const { prev: prevUrl, next: nextUrl } = (page && totalPages)
    ? getPaginationLinks(location.pathname, page, totalPages)
    : { prev: null, next: null };
  const keywordStr = metaOverride?.keywords || keywords.join(", ");
  const robotsContent = noindex ? "noindex, nofollow" : (metaOverride?.robots || "index, follow");
  const image = metaOverride?.og_image || ogImage || getStaticOgImage(location.pathname) || buildOgImageUrl({
    title: fullTitle, description: metaDesc,
    type: isArticle ? "article" : "default",
    date: isArticle && article?.publishedTime ? new Date(article.publishedTime).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "",
    category: isArticle && article?.section ? article.section : "",
  });
  const authorList = isArticle ? (Array.isArray(article.authors) ? article.authors : [article.authors]).filter(Boolean) : [];
  const schemas = structuredData ? (Array.isArray(structuredData) ? structuredData : [structuredData]) : [];
  const hreflangLinks = (!noindex && hreflang) ? buildHreflangLinks(stripLangPrefix(location.pathname), SITE_DOMAIN) : [];

  useEffect(() => {
    // Title
    document.title = fullTitle;

    // Basic meta
    setMeta("description", metaDesc);
    if (keywordStr) setMeta("keywords", keywordStr);
    setMeta("robots", robotsContent);
    setMeta("httpEquiv", currentLang.hreflang, "http-equiv");

    // Canonical + pagination
    setLink("canonical", canonical);
    if (prevUrl) setLink("prev", prevUrl);
    if (nextUrl) setLink("next", nextUrl);

    // hreflang
    hreflangLinks.forEach(({ hreflang: hl, href }) => setLink("alternate", href, { hreflang: hl }));

    // OG base
    setMeta("og:site_name", SITE_NAME, "property");
    setMeta("og:type", ogType, "property");
    setMeta("og:url", canonical, "property");
    setMeta("og:title", metaOverride?.og_title || fullTitle, "property");
    setMeta("og:description", metaOverride?.og_description || metaDesc, "property");
    setMeta("og:image", image, "property");

    // OG article
    if (isArticle) {
      if (article.publishedTime) setMeta("article:published_time", article.publishedTime, "property");
      if (article.modifiedTime || article.publishedTime) setMeta("article:modified_time", article.modifiedTime || article.publishedTime, "property");
      if (article.section) setMeta("article:section", article.section, "property");
      authorList.forEach(author => setMeta("article:author", author, "property"));
      (article.tags || []).forEach(tag => setMeta("article:tag", tag, "property"));
    }

    // Twitter
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:site", TWITTER_HANDLE);
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", metaDesc);
    setMeta("twitter:image", image);

    // JSON-LD structured data
    // Remove previous schema tags injected by this component
    schemaTagsRef.current.forEach(el => el.parentNode?.removeChild(el));
    schemaTagsRef.current = schemas.map(schema => {
      const el = document.createElement("script");
      el.type = "application/ld+json";
      el.textContent = JSON.stringify(schema);
      document.head.appendChild(el);
      return el;
    });

    return () => {
      schemaTagsRef.current.forEach(el => el.parentNode?.removeChild(el));
      schemaTagsRef.current = [];
    };
  }, [fullTitle, metaDesc, canonical, ogType, image, robotsContent, keywordStr, metaOverride?.og_title, metaOverride?.og_description, JSON.stringify(schemas), JSON.stringify(hreflangLinks)]);

  return null;
}