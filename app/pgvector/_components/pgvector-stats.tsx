"use client";

import { Badge } from "@/components/ui/badge";
import type { PgvectorStats } from "../_types";

interface Props {
  data: PgvectorStats | null;
  loading: boolean;
}

export function PgvectorStatsPanel({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/60 bg-card/50 p-4 animate-pulse"
          >
            <div className="h-3 w-16 bg-muted rounded mb-2" />
            <div className="h-6 w-20 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    { label: "Item Chunks", value: data.chunks.toLocaleString() },
    { label: "Doc Chunks", value: data.docChunks.toLocaleString() },
    { label: "Dimension", value: String(data.dimension) },
    { label: "Metric", value: data.metric },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold">PGlite + pgvector</h3>
        <Badge variant="default" className="text-xs">Local</Badge>
        <span className="text-xs text-muted-foreground">
          {data.items} items · {data.documents} documents
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-border/60 bg-card/50 p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              {card.label}
            </p>
            <p className="text-lg font-semibold tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
