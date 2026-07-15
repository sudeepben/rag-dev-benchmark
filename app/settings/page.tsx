"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Stats {
  counts: {
    items: number;
    chunks: number;
    documents: number;
    doc_chunks: number;
    experiments: number;
  };
  pinecone: {
    configured: boolean;
    stats?: {
      vectorCount: number;
      dimension?: number;
      indexFullness?: number;
    };
  };
  openai: {
    configured: boolean;
  };
  env: Record<string, boolean>;
}

const ENV_VARS = [
  "OPENAI_API_KEY",
  "PINECONE_API_KEY",
  "PINECONE_INDEX_NAME",
  "PINECONE_CLOUD",
  "PINECONE_REGION",
] as const;

export default function SettingsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [seedLoading, setSeedLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleSeed = async () => {
    setSeedLoading(true);
    setActionResult(null);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setActionResult(
          `Seeded ${data.items} items, ${data.chunks} chunks${data.pinecone ? `, ${data.pinecone.upserted} Pinecone vectors` : ""}`
        );
        fetchStats();
      } else {
        setActionResult(`Error: ${data.error}`);
      }
    } catch (err) {
      setActionResult(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setSeedLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setResetLoading(true);
    setActionResult(null);
    setConfirmReset(false);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const d = data.deleted;
        const total = d.items + d.chunks + d.documents + d.doc_chunks + d.experiments;
        setActionResult(
          `Cleared ${total} rows (${d.items} items, ${d.chunks} chunks, ${d.documents} docs, ${d.doc_chunks} doc chunks, ${d.experiments} experiments)${data.pineconeCleared ? " + Pinecone vectors" : ""}`
        );
        fetchStats();
      } else {
        setActionResult(`Error: ${data.error}`);
      }
    } catch (err) {
      setActionResult(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setResetLoading(false);
    }
  };

  const maskKey = (key: string): string => {
    if (key.length <= 8) return "****";
    return key.slice(0, 7) + "..." + key.slice(-4);
  };

  return (
    <div className="mx-auto max-w-3xl py-8 px-6">
      <div className="mb-8 animate-fade-in-up">
        <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          System configuration, status, and quick actions
        </p>
      </div>

      {/* Connection Status */}
      <div className="mb-8 animate-fade-in-up delay-1">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3 block">
          Connection Status
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4 border-border/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">OpenAI</span>
              <Badge variant={stats?.openai?.configured ? "default" : "destructive"}>
                {stats?.openai?.configured ? "Connected" : "Not Configured"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.openai?.configured
                ? maskKey(process.env.NEXT_PUBLIC_OPENAI_KEY_HINT || "sk-proj-...configured")
                : "Set OPENAI_API_KEY"}
            </p>
          </Card>

          <Card className="p-4 border-border/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Pinecone</span>
              <Badge variant={stats?.pinecone?.configured ? "default" : "secondary"}>
                {stats?.pinecone?.configured ? "Connected" : "Optional"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.pinecone?.configured
                ? `Index: ${stats.pinecone.stats?.dimension ?? "?"}d`
                : "Not configured"}
            </p>
          </Card>

          <Card className="p-4 border-border/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">PGlite</span>
              <Badge variant="default">Available</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Local embedded database
            </p>
          </Card>
        </div>
      </div>

      {/* Database Stats */}
      <div className="mb-8 animate-fade-in-up delay-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3 block">
          Database Stats
        </label>
        <Card className="border-border/60 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading stats...
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left p-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Table
                  </th>
                  <th className="text-right p-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Items", key: "items" },
                  { label: "Chunks", key: "chunks" },
                  { label: "Documents", key: "documents" },
                  { label: "Doc Chunks", key: "doc_chunks" },
                  { label: "Experiments", key: "experiments" },
                ].map((row) => (
                  <tr key={row.key} className="border-b border-border/20 last:border-0">
                    <td className="p-3 text-muted-foreground">{row.label}</td>
                    <td className="p-3 text-right tabular-nums">
                      {stats?.counts?.[row.key as keyof typeof stats.counts] ?? 0}
                    </td>
                  </tr>
                ))}
                {stats?.pinecone?.configured && (
                  <tr className="border-b border-border/20 last:border-0">
                    <td className="p-3 text-muted-foreground">Pinecone Vectors</td>
                    <td className="p-3 text-right tabular-nums">
                      {stats.pinecone.stats?.vectorCount ?? "—"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="mb-8 animate-fade-in-up delay-3">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3 block">
          Quick Actions
        </label>
        <Card className="p-4 border-border/60">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Button
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={handleSeed}
              disabled={seedLoading}
            >
              {seedLoading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 mr-1.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Seeding...
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Seed Sample Data
                </>
              )}
            </Button>

            <Button
              variant="destructive"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={handleReset}
              disabled={resetLoading}
            >
              {resetLoading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 mr-1.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Clearing...
                </>
              ) : confirmReset ? (
                "Confirm Clear All?"
              ) : (
                <>
                  <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  Clear All Data
                </>
              )}
            </Button>
          </div>

          {actionResult && (
            <div className={`text-xs p-2 rounded ${actionResult.startsWith("Error") ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
              {actionResult}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/30">
            <Link href="/inventory">
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
                Inventory
              </Button>
            </Link>
            <Link href="/documents">
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
                Documents
              </Button>
            </Link>
            <Link href="/experiment">
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
                Experiments
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Environment */}
      <div className="animate-fade-in-up delay-4">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3 block">
          Environment Variables
        </label>
        <Card className="border-border/60 overflow-hidden">
          <div className="divide-y divide-border/20">
            {ENV_VARS.map((varName) => {
              const isSet = stats?.env?.[varName] ?? false;
              return (
                <div key={varName} className="flex items-center justify-between p-3">
                  <span className="text-sm font-mono text-muted-foreground">
                    {varName}
                  </span>
                  <span className={`text-sm ${isSet ? "text-green-500" : "text-red-400"}`}>
                    {isSet ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
