"use client";

import { useState, useEffect, useCallback } from "react";
import type { ExperimentRun } from "../_types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, ChevronRightIcon, Trash2Icon } from "lucide-react";

interface ExperimentHistoryProps {
  refreshKey: number;
  onSelect: (run: ExperimentRun) => void;
}

function timeAgo(date: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function scoreColor(score: number): string {
  if (score >= 0.8) return "text-green-400";
  if (score >= 0.5) return "text-yellow-400";
  return "text-red-400";
}

export function ExperimentHistory({
  refreshKey,
  onSelect,
}: ExperimentHistoryProps) {
  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/experiment/history");
      if (res.ok) {
        const data = await res.json();
        setRuns(Array.isArray(data) ? data : data.runs ?? []);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshKey]);

  const handleClear = async () => {
    try {
      await fetch("/api/experiment/history", { method: "DELETE" });
      setRuns([]);
    } catch {
      // silently ignore
    }
  };

  if (runs.length === 0 && !loading) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-card/30">
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronDownIcon className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRightIcon className="h-4 w-4 shrink-0" />
        )}
        <span>Experiment History</span>
        <Badge variant="secondary" className="ml-auto text-xs px-1.5">
          {runs.length}
        </Badge>
      </button>

      {open && (
        <div className="border-t border-border/40">
          <div className="overflow-x-auto">
            <table className="data-table w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                  <th className="px-3 py-2 text-left font-medium">Question</th>
                  <th className="px-3 py-2 text-left font-medium">Backends</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Top Score
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Latency</th>
                  <th className="px-3 py-2 text-left font-medium">Winner</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const backends = Object.keys(run.results);
                  const topScore = Math.max(
                    ...backends.map((b) => run.results[b].topScore)
                  );
                  const winner =
                    run.comparison?.latencyWinner ??
                    run.comparison?.scoreWinner ??
                    null;

                  return (
                    <tr
                      key={run.id}
                      onClick={() => onSelect(run)}
                      className="cursor-pointer border-b border-border/20 hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {timeAgo(run.createdAt)}
                      </td>
                      <td
                        className="px-3 py-2 max-w-[200px] truncate"
                        title={run.question}
                      >
                        {run.question.length > 50
                          ? run.question.slice(0, 50) + "\u2026"
                          : run.question}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          {backends.map((b) => (
                            <Badge
                              key={b}
                              variant="outline"
                              className="font-mono text-xs px-1.5 py-0"
                            >
                              {b}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${scoreColor(topScore)}`}
                      >
                        {topScore.toFixed(3)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">
                        {run.totalLatencyMs}ms
                      </td>
                      <td className="px-3 py-2">
                        {winner ? (
                          <Badge
                            variant="outline"
                            className="font-mono text-xs px-1.5 py-0 border-primary/40 text-primary"
                          >
                            {winner}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/50">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Clear button */}
          <div className="flex justify-end px-3 py-2 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-xs text-muted-foreground hover:text-destructive h-7 px-2"
            >
              <Trash2Icon className="h-3 w-3 mr-1" />
              Clear History
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
