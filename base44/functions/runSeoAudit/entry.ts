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

const AUDIT_PAGES = [
  { label: "Home", path: "/", title: "Coen Construction | Boston MA General Contractor | Home Additions, Decks, Remodeling", desc: "Coen Construction is Greater Boston's trusted general contractor specializing in home additions, decks, siding, kitchen remodeling, and custom carpentry." },
  { label: "Services", path: "/services", title: "Construction Services | Coen Construction Boston MA", desc: "Explore all construction and remodeling services from Coen Construction serving Greater Boston." },
  { label: "Services: Home Additions", path: "/services/home-additions", title: "Home Additions Boston MA | Coen Construction", desc: "Expert home addition contractor in Boston MA. Room additions, second story additions, garage conversions. Free estimates." },
  { label: "Services: Decks, Porches & Pergolas", path: "/services/decks-porches-pergolas", title: "Deck & Pergola Builder Boston MA | Coen Construction", desc: "Custom decks, porches, and pergolas built for New England weather. Greater Boston's top deck contractor." },
  { label: "Services: Siding", path: "/services/siding", title: "Siding Contractor Boston MA | Coen Construction", desc: "James Hardie fiber cement and vinyl siding installation in Greater Boston. Licensed, insured, expert craftsmanship." },
  { label: "Services: Kitchen Remodel", path: "/services/kitchen-remodeling", title: "Kitchen Remodeling Boston MA | Coen Construction", desc: "Full kitchen remodels in Greater Boston. Custom cabinets, countertops, flooring. Free estimates from Coen Construction." },
  { label: "Services: Custom Cabinetry", path: "/services/custom-carpentry", title: "Custom Cabinetry & Carpentry Boston MA | Coen Construction", desc: "Handcrafted custom cabinetry, built-ins, and finish carpentry in Greater Boston. Expert craftsmanship by Coen Construction." },
  { label: "Services: Snow Removal", path: "/services/snow-removal", title: "Snow Removal Services Boston MA | Coen Construction", desc: "Reliable residential and commercial snow removal in Greater Boston and South Shore. Seasonal contracts available." },
  { label: "About", path: "/about", title: "About Coen Construction | Family-Owned Boston Contractor Since 2010", desc: "Learn about Coen Construction — a family-owned Greater Boston general contractor with 15+ years of experience." },
  { label: "Our Work", path: "/gallery", title: "Our Work | Project Gallery | Coen Construction Boston MA", desc: "Browse Coen Construction's portfolio of home additions, decks, siding, and remodeling projects across Greater Boston." },
  { label: "Contact", path: "/contact", title: "Contact Coen Construction | Free Estimates Boston MA", desc: "Get a free estimate from Coen Construction. Call (617) 857-2636 or fill out our online form. Serving Greater Boston since 2010." },
  { label: "Service Areas", path: "/service-areas", title: "Service Areas | Coen Construction Greater Boston MA", desc: "Coen Construction serves 65+ communities across Greater Boston, Metro West, and the South Shore." },
  { label: "Estimator", path: "/budget-estimator", title: "Free Project Cost Estimator | Coen Construction Boston MA", desc: "Get an instant estimate for your home addition, deck, kitchen remodel, or siding project in Greater Boston." },
  { label: "Design Preview", path: "/start", title: "AI Design Preview | Visualize Your Home Renovation | Coen Construction", desc: "See your home renovation before construction starts. AI-powered design previews for additions, decks, and remodels." },
  { label: "Financing", path: "/financing", title: "Financing Options | Coen Construction Boston MA", desc: "Flexible financing options for home improvements and remodeling projects in Greater Boston." },
  { label: "Blog", path: "/blog", title: "Construction & Remodeling Blog | Coen Construction Boston", desc: "Expert tips, cost guides, and renovation ideas from Coen Construction." },
];

// All service area towns and their slugs
const SERVICE_AREAS = {
  "Greater Boston": ["Cambridge","Somerville","Brookline","Medford","Revere","Everett","Allston","Brighton","Charlestown","East Boston","Dorchester","South Boston","Jamaica Plain","Roslindale","Hyde Park","West Roxbury","Roxbury"],
  "Metro West": ["Lexington","Weston","Waltham","Concord","Lincoln","Wellesley","Newton","Medfield","Millis","Dedham","Westwood","Dover","Sherborn","Holliston","Medway","Ashland","Hopkinton","Framingham","Natick","Wayland","Sudbury","Watertown"],
  "South Shore": ["Plymouth","Milton","Easton","Sharon","Stoughton","Mansfield","Foxborough","Norfolk","Walpole","Norwood","Canton","Braintree","Quincy","Weymouth","Hanover","Hingham","Cohasset","Scituate","Norwell","Marshfield","Duxbury","Pembroke","Kingston","Hull"]
};

