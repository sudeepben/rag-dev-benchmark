"use client";

import { useState, useEffect, useCallback } from "react";
import { PgvectorStatsPanel } from "./_components/pgvector-stats";
import { ChunksTable } from "./_components/chunks-table";
import type { PgvectorStats } from "./_types";

export default function PgvectorPage() {
  const [stats, setStats] = useState<PgvectorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pgvector?action=stats");
      if (res.ok) setStats(await res.json());
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshKey]);

  return (
    <div className="mx-auto max-w-[1400px] py-8 px-6">
      <div className="flex items-end justify-between mb-8 animate-fade-in-up">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">PGvector</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and manage local vector embeddings
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="mb-8 animate-fade-in-up delay-1">
        <PgvectorStatsPanel data={stats} loading={loading} />
      </div>

      <div className="animate-fade-in-up delay-2">
        <h3 className="text-sm font-semibold mb-4">Chunks</h3>
        <ChunksTable
          refreshKey={refreshKey}
          onRefresh={() => setRefreshKey((k) => k + 1)}
        />
      </div>
    </div>
  );
}
