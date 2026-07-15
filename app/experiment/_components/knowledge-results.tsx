"use client";

import type { KnowledgeAugmentedResponse } from "../_types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Loader2Icon,
  ZapIcon,
  TrophyIcon,
  PenLineIcon,
  SearchIcon,
  CheckCircle2Icon,
  ArrowRightIcon,
} from "lucide-react";

interface KnowledgeResultsProps {
  result: KnowledgeAugmentedResponse | null;
  loading: boolean;
}

function StepHeader({
  step,
  title,
  icon: Icon,
  latencyMs,
}: {
  step: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  latencyMs?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
        {step}
      </div>
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
      {latencyMs !== undefined && (
        <Badge
          variant="outline"
          className="ml-auto text-xs tabular-nums border-border/60 font-mono"
        >
          {latencyMs}ms
        </Badge>
      )}
    </div>
  );
}

function RetrievalMetricsBar({
  result,
}: {
  result: KnowledgeAugmentedResponse;
}) {
  const backends = Object.keys(result.results);
  const { comparison } = result;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-background/30 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <ZapIcon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Embedding
        </span>
        <span className="text-sm tabular-nums text-foreground">
          {result.embeddingLatencyMs}ms
        </span>
      </div>

      {backends.length > 0 && (
        <Separator orientation="vertical" className="h-4 bg-border/40" />
      )}

      {backends.map((key) => {
        const r = result.results[key];
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

function BackendChunkSummary({ result }: { result: any; backendKey: string }) {
  return (
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
  );
}

export function KnowledgeResults({ result, loading }: KnowledgeResultsProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2Icon className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm">
            Running knowledge-augmented pipeline...
          </span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <PenLineIcon className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm">
            Knowledge Augmented mode: draft, retrieve, then ground
          </p>
          <p className="text-xs text-muted-foreground/60">
            Enter a question below to run the full pipeline
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
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Question
        </p>
        <p className="text-sm text-foreground">{result.question}</p>
      </div>

      {/* Step 1 - Draft Answer */}
      <Card className="animate-fade-in-up border-amber-500/30 bg-amber-500/5 p-4">
        <StepHeader
          step={1}
          title="Draft Answer"
          icon={PenLineIcon}
          latencyMs={result.draftAnswer.latencyMs}
        />
        <div className="rounded-md bg-amber-500/5 border border-amber-500/20 p-3">
          <p className="text-sm leading-relaxed text-foreground/90">
            {result.draftAnswer.text}
          </p>
        </div>
      </Card>

      {/* Step 2 - Retrieval */}
      <Card className="animate-fade-in-up border-border/60 bg-card/50 p-4">
        <StepHeader
          step={2}
          title="Retrieval"
          icon={SearchIcon}
          latencyMs={result.embeddingLatencyMs}
        />

        <div className="flex flex-col gap-3">
          <RetrievalMetricsBar result={result} />

          {backends.map((key) => {
            const r = result.results[key];
            const isWinner = latencyWinner === key && backends.length > 1;
            return (
              <div
                key={key}
                className="rounded-md border border-border/60 bg-background/30 p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {r.backend ?? key}
                  </Badge>
                  {isWinner && (
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      <TrophyIcon className="h-3 w-3 mr-1" />
                      Winner
                    </Badge>
                  )}
                  {r.abstained && (
                    <Badge
                      variant="secondary"
                      className="text-muted-foreground"
                    >
                      Abstained
                    </Badge>
                  )}
                  {r.error && (
                    <Badge variant="destructive">{r.error}</Badge>
                  )}
                </div>
                <BackendChunkSummary result={r} backendKey={key} />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Step 3 - Final Answer */}
      {result.finalAnswer && (
        <Card className="animate-fade-in-up border-emerald-500/30 bg-emerald-500/5 p-4">
          <StepHeader
            step={3}
            title="Final Answer"
            icon={CheckCircle2Icon}
            latencyMs={result.finalAnswer.latencyMs}
          />
          <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 p-3">
            <p className="text-sm leading-relaxed text-foreground/90">
              {result.finalAnswer.text}
            </p>
          </div>

          {result.finalAnswer.citations.length > 0 && (
            <div className="mt-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Citations
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {result.finalAnswer.citations.map((citation, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-xs border-emerald-500/30 text-emerald-400"
                  >
                    {citation}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Draft vs Final comparison */}
      {result.finalAnswer && (
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Draft vs Final Comparison
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-amber-400 mb-2 block">
                Draft (model knowledge)
              </span>
              <p className="text-xs leading-relaxed text-foreground/70">
                {result.draftAnswer.text}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-400 mb-2 block">
                Final (grounded)
              </span>
              <p className="text-xs leading-relaxed text-foreground/70">
                {result.finalAnswer.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Total latency */}
      <p className="text-xs text-muted-foreground/60 text-right tabular-nums">
        Total: {result.totalLatencyMs}ms
      </p>
    </div>
  );
}
