/**
 * Validate LLM-generated citations against actual chunk IDs.
 * Filters out any citation that doesn't match a real chunk ID
 * that was passed to the LLM in the context.
 */
export function validateCitations(
  citations: string[],
  validChunkIds: Set<string>
): string[] {
  return citations.filter((id) => validChunkIds.has(id));
}
