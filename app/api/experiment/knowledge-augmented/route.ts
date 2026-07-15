import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { embedQuery, embedTexts } from "@/lib/rag/embed";
import { searchPgvector } from "@/lib/rag/search";
import { searchPinecone, isPineconeConfigured } from "@/lib/rag/pinecone";
import { checkGuardrails } from "@/lib/rag/guardrails";
import { getPglite } from "@/lib/db";
import type {
  BackendResult,
  ComparisonMetrics,
  Backend,
  SearchResult,
  ExperimentParams,
} from "@/lib/rag/types";
import { DEFAULT_PARAMS } from "@/lib/rag/types";

interface KnowledgeAugmentedRequest {
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

async function runBackendSearch(
  backend: Backend,
  draftEmbedding: number[],
  params: {
    topK: number;
    similarityThreshold: number;
    dataSource: "inventory" | "documents";
  }
): Promise<{ chunks: SearchResult[]; searchLatencyMs: number; error?: string }> {
  const searchStart = performance.now();

  try {
    let chunks: SearchResult[];

    if (backend === "pgvector") {
      if (params.dataSource === "documents") {
        chunks = await searchDocChunks(draftEmbedding, params.topK);
      } else {
        chunks = await searchPgvector(draftEmbedding, params.topK);
      }
    } else {
      if (!isPineconeConfigured()) {
        throw new Error("Pinecone is not configured");
      }
      chunks = await searchPinecone(draftEmbedding, params.topK);
    }

    return {
      chunks,
      searchLatencyMs: Math.round(performance.now() - searchStart),
    };
  } catch (err) {
    return {
      chunks: [],
      searchLatencyMs: Math.round(performance.now() - searchStart),
      error: err instanceof Error ? err.message : "Search failed",
    };
  }
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
    const body: KnowledgeAugmentedRequest = await request.json();

    if (!body.question?.trim()) {
      return NextResponse.json(
        { error: "question is required" },
        { status: 400 }
      );
    }

    const params: ExperimentParams = {
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
      maxQueryChars: DEFAULT_PARAMS.maxQueryChars,
      maxContextChars: DEFAULT_PARAMS.maxContextChars,
      maxChunkChars: DEFAULT_PARAMS.maxChunkChars,
    };
    const dataSource = body.dataSource ?? "inventory";

    const totalStart = performance.now();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Step 1: Draft generation — answer from model knowledge
    const draftStart = performance.now();
    const draftResponse = await openai.chat.completions.create({
      model: params.llmModel,
      messages: [
        {
          role: "system",
          content:
            "Answer this question using your general knowledge. Be detailed and specific.",
        },
        { role: "user", content: body.question },
      ],
      temperature: params.temperature,
      max_tokens: params.maxTokens,
    });
    const draftLatencyMs = Math.round(performance.now() - draftStart);
    const draftText =
      draftResponse.choices[0]?.message?.content || "No draft generated.";

    // Step 2: Embed the draft answer AND the original query in parallel
    const embedStart = performance.now();
    const [draftEmbeddings, queryEmbedding] = await Promise.all([
      embedTexts([draftText], params.embeddingModel),
      embedQuery(body.question, params.embeddingModel),
    ]);
    const embeddingLatencyMs = Math.round(performance.now() - embedStart);
    const draftEmbedding = draftEmbeddings[0];

    // Step 3: Search both backends using the DRAFT ANSWER embedding
    const searchPromises = params.backends.map((backend) =>
      runBackendSearch(backend, draftEmbedding, {
        topK: params.topK,
        similarityThreshold: params.similarityThreshold,
        dataSource,
      })
    );

    const searchResults = await Promise.all(searchPromises);

    // Step 4: Build BackendResult for each backend, apply guardrails
    const results: Record<string, BackendResult> = {};

    for (let i = 0; i < params.backends.length; i++) {
      const backend = params.backends[i];
      const searchResult = searchResults[i];

      const guardrails = checkGuardrails(searchResult.chunks, {
        minTopScore: params.similarityThreshold,
      });

      const topScore = searchResult.chunks[0]?.score ?? 0;
      const avgScore =
        searchResult.chunks.length > 0
          ? searchResult.chunks.reduce((sum, c) => sum + c.score, 0) /
            searchResult.chunks.length
          : 0;
      const relevantChunks = searchResult.chunks.filter(
        (c) => c.score >= params.similarityThreshold
      ).length;

      const abstained = !guardrails.shouldAnswer;

      results[backend] = {
        backend,
        chunks: searchResult.chunks,
        answer: null,
        citations: [],
        searchLatencyMs: searchResult.searchLatencyMs,
        generationLatencyMs: 0,
        totalLatencyMs: searchResult.searchLatencyMs,
        topScore,
        avgScore,
        relevantChunks,
        abstained,
        error: searchResult.error,
      };
    }

    // Step 5: Compute comparison metrics
    const comparison = computeComparison(results, embeddingLatencyMs);

    // Step 6: Generate final grounded answer if requested
    let finalAnswer: {
      text: string;
      citations: string[];
      latencyMs: number;
    } | null = null;

    if (params.generateAnswers) {
      // Gather all chunks from all backends, deduplicate, take top ones
      const allChunks: SearchResult[] = [];
      const seenIds = new Set<string>();
      for (const backendKey of Object.keys(results)) {
        for (const chunk of results[backendKey].chunks) {
          if (!seenIds.has(chunk.id)) {
            seenIds.add(chunk.id);
            allChunks.push(chunk);
          }
        }
      }
      allChunks.sort((a, b) => b.score - a.score);
      const topChunks = allChunks.slice(0, params.maxContextChunks);

      // Check if any backend passed guardrails
      const anyPassed = Object.values(results).some((r) => !r.abstained);

      if (anyPassed && topChunks.length > 0) {
        const contextBlocks = topChunks
          .map(
            (chunk, i) =>
              `[CONTEXT ${i + 1} - ${chunk.id}] (score: ${chunk.score.toFixed(3)})\n${chunk.content.slice(0, 1400)}`
          )
          .join("\n\n");

        const finalStart = performance.now();
        const finalResponse = await openai.chat.completions.create({
          model: params.llmModel,
          messages: [
            {
              role: "system",
              content:
                "You are answering a question about inventory items. You have retrieved context from the database. Use the retrieved context to provide an accurate, grounded answer. If the context contradicts your initial knowledge, prefer the context. Return a JSON response with keys: \"answer\" (string), \"citations\" (array of chunk IDs used).",
            },
            {
              role: "user",
              content: `ORIGINAL QUESTION: ${body.question}\n\nDRAFT ANSWER (from general knowledge):\n${draftText}\n\nRETRIEVED CONTEXT:\n${contextBlocks}\n\nProvide a grounded final answer based on the retrieved context. Return JSON with "answer" and "citations" keys.`,
            },
          ],
          temperature: params.temperature,
          max_tokens: params.maxTokens,
        });
        const finalLatencyMs = Math.round(performance.now() - finalStart);
        const finalContent =
          finalResponse.choices[0]?.message?.content || "";

        let answerText = finalContent;
        let citations: string[] = [];

        try {
          const jsonMatch = finalContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            answerText = parsed.answer || finalContent;
            citations = Array.isArray(parsed.citations)
              ? parsed.citations
              : [];
          }
        } catch {
          // Use raw content if JSON parsing fails
        }

        finalAnswer = {
          text: answerText,
          citations,
          latencyMs: finalLatencyMs,
        };

        // Update backend results with the final answer for the first non-abstained backend
        for (const backendKey of Object.keys(results)) {
          if (!results[backendKey].abstained) {
            results[backendKey].answer = answerText;
            results[backendKey].citations = citations;
            results[backendKey].generationLatencyMs = finalLatencyMs;
            results[backendKey].totalLatencyMs =
              results[backendKey].searchLatencyMs + finalLatencyMs;
            break;
          }
        }
      }
    }

    const totalLatencyMs = Math.round(performance.now() - totalStart);

    // Step 7: Save experiment
    const experimentId = crypto.randomUUID();
    const client = await getPglite();

    await client.query(
      `INSERT INTO experiments (id, question, parameters, pgvector_result, pinecone_result, metrics, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        experimentId,
        body.question,
        JSON.stringify({ ...params, mode: "knowledge-augmented" }),
        results.pgvector ? JSON.stringify(results.pgvector) : null,
        results.pinecone ? JSON.stringify(results.pinecone) : null,
        JSON.stringify({
          ...comparison,
          draftAnswer: { text: draftText, latencyMs: draftLatencyMs },
          embeddingLatencyMs,
          finalAnswer,
          totalLatencyMs,
        }),
      ]
    );

    // Step 8: Return response
    return NextResponse.json({
      mode: "knowledge-augmented",
      draftAnswer: { text: draftText, latencyMs: draftLatencyMs },
      embeddingLatencyMs,
      results,
      comparison,
      finalAnswer,
      totalLatencyMs,
      question: body.question,
      params,
    });
  } catch (err) {
    console.error("Knowledge-augmented experiment error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
