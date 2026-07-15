export interface ChunkResult {
  id: string;
  itemId: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface QueryResponse {
  question: string;
  answer: string | null;
  citations: string[];
  chunks: ChunkResult[];
  latencyMs: number;
}
