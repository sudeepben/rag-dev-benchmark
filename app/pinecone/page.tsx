"use client";

import { useState, useEffect, useCallback } from "react";
import { IndexStats } from "./_components/index-stats";
import { VectorsTable } from "./_components/vectors-table";
import type { PineconeStatsResponse } from "./_types";

export default function PineconePage() {
  const [statsData, setStatsData] = useState<PineconeStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pinecone?action=stats");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load Pinecone data");
      } else {
        setStatsData(data);
      }
    } catch {
      setError("Network error");
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
          <h2 className="text-xl font-semibold tracking-tight">Pinecone</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage vectors and inspect your Pinecone index
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="animate-fade-in-up delay-1">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Check your PINECONE_API_KEY and PINECONE_INDEX_NAME in .env.local
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8 animate-fade-in-up delay-1">
            <IndexStats data={statsData} loading={loading} />
          </div>

          <div className="animate-fade-in-up delay-2">
            <h3 className="text-sm font-semibold mb-4">Vectors</h3>
            <VectorsTable
              refreshKey={refreshKey}
              onRefresh={() => setRefreshKey((k) => k + 1)}
            />
          </div>
        </>
      )}
    </div>
  );
}
