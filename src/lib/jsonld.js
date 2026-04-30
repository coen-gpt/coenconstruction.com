/**
 * lib/jsonld.js — JSON-LD injection helpers
 *
 * Usage (in a page component):
 *
 *   import { injectSchemas, schemaScript } from "@/lib/jsonld";
 *   import { organizationSchema, webSiteSchema, breadcrumbFromPath } from "@/lib/schema";
 *   import { Helmet } from "react-helmet";
 *
 *   // Option A — inline in Helmet (preferred with SEOHead):
 *   <SEOHead structuredData={injectSchemas(organizationSchema(), webSiteSchema())} />
 *
 *   // Option B — render <script> tags directly inside <Helmet>:
 *   <Helmet>
 *     {schemaScripts(organizationSchema(), webSiteSchema()).map((s, i) => (
 *       <script key={i} type="application/ld+json">{s}</script>
 *     ))}
 *   </Helmet>
 */

/**
 * Combine one or more schema objects into a single array for use with
 * SEOHead's `structuredData` prop. Filters out falsy values so you can safely
 * pass conditional schemas.
 *
 * @param  {...object|null|undefined} schemas
 * @returns {object[]}
 */
export function injectSchemas(...schemas) {
  return schemas.filter(Boolean);
}

/**
 * Serialise one or more schema objects to JSON strings for direct <script>
 * tag injection. Useful when you're managing Helmet yourself.
 *
 * @param  {...object} schemas
 * @returns {string[]}
 */
export function schemaScripts(...schemas) {
  return schemas.filter(Boolean).map(s => JSON.stringify(s));
}