const ALL_TOWNS = Object.values(SERVICE_AREAS).flat();

const INTERNAL_PAGES = {
  services: {
    "Home Additions": "/services/home-additions",
    "Decks & Pergolas": "/services/decks-porches-pergolas",
    "Siding": "/services/siding",
    "Kitchen Remodeling": "/services/kitchen-remodeling",
    "Custom Carpentry": "/services/custom-carpentry",
    "Snow Removal": "/services/snow-removal",
  },
  areas: ALL_TOWNS.reduce((acc, t) => {
    acc[t] = `/service-areas/${t.toLowerCase().replace(/\s+/g, '-')}`;
    return acc;
  }, {}),
};

Deno.serve(async (req) => {
  try {
    const { base44, user } = await verifyAdminSession(req, 'can_access_seo');
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    if (body.list_pages) {
      return Response.json({ pages: AUDIT_PAGES.map(p => p.label) });
    }

    const pageName = body.page;
    if (!pageName) return Response.json({ error: 'page is required' }, { status: 400 });

    const pageConfig = AUDIT_PAGES.find(p => p.label === pageName);
    if (!pageConfig) return Response.json({ error: `Unknown page "${pageName}"` }, { status: 400 });

    // Fetch live page content
    let livePageContent = '';
    try {
      const pageUrl = `https://www.coenconstruction.com${pageConfig.path}`;
      const htmlRes = await fetch(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      const html = await htmlRes.text();
      livePageContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/\s{2,}/g, ' ').trim().slice(0, 8000);
      console.log('Live page fetched, length:', livePageContent.length);
    } catch (e) {
      console.warn('Could not fetch live page:', e.message);
    }

    const serviceAreaList = Object.entries(SERVICE_AREAS)
      .map(([region, towns]) => `${region}: ${towns.join(', ')}`)
      .join('\n');

    const servicePageMap = Object.entries(INTERNAL_PAGES.services)
      .map(([s, u]) => `  - ${s} → https://www.coenconstruction.com${u}`)
      .join('\n');

    const areaPageMap = ALL_TOWNS.slice(0, 30)
      .map(t => `  - ${t} → https://www.coenconstruction.com/service-areas/${t.toLowerCase().replace(/\s+/g, '-')}`)
      .join('\n') + `\n  ... and ${ALL_TOWNS.length - 30} more towns`;

    const prompt = `You are a world-class Google SEO strategist, Google Business Profile (GBP) expert, and lead generation specialist for LOCAL service businesses. Your ONLY goal is to rank Coen Construction #1 on Google for contractor searches in Greater Boston and generate phone calls and form submissions from homeowners.

BUSINESS: Coen Construction
WEBSITE: https://www.coenconstruction.com
ADDRESS: 387 Page Street Ste 10B, Stoughton, MA 02072
PHONE: (617) 857-2636
LICENSE: MA Contractor Reg. #CS-107247
FOUNDED: 2010 (family-owned)
SERVICES: Home Additions, Decks/Porches/Pergolas, Siding (James Hardie specialist), Kitchen Remodeling, Custom Carpentry, Snow Removal

SERVICE AREAS — 65+ Communities:
${serviceAreaList}

INTERNAL SERVICE PAGES:
${servicePageMap}

INTERNAL SERVICE AREA PAGES:
${areaPageMap}

PAGE BEING AUDITED: ${pageConfig.label}
URL: https://www.coenconstruction.com${pageConfig.path}
Current Title: ${pageConfig.title}
Current Meta Description: ${pageConfig.desc}
${livePageContent ? `\nLIVE PAGE CONTENT:\n---\n${livePageContent}\n---\nCRITICAL: You have the live page content above. Do NOT suggest adding anything that is clearly already present on the page. Only flag genuinely missing items.` : ''}

YOUR TASK: Audit this page from a Google Local SEO + lead generation perspective. Think about:
1. How does Google rank local contractor pages? (E-E-A-T, NAP consistency, local signals, reviews schema)
2. What schema markup is missing? (LocalBusiness, Service, ServiceArea, FAQPage, BreadcrumbList)
3. What internal links to service area pages and service pages are missing or weak?
4. What hyperlinked keywords would boost both rankings AND lead generation?
5. Are all relevant service area towns being referenced/linked?

Return ONLY valid JSON (no markdown, no explanation):
{
  "overall_score": <0-100>,
  "local_score": <0-100>,
  "trust_score": <0-100>,
  "lead_gen_score": <0-100>,
  "suggested_title": "<optimized title under 60 chars with primary keyword + location>",
  "suggested_description": "<155 chars max, includes primary keyword, location, benefit, and CTA like 'Free Estimate'>",
  "keywords": ["<8-12 specific long-tail local keywords homeowners actually search>"],
  "issues": ["<3-5 critical SEO issues that are actually missing from the live page — be specific>"],
  "recommendations": ["<5 high-impact Google ranking improvements for this specific page>"],
  "local_seo_tips": ["<4 Google Business Profile / local pack / NAP tips specific to this page>"],
  "lead_gen_tips": ["<4 conversion rate tips — phone number placement, CTA copy, trust signals, urgency>"],
  "cro_suggestions": ["<3 specific CRO improvements to turn visitors into leads>"],
  "backlink_opportunities": ["<3 specific local backlink sources: town blogs, HOA sites, local news, Chamber of Commerce, etc.>"],
  "internal_link_suggestions": ["<4 specific internal linking recommendations — which text should link to which page URL>"],
  "schema_markup_suggestions": ["<list the schema types needed: LocalBusiness, Service, FAQPage, BreadcrumbList, ServiceArea>"],
  "hyperlinked_keywords": [
    {
      "anchor_text": "<exact keyword phrase to hyperlink, e.g. 'home additions in Newton MA'>",
      "url": "<internal URL like /services/home-additions or /service-areas/newton>",
      "context": "<one sentence explaining where on the page this link should appear and why>",
      "keyword_type": "<service|location|service_area|brand>"
    }
  ],
  "schema_json": "<complete JSON-LD schema string for this page — must include LocalBusiness with address/phone/geo/areaServed (list all 65 towns), plus page-specific types: Service schema for service pages, FAQPage schema using actual page FAQs if applicable, BreadcrumbList for all pages. Format as a single JSON-LD <script> tag content. Use real business data: name=Coen Construction, address=387 Page Street Ste 10B Stoughton MA 02072, phone=(617)857-2636, geo lat=42.0745 lng=-71.1054>"
}

For hyperlinked_keywords: generate 6-10 entries covering a mix of service keywords (linking to service pages) and location keywords (linking to service area town pages). Prioritize towns in ${pageConfig.label.includes('Service') ? 'the relevant service area' : 'all three regions'}.

For schema_json: generate complete, valid JSON-LD. The LocalBusiness areaServed should list all ${ALL_TOWNS.length} service area towns as an array of City objects. For service pages include a Service schema. For pages with FAQs visible in the content, include FAQPage schema. Always include BreadcrumbList.`;

    const rawRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'claude_sonnet_4_6',
      prompt,
    });

    let res;
    if (typeof rawRes === 'string') {
      const jsonMatch = rawRes.match(/\{[\s\S]*\}/);
      res = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } else {
      res = rawRes;
    }

    console.log('SEO audit scores:', res.overall_score, res.local_score, res.trust_score, res.lead_gen_score);
    console.log('Hyperlinked keywords count:', res.hyperlinked_keywords?.length || 0);
    console.log('Schema JSON length:', res.schema_json?.length || 0);

    const record = await base44.asServiceRole.entities.SeoAudit.create({
      page: pageConfig.label,
      page_path: pageConfig.path,
      current_title: pageConfig.title,
      current_description: pageConfig.desc,
      suggested_title: res.suggested_title,
      suggested_description: res.suggested_description,
      keywords: res.keywords || [],
      issues: res.issues || [],
      recommendations: res.recommendations || [],
      local_seo_tips: res.local_seo_tips || [],
      lead_gen_tips: res.lead_gen_tips || [],
      cro_suggestions: res.cro_suggestions || [],
      backlink_opportunities: res.backlink_opportunities || [],
      internal_link_suggestions: res.internal_link_suggestions || [],
      schema_markup_suggestions: res.schema_markup_suggestions || [],
      hyperlinked_keywords: res.hyperlinked_keywords || [],
      schema_json: res.schema_json || '',
      score: res.overall_score ?? 0,
      local_score: res.local_score ?? 0,
      trust_score: res.trust_score ?? 0,
      lead_gen_score: res.lead_gen_score ?? 0,
      status: 'analyzed',
      applied_version: 0,
      revert_history: [],
    });

    return Response.json({ success: true, page: pageConfig.label, id: record.id, score: res.overall_score });
  } catch (error) {
    console.error('SEO Audit error:', error);
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});