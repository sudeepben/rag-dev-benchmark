"use client";

import type { ExperimentRun } from "../_types";
import type { BackendResult } from "@/lib/rag/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sources,
  SourcesTrigger,
  SourcesContent,
  Source,
} from "@/components/ai-elements/sources";
import { Loader2Icon, ZapIcon, TrophyIcon } from "lucide-react";

interface ResultsPanelProps {
  result: ExperimentRun | null;
  loading: boolean;
}

function MetricsBar({ result }: { result: ExperimentRun }) {
  const { comparison, results } = result;
  const backends = Object.keys(results);

  return (
    <div className="animate-fade-in flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/50 px-4 py-3">
      {comparison && (
        <>
          <div className="flex items-center gap-1.5">
            <ZapIcon className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Embedding
            </span>
            <span className="text-sm tabular-nums text-foreground">
              {comparison.embeddingLatencyMs}ms
            </span>
          </div>
          <Separator orientation="vertical" className="h-4 bg-border/40" />
        </>
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

function BackendCard({
  result,
  isWinner,
}: {
  result: BackendResult;
  isWinner: boolean;
}) {
  return (
    <Card className="card-hover animate-fade-in-up border-border/60 bg-card/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="outline" className="font-mono text-xs">
          {result.backend}
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

      {result.citations.length > 0 && (
        <div className="mb-3">
          <Sources>
            <SourcesTrigger count={result.citations.length} />
            <SourcesContent>
              {result.citations.map((citation, i) => (
                <Source key={i} title={citation} />
              ))}
            </SourcesContent>
          </Sources>
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
            {result.topScore.toFixed(3)}
          </span>
        </span>
        <span>
          Relevant:{" "}
          <span className="tabular-nums text-foreground">
            {result.relevantChunks}
          </span>
        </span>
      </div>
    </Card>
  );
}

export function ResultsPanel({ result, loading }: ResultsPanelProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2Icon className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm">Running experiment...</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ZapIcon className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm">
            Enter a question below to run an experiment
          </p>
          <p className="text-xs text-muted-foreground/60">
            Configure parameters in the left panel
          </p>
        </div>
      </div>
    );
  }

  const backends = Object.keys(result.results);
  const latencyWinner = result.comparison?.latencyWinner ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* Question */}
      <div className="animate-fade-in">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Question
        </p>
        <p className="text-sm text-foreground">{result.question}</p>
      </div>

      {/* Metrics bar */}
      <MetricsBar result={result} />

      {/* Backend results */}
      <div
        className={`grid gap-4 ${
          backends.length > 1 ? "grid-cols-2" : "grid-cols-1"
        }`}
      >
        {backends.map((key) => (
          <BackendCard
            key={key}
            result={result.results[key]}
            isWinner={latencyWinner === key && backends.length > 1}
          />
        ))}
      </div>

      {/* Total latency */}
      <p className="text-xs text-muted-foreground/60 text-right tabular-nums">
        Total: {result.totalLatencyMs}ms
      </p>
    </div>
  );
}
