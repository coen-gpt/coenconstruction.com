/**
 * Internationalization (i18n) infrastructure for Coen Construction
 * ─────────────────────────────────────────────────────────────────
 * Currently English-only. This file provides the full foundation for
 * adding language variants without breaking the existing site.
 *
 * URL strategy: subdirectory prefix (/en/, /es/, /fr/)
 * Default language (en-US) is served at the root (/) with x-default hreflang.
 */

import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// ─── Supported Languages ──────────────────────────────────────────────────────

export const LANGUAGES = [
  {
    code: "en",
    region: "US",
    hreflang: "en-US",
    label: "English",
    nativeLabel: "English",
    flag: "🇺🇸",
    urlPrefix: "",          // default language served at root (no prefix)
    isDefault: true,
  },
  // Uncomment and add translations to activate:
  // {
  //   code: "es",
  //   region: "US",
  //   hreflang: "es",
  //   label: "Spanish",
  //   nativeLabel: "Español",
  //   flag: "🇪🇸",
  //   urlPrefix: "/es",
  //   isDefault: false,
  // },
  // {
  //   code: "pt",
  //   region: "BR",
  //   hreflang: "pt-BR",
  //   label: "Portuguese",
  //   nativeLabel: "Português",
  //   flag: "🇧🇷",
  //   urlPrefix: "/pt",
  //   isDefault: false,
  // },
];

export const DEFAULT_LANGUAGE = LANGUAGES.find(l => l.isDefault);
export const ACTIVE_LANGUAGES = LANGUAGES; // all configured languages

// ─── URL Helpers ──────────────────────────────────────────────────────────────

/** Detect the language code from a pathname, e.g. "/es/services" → "es" */
export function getLangFromPath(pathname) {
  for (const lang of LANGUAGES) {
    if (!lang.isDefault && lang.urlPrefix && pathname.startsWith(lang.urlPrefix + "/")) {
      return lang;
    }
    if (!lang.isDefault && lang.urlPrefix && pathname === lang.urlPrefix) {
      return lang;
    }
  }
  return DEFAULT_LANGUAGE;
}

/** Strip language prefix from a path, e.g. "/es/services" → "/services" */
export function stripLangPrefix(pathname) {
  for (const lang of LANGUAGES) {
    if (!lang.isDefault && lang.urlPrefix && pathname.startsWith(lang.urlPrefix)) {
      return pathname.slice(lang.urlPrefix.length) || "/";
    }
  }
  return pathname;
}

/** Build a localized path for a given language, e.g. lang=es, path="/services" → "/es/services" */
export function buildLocalizedPath(lang, canonicalPath) {
  if (lang.isDefault) return canonicalPath;
  const clean = stripLangPrefix(canonicalPath);
  return `${lang.urlPrefix}${clean === "/" ? "" : clean}` || lang.urlPrefix;
}

// ─── hreflang Link Builder ────────────────────────────────────────────────────

/**
 * Build all hreflang link objects for a given canonical path.
 * Returns array of { hreflang, href } — include in <Helmet> as <link rel="alternate" />.
 *
 * @param {string} canonicalPath  - Path without lang prefix, e.g. "/services"
 * @param {string} siteDomain     - e.g. "https://coenconstruction.com"
 */
export function buildHreflangLinks(canonicalPath, siteDomain) {
  const links = [];

  // x-default always points to the default-language (root) URL
  links.push({
    hreflang: "x-default",
    href: `${siteDomain}${canonicalPath === "/" ? "" : canonicalPath}` || siteDomain,
  });

  // One entry per language
  for (const lang of LANGUAGES) {
    const localizedPath = buildLocalizedPath(lang, canonicalPath);
    links.push({
      hreflang: lang.hreflang,
      href: `${siteDomain}${localizedPath}`,
    });
  }

  return links;
}

// ─── Browser Language Detection ──────────────────────────────────────────────

/**
 * Detect the best matching language from navigator.languages.
 * Returns a language config object or null if no match.
 */
export function detectBrowserLanguage() {
  if (typeof navigator === "undefined") return null;
  const preferred = (navigator.languages || [navigator.language]).map(l => l.toLowerCase());

  for (const pref of preferred) {
    // Exact hreflang match (e.g. "en-us" → "en-US")
    const exact = LANGUAGES.find(l => l.hreflang.toLowerCase() === pref);
    if (exact) return exact;
    // Language-only match (e.g. "es-mx" → "es")
    const partial = LANGUAGES.find(l => l.code === pref.split("-")[0]);
    if (partial) return partial;
  }
  return null;
}

// ─── React Hook ───────────────────────────────────────────────────────────────

/**
 * useLanguage — React hook providing:
 *   - currentLang: the active language config
 *   - canonicalPath: the path without lang prefix
 *   - switchLanguage(lang): navigate to equivalent page in target language
 *   - hreflangLinks: array of { hreflang, href } for SEOHead
 */
export function useLanguage(siteDomain) {
  const location = useLocation();
  const navigate = useNavigate();

  const currentLang = getLangFromPath(location.pathname);
  const canonicalPath = stripLangPrefix(location.pathname);

  const switchLanguage = useCallback((targetLang) => {
    const newPath = buildLocalizedPath(targetLang, canonicalPath);
    navigate(newPath, { replace: false });
    // Persist preference
    try { localStorage.setItem("preferred_lang", targetLang.code); } catch {}
  }, [canonicalPath, navigate]);

  const hreflangLinks = buildHreflangLinks(canonicalPath, siteDomain || "https://coenconstruction.com");

  return { currentLang, canonicalPath, switchLanguage, hreflangLinks };
}