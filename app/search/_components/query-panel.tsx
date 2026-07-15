"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { QueryResponse } from "../_types";

export function QueryPanel() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleQuery = async () => {
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), topK: 5 }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Query failed");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score > 0.7) return "text-emerald-400 border-emerald-400/30 bg-emerald-400/10";
    if (score > 0.4) return "text-primary border-primary/30 bg-primary/10";
    return "text-muted-foreground border-border bg-muted/30";
  };

  return (
    <div className="space-y-6">
      <Card className="card-hover border-border/60">
        <CardContent className="pt-6 space-y-4">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about your inventory..."
            rows={3}
            className="bg-background/50 resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleQuery();
              }
            }}
          />
          <div className="flex items-center gap-3">
            <Button
              onClick={handleQuery}
              disabled={loading || !question.trim()}
              className={cn(loading ? "" : "glow-amber-sm")}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Searching...
                </span>
              ) : (
                "Search"
              )}
            </Button>
            <span className="text-xs text-muted-foreground/50">
              Enter to search · Shift+Enter for newline
            </span>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-fade-in">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4 animate-fade-in-up">
          {result.answer && (
            <Card className="border-primary/20 card-hover">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">
                    Answer
                  </CardTitle>
                  <span className="text-xs tabular-nums text-muted-foreground/50">
                    {result.latencyMs}ms
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">
                  {result.answer}
                </p>
                {result.citations.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border/40">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60 mb-2">
                      Sources
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.citations.map((c) => (
                        <Badge
                          key={c}
                          variant="outline"
                          className="text-xs font-mono border-primary/20 text-primary/70"
                        >
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="card-hover border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Retrieved Chunks
                <span className="text-muted-foreground/50 font-normal ml-2">
                  {result.chunks.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.chunks.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  No matching chunks found.
                </p>
              ) : (
                <div className="space-y-3">
                  {result.chunks.map((chunk, i) => (
                    <div key={chunk.id}>
                      {i > 0 && <Separator className="mb-3 opacity-30" />}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <code className="text-xs tabular-nums text-muted-foreground/50">
                            {chunk.id}
                          </code>
                          <span
                            className={cn(
                              "text-xs tabular-nums px-2 py-0.5 rounded-full border",
                              scoreColor(chunk.score)
                            )}
                          >
                            {(chunk.score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/20 border border-border/30 p-3 rounded-md text-foreground/75">
                          {chunk.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
