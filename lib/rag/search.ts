import { getPglite } from "@/lib/db";
import { embedQuery } from "./embed";
import type { SearchResult } from "./types";

// Re-export for convenience
export type { SearchResult } from "./types";

/**
 * Search pgvector with a pre-computed embedding vector.
 * Timing should be done by the caller.
 */
export async function searchPgvector(
  queryEmbedding: number[],
  topK: number = 5
): Promise<SearchResult[]> {
  const client = await getPglite();

  const result = await client.query<{
    id: string;
    item_id: string;
    content: string;
    metadata: Record<string, unknown>;
    score: number;
  }>(
    `SELECT id, item_id, content, metadata,
            1 - (embedding <=> $1::vector) AS score
     FROM chunks
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [`[${queryEmbedding.join(",")}]`, topK]
  );

  return result.rows.map((row) => ({
    id: row.id,
    itemId: row.item_id,
    content: row.content,
    score: row.score,
    metadata: row.metadata || {},
  }));
}

/**
 * Convenience wrapper: embeds query then searches pgvector.
 * Used by the simple /api/query route.
 */
export async function vectorSearch(
  query: string,
  topK: number = 5,
  model?: string
): Promise<SearchResult[]> {
  const queryEmbedding = await embedQuery(query, model);
  return searchPgvector(queryEmbedding, topK);
}
