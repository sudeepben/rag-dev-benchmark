// ─── Search ───

export interface SearchResult {
  id: string;
  itemId: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export type Backend = "pgvector" | "pinecone";

// ─── Experiment Parameters ───

export interface ExperimentParams {
  topK: number;
  similarityThreshold: number;
  temperature: number;
  maxTokens: number;
  embeddingModel: string;
  llmModel: string;
  generateAnswers: boolean;
  backends: Backend[];
  maxContextChunks: number;
  maxQueryChars: number;
  maxContextChars: number;
  maxChunkChars: number;
}

export const DEFAULT_PARAMS: ExperimentParams = {
  topK: 5,
  similarityThreshold: 0.18,
  temperature: 0.1,
  maxTokens: 220,
  embeddingModel: "text-embedding-3-small",
  llmModel: "gpt-4.1-nano",
  generateAnswers: true,
  backends: ["pgvector"],
  maxContextChunks: 4,
  maxQueryChars: 800,
  maxContextChars: 5500,
  maxChunkChars: 1400,
};

// ─── Backend Result ───

export interface BackendResult {
  backend: Backend;
  chunks: SearchResult[];
  answer: string | null;
  citations: string[];
  searchLatencyMs: number;
  generationLatencyMs: number;
  totalLatencyMs: number;
  topScore: number;
  avgScore: number;
  relevantChunks: number;
  abstained: boolean;
  abstentionLayer?: number;
  error?: string;
}

// ─── Comparison ───

export interface ComparisonMetrics {
  embeddingLatencyMs: number;
  latencyWinner: Backend | null;
  scoreWinner: Backend | null;
  latencyDeltaMs: number;
  scoreDelta: number;
  overlapChunks: number;
}

export interface CompareResponse {
  question: string;
  params: ExperimentParams;
  results: Record<string, BackendResult>;
  comparison: ComparisonMetrics | null;
  totalLatencyMs: number;
}

// ─── Guardrails ───

export interface GuardrailDecision {
  shouldAnswer: boolean;
  reason: string;
  layer?: number;
}

export const SAFE_FALLBACK_MESSAGE =
  "I couldn't find enough relevant information to answer this question confidently.";
