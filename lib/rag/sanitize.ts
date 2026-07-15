import type { SearchResult } from "./types";

/**
 * Sanitize and truncate a query string.
 * Trims whitespace and truncates at a word boundary.
 */
export function sanitizeQuery(query: string, maxChars: number = 800): string {
  const trimmed = query.trim();
  if (trimmed.length <= maxChars) return trimmed;

  // Truncate at last space before maxChars
  const cut = trimmed.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
}

/**
 * Build context from chunks, respecting token/char budgets.
 * Returns a subset of chunks that fit within the budget.
 */
export function buildContext(
  chunks: SearchResult[],
  opts: {
    maxContextChunks?: number;
    maxChunkChars?: number;
    maxContextChars?: number;
  } = {}
): SearchResult[] {
  const {
    maxContextChunks = 4,
    maxChunkChars = 1400,
    maxContextChars = 5500,
  } = opts;

  const selected: SearchResult[] = [];
  let totalChars = 0;

  for (const chunk of chunks.slice(0, maxContextChunks)) {
    const content = chunk.content.slice(0, maxChunkChars);
    if (totalChars + content.length > maxContextChars) break;
    totalChars += content.length;
    selected.push({ ...chunk, content });
  }

  return selected;
}
