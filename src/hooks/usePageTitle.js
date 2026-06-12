import { useEffect } from "react";

const SITE_NAME = "Coen Construction";

/**
 * Sets the browser-tab title for pages that don't render SEOHead
 * (auth screens, token portals, the field crew app, backend shells).
 * Marketing pages keep using SEOHead, which also manages meta tags.
 */
export default function usePageTitle(title) {
  useEffect(() => {
    if (!title) return;
    document.title = `${title} | ${SITE_NAME}`;
  }, [title]);
}
