import { NextRequest, NextResponse } from "next/server";
import { vectorSearch } from "@/lib/rag/search";
import { generateAnswer } from "@/lib/rag/generate";
import { sanitizeQuery } from "@/lib/rag/sanitize";
import {
  checkPreGenerationGuardrails,
  checkPostGenerationGuardrails,
} from "@/lib/rag/guardrails";
import { SAFE_FALLBACK_MESSAGE } from "@/lib/rag/types";

export async function POST(request: NextRequest) {
  try {
    const { question, topK = 5, generateResponse = true } = await request.json();

    if (!question) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured. Add it to your .env.local file." },
        { status: 500 }
      );
    }

    const startTime = Date.now();
    const sanitized = sanitizeQuery(question);

    // Vector search
    const results = await vectorSearch(sanitized, topK);

    // Pre-generation guardrails (layers 1-3)
    const preCheck = checkPreGenerationGuardrails(sanitized, results);
    if (!preCheck.shouldAnswer) {
      return NextResponse.json({
        question: sanitized,
        answer: SAFE_FALLBACK_MESSAGE,
        citations: [],
        chunks: results,
        latencyMs: Date.now() - startTime,
        abstained: true,
        abstentionReason: preCheck.reason,
      });
    }

    let answer = null;
    let citations: string[] = [];
    let abstained = false;
    let abstentionReason: string | undefined;

    if (generateResponse && results.length > 0) {
      const generated = await generateAnswer(sanitized, results);

      // Post-generation guardrails (layers 4-5)
      const validIds = new Set(results.map((c) => c.id));
      const postCheck = checkPostGenerationGuardrails(generated, validIds);

      if (!postCheck.shouldAnswer) {
        answer = SAFE_FALLBACK_MESSAGE;
        citations = [];
        abstained = true;
        abstentionReason = postCheck.reason;
      } else {
        answer = generated.answer;
        citations = generated.citations;
      }
    }

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      question: sanitized,
      answer,
      citations,
      chunks: results,
      latencyMs,
      abstained,
      abstentionReason,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
