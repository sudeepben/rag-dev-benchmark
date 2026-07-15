"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PgvectorRecord, PgvectorListResponse } from "../_types";

interface Props {
  refreshKey: number;
  onRefresh: () => void;
}

export function ChunksTable({ refreshKey, onRefresh }: Props) {
  const [data, setData] = useState<PgvectorListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [table, setTable] = useState<"chunks" | "doc_chunks">("chunks");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: "list",
        table,
        page: String(page),
        pageSize: "50",
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/pgvector?${params}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [table, page, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await fetch("/api/pgvector", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, table }),
      });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onRefresh();
      fetchData();
    } catch {
      // Ignore
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      await fetch("/api/pgvector", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), table }),
      });
      setSelected(new Set());
      onRefresh();
      fetchData();
    } catch {
      // Ignore
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!data) return;
    const allIds = data.records.map((r) => r.id);
    if (selected.size === allIds.length && allIds.every((id) => selected.has(id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const truncate = (s: string, len: number) =>
    s.length > len ? s.slice(0, len) + "..." : s;

  return (
    <div className="space-y-4">
      {/* Table selector + search */}
      <div className="flex items-end gap-3 flex-wrap rounded-lg border border-border/60 bg-card/50 p-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Source
          </label>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={table === "chunks" ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => {
                setTable("chunks");
                setPage(1);
                setSelected(new Set());
              }}
            >
              Inventory Chunks
            </Button>
            <Button
              size="sm"
              variant={table === "doc_chunks" ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => {
                setTable("doc_chunks");
                setPage(1);
                setSelected(new Set());
              }}
            >
              Document Chunks
            </Button>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex items-end gap-2 flex-1">
          <div className="space-y-1.5 flex-1">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Search
            </label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, content, or ref ID..."
              className="h-8 text-sm bg-background/50"
            />
          </div>
          <Button type="submit" size="sm" className="h-8">
            Search
          </Button>
        </form>

        {selected.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs text-destructive border-destructive/30"
            onClick={handleDeleteSelected}
            disabled={deleting}
          >
            Delete {selected.size} selected
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <table className="w-full text-sm data-table">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  checked={
                    !!data &&
                    data.records.length > 0 &&
                    data.records.every((r) => selected.has(r.id))
                  }
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Chunk ID
              </th>
              <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {table === "doc_chunks" ? "Doc ID" : "Item ID"}
              </th>
              <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Content Preview
              </th>
              <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Created
              </th>
              <th className="w-16 p-3" />
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-xs">Loading chunks...</span>
                  </div>
                </td>
              </tr>
            ) : !data || data.records.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-muted-foreground">
                  <p className="text-sm">No chunks found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {search
                      ? "Try adjusting your search"
                      : "Import data to create vector embeddings"}
                  </p>
                </td>
              </tr>
            ) : (
              data.records.map((record: PgvectorRecord) => {
                const isExpanded = expandedId === record.id;

                return (
                  <tr
                    key={record.id}
                    className={cn(
                      "border-b border-border/40 last:border-0",
                      selected.has(record.id) && "bg-primary/5"
                    )}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(record.id)}
                        onChange={() => toggleSelect(record.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="p-3">
                      <button
                        className="font-mono text-xs text-primary/80 hover:text-primary transition-colors text-left"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : record.id)
                        }
                      >
                        {truncate(record.id, 35)}
                      </button>
                      {isExpanded && (
                        <div className="mt-2 p-3 rounded-md bg-muted/30 border border-border/40 text-xs space-y-1 animate-fade-in">
                          <p>
                            <span className="text-muted-foreground">Full ID: </span>
                            <span className="font-mono break-all">{record.id}</span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              {table === "doc_chunks" ? "Doc" : "Item"} ID:{" "}
                            </span>
                            <span className="font-mono break-all">{record.refId}</span>
                          </p>
                          {record.metadata && (
                            <p>
                              <span className="text-muted-foreground">Metadata: </span>
                              <span className="font-mono">
                                {JSON.stringify(record.metadata)}
                              </span>
                            </p>
                          )}
                          {record.content && (
                            <div className="mt-2">
                              <p className="text-muted-foreground mb-1">Content:</p>
                              <p className="whitespace-pre-wrap text-foreground/70 bg-background/50 p-2 rounded border border-border/30 max-h-[200px] overflow-y-auto">
                                {record.content}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {truncate(record.refId, 20)}
                    </td>
                    <td className="p-3 text-xs text-foreground/60 max-w-[300px]">
                      {record.content ? (
                        truncate(record.content, 80)
                      ) : (
                        <span className="text-muted-foreground/40">&mdash;</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground/60 whitespace-nowrap">
                      {record.createdAt
                        ? new Date(record.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDelete(record.id)}
                        disabled={deleting}
                        className="text-xs text-muted-foreground/50 hover:text-destructive transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground tabular-nums">
            Page {data.page}/{data.totalPages} &middot; {data.total} total
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <span className="px-2 text-muted-foreground tabular-nums tabular-nums">
              {page}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={page >= data.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {data && data.total > 0 && (
        <div className="text-xs text-muted-foreground/40">
          {data.total} chunks in {table === "doc_chunks" ? "doc_chunks" : "chunks"} table
        </div>
      )}
    </div>
  );
}
