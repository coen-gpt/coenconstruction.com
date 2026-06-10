import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
}

async function verifySignature(data, signature, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), new TextEncoder().encode(data));
}

async function verifyBlogAdmin(req, body, base44) {
  const auth = req.headers.get('authorization') || '';
  const token = String(body.admin_session_token || req.headers.get('x-admin-session-token') || auth.replace(/^Bearer\s+/i, '') || '').trim();
  if (!token) return { error: 'Unauthorized', status: 401 };

  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) return { error: 'Unauthorized', status: 401 };

  const secret = Deno.env.get('ADMIN_SESSION_SECRET');
  if (!secret || !(await verifySignature(`${header}.${payload}`, signature, secret).catch(() => false))) {
    return { error: 'Unauthorized', status: 401 };
  }

  const session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  if (Number(session.exp || 0) < Math.floor(Date.now() / 1000)) return { error: 'Session expired', status: 401 };

  const users = await base44.asServiceRole.entities.AdminUser.filter({ email: String(session.email || '').toLowerCase() });
  const user = users[0];
  if (!user || user.active === false) return { error: 'Forbidden', status: 403 };
  if (user.role !== 'admin' && !user.can_access_blog) return { error: 'Forbidden', status: 403 };
  return { user };
}

const TOPICS = [
  { title: "Home Additions", category: "Home Additions" },
  { title: "Decks, Porches & Pergolas", category: "Decks & Outdoors" },
  { title: "Siding", category: "Siding" },
  { title: "Kitchen Remodeling", category: "Kitchen & Bath" },
  { title: "Bathroom Remodeling", category: "Kitchen & Bath" },
  { title: "Custom Carpentry", category: "Custom Carpentry" },
  { title: "Snow Removal", category: "Snow Removal" },
  { title: "Full Home Renovation", category: "Home Renovation" },
  { title: "Outdoor Living Spaces", category: "Decks & Outdoors" },
  { title: "Windows & Doors", category: "Home Improvement" },
];

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ── Output sanitizer ─────────────────────────────────────────────────────────
// The LLM occasionally ignores formatting instructions and returns markdown or
// plain text. Normalize everything to clean HTML before it is stored, so the
// public always sees a polished, properly formatted article.

function decodeUnicodeEscapes(text) {
  return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function inlineFormat(text) {
  return text
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '$1');
}

function markdownToHtml(text) {
  const lines = text.split('\n');
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${inlineFormat(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(`<${list.type}>${list.items.map((i) => `<li>${i}</li>`).join('')}</${list.type}>`);
      list = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { flushParagraph(); flushList(); continue; }
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph(); flushList();
      const level = Math.min(Math.max(heading[1].length, 2), 3);
      blocks.push(`<h${level}>${inlineFormat(heading[2].replace(/#+\s*$/, '').trim())}</h${level}>`);
      continue;
    }
    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
      list.items.push(inlineFormat(bullet[1]));
      continue;
    }
    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
      list.items.push(inlineFormat(numbered[1]));
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  return blocks.join('\n');
}

function sanitizeBlogHtml(raw) {
  if (!raw) return '';
  const text = decodeUnicodeEscapes(String(raw)).replace(/\r\n/g, '\n');
  const looksLikeHtml = /<\s*(p|h[1-6]|ul|ol|li|div|br|blockquote)\b/i.test(text);
  if (looksLikeHtml) {
    return text
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\n)#{1,6}\s+/g, '$1')
      .replace(/<p>\s*<\/p>/g, '');
  }
  return markdownToHtml(text);
}

