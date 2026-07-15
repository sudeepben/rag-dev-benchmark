import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { embedQuery } from "@/lib/rag/embed";
import { searchPgvector } from "@/lib/rag/search";
import { searchPinecone, isPineconeConfigured } from "@/lib/rag/pinecone";
import { generateAnswer } from "@/lib/rag/generate";
import { checkGuardrails } from "@/lib/rag/guardrails";
import { getPglite } from "@/lib/db";
import type {
  BackendResult,
  ComparisonMetrics,
  Backend,
  SearchResult,
} from "@/lib/rag/types";
import { DEFAULT_PARAMS } from "@/lib/rag/types";

interface ContextEngineRequest {
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
  dataSource?: "inventory" | "documents";
}

interface Classification {
  needsRetrieval: boolean;
  reason: string;
  confidence: number;
  latencyMs: number;
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

  const guardrails = checkGuardrails(chunks, {
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

  let answer: string | null = null;
  let citations: string[] = [];
  let generationLatencyMs = 0;

  if (params.generateAnswers && guardrails.shouldAnswer) {
    const genStart = performance.now();
    const result = await generateAnswer(question, chunks, {
      model: params.llmModel,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      maxContextChunks: params.maxContextChunks,
    });
    generationLatencyMs = Math.round(performance.now() - genStart);
    answer = result.answer;
    citations = result.citations;
  }

  const abstained = !guardrails.shouldAnswer;

  return {
    backend,
    chunks,
    answer,
    citations,
    searchLatencyMs,
    generationLatencyMs,
    totalLatencyMs: searchLatencyMs + generationLatencyMs,
    topScore,
    avgScore,
    relevantChunks,
    abstained,
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
    const body: ContextEngineRequest = await request.json();

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
    };
    const dataSource = body.dataSource ?? "inventory";

    const totalStart = performance.now();

    // Step 1: Classification — decide if retrieval is needed
    const classificationStart = performance.now();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const classificationResponse = await openai.chat.completions.create({
      model: params.llmModel,
      messages: [
        {
          role: "system",
          content:
            "You are a query classifier for a product inventory system. Determine if the user's question requires searching a product database or can be answered from general knowledge. Return ONLY valid JSON: { \"needsRetrieval\": boolean, \"reason\": string, \"confidence\": number }",
        },
        { role: "user", content: body.question },
      ],
      temperature: 0,
      max_tokens: 200,
    });

    const classificationLatencyMs = Math.round(
      performance.now() - classificationStart
    );

    const classificationContent =
      classificationResponse.choices[0]?.message?.content || "";
    let classification: Classification;

    try {
      const jsonMatch = classificationContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in classification response");
      const parsed = JSON.parse(jsonMatch[0]);
      classification = {
        needsRetrieval: Boolean(parsed.needsRetrieval),
        reason: String(parsed.reason || ""),
        confidence: Number(parsed.confidence || 0),
        latencyMs: classificationLatencyMs,
      };
    } catch {
      // Default to needing retrieval if classification fails
      classification = {
        needsRetrieval: true,
        reason: "Classification parsing failed, defaulting to retrieval",
        confidence: 0,
        latencyMs: classificationLatencyMs,
      };
    }

    const experimentId = crypto.randomUUID();
    const client = await getPglite();

    // Step 2: If no retrieval needed, generate direct answer
    if (!classification.needsRetrieval) {
      const directStart = performance.now();

      const directResponse = await openai.chat.completions.create({
        model: params.llmModel,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Answer the user's question using your general knowledge.",
          },
          { role: "user", content: body.question },
        ],
        temperature: params.temperature,
        max_tokens: params.maxTokens,
      });

      const directLatencyMs = Math.round(performance.now() - directStart);
      const directAnswer =
        directResponse.choices[0]?.message?.content || "No response generated.";
      const totalLatencyMs = Math.round(performance.now() - totalStart);

      await client.query(
        `INSERT INTO experiments (id, question, parameters, pgvector_result, pinecone_result, metrics, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          experimentId,
          body.question,
          JSON.stringify({ ...params, mode: "context-engine", direct_answer: true }),
          null,
          null,
          JSON.stringify({
            classification,
            directAnswer,
            directAnswerLatencyMs: directLatencyMs,
            totalLatencyMs,
          }),
        ]
      );

      return NextResponse.json({
        mode: "context-engine",
        classification,
        directAnswer,
        retrievalResults: null,
        totalLatencyMs,
      });
    }

    // Step 3: Retrieval needed — run the same dual-backend comparison flow
    const embedStart = performance.now();
    const queryEmbedding = await embedQuery(body.question, params.embeddingModel);
    const embeddingLatencyMs = Math.round(performance.now() - embedStart);

    const backendPromises = params.backends.map((backend) =>
      runBackend(backend, queryEmbedding, body.question, {
        topK: params.topK,
        similarityThreshold: params.similarityThreshold,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        llmModel: params.llmModel,
        generateAnswers: params.generateAnswers,
        maxContextChunks: params.maxContextChunks,
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

    await client.query(
      `INSERT INTO experiments (id, question, parameters, pgvector_result, pinecone_result, metrics, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        experimentId,
        body.question,
        JSON.stringify({ ...params, mode: "context-engine" }),
        results.pgvector ? JSON.stringify(results.pgvector) : null,
        results.pinecone ? JSON.stringify(results.pinecone) : null,
        JSON.stringify({ ...comparison, classification }),
      ]
    );

    return NextResponse.json({
      mode: "context-engine",
      classification,
      directAnswer: null,
      retrievalResults: {
        question: body.question,
        params,
        results,
        comparison,
        totalLatencyMs,
      },
      totalLatencyMs,
    });
  } catch (err) {
    console.error("Context-engine experiment error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
