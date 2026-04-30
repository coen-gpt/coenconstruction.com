import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get topic from payload or pick a random one
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const topicOverride = body.topic;
    const selectedTopic = topicOverride
      ? { title: topicOverride, category: "General Contractor" }
      : TOPICS[Math.floor(Math.random() * TOPICS.length)];

    // Load custom AI prompt from settings, fallback to default
    const DEFAULT_PROMPT = `You are an experienced content writer for Coen Construction, a Greater Boston MA general contractor specializing in home additions, decks, siding, kitchen remodeling, custom carpentry, and snow removal. Write a detailed, SEO-optimized blog post about: "{topic}".

Write exactly like a knowledgeable human contractor who genuinely wants to help homeowners. The tone should be warm, conversational, and expert — not robotic or overly formal.

CRITICAL FORMATTING RULES:
- Output the content field as valid HTML only (using <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em> tags)
- Do NOT use markdown, hash symbols (#), asterisks (**), dashes for bullets, or any non-HTML formatting
- Do NOT start sections with "##" or "#" — use proper <h2> and <h3> tags instead
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
- title: A compelling, SEO-friendly title (include "Boston" or "Greater Boston" or "MA") — plain text, no HTML
- excerpt: A 1-2 sentence plain text summary (150 chars max)
- content: The full blog post body as valid HTML (using the tags described above)
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

    // Generate a hero image for the post
    const imageResult = await base44.asServiceRole.integrations.Core.GenerateImage({
      prompt: `Professional, high-quality photo of ${topic.title.toLowerCase()} in a New England / Boston-area home. Beautiful residential construction, natural lighting, realistic style. No text or logos.`
    });

    const slug = slugify(postData.title);

    // Save to database
    const blogPost = await base44.asServiceRole.entities.BlogPost.create({
      title: postData.title,
      slug,
      category: topic.category,
      excerpt: postData.excerpt,
      content: postData.content,
      img: imageResult.url,
      read_time: postData.read_time,
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