function sanitizePlainText(raw) {
  if (!raw) return '';
  return decodeUnicodeEscapes(String(raw))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*|__|##+|`/g, '')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const auth = await verifyBlogAdmin(req, body, base44);
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

    // Get topic from payload or pick a random one
    const topicOverride = body.topic;
    const selectedTopic = topicOverride
      ? { title: topicOverride, category: "General Contractor" }
      : TOPICS[Math.floor(Math.random() * TOPICS.length)];

    // Load custom AI prompt from settings, fallback to default
    const DEFAULT_PROMPT = `You are an experienced content writer for Coen Construction, a family-owned Greater Boston MA general contractor (based in Stoughton, serving the area since 2010) specializing in home additions, decks, siding, kitchen remodeling, custom carpentry, and snow removal. Write a complete, publish-ready, SEO-optimized blog post about: "{topic}".

Write exactly like a knowledgeable human contractor who genuinely wants to help homeowners. The tone should be warm, conversational, and expert — not robotic or overly formal. The article must be COMPLETE and polished: no placeholders, no notes to the editor, no unfinished sections, no filler.

CRITICAL FORMATTING RULES — follow these exactly:
- Output the content field as valid, clean HTML using ONLY these tags: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <a>
- NEVER use markdown of any kind: no # headings, no ** or * emphasis, no - or * bullet lines, no [text](url) links, no backticks, no pipes, no tables
- NEVER use emojis, decorative symbols, or unusual special characters. Use plain English punctuation only. Special characters are allowed only where the topic genuinely requires them (for example $ in prices or % in percentages)
- Paragraphs must be wrapped in <p> tags
- Lists must use <ul><li> or <ol><li>
- Section headings must use <h2> or <h3> tags

HYPERLINK RULES — this is important:
- Throughout the post, naturally hyperlink relevant keywords using <a href="URL"> tags as follows:
  - "home addition" or "home additions" → <a href="/services/home-additions">home addition</a>
  - "kitchen remodel" or "kitchen remodeling" → <a href="/services/kitchen-remodeling">kitchen remodeling</a>
  - "bathroom remodel" or "bathroom remodeling" → <a href="/services/bathroom-remodeling">bathroom remodeling</a>
  - "custom carpentry" → <a href="/services/custom-carpentry">custom carpentry</a>
  - "snow removal" → <a href="/services/snow-removal">snow removal</a>
  - "siding" or "siding installation" → <a href="/services/siding">siding</a>
  - "deck" or "deck construction" or "decks" → <a href="/services/decks-porches-pergolas">deck</a>
  - "pergola" or "porch" → <a href="/services/decks-porches-pergolas">pergola</a>
  - "free design preview" → <a href="/start">free design preview</a>
  - "free estimate" or "free quote" → <a href="/contact">free estimate</a>
  - "contact us" or "reach out" (only once at the end) → <a href="/contact">contact us</a>
- Use each hyperlink naturally — do not force them. 3-6 hyperlinks total is ideal.

CONTENT RULES:
- Target Greater Boston homeowners
- Be 600-900 words
- Include practical tips, Boston-area costs/pricing context, and local seasonal considerations
- End with a compelling call to action paragraph (not a heading) encouraging readers to get a free estimate or try the free design preview

Return JSON with these fields:
- title: A compelling, SEO-friendly title (include "Boston" or "Greater Boston" or "MA") — plain text only, no HTML, no markdown, no surrounding quotes
- excerpt: A 1-2 sentence plain text summary (150 chars max) — no HTML or markdown
- content: The full blog post body as valid, clean HTML (using ONLY the tags described above)
- read_time: Estimated read time (e.g. "6 min read")`;

    const settingsRecords = await base44.asServiceRole.entities.AppSettings.filter({ key: "blog_ai_prompt" });
    const customPrompt = settingsRecords[0]?.value;
    const promptTemplate = customPrompt || DEFAULT_PROMPT;
    const prompt = promptTemplate.replace("{topic}", selectedTopic.title);
    const topic = selectedTopic;

    // Generate the blog post content
    const postData = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          excerpt: { type: "string" },
          content: { type: "string" },
          read_time: { type: "string" }
        }
      }
    });

    // Normalize the AI output to clean HTML / plain text regardless of how
    // well the model followed the formatting instructions
    const cleanTitle = sanitizePlainText(postData.title);
    const cleanExcerpt = sanitizePlainText(postData.excerpt);
    const cleanContent = sanitizeBlogHtml(postData.content);
    if (!cleanTitle || cleanContent.length < 500) {
      return Response.json({ error: "AI returned an incomplete post — please try again." }, { status: 502 });
    }

    // Generate a hero image for the post
    const imageResult = await base44.asServiceRole.integrations.Core.GenerateImage({
      prompt: `Professional, high-quality photo of ${topic.title.toLowerCase()} in a New England / Boston-area home. Beautiful residential construction, natural lighting, realistic style. No text or logos.`
    });

    const slug = slugify(cleanTitle);

    // Save to database
    const blogPost = await base44.asServiceRole.entities.BlogPost.create({
      title: cleanTitle,
      slug,
      category: topic.category,
      excerpt: cleanExcerpt,
      content: cleanContent,
      img: imageResult.url,
      read_time: sanitizePlainText(postData.read_time) || "5 min read",
      published: true,
    });

    return Response.json({
      success: true,
      post: blogPost,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});