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

const SLUGS = [
  "finding-your-dream-deck-builders-in-hanover-ma-a-complete-guide",
  "transform-your-home-with-expert-porch-and-portico-builders",
  "your-go-to-storm-damage-repair-contractor-on-the-south-shore",
  "historic-home-restoration-in-boston-a-comprehensive-guide",
  "expert-tips-for-james-hardie-siding-installation-in-boston",
  "stoughton-snow-removal-services-ensuring-safe-and-clear-homes-this-winter",
  "finding-the-best-local-carpenters-near-you-a-guide-for-boston-homeowners",
  "transform-your-scituate-home-with-custom-additions-expert-tips-and-solutions",
  "expert-tips-for-exterior-home-trim-repair-in-boston",
  "transform-your-norwell-bathroom-expert-renovation-tips",
  "expert-porch-and-portico-building-in-greater-boston",
  "what-to-expect-when-working-with-boston-general-contractors",
  "how-to-choose-the-right-general-contractor-for-your-boston-home",
  "why-hiring-a-local-general-contractor-matters-in-boston",
  "residential-construction-projects-that-require-a-general-contractor",
  "what-general-contractors-in-boston-do-and-why-homeowners-need-them",
  "top-carpentry-projects-that-add-instant-home-value",
  "how-to-create-a-realistic-budget-for-a-kitchen-remodel",
  "a-beginners-guide-to-home-remodeling-permits-and-regulations",
  "6-must-have-skills-to-look-for-in-a-professional-carpenter",
  "room-additions-that-add-style-and-space-without-breaking-the-bank",
  "why-local-general-contractors-understand-your-needs-better",
  "vinyl-vs-fiber-cement-siding-which-is-best-for-your-home",
  "kitchen-renovation-trends-that-add-value-to-your-home",
  "how-a-professional-carpenter-can-help-you-avoid-costly-diy-mistakes",
  "what-permits-are-needed-for-boston-home-additions",
  "how-to-collaborate-with-a-carpenter-on-a-renovation",
  "common-mistakes-in-kitchen-remodeling",
  "maximizing-square-footage-with-smart-additions",
  "signs-your-home-needs-new-siding",
  "what-to-know-before-hiring-a-contractor",
  "custom-carpentry-tips-for-small-spaces",
  "the-role-of-a-general-contractor-in-large-projects",
  "kitchen-remodeling-trends-to-watch",
  "tips-for-planning-a-home-expansion",
  "choosing-the-right-materials-for-siding",
  "how-to-budget-for-your-next-renovation",
  "avoiding-pitfalls-in-kitchen-renovation-projects",
  "how-carpenters-add-value-to-remodeling-projects",
  "design-ideas-for-a-modern-kitchen-remodel",
  "when-is-the-right-time-for-a-home-addition",
  "benefits-of-hiring-a-local-siding-contractor",
  "top-qualities-to-look-for-in-a-general-contractor",
  "step-by-step-guide-to-home-kitchen-remodeling",
  "the-benefits-of-a-new-siding-from-local-siding-contractors",
  "local-general-contractors-your-guide-to-vetting",
  "planning-new-home-additions-key-considerations",
  "what-to-expect-from-a-professional-carpenter",
  "maximizing-space-with-kitchen-remodeling-pro-tips",
  "trending-home-additions-ideas-for-your-project",
  "choosing-the-right-siding-contractors-coen-construction",
  "why-experienced-general-contractors-are-crucial-for-success",
  "popular-home-additions-types-enhance-your-living-space",
  "siding-contractors-tips-the-best-siding-materials-for-you",
  "top-general-contractors-choose-coen-construction",
  "when-to-call-general-contractors-signs-you-cant-ignore",
  "home-additions-101-everything-you-need-to-know",
  "choosing-local-siding-contractors-what-to-expect",
  "transform-your-space-with-home-additions-today",
  "boosting-curb-appeal-with-the-best-siding-contractors",
  "why-you-should-work-with-top-general-contractors",
];

// Map slug to a human-readable title
function slugToTitle(slug) {
  return slug
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace(/\bMa\b/g, "MA")
    .replace(/\bBoston\b/g, "Boston")
    .replace(/\bCoen Construction\b/g, "Coen Construction");
}

// Assign a category based on slug keywords
function getCategory(slug) {
  if (slug.includes("kitchen")) return "Kitchen Remodeling";
  if (slug.includes("siding") || slug.includes("hardie") || slug.includes("fiber-cement")) return "Siding";
  if (slug.includes("deck") || slug.includes("porch") || slug.includes("pergola") || slug.includes("portico")) return "Decks & Outdoors";
  if (slug.includes("addition") || slug.includes("room-addition") || slug.includes("expansion") || slug.includes("square-footage")) return "Home Additions";
  if (slug.includes("carpenter") || slug.includes("carpentry") || slug.includes("trim")) return "Custom Carpentry";
  if (slug.includes("snow")) return "Snow Removal";
  if (slug.includes("bathroom")) return "Bathroom Remodeling";
  if (slug.includes("permit") || slug.includes("budget") || slug.includes("contractor") || slug.includes("general-contractor")) return "General Contracting";
  if (slug.includes("storm") || slug.includes("restoration") || slug.includes("historic")) return "Renovation & Restoration";
  return "Home Improvement";
}

