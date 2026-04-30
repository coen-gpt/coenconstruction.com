import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DOMAIN = "https://www.coenconstruction.com";
const TODAY = new Date().toISOString().split("T")[0];

// Cache: store generated XML + expiry timestamp
let cachedXml = null;
let cacheExpiry = 0;

// ─── Static pages ─────────────────────────────────────────────────────────────
const STATIC_URLS = [
  { path: "/",                            changefreq: "daily",   priority: "1.0" },
  { path: "/about",                       changefreq: "monthly", priority: "0.8" },
  { path: "/contact",                     changefreq: "monthly", priority: "0.8" },
  { path: "/gallery",                     changefreq: "weekly",  priority: "0.8" },
  { path: "/blog",                        changefreq: "daily",   priority: "0.8" },
  { path: "/financing",                   changefreq: "monthly", priority: "0.7" },
  { path: "/start",                       changefreq: "monthly", priority: "0.8" },
  { path: "/services",                    changefreq: "weekly",  priority: "0.9" },
  { path: "/services/home-additions",     changefreq: "weekly",  priority: "0.8" },
  { path: "/services/kitchen-remodeling", changefreq: "weekly",  priority: "0.8" },
  { path: "/services/bathroom-remodeling",changefreq: "weekly",  priority: "0.8" },
  { path: "/services/decks-porches-pergolas", changefreq: "weekly", priority: "0.8" },
  { path: "/services/siding",             changefreq: "weekly",  priority: "0.8" },
  { path: "/services/custom-carpentry",   changefreq: "weekly",  priority: "0.8" },
  { path: "/services/snow-removal",       changefreq: "weekly",  priority: "0.7" },
  { path: "/service-areas",              changefreq: "weekly",  priority: "0.9" },
  { path: "/service-areas/greater-boston",changefreq: "weekly",  priority: "0.8" },
  { path: "/service-areas/metro-west",    changefreq: "weekly",  priority: "0.8" },
  { path: "/service-areas/south-shore",   changefreq: "weekly",  priority: "0.8" },
  // Greater Boston towns
  ...["cambridge","somerville","brookline","medford","revere","everett",
      "allston","brighton","charlestown","east-boston","dorchester",
      "south-boston","jamaica-plain","roslindale","hyde-park","west-roxbury","roxbury"
  ].map(t => ({ path: `/service-areas/${t}`, changefreq: "monthly", priority: "0.7" })),
  // Metro West towns
  ...["lexington","weston","waltham","concord","lincoln","wellesley","newton",
      "medfield","millis","dedham","westwood","dover","sherborn","holliston",
      "medway","ashland","hopkinton","framingham","natick","wayland","sudbury","watertown"
  ].map(t => ({ path: `/service-areas/${t}`, changefreq: "monthly", priority: "0.7" })),
  // South Shore towns
  ...["plymouth","milton","easton","sharon","stoughton","mansfield","foxborough",
      "norfolk","walpole","norwood","canton","braintree","quincy","weymouth",
      "hanover","hingham","cohasset","scituate","norwell","marshfield",
      "duxbury","pembroke","kingston","hull"
  ].map(t => ({ path: `/service-areas/${t}`, changefreq: "monthly", priority: "0.7" })),
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
];

function urlTag({ loc, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function toLastmod(dateStr) {
  if (!dateStr) return TODAY;
  return new Date(dateStr).toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  // Return cache if still valid
  const now = Date.now();
  if (cachedXml && now < cacheExpiry) {
    return new Response(cachedXml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "X-Cache": "HIT",
      },
    });
  }

  const base44 = createClientFromRequest(req);

  // ─── Fetch dynamic entities in parallel ───────────────────────────────────
  const [blogPosts] = await Promise.all([
    base44.asServiceRole.entities.BlogPost.filter({ published: true }, "-updated_date", 999),
  ]);

  // ─── Build URL entries ─────────────────────────────────────────────────────
  const staticEntries = STATIC_URLS.map(({ path, changefreq, priority }) =>
    urlTag({ loc: `${DOMAIN}${path}`, lastmod: TODAY, changefreq, priority })
  );

  const blogEntries = (blogPosts || [])
    .filter(p => p.slug)
    .map(p => urlTag({
      loc: `${DOMAIN}/blog/${p.slug}`,
      lastmod: toLastmod(p.updated_date || p.created_date),
      changefreq: "weekly",
      priority: "0.6",
    }));

  // ─── Assemble XML ──────────────────────────────────────────────────────────
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">

  <!-- Static pages: ${staticEntries.length} -->
${staticEntries.join("\n")}

  <!-- Blog posts: ${blogEntries.length} -->
${blogEntries.join("\n")}

</urlset>`;

  // Store in cache for 1 hour
  cachedXml = xml;
  cacheExpiry = now + 60 * 60 * 1000;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Cache": "MISS",
    },
  });
});