import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const blogPosts = await base44.asServiceRole.entities.BlogPost.filter({ published: true }, '-updated_date');

    const baseUrl = 'https://www.coenconstruction.com';
    const today = new Date().toISOString().split('T')[0];

    const REGIONS = [
      { towns: ["Cambridge", "Somerville", "Brookline", "Medford", "Revere", "Everett", "Allston", "Brighton", "Charlestown", "East Boston", "Dorchester", "South Boston", "Jamaica Plain", "Roslindale", "Hyde Park", "West Roxbury", "Roxbury"] },
      { towns: ["Lexington", "Weston", "Waltham", "Concord", "Lincoln", "Wellesley", "Newton", "Medfield", "Millis", "Dedham", "Westwood", "Dover", "Sherborn", "Holliston", "Medway", "Ashland", "Hopkinton", "Framingham", "Natick", "Wayland", "Sudbury", "Watertown"] },
      { towns: ["Plymouth", "Milton", "Easton", "Sharon", "Stoughton", "Mansfield", "Foxborough", "Norfolk", "Walpole", "Norwood", "Canton", "Braintree", "Quincy", "Weymouth", "Hanover", "Hingham", "Cohasset", "Scituate", "Norwell", "Marshfield", "Duxbury", "Pembroke", "Kingston", "Hull"] },
    ];
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
    const townUrls = allTowns.map(town => makeUrl(`${baseUrl}/service-areas/${slugify(town)}`, 'monthly', '0.80'));
    const blogUrls = blogPosts.map(post => makeUrl(`${baseUrl}/blog/${post.slug}`, 'monthly', '0.75'));

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${staticUrls.join('')}
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

    const totalUrls = staticUrls.length + townUrls.length + blogUrls.length;
    return Response.json({
      success: true,
      message: `Sitemap generated with ${totalUrls} URLs.`,
      stats: { static: staticPages.length, towns: allTowns.length, blog: blogPosts.length, total: totalUrls },
      file_url: fileUrl,
    });
  } catch (error) {
    console.error('Sitemap generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});