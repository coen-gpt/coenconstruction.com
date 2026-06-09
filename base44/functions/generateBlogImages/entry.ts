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

// Builds a unique, detailed image prompt based on the post title, category, and excerpt
function buildImagePrompt(title, category, excerpt) {
  const base = "Professional architectural photography, photorealistic, natural lighting, no text, no people, no logos. New England / Greater Boston setting.";

  const categoryThemes = {
    "Kitchen Remodeling": "modern renovated kitchen interior with quartz countertops, shaker cabinets, and a bay window overlooking a Boston-area neighborhood",
    "Bathroom Remodeling": "elegantly renovated bathroom with subway tile, freestanding tub, and natural light in a historic New England colonial home",
    "Home Additions": "beautiful two-story home addition on a classic New England colonial, brick accents, dormers, surrounded by fall foliage",
    "Decks & Outdoors": "stunning composite deck with pergola attached to a New England cape-style home, autumn trees in background",
    "Siding": "freshly sided New England colonial home with James Hardie fiber cement siding, classic white trim, Boston suburbs street",
    "Custom Carpentry": "custom built-in bookshelves and millwork in a historic Boston brownstone interior, warm wood tones",
    "Snow Removal": "New England suburban home driveway professionally cleared of snow, Boston winter scene, clean and safe",
    "General Contracting": "residential construction project in a Greater Boston neighborhood, professional crew, Cape Cod style home",
    "Renovation & Restoration": "beautifully restored Victorian-era Boston home exterior, historic detail preserved, fresh paint",
    "Home Improvement": "well-maintained New England home exterior, manicured lawn, autumn colors, suburban Boston neighborhood",
  };

  const categoryScene = categoryThemes[category] || "beautifully renovated New England home, classic architecture, Boston suburbs, warm natural light";

  // Extract key topic from title for specificity
  const titleLower = title.toLowerCase();
  let topicDetail = "";

  if (titleLower.includes("deck") || titleLower.includes("porch") || titleLower.includes("pergola") || titleLower.includes("portico")) {
    topicDetail = "beautiful covered porch with classic columns, cedar decking, New England cape house backdrop";
  } else if (titleLower.includes("kitchen")) {
    topicDetail = "bright renovated New England kitchen, white shaker cabinets, farmhouse sink, hardwood floors";
  } else if (titleLower.includes("bathroom")) {
    topicDetail = "spa-like renovated bathroom, hexagonal floor tile, marble vanity, New England home";
  } else if (titleLower.includes("siding") || titleLower.includes("hardie") || titleLower.includes("fiber cement") || titleLower.includes("vinyl")) {
    topicDetail = "crisp James Hardie fiber cement siding installation on a classic Boston-area colonial home";
  } else if (titleLower.includes("addition") || titleLower.includes("room addition") || titleLower.includes("expansion")) {
    topicDetail = "seamless home addition on a New England colonial, matching roofline, new dormers, tree-lined street";
  } else if (titleLower.includes("carpenter") || titleLower.includes("carpentry") || titleLower.includes("trim") || titleLower.includes("millwork")) {
    topicDetail = "custom wood built-ins and detailed millwork in a Boston-area historic home, craftsman details";
  } else if (titleLower.includes("snow")) {
    topicDetail = "freshly plowed New England driveway, snow-covered trees, warm lights glowing from a Boston colonial";
  } else if (titleLower.includes("historic") || titleLower.includes("restoration")) {
    topicDetail = "meticulously restored historic Boston brownstone, ornate Victorian details, fresh exterior paint";
  } else if (titleLower.includes("storm") || titleLower.includes("repair")) {
    topicDetail = "home repair work on a New England house exterior, skilled workers on scaffolding, Boston suburb";
  } else if (titleLower.includes("permit") || titleLower.includes("budget") || titleLower.includes("planning")) {
    topicDetail = "architect reviewing blueprints on a construction site of a Boston-area residential home addition";
  } else if (titleLower.includes("curb appeal") || titleLower.includes("exterior") || titleLower.includes("boosting")) {
    topicDetail = "gorgeous New England home exterior with lush landscaping, shutters, and fresh paint, Boston suburb";
  } else if (titleLower.includes("contractor") || titleLower.includes("general contractor")) {
    topicDetail = "professional contractor reviewing plans in front of a large New England home renovation project";
  } else if (titleLower.includes("space") || titleLower.includes("maximizing") || titleLower.includes("small")) {
    topicDetail = "clever use of space in a compact New England home interior, built-ins, smart storage solutions";
  } else if (titleLower.includes("spring") || titleLower.includes("season")) {
    topicDetail = "New England home in spring with blooming trees, fresh exterior paint, colorful flower beds, Boston suburb";
  } else if (titleLower.includes("material") || titleLower.includes("material")) {
    topicDetail = "array of premium building materials samples for a New England home renovation project";
  } else {
    topicDetail = categoryScene;
  }

  return `${base} Scene: ${topicDetail}. Wide angle, golden hour lighting, ultra sharp detail. Title context: "${title}".`;
}

Deno.serve(async (req) => {
  try {
  const body = await req.json().catch(() => ({}));
  const { base44 } = await verifyAdminSession(req, 'can_access_blog', body);
  const batchStart = body.batchStart ?? 0;
  const batchSize = body.batchSize ?? 3;

  // Single post mode
  if (body.postId) {
    const post = await base44.asServiceRole.entities.BlogPost.get(body.postId);
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });
    const prompt = buildImagePrompt(post.title || "", post.category || "", post.excerpt || "");
    const { url } = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt });
    await base44.asServiceRole.entities.BlogPost.update(post.id, { img: url });
    return Response.json({ success: true, url });
  }

  // Fetch all posts
  const allPosts = await base44.asServiceRole.entities.BlogPost.list();
  const batch = allPosts.slice(batchStart, batchStart + batchSize);

  const results = [];
  const errors = [];

  for (const post of batch) {
    const id = post.id;
    const title = post.title || post.data?.title || "";
    const category = post.category || post.data?.category || "";
    const excerpt = post.excerpt || post.data?.excerpt || "";

    const prompt = buildImagePrompt(title, category, excerpt);

    try {
      const { url } = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt });

      await base44.asServiceRole.entities.BlogPost.update(id, { img: url });

      results.push({ id, title, status: 'updated', prompt });
    } catch (err) {
      errors.push({ id, title, error: err.message });
    }
  }

  return Response.json({
    batchStart,
    batchSize,
    total: allPosts.length,
    processed: batchStart + batch.length,
    remaining: Math.max(0, allPosts.length - batchStart - batch.length),
    results,
    errors,
  });
  } catch (error) {
    const status = error.message === 'Forbidden' ? 403 : error.message.includes('Unauthorized') || error.message.includes('expired') ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
});