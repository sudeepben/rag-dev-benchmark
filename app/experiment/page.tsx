"use client";

import { useState, useEffect, useCallback } from "react";
import type { ExperimentParams } from "@/lib/rag/types";
import { DEFAULT_PARAMS } from "@/lib/rag/types";
import type {
  ExperimentRun,
  ConfigResponse,
  ExperimentMode,
  ContextEngineResponse,
  KnowledgeAugmentedResponse,
} from "./_types";
import { ConfigPanel } from "./_components/config-panel";
import { ResultsPanel } from "./_components/results-panel";
import { ChunksPanel } from "./_components/chunks-panel";
import { ExperimentHistory } from "./_components/experiment-history";
import { ModeTabs } from "./_components/mode-tabs";
import { ContextEngineResults } from "./_components/context-engine-results";
import { KnowledgeResults } from "./_components/knowledge-results";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendIcon } from "lucide-react";

type FullParams = ExperimentParams & {
  dataSource: "inventory" | "documents";
};

export default function ExperimentPage() {
  const [params, setParams] = useState<FullParams>({
    ...DEFAULT_PARAMS,
    dataSource: "inventory",
  });
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<ExperimentMode>("raw");
  const [result, setResult] = useState<ExperimentRun | null>(null);
  const [contextEngineResult, setContextEngineResult] =
    useState<ContextEngineResponse | null>(null);
  const [knowledgeResult, setKnowledgeResult] =
    useState<KnowledgeAugmentedResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    fetch("/api/experiment/config")
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch(() => {});
  }, []);

  // Clear all results when mode changes
  const handleModeChange = useCallback((newMode: ExperimentMode) => {
    setMode(newMode);
    setResult(null);
    setContextEngineResult(null);
    setKnowledgeResult(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    try {
      if (mode === "raw") {
        const res = await fetch("/api/experiment/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, ...params }),
        });
        const data = await res.json();
        setResult({
          id: crypto.randomUUID(),
          question: trimmed,
          params,
          results: data.results,
          comparison: data.comparison ?? null,
          totalLatencyMs: data.totalLatencyMs,
          createdAt: new Date().toISOString(),
        });
        setHistoryKey((k) => k + 1);
      } else if (mode === "context-engine") {
        const res = await fetch("/api/experiment/context-engine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, ...params }),
        });
        const data: ContextEngineResponse = await res.json();
        setContextEngineResult(data);
      } else if (mode === "knowledge-augmented") {
        const res = await fetch("/api/experiment/knowledge-augmented", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, ...params }),
        });
        const data: KnowledgeAugmentedResponse = await res.json();
        setKnowledgeResult(data);
      }
    } catch (err) {
      console.error("Experiment failed:", err);
    } finally {
      setLoading(false);
    }
  }, [question, params, loading, mode]);

  // Build a synthetic ExperimentRun for the chunks panel from any mode's results
  const chunksResult: ExperimentRun | null = (() => {
    if (mode === "raw") return result;
    if (mode === "context-engine" && contextEngineResult?.retrievalResults) {
      return {
        id: "context-engine-run",
        question: contextEngineResult.question,
        params: contextEngineResult.params,
        results: contextEngineResult.retrievalResults.results,
        comparison: contextEngineResult.retrievalResults.comparison ?? null,
        totalLatencyMs: contextEngineResult.totalLatencyMs,
        createdAt: new Date().toISOString(),
      };
    }
    if (mode === "knowledge-augmented" && knowledgeResult) {
      return {
        id: "knowledge-run",
        question: knowledgeResult.question,
        params: knowledgeResult.params,
        results: knowledgeResult.results,
        comparison: knowledgeResult.comparison ?? null,
        totalLatencyMs: knowledgeResult.totalLatencyMs,
        createdAt: new Date().toISOString(),
      };
    }
    return null;
  })();

  return (
    <div className="flex h-[calc(100vh-6.5rem)]">
      {/* Left sidebar - config */}
      <div className="w-[280px] shrink-0 border-r border-border/60 overflow-y-auto p-4">
        <ConfigPanel params={params} onChange={setParams} config={config} />
      </div>

      {/* Center - query + results */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mode tabs at the top */}
        <div className="border-b border-border/60 px-6 py-3">
          <ModeTabs mode={mode} onChange={handleModeChange} />
        </div>

        {/* Results area - scrollable */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {mode === "raw" && (
            <>
              <ResultsPanel result={result} loading={loading} />
              <ExperimentHistory
                refreshKey={historyKey}
                onSelect={(run) => setResult(run)}
              />
            </>
          )}
          {mode === "context-engine" && (
            <ContextEngineResults
              result={contextEngineResult}
              loading={loading}
            />
          )}
          {mode === "knowledge-augmented" && (
            <KnowledgeResults result={knowledgeResult} loading={loading} />
          )}
        </div>

        {/* Query input - fixed at bottom */}
        <div className="border-t border-border/60 p-4">
          <div className="flex gap-2">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ask a question to test RAG retrieval..."
              className="min-h-[44px] max-h-[120px] resize-none border-border/60 bg-background/50 text-sm"
              rows={1}
            />
            <Button
              onClick={handleSubmit}
              disabled={!question.trim() || loading}
              className="glow-amber-sm shrink-0 self-end"
              size="icon"
            >
              <SendIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Right sidebar - chunks */}
      <div className="w-[320px] shrink-0 border-l border-border/60 overflow-y-auto p-4">
        <ChunksPanel result={chunksResult} />
      </div>
    </div>
  );
}
