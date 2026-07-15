"use client";

import { Badge } from "@/components/ui/badge";
import type { PineconeStatsResponse } from "../_types";

interface IndexStatsProps {
  data: PineconeStatsResponse | null;
  loading: boolean;
}

export function IndexStats({ data, loading }: IndexStatsProps) {
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

  const { stats, info } = data;
  const namespaceCount = stats.namespaces
    ? Object.keys(stats.namespaces).length
    : 0;

  const cards = [
    {
      label: "Vectors",
      value: stats.vectorCount.toLocaleString(),
      sub: null,
    },
    {
      label: "Dimension",
      value: String(stats.dimension || info.dimension || "—"),
      sub: null,
    },
    {
      label: "Metric",
      value: info.metric || "—",
      sub: null,
    },
    {
      label: "Status",
      value: info.status?.ready ? "Ready" : info.status?.state || "—",
      sub: info.host
        ? info.host.split(".")[0]
        : null,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold">{info.name}</h3>
        <Badge
          variant={info.status?.ready ? "default" : "secondary"}
          className="text-xs"
        >
          {info.status?.ready ? "Ready" : "Not ready"}
        </Badge>
        {namespaceCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {namespaceCount} namespace{namespaceCount !== 1 ? "s" : ""}
          </span>
        )}
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
            {card.sub && (
              <p className="text-xs text-muted-foreground/60 font-mono mt-0.5 truncate">
                {card.sub}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
