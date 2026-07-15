import { Pinecone } from "@pinecone-database/pinecone";
import type { SearchResult } from "./types";

let client: Pinecone | null = null;

const MAX_METADATA_CONTENT = 39000; // Pinecone 40KB metadata limit, leave room

export function isPineconeConfigured(): boolean {
  return !!(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX_NAME);
}

function getClient(): Pinecone {
  if (!client) {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY is not configured");
    }
    client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }
  return client;
}

function getIndexName(): string {
  const name = process.env.PINECONE_INDEX_NAME;
  if (!name) throw new Error("PINECONE_INDEX_NAME is not configured");
  return name;
}

/**
 * Ensure the Pinecone index exists, creating it if needed.
 */
export async function ensureIndex(dimension: number = 1536): Promise<void> {
  const pc = getClient();
  const indexName = getIndexName();

  const existing = await pc.listIndexes();
  const found = existing.indexes?.some((idx) => idx.name === indexName);

  if (!found) {
    await pc.createIndex({
      name: indexName,
      dimension,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: (process.env.PINECONE_CLOUD as "aws" | "gcp" | "azure") || "aws",
          region: process.env.PINECONE_REGION || "us-east-1",
        },
      },
    });

    // Wait for index to be ready (max 60s)
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const desc = await pc.describeIndex(indexName);
      if (desc.status?.ready) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/**
 * Upsert chunks with embeddings to Pinecone.
 */
export async function upsertToPinecone(
  chunks: { id: string; itemId: string; content: string; metadata: Record<string, unknown> }[],
  embeddings: number[][]
): Promise<{ upserted: number }> {
  const pc = getClient();
  const index = pc.index(getIndexName());
  const batchSize = 100;
  let upserted = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize).map((chunk, j) => ({
      id: chunk.id,
      values: embeddings[i + j],
      metadata: {
        item_id: chunk.itemId,
        content: chunk.content.slice(0, MAX_METADATA_CONTENT),
        chunk_index: (chunk.metadata?.index as number) ?? 0,
      },
    }));

    await index.upsert({ records: batch });
    upserted += batch.length;
  }

  return { upserted };
}

/**
 * Search Pinecone with a pre-computed embedding vector.
 */
export async function searchPinecone(
  queryEmbedding: number[],
  topK: number = 5
): Promise<SearchResult[]> {
  const pc = getClient();
  const index = pc.index(getIndexName());

  const result = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });

  return (result.matches || []).map((match) => ({
    id: match.id,
    itemId: (match.metadata?.item_id as string) || "",
    content: (match.metadata?.content as string) || "",
    score: match.score ?? 0,
    metadata: (match.metadata as Record<string, unknown>) || {},
  }));
}

/**
 * Get detailed index stats.
 */
export async function getPineconeStats(): Promise<{
  vectorCount: number;
  dimension?: number;
  indexFullness?: number;
  namespaces?: Record<string, { recordCount: number }>;
}> {
  try {
    const pc = getClient();
    const index = pc.index(getIndexName());
    const stats = await index.describeIndexStats();
    return {
      vectorCount: stats.totalRecordCount ?? 0,
      dimension: stats.dimension,
      indexFullness: stats.indexFullness,
      namespaces: stats.namespaces as Record<string, { recordCount: number }>,
    };
  } catch {
    return { vectorCount: 0 };
  }
}

/**
 * Get index info (name, dimension, metric, status).
 */
export async function getPineconeIndexInfo() {
  const pc = getClient();
  const indexName = getIndexName();
  const desc = await pc.describeIndex(indexName);
  return {
    name: desc.name,
    dimension: desc.dimension,
    metric: desc.metric,
    host: desc.host,
    status: desc.status,
    spec: desc.spec,
  };
}

/**
 * List vector IDs with pagination.
 */
export async function listPineconeVectors(options: {
  prefix?: string;
  limit?: number;
  paginationToken?: string;
}): Promise<{
  ids: string[];
  nextToken?: string;
}> {
  const pc = getClient();
  const index = pc.index(getIndexName());

  const result = await index.listPaginated({
    prefix: options.prefix || undefined,
    limit: options.limit || 50,
    paginationToken: options.paginationToken || undefined,
  });

  return {
    ids: result.vectors?.map((v) => v.id!) || [],
    nextToken: result.pagination?.next,
  };
}

/**
 * Fetch vectors by IDs (returns full vectors with metadata).
 */
export async function fetchPineconeVectors(ids: string[]) {
  const pc = getClient();
  const index = pc.index(getIndexName());

  const result = await index.fetch({ ids });

  const records = Object.entries(result.records || {}).map(([id, record]) => ({
    id,
    metadata: record.metadata || {},
    hasValues: !!record.values && record.values.length > 0,
    dimension: record.values?.length || 0,
  }));

  return { records };
}

/**
 * Delete a single vector by ID.
 */
export async function deletePineconeVector(id: string): Promise<void> {
  const pc = getClient();
  const index = pc.index(getIndexName());
  await index.deleteOne({ id });
}

/**
 * Delete multiple vectors by IDs.
 */
export async function deletePineconeVectors(ids: string[]): Promise<void> {
  const pc = getClient();
  const index = pc.index(getIndexName());
  await index.deleteMany({ ids });
}

/**
 * Delete all vectors in the index.
 */
export async function deleteAllPineconeVectors(): Promise<void> {
  const pc = getClient();
  const index = pc.index(getIndexName());
  await index.deleteAll();
}

/**
 * Update vector metadata.
 */
export async function updatePineconeMetadata(
  id: string,
  metadata: Record<string, string | number | boolean>
): Promise<void> {
  const pc = getClient();
  const index = pc.index(getIndexName());
  await index.update({ id, metadata });
}
