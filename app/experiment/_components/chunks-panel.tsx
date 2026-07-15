"use client";

import { useState } from "react";
import type { ExperimentRun } from "../_types";
import type { Backend, SearchResult } from "@/lib/rag/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ChunksPanelProps {
  result: ExperimentRun | null;
}

function scoreColor(score: number): string {
  if (score > 0.7) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (score > 0.4) return "bg-primary/20 text-primary border-primary/30";
  return "bg-muted text-muted-foreground border-border/60";
}

function ChunkItem({ chunk, index }: { chunk: SearchResult; index: number }) {
  return (
    <div className="animate-fade-in-up flex flex-col gap-2 rounded-lg border border-border/60 bg-card/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground truncate">
          #{index + 1} &middot; {chunk.id.slice(0, 16)}
        </span>
        <Badge
          variant="outline"
          className={cn("text-xs tabular-nums shrink-0", scoreColor(chunk.score))}
        >
          {(chunk.score * 100).toFixed(1)}%
        </Badge>
      </div>
      <div className="rounded-md bg-background/50 p-2 text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
        {chunk.content}
      </div>
      {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(chunk.metadata).slice(0, 4).map(([key, val]) => (
            <span
              key={key}
              className="text-xs text-muted-foreground/60"
            >
              {key}:{" "}
              {typeof val === "string" ? val.slice(0, 20) : String(val)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChunksPanel({ result }: ChunksPanelProps) {
  const backends = result ? (Object.keys(result.results) as Backend[]) : [];
  const [activeTab, setActiveTab] = useState<Backend>("pgvector");

  const selectedBackend = backends.includes(activeTab)
    ? activeTab
    : backends[0] ?? "pgvector";

  const chunks: SearchResult[] =
    result?.results[selectedBackend]?.chunks ?? [];

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground/50">
          Chunks will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-foreground">
        Retrieved Chunks
      </h2>

      {/* Backend tabs */}
      {backends.length > 1 && (
        <div className="flex gap-1 rounded-lg bg-background/50 p-1">
          {backends.map((backend) => (
            <button
              key={backend}
              onClick={() => setActiveTab(backend)}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                selectedBackend === backend
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {backend}
              <span className="ml-1 text-xs tabular-nums">
                ({result.results[backend]?.chunks.length ?? 0})
              </span>
            </button>
          ))}
        </div>
      )}

      {backends.length === 1 && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {selectedBackend}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {chunks.length} chunk{chunks.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Chunks list */}
      <div className="flex flex-col gap-2">
        {chunks.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 text-center py-4">
            No chunks retrieved
          </p>
        ) : (
          chunks.map((chunk, i) => (
            <ChunkItem key={chunk.id} chunk={chunk} index={i} />
          ))
        )}
      </div>
    </div>
  );
}
