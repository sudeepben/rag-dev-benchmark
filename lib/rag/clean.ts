/**
 * Text cleaning and normalization for RAG ingestion.
 * Applied before chunking to improve embedding quality.
 */

/** Strip control characters except newline, tab, carriage return */
function stripControlChars(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
}

/** Normalize common unicode variants to ASCII equivalents */
function normalizeUnicode(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")   // curly single quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')    // curly double quotes
    .replace(/[\u2013\u2014]/g, "-")                 // en-dash, em-dash
    .replace(/\u2026/g, "...")                        // ellipsis
    .replace(/\u00A0/g, " ")                          // non-breaking space
    .replace(/\u200B/g, "")                           // zero-width space
    .replace(/\uFEFF/g, "");                          // BOM
}

/** Collapse multiple spaces/tabs into single space per line */
function collapseWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " "))
    .join("\n");
}

/** Collapse 3+ consecutive newlines into 2 (preserve paragraph breaks) */
function collapseNewlines(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n");
}

/**
 * Clean and normalize raw text before chunking.
 * Idempotent — calling twice produces the same result.
 */
export function cleanText(raw: string): string {
  if (!raw) return "";

  let text = raw;
  text = stripControlChars(text);
  text = normalizeUnicode(text);
  text = collapseWhitespace(text);
  text = collapseNewlines(text);
  text = text.trim();

  return text;
}
