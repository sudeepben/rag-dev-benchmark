import OpenAI from "openai";
import type { SearchResult } from "./types";
import { buildContext } from "./sanitize";
import { validateCitations } from "./citations";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

const SYSTEM_PROMPT = `You are a retrieval-grounded assistant that answers questions based ONLY on the provided context.
Rules:
1) Use ONLY the information from the provided CONTEXT blocks.
2) Do NOT use prior knowledge.
3) If the context doesn't contain enough information to answer, set insufficient_context to true.
4) Cite the chunk IDs you used in your answer.
5) Be concise and accurate.
6) Return strict JSON only with keys: "answer", "citations", "insufficient_context".`;

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxContextChunks?: number;
  maxChunkChars?: number;
  maxContextChars?: number;
}

export interface GenerateResult {
  answer: string;
  citations: string[];
  insufficientContext: boolean;
}

export async function generateAnswer(
  question: string,
  chunks: SearchResult[],
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const {
    model = "gpt-4.1-nano",
    temperature = 0.1,
    maxTokens = 220,
    maxContextChunks = 4,
    maxChunkChars = 1400,
    maxContextChars = 5500,
  } = options;

  const openai = getClient();

  // Apply context budget
  const contextChunks = buildContext(chunks, {
    maxContextChunks,
    maxChunkChars,
    maxContextChars,
  });

  const validChunkIds = new Set(contextChunks.map((c) => c.id));

  const contextBlocks = contextChunks
    .map(
      (chunk, i) =>
        `[CONTEXT ${i + 1} - ${chunk.id}] (score: ${chunk.score.toFixed(3)})\n${chunk.content}`
    )
    .join("\n\n");

  const userMessage = `CONTEXT:\n${contextBlocks}\n\nQUESTION: ${question}\n\nReturn JSON: {"answer": "...", "citations": ["chunk-id"], "insufficient_context": false}`;

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    max_tokens: maxTokens,
    temperature,
  });

  const content = response.choices[0]?.message?.content || "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const rawCitations = Array.isArray(parsed.citations) ? parsed.citations : [];
      return {
        answer: parsed.answer || content,
        citations: validateCitations(rawCitations, validChunkIds),
        insufficientContext: parsed.insufficient_context === true,
      };
    }
  } catch {
    // Fall through to return raw content
  }

  return { answer: content, citations: [], insufficientContext: false };
}
