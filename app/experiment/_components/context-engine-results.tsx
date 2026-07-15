"use client";

import type { ContextEngineResponse } from "../_types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2Icon, ZapIcon, TrophyIcon, BrainIcon, SearchIcon } from "lucide-react";

interface ContextEngineResultsProps {
  result: ContextEngineResponse | null;
  loading: boolean;
}

function ClassificationCard({
  classification,
}: {
  classification: ContextEngineResponse["classification"];
}) {
  const needsRetrieval = classification.needsRetrieval;

  return (
    <Card className="animate-fade-in-up border-border/60 bg-card/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <BrainIcon className="h-4 w-4 text-primary" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Classification
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Badge
          className={
            needsRetrieval
              ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
              : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
          }
          variant="outline"
        >
          {needsRetrieval ? (
            <>
              <SearchIcon className="h-3 w-3 mr-1" />
              Retrieval Needed
            </>
          ) : (
            <>
              <BrainIcon className="h-3 w-3 mr-1" />
              Direct Answer
            </>
          )}
        </Badge>

        <Badge variant="outline" className="text-xs tabular-nums border-border/60">
          {(classification.confidence * 100).toFixed(0)}% confidence
        </Badge>

        <Badge variant="outline" className="text-xs tabular-nums border-border/60 font-mono">
          {classification.latencyMs}ms
        </Badge>
      </div>

      <p className="text-sm text-foreground/80 leading-relaxed">
        {classification.reason}
      </p>
    </Card>
  );
}

function RetrievalMetricsBar({
  retrievalResults,
}: {
  retrievalResults: NonNullable<ContextEngineResponse["retrievalResults"]>;
}) {
  const { results, comparison } = retrievalResults;
  const backends = Object.keys(results);

  return (
    <div className="animate-fade-in flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/50 px-4 py-3">
      <div className="flex items-center gap-1.5">
        <ZapIcon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Embedding
        </span>
        <span className="text-sm tabular-nums text-foreground">
          {retrievalResults.embeddingLatencyMs}ms
        </span>
      </div>

      {backends.length > 0 && (
        <Separator orientation="vertical" className="h-4 bg-border/40" />
      )}

      {backends.map((key) => {
        const r = results[key];
        const isWinner =
          comparison?.latencyWinner === key && backends.length > 1;
        return (
          <div key={key} className="flex items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {key}
            </span>
            <span className="text-sm tabular-nums text-foreground">
              {r.totalLatencyMs}ms
            </span>
            {isWinner && (
              <TrophyIcon className="h-3.5 w-3.5 text-primary" />
            )}
          </div>
        );
      })}

      {comparison && backends.length > 1 && (
        <>
          <Separator orientation="vertical" className="h-4 bg-border/40" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Score Delta
            </span>
            <span className="text-sm tabular-nums text-foreground">
              {comparison.scoreDelta.toFixed(3)}
            </span>
          </div>
          <Separator orientation="vertical" className="h-4 bg-border/40" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Overlap
            </span>
            <span className="text-sm tabular-nums text-foreground">
              {comparison.overlapChunks} chunks
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function RetrievalBackendCard({
  backendKey,
  result,
  isWinner,
}: {
  backendKey: string;
  result: any;
  isWinner: boolean;
}) {
  return (
    <Card className="card-hover animate-fade-in-up border-border/60 bg-card/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="outline" className="font-mono text-xs">
          {result.backend ?? backendKey}
        </Badge>
        {isWinner && (
          <Badge className="bg-primary/20 text-primary border-primary/30">
            <TrophyIcon className="h-3 w-3 mr-1" />
            Winner
          </Badge>
        )}
        {result.abstained && (
          <Badge variant="secondary" className="text-muted-foreground">
            Abstained
          </Badge>
        )}
        {result.error && (
          <Badge variant="destructive">{result.error}</Badge>
        )}
      </div>

      {result.answer && (
        <div className="mb-3">
          <p className="text-sm leading-relaxed text-foreground/90">
            {result.answer}
          </p>
        </div>
      )}

      <Separator className="bg-border/40 my-3" />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Search:{" "}
          <span className="tabular-nums text-foreground">
            {result.searchLatencyMs}ms
          </span>
        </span>
        {result.generationLatencyMs > 0 && (
          <span>
            Generation:{" "}
            <span className="tabular-nums text-foreground">
              {result.generationLatencyMs}ms
            </span>
          </span>
        )}
        <span>
          Top Score:{" "}
          <span className="tabular-nums text-foreground">
            {result.topScore?.toFixed(3) ?? "N/A"}
          </span>
        </span>
        <span>
          Relevant:{" "}
          <span className="tabular-nums text-foreground">
            {result.relevantChunks ?? 0}
          </span>
        </span>
      </div>
    </Card>
  );
}

export function ContextEngineResults({
  result,
  loading,
}: ContextEngineResultsProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2Icon className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm">Running context engine...</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <BrainIcon className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm">
            Context Engine mode: smart routing decides if RAG is needed
          </p>
          <p className="text-xs text-muted-foreground/60">
            Enter a question below to classify and route
          </p>
        </div>
      </div>
    );
  }

  const retrievalResults = result.retrievalResults;
  const backends = retrievalResults ? Object.keys(retrievalResults.results) : [];
  const latencyWinner = retrievalResults?.comparison?.latencyWinner ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* Question */}
      <div className="animate-fade-in">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Question
        </p>
        <p className="text-sm text-foreground">{result.question}</p>
      </div>

      {/* Classification */}
      <ClassificationCard classification={result.classification} />

      {/* Direct answer (no retrieval) */}
      {result.directAnswer && !result.classification.needsRetrieval && (
        <Card className="animate-fade-in-up border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BrainIcon className="h-4 w-4 text-emerald-400" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Direct Answer
            </span>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {result.directAnswer}
          </p>
        </Card>
      )}

      {/* Retrieval results */}
      {retrievalResults && (
        <>
          <RetrievalMetricsBar retrievalResults={retrievalResults} />

          <div
            className={`grid gap-4 ${
              backends.length > 1 ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
            {backends.map((key) => (
              <RetrievalBackendCard
                key={key}
                backendKey={key}
                result={retrievalResults.results[key]}
                isWinner={latencyWinner === key && backends.length > 1}
              />
            ))}
          </div>
        </>
      )}

      {/* Total latency */}
      <p className="text-xs text-muted-foreground/60 text-right tabular-nums">
        Total: {result.totalLatencyMs}ms
      </p>
    </div>
  );
}
