/**
 * Utilities for handling task/note descriptions that may be stored
 * as markdown (legacy) or HTML (from the Tiptap rich-text editor).
 */

/**
 * Detect whether a string looks like HTML content (has tags).
 */
export function isHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*?>/i.test(text);
}

/**
 * Convert basic markdown to HTML so legacy descriptions can be loaded
 * into the Tiptap editor. Handles bullets, numbered lists, bold,
 * italic, links, and paragraphs.
 */
export function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return "";
  if (isHtmlContent(md)) return md; // already HTML

  const lines = md.split("\n");
  const htmlParts: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeList = () => {
    if (inUl) {
      htmlParts.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      htmlParts.push("</ol>");
      inOl = false;
    }
  };

  for (const raw of lines) {
    const line = raw;

    // Bullet list: "- ", "* ", "+ "
    const bulletMatch = line.match(/^\s*[-*+]\s+(.*)/);
    if (bulletMatch) {
      if (inOl) { htmlParts.push("</ol>"); inOl = false; }
      if (!inUl) { htmlParts.push("<ul>"); inUl = true; }
      htmlParts.push(`<li>${inlineMarkdown(bulletMatch[1])}</li>`);
      continue;
    }

    // Numbered list: "1. ", "2. ", etc.
    const numMatch = line.match(/^\s*\d+\.\s+(.*)/);
    if (numMatch) {
      if (inUl) { htmlParts.push("</ul>"); inUl = false; }
      if (!inOl) { htmlParts.push("<ol>"); inOl = true; }
      htmlParts.push(`<li>${inlineMarkdown(numMatch[1])}</li>`);
      continue;
    }

    // Empty line — close any open list
    if (!line.trim()) {
      closeList();
      continue;
    }

    // Regular paragraph
    closeList();
    htmlParts.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  closeList();
  return htmlParts.join("");
}

/** Apply inline markdown formatting (bold, italic, links). */
function inlineMarkdown(text: string): string {
  return (
    text
      // Bold: **text** or __text__
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<strong>$1</strong>")
      // Italic: *text* or _text_ (but not inside **)
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
      .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "<em>$1</em>")
      // Links: [text](url)
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      )
  );
}

/**
 * Strip all markdown and HTML formatting, returning plain text.
 * Used for single-line previews in task lists.
 */
export function stripFormatting(text: string): string {
  if (!text) return "";

  let result = text;

  if (isHtmlContent(result)) {
    // Strip HTML tags
    result = result.replace(/<[^>]+>/g, " ");
  } else {
    // Strip markdown: bold, italic, links, list markers
    result = result
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1")
      .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "");
  }

  // Collapse whitespace
  return result.replace(/\s+/g, " ").trim();
}
