import type { SearchResult, GuardrailDecision } from "./types";

/**
 * Pre-generation guardrails (Layers 1-3).
 * Run BEFORE calling the LLM.
 */
export function checkPreGenerationGuardrails(
  query: string,
  chunks: SearchResult[],
  options: {
    minTopScore?: number;
    minRelevantChunks?: number;
  } = {}
): GuardrailDecision {
  const { minTopScore = 0.18, minRelevantChunks = 1 } = options;

  // Layer 1: Empty query
  if (!query || query.trim().length === 0) {
    return { shouldAnswer: false, reason: "Empty query", layer: 1 };
  }

  // Layer 2: No chunks or top score too low
  if (chunks.length === 0) {
    return { shouldAnswer: false, reason: "No chunks retrieved", layer: 2 };
  }

  const topScore = chunks[0]?.score ?? 0;
  if (topScore < minTopScore) {
    return {
      shouldAnswer: false,
      reason: `Top score ${topScore.toFixed(3)} below threshold ${minTopScore}`,
      layer: 2,
    };
  }

  // Layer 3: Not enough relevant chunks
  const relevantCount = chunks.filter((c) => c.score >= minTopScore).length;
  if (relevantCount < minRelevantChunks) {
    return {
      shouldAnswer: false,
      reason: `Only ${relevantCount} relevant chunks (need ${minRelevantChunks})`,
      layer: 3,
    };
  }

  return { shouldAnswer: true, reason: "Passed pre-generation guardrails" };
}

/**
 * Post-generation guardrails (Layers 4-5).
 * Run AFTER the LLM responds, to validate the answer quality.
 */
export function checkPostGenerationGuardrails(
  result: {
    citations: string[];
    insufficientContext: boolean;
  },
  validChunkIds: Set<string>
): GuardrailDecision {
  // Layer 4: No valid citations in answer
  const validCitations = result.citations.filter((id) => validChunkIds.has(id));
  if (validCitations.length === 0) {
    return {
      shouldAnswer: false,
      reason: "Answer had no valid evidence citations",
      layer: 4,
    };
  }

  // Layer 5: LLM self-reports insufficient context
  if (result.insufficientContext) {
    return {
      shouldAnswer: false,
      reason: "LLM reports insufficient context",
      layer: 5,
    };
  }

  return { shouldAnswer: true, reason: "Passed post-generation guardrails" };
}

/**
 * Backward-compatible wrapper.
 * Runs pre-generation guardrails only (layers 2-3, no query check).
 */
export function checkGuardrails(
  chunks: SearchResult[],
  options: {
    minTopScore?: number;
    minRelevantChunks?: number;
  } = {}
): GuardrailDecision {
  return checkPreGenerationGuardrails("_", chunks, options);
}
