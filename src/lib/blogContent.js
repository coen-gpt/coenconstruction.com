/**
 * Blog content normalizer.
 *
 * Posts in the BlogPost entity come from several generations of AI prompts:
 * some are clean HTML, others are raw markdown or plain text with artifacts
 * (### headings, **bold**, [text](url) links, literal – escapes). These
 * helpers turn any of those into clean, publishable HTML so the public always
 * sees a properly formatted article.
 */

function decodeUnicodeEscapes(text) {
  return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Inline markdown → HTML within a single line of text.
function inlineFormat(text) {
  return text
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "$1");
}

function markdownToHtml(text) {
  const lines = text.split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null; // { type: "ul" | "ol", items: [] }

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${inlineFormat(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(`<${list.type}>${list.items.map((i) => `<li>${i}</li>`).join("")}</${list.type}>`);
      list = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      // h1 is reserved for the page title; clamp markdown headings to h2/h3
      const level = Math.min(Math.max(heading[1].length, 2), 3);
      blocks.push(`<h${level}>${inlineFormat(heading[2].replace(/#+\s*$/, "").trim())}</h${level}>`);
      continue;
    }
    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(inlineFormat(bullet[1]));
      continue;
    }
    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(inlineFormat(numbered[1]));
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  return blocks.join("\n");
}

/** Normalize stored blog content (HTML, markdown, or plain text) to clean HTML. */
export function formatBlogContent(raw) {
  if (!raw) return "";
  let text = decodeUnicodeEscapes(String(raw)).replace(/\r\n/g, "\n");

  const looksLikeHtml = /<\s*(p|h[1-6]|ul|ol|li|div|br|blockquote)\b/i.test(text);
  if (looksLikeHtml) {
    // Mostly HTML already — just scrub stray markdown the AI left inside it.
    return text
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|\n)#{1,6}\s+/g, "$1")
      .replace(/<p>\s*<\/p>/g, "");
  }
  return markdownToHtml(text);
}

/** Plain-text version of any blog field, for meta descriptions and excerpts. */
export function blogPlainText(raw, maxLength = 160) {
  if (!raw) return "";
  const text = formatBlogContent(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).replace(/\s+\S*$/, "")}…`;
}
