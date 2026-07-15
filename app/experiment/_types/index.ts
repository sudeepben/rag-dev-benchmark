import type {
  Backend,
  ExperimentParams,
  BackendResult,
  ComparisonMetrics,
} from "@/lib/rag/types";

export interface ExperimentRun {
  id: string;
  question: string;
  params: ExperimentParams;
  results: Record<string, BackendResult>;
  comparison: ComparisonMetrics | null;
  totalLatencyMs: number;
  createdAt: string;
}

export interface ConfigResponse {
  backends: {
    pgvector: { available: boolean; chunkCount: number };
    pinecone: { available: boolean; chunkCount: number };
  };
  dataSources: {
    inventory: { chunkCount: number };
    documents: { chunkCount: number };
  };
}

export type ExperimentMode = "raw" | "context-engine" | "knowledge-augmented";

export interface ClassificationResult {
  needsRetrieval: boolean;
  reason: string;
  confidence: number;
  latencyMs: number;
}

export interface ContextEngineResponse {
  mode: "context-engine";
  classification: ClassificationResult;
  directAnswer: string | null;
  retrievalResults: {
    results: Record<string, any>;
    comparison: any;
    embeddingLatencyMs: number;
  } | null;
  totalLatencyMs: number;
  question: string;
  params: any;
}

export interface KnowledgeAugmentedResponse {
  mode: "knowledge-augmented";
  draftAnswer: { text: string; latencyMs: number };
  embeddingLatencyMs: number;
  results: Record<string, any>;
  comparison: any;
  finalAnswer: { text: string; citations: string[]; latencyMs: number } | null;
  totalLatencyMs: number;
  question: string;
  params: any;
}