// Generate a random date scattered over the past 13 months
function randomDate(index, total) {
  const now = new Date("2026-04-07");
  const msPerDay = 86400000;
  // Spread posts roughly evenly over 400 days, with slight jitter
  const daysBack = Math.round((index / total) * 400) + Math.floor(Math.random() * 10);
  const d = new Date(now.getTime() - daysBack * msPerDay);
  return d.toISOString().split("T")[0];
}

// Internal link map: keyword -> URL
const INTERNAL_LINKS = {
  "home additions": "/services/home-additions",
  "home addition": "/services/home-additions",
  "kitchen remodel": "/services/kitchen-remodeling",
  "kitchen remodeling": "/services/kitchen-remodeling",
  "kitchen renovation": "/services/kitchen-remodeling",
  "custom carpentry": "/services/custom-carpentry",
  "carpentry": "/services/custom-carpentry",
  "siding": "/services/siding",
  "fiber cement siding": "/services/siding",
  "vinyl siding": "/services/siding",
  "James Hardie": "/services/siding",
  "decks": "/services/decks-porches-pergolas",
  "deck": "/services/decks-porches-pergolas",
  "pergola": "/services/decks-porches-pergolas",
  "porches": "/services/decks-porches-pergolas",
  "porch": "/services/decks-porches-pergolas",
  "snow removal": "/services/snow-removal",
  "general contractor": "/services",
  "general contractors": "/services",
  "Boston": "/service-areas/boston",
  "Cambridge": "/service-areas/cambridge",
  "Newton": "/service-areas/newton",
  "Brookline": "/service-areas/brookline",
  "Somerville": "/service-areas/somerville",
  "Medford": "/service-areas/medford",
  "Quincy": "/service-areas/quincy",
  "Lexington": "/service-areas/lexington",
  "Needham": "/service-areas/needham",
  "service areas": "/service-areas",
  "Greater Boston": "/service-areas",
  "free estimate": "/contact",
  "free consultation": "/contact",
  "contact us": "/contact",
  "Coen Construction": "/",
};

function buildPrompt(slug, title, category) {
  const linkHints = Object.entries(INTERNAL_LINKS)
    .map(([kw, url]) => `- "${kw}" → <a href="${url}">${kw}</a>`)
    .join("\n");

  return `You are an expert SEO content writer for Coen Construction, a family-owned general contracting company based in Stoughton, MA serving Greater Boston since 2010. License #CS-108826. Phone: (617) 857-COEN. Services: home additions, kitchen remodeling, decks/porches/pergolas, siding (James Hardie specialist), custom carpentry, snow removal.

Write a fully SEO-optimized blog post for the following:
- Slug: ${slug}
- Title: ${title}
- Category: ${category}

Requirements:
1. Write 700–900 words of rich, helpful, engaging content.
2. Naturally mention Coen Construction as the recommended contractor throughout.
3. Hyperlink keywords using ONLY these exact anchor tags (use each link at most once, naturally embedded in sentences):
${linkHints}
4. Use proper HTML formatting: <h2>, <h3>, <p>, <ul>, <li>, <strong> tags. NO markdown.
5. Include a compelling intro paragraph and a strong closing CTA paragraph mentioning Coen Construction and linking to /contact.
6. Optimize for the primary keyword implied by the slug.
7. Write naturally — do NOT stuff keywords. Max 1–2 links per paragraph.

Return ONLY a JSON object with these exact fields:
{
  "title": "SEO-optimized H1 title (can differ slightly from slug title for better flow)",
  "excerpt": "150-160 character meta description / excerpt",
  "content": "full HTML content string",
  "read_time": "X min read"
}`;
}

Deno.serve(async (req) => {
  try {
  const body = await req.json().catch(() => ({}));
  const { base44 } = await verifyAdminSession(req, 'can_access_blog', body);
  const batchStart = body.batchStart ?? 0;
  const batchSize = body.batchSize ?? 5;
  const slugs = SLUGS.slice(batchStart, batchStart + batchSize);

  const results = [];
  const errors = [];

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const globalIndex = batchStart + i;
    const title = slugToTitle(slug);
    const category = getCategory(slug);
    const prompt = buildPrompt(slug, title, category);

    try {
      const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            excerpt: { type: "string" },
            content: { type: "string" },
            read_time: { type: "string" },
          },
          required: ["title", "excerpt", "content", "read_time"],
        },
      });

      const post = {
        slug,
        title: aiResult.title || title,
        excerpt: aiResult.excerpt || "",
        content: aiResult.content || "",
        read_time: aiResult.read_time || "5 min read",
        category,
        published: true,
        img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
        created_date: randomDate(globalIndex, SLUGS.length),
      };

      await base44.asServiceRole.entities.BlogPost.create(post);
      results.push({ slug, status: "created" });
    } catch (err) {
      errors.push({ slug, error: err.message });
    }
  }

  return Response.json({
    batchStart,
    batchSize,
    total: SLUGS.length,
    processed: batchStart + slugs.length,
    remaining: Math.max(0, SLUGS.length - batchStart - slugs.length),
    results,
    errors,
  });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});