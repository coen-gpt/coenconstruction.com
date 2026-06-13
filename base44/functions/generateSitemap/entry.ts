import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyAdminSession(req, permission, parsedBody) {
  const base44 = createClientFromRequest(req);
  const body = parsedBody || await req.clone().json().catch(() => ({}));
  const auth = req.headers.get('authorization') || '';
  const token = String(body.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
  if (!token) throw new Error('Unauthorized');
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) throw new Error('Unauthorized');
  const secret = Deno.env.get('ADMIN_SESSION_SECRET');
  if (!secret || !(await verifySignature(`${header}.${payload}`, signature, secret).catch(() => false))) throw new Error('Unauthorized');
  const session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  if (Number(session.exp || 0) < Math.floor(Date.now() / 1000)) throw new Error('Session expired');
  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: String(session.email || '').toLowerCase() });
  const user = users[0];
  if (!user || user.active === false) throw new Error('Forbidden');
  if (permission && user.role !== 'admin' && !user[permission]) throw new Error('Forbidden');
  return { base44, user };
}

Deno.serve(async (req) => {
  try {
    const { base44, user } = await verifyAdminSession(req, 'can_access_seo');

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const blogPosts = await base44.asServiceRole.entities.BlogPost.filter({ published: true }, '-updated_date');

    const baseUrl = 'https://coenconstruction.com';
    const today = new Date().toISOString().split('T')[0];

    // NOTE: kept in sync with the canonical list in src/data/townData.js (REGIONS).
    // This Deno function can't import the React src/ bundle, so the list is mirrored
    // here — update both together when the service area changes.
    const REGIONS = [
      { slug: "greater-boston", towns: ["Cambridge", "Somerville", "Brookline", "Medford", "Revere", "Everett", "Allston", "Brighton", "Charlestown", "East Boston", "Dorchester", "South Boston", "Jamaica Plain", "Roslindale", "Hyde Park", "West Roxbury", "Roxbury", "North End", "South End", "Back Bay", "Beacon Hill", "Arlington", "Belmont", "Malden", "Chelsea", "Winthrop", "Saugus", "Woburn"] },
      { slug: "metro-west", towns: ["Lexington", "Weston", "Waltham", "Concord", "Lincoln", "Wellesley", "Newton", "Medfield", "Millis", "Dedham", "Westwood", "Dover", "Sherborn", "Holliston", "Medway", "Ashland", "Hopkinton", "Framingham", "Natick", "Wayland", "Sudbury", "Watertown", "Needham", "Bedford", "Burlington", "Maynard", "Hudson", "Southborough", "Milford", "Upton", "Franklin", "Bellingham"] },
      { slug: "south-shore", towns: ["Plymouth", "Milton", "Easton", "Sharon", "Stoughton", "Mansfield", "Foxborough", "Norfolk", "Walpole", "Norwood", "Canton", "Braintree", "Quincy", "Weymouth", "Hanover", "Hingham", "Cohasset", "Scituate", "Norwell", "Marshfield", "Duxbury", "Pembroke", "Kingston", "Hull", "Brockton", "Randolph", "Holbrook", "Rockland", "Carver", "Plympton", "Halifax", "Norton", "Attleboro", "Plainville"] },
    ];
    const COUNTIES = ["middlesex", "norfolk", "plymouth", "suffolk", "bristol"];
    const allTowns = REGIONS.flatMap(r => r.towns);
    const slugify = (name) => name.toLowerCase().replace(/\s+/g, '-');

    const staticPages = [
      { path: '/',                                  priority: '1.0', changefreq: 'weekly'  },
      { path: '/contact',                           priority: '0.95', changefreq: 'monthly' },
      { path: '/services',                          priority: '0.90', changefreq: 'weekly'  },
      { path: '/service-areas',                     priority: '0.90', changefreq: 'monthly' },
      { path: '/about',                             priority: '0.85', changefreq: 'monthly' },
      { path: '/blog',                              priority: '0.85', changefreq: 'daily'   },
      { path: '/gallery',                           priority: '0.80', changefreq: 'monthly' },
      { path: '/services/home-additions',           priority: '0.85', changefreq: 'monthly' },
      { path: '/services/decks-porches-pergolas',   priority: '0.85', changefreq: 'monthly' },
      { path: '/services/kitchen-remodeling',       priority: '0.85', changefreq: 'monthly' },
      { path: '/services/bathroom-remodeling',      priority: '0.85', changefreq: 'monthly' },
      { path: '/services/siding',                   priority: '0.80', changefreq: 'monthly' },
      { path: '/services/custom-carpentry',         priority: '0.80', changefreq: 'monthly' },
      { path: '/services/snow-removal',             priority: '0.75', changefreq: 'monthly' },
      { path: '/financing',                         priority: '0.70', changefreq: 'monthly' },
      { path: '/budget-estimator',                  priority: '0.65', changefreq: 'monthly' },
      { path: '/privacy-policy',                    priority: '0.20', changefreq: 'yearly'  },
    ];

    const makeUrl = (loc, changefreq, priority) => `
  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;

    const staticUrls = staticPages.map(p => makeUrl(`${baseUrl}${p.path}`, p.changefreq, p.priority));
    // Region + county hub pages (real, content-rich landing pages that were missing from the sitemap)
    const regionUrls = REGIONS.map(r => makeUrl(`${baseUrl}/service-areas/${r.slug}`, 'monthly', '0.85'));
    const countyUrls = COUNTIES.map(c => makeUrl(`${baseUrl}/service-areas/county/${c}`, 'monthly', '0.82'));
    const townUrls = allTowns.map(town => makeUrl(`${baseUrl}/service-areas/${slugify(town)}`, 'monthly', '0.78'));
    const blogUrls = blogPosts.map(post => makeUrl(`${baseUrl}/blog/${post.slug}`, 'monthly', '0.75'));
    // NOTE: /service-areas/{town}/{service} cells are intentionally NOT emitted yet — they are
    // templated (programmatic) pages. Emit them only after a de-thinning + indexation audit so
    // we don't flood the sitemap with near-duplicate URLs.

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${staticUrls.join('')}
${regionUrls.join('')}
${countyUrls.join('')}
${townUrls.join('')}
${blogUrls.join('')}
</urlset>`;

    // Upload sitemap as a file (too large for entity field)
    const sitemapFile = new File([sitemap], 'sitemap.xml', { type: 'application/xml' });
    const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: sitemapFile });
    const fileUrl = uploadRes.file_url;

    // Store just the URL in AppSettings
    const existing = await base44.asServiceRole.entities.AppSettings.filter({ key: 'sitemap_xml_url' });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.AppSettings.update(existing[0].id, { value: fileUrl });
    } else {
      await base44.asServiceRole.entities.AppSettings.create({ key: 'sitemap_xml_url', value: fileUrl });
    }

    const totalUrls = staticUrls.length + regionUrls.length + countyUrls.length + townUrls.length + blogUrls.length;
    return Response.json({
      success: true,
      message: `Sitemap generated with ${totalUrls} URLs.`,
      stats: { static: staticPages.length, regions: regionUrls.length, counties: countyUrls.length, towns: allTowns.length, blog: blogPosts.length, total: totalUrls },
      file_url: fileUrl,
    });
  } catch (error) {
    console.error('Sitemap generation error:', error);
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});