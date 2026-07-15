import { NextRequest, NextResponse } from "next/server";
import { embedQuery } from "@/lib/rag/embed";
import { searchPgvector } from "@/lib/rag/search";
import { searchPinecone, isPineconeConfigured } from "@/lib/rag/pinecone";
import { generateAnswer } from "@/lib/rag/generate";
import {
  checkPreGenerationGuardrails,
  checkPostGenerationGuardrails,
} from "@/lib/rag/guardrails";
import { sanitizeQuery } from "@/lib/rag/sanitize";
import { getPglite } from "@/lib/db";
import type {
  BackendResult,
  ComparisonMetrics,
  Backend,
  SearchResult,
} from "@/lib/rag/types";
import { DEFAULT_PARAMS, SAFE_FALLBACK_MESSAGE } from "@/lib/rag/types";

interface CompareRequest {
  question: string;
  topK?: number;
  similarityThreshold?: number;
  temperature?: number;
  maxTokens?: number;
  embeddingModel?: string;
  llmModel?: string;
  generateAnswers?: boolean;
  backends?: Backend[];
  maxContextChunks?: number;
  maxQueryChars?: number;
  maxContextChars?: number;
  maxChunkChars?: number;
  dataSource?: "inventory" | "documents";
}

async function searchDocChunks(
  queryEmbedding: number[],
  topK: number
): Promise<SearchResult[]> {
  const client = await getPglite();
  const result = await client.query<{
    id: string;
    doc_id: string;
    content: string;
    metadata: Record<string, unknown>;
    score: number;
  }>(
    `SELECT id, doc_id, content, metadata,
            1 - (embedding <=> $1::vector) AS score
     FROM doc_chunks
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [`[${queryEmbedding.join(",")}]`, topK]
  );

  return result.rows.map((row) => ({
    id: row.id,
    itemId: row.doc_id,
    content: row.content,
    score: row.score,
    metadata: row.metadata || {},
  }));
}

async function runBackend(
  backend: Backend,
  queryEmbedding: number[],
  question: string,
  params: {
    topK: number;
    similarityThreshold: number;
    temperature: number;
    maxTokens: number;
    llmModel: string;
    generateAnswers: boolean;
    maxContextChunks: number;
    maxContextChars: number;
    maxChunkChars: number;
    dataSource: "inventory" | "documents";
  }
): Promise<BackendResult> {
  const searchStart = performance.now();
  let chunks: SearchResult[];

  try {
    if (backend === "pgvector") {
      if (params.dataSource === "documents") {
        chunks = await searchDocChunks(queryEmbedding, params.topK);
      } else {
        chunks = await searchPgvector(queryEmbedding, params.topK);
      }
    } else {
      if (!isPineconeConfigured()) {
        throw new Error("Pinecone is not configured");
      }
      chunks = await searchPinecone(queryEmbedding, params.topK);
    }
  } catch (err) {
    return {
      backend,
      chunks: [],
      answer: null,
      citations: [],
      searchLatencyMs: Math.round(performance.now() - searchStart),
      generationLatencyMs: 0,
      totalLatencyMs: Math.round(performance.now() - searchStart),
      topScore: 0,
      avgScore: 0,
      relevantChunks: 0,
      abstained: true,
      error: err instanceof Error ? err.message : "Search failed",
    };
  }

  const searchLatencyMs = Math.round(performance.now() - searchStart);

  // Pre-generation guardrails (layers 1-3)
  const preCheck = checkPreGenerationGuardrails(question, chunks, {
    minTopScore: params.similarityThreshold,
  });

  const topScore = chunks[0]?.score ?? 0;
  const avgScore =
    chunks.length > 0
      ? chunks.reduce((sum, c) => sum + c.score, 0) / chunks.length
      : 0;
  const relevantChunks = chunks.filter(
    (c) => c.score >= params.similarityThreshold
  ).length;

  if (!preCheck.shouldAnswer || !params.generateAnswers) {
    return {
      backend,
      chunks,
      answer: !preCheck.shouldAnswer ? SAFE_FALLBACK_MESSAGE : null,
      citations: [],
      searchLatencyMs,
      generationLatencyMs: 0,
      totalLatencyMs: searchLatencyMs,
      topScore,
      avgScore,
      relevantChunks,
      abstained: !preCheck.shouldAnswer,
      abstentionLayer: preCheck.layer,
    };
  }

  // Generate answer
  const genStart = performance.now();
  const generated = await generateAnswer(question, chunks, {
    model: params.llmModel,
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    maxContextChunks: params.maxContextChunks,
    maxContextChars: params.maxContextChars,
    maxChunkChars: params.maxChunkChars,
  });
  const generationLatencyMs = Math.round(performance.now() - genStart);

  // Post-generation guardrails (layers 4-5)
  const validIds = new Set(chunks.slice(0, params.maxContextChunks).map((c) => c.id));
  const postCheck = checkPostGenerationGuardrails(generated, validIds);

  if (!postCheck.shouldAnswer) {
    return {
      backend,
      chunks,
      answer: SAFE_FALLBACK_MESSAGE,
      citations: [],
      searchLatencyMs,
      generationLatencyMs,
      totalLatencyMs: searchLatencyMs + generationLatencyMs,
      topScore,
      avgScore,
      relevantChunks,
      abstained: true,
      abstentionLayer: postCheck.layer,
    };
  }

  return {
    backend,
    chunks,
    answer: generated.answer,
    citations: generated.citations,
    searchLatencyMs,
    generationLatencyMs,
    totalLatencyMs: searchLatencyMs + generationLatencyMs,
    topScore,
    avgScore,
    relevantChunks,
    abstained: false,
  };
}

function computeComparison(
  results: Record<string, BackendResult>,
  embeddingLatencyMs: number
): ComparisonMetrics | null {
  const backends = Object.keys(results) as Backend[];

  if (backends.length < 2) {
    return {
      embeddingLatencyMs,
      latencyWinner: null,
      scoreWinner: null,
      latencyDeltaMs: 0,
      scoreDelta: 0,
      overlapChunks: 0,
    };
  }

  const a = results[backends[0]];
  const b = results[backends[1]];

  const latencyDeltaMs = Math.abs(a.searchLatencyMs - b.searchLatencyMs);
  const latencyWinner =
    a.searchLatencyMs <= b.searchLatencyMs ? a.backend : b.backend;

  const scoreDelta = Math.abs(a.topScore - b.topScore);
  const scoreWinner = a.topScore >= b.topScore ? a.backend : b.backend;

  const aIds = new Set(a.chunks.map((c) => c.id));
  const overlapChunks = b.chunks.filter((c) => aIds.has(c.id)).length;

  return {
    embeddingLatencyMs,
    latencyWinner,
    scoreWinner,
    latencyDeltaMs,
    scoreDelta,
    overlapChunks,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: CompareRequest = await request.json();

    if (!body.question?.trim()) {
      return NextResponse.json(
        { error: "question is required" },
        { status: 400 }
      );
    }

    const params = {
      topK: body.topK ?? DEFAULT_PARAMS.topK,
      similarityThreshold:
        body.similarityThreshold ?? DEFAULT_PARAMS.similarityThreshold,
      temperature: body.temperature ?? DEFAULT_PARAMS.temperature,
      maxTokens: body.maxTokens ?? DEFAULT_PARAMS.maxTokens,
      embeddingModel: body.embeddingModel ?? DEFAULT_PARAMS.embeddingModel,
      llmModel: body.llmModel ?? DEFAULT_PARAMS.llmModel,
      generateAnswers: body.generateAnswers ?? DEFAULT_PARAMS.generateAnswers,
      backends: body.backends ?? DEFAULT_PARAMS.backends,
      maxContextChunks:
        body.maxContextChunks ?? DEFAULT_PARAMS.maxContextChunks,
      maxQueryChars: body.maxQueryChars ?? DEFAULT_PARAMS.maxQueryChars,
      maxContextChars: body.maxContextChars ?? DEFAULT_PARAMS.maxContextChars,
      maxChunkChars: body.maxChunkChars ?? DEFAULT_PARAMS.maxChunkChars,
    };
    const dataSource = body.dataSource ?? "inventory";

    const totalStart = performance.now();

    // Sanitize query
    const sanitizedQuestion = sanitizeQuery(body.question, params.maxQueryChars);

    // Embed query once
    const embedStart = performance.now();
    const queryEmbedding = await embedQuery(sanitizedQuestion, params.embeddingModel);
    const embeddingLatencyMs = Math.round(performance.now() - embedStart);

    // Run each backend in parallel
    const backendPromises = params.backends.map((backend) =>
      runBackend(backend, queryEmbedding, sanitizedQuestion, {
        topK: params.topK,
        similarityThreshold: params.similarityThreshold,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        llmModel: params.llmModel,
        generateAnswers: params.generateAnswers,
        maxContextChunks: params.maxContextChunks,
        maxContextChars: params.maxContextChars,
        maxChunkChars: params.maxChunkChars,
        dataSource,
      })
    );

    const backendResults = await Promise.all(backendPromises);

    const results: Record<string, BackendResult> = {};
    for (const result of backendResults) {
      results[result.backend] = result;
    }

    const comparison = computeComparison(results, embeddingLatencyMs);
    const totalLatencyMs = Math.round(performance.now() - totalStart);

    // Save experiment to database
    const experimentId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const client = await getPglite();
    await client.query(
      `INSERT INTO experiments (id, question, parameters, pgvector_result, pinecone_result, metrics, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        experimentId,
        sanitizedQuestion,
        JSON.stringify(params),
        results.pgvector ? JSON.stringify(results.pgvector) : null,
        results.pinecone ? JSON.stringify(results.pinecone) : null,
        JSON.stringify(comparison),
      ]
    );

    const response = {
      question: sanitizedQuestion,
      params,
      results,
      comparison,
      totalLatencyMs,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Compare experiment error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
