"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { VectorRecord, ListResponse, FetchResponse } from "../_types";

interface VectorsTableProps {
  refreshKey: number;
  onRefresh: () => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function VectorsTable({ refreshKey, onRefresh }: VectorsTableProps) {
  const [records, setRecords] = useState<VectorRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Pagination state
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(0);
  // Store token returned by each page, so we can go forward
  // tokens[0] = undefined (first page), tokens[1] = token for page 2, etc.
  const [tokens, setTokens] = useState<(string | undefined)[]>([undefined]);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Filters
  const [prefix, setPrefix] = useState("");
  const [itemIdFilter, setItemIdFilter] = useState("");
  const [contentFilter, setContentFilter] = useState("");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Track whether filters have been applied (to show "active" state)
  const appliedFilters = useRef({ prefix: "", itemId: "", content: "" });

  const loadPage = useCallback(
    async (page: number, pSize?: number) => {
      const size = pSize ?? pageSize;
      setLoading(true);
      try {
        const token = tokens[page];
        const params = new URLSearchParams({ action: "list", limit: String(size) });
        if (appliedFilters.current.prefix) params.set("prefix", appliedFilters.current.prefix);
        if (token) params.set("token", token);

        const res = await fetch(`/api/pinecone?${params}`);
        if (!res.ok) {
          setRecords([]);
          setHasNextPage(false);
          return;
        }

        const data: ListResponse = await res.json();
        setHasNextPage(!!data.nextToken);

        // Store the next token for the following page
        if (data.nextToken) {
          setTokens((prev) => {
            const updated = [...prev];
            updated[page + 1] = data.nextToken;
            return updated;
          });
        }

        // Fetch details for this page's IDs
        if (data.ids.length > 0) {
          await fetchDetails(data.ids);
        } else {
          setRecords([]);
        }

        setCurrentPage(page);
      } catch {
        setRecords([]);
      } finally {
        setLoading(false);
      }
    },
    [pageSize, tokens]
  );

  const fetchDetails = async (vectorIds: string[]) => {
    if (vectorIds.length === 0) return;
    setFetching(true);
    try {
      const allRecords: VectorRecord[] = [];
      for (let i = 0; i < vectorIds.length; i += 100) {
        const batch = vectorIds.slice(i, i + 100);
        const res = await fetch(
          `/api/pinecone?action=fetch&ids=${batch.join(",")}`
        );
        if (res.ok) {
          const data: FetchResponse = await res.json();
          allRecords.push(...data.records);
        }
      }
      setRecords(allRecords);
    } catch {
      // Ignore
    } finally {
      setFetching(false);
    }
  };

  // Initial load + refresh
  useEffect(() => {
    resetAndLoad();
  }, [refreshKey]);

  const resetAndLoad = (pSize?: number) => {
    setCurrentPage(0);
    setTokens([undefined]);
    setHasNextPage(false);
    setSelected(new Set());
    setExpandedId(null);
    loadPage(0, pSize);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    appliedFilters.current = {
      prefix: prefix.trim(),
      itemId: itemIdFilter.trim().toLowerCase(),
      content: contentFilter.trim().toLowerCase(),
    };
    resetAndLoad();
  };

  const handleClearFilters = () => {
    setPrefix("");
    setItemIdFilter("");
    setContentFilter("");
    appliedFilters.current = { prefix: "", itemId: "", content: "" };
    resetAndLoad();
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    resetAndLoad(newSize);
  };

  const goNext = () => {
    if (hasNextPage) loadPage(currentPage + 1);
  };

  const goPrev = () => {
    if (currentPage > 0) loadPage(currentPage - 1);
  };

  // Client-side filters (item_id and content) applied on top of Pinecone prefix filter
  const filteredRecords = records.filter((r) => {
    const itemId = ((r.metadata?.item_id as string) || "").toLowerCase();
    const content = ((r.metadata?.content as string) || "").toLowerCase();

    if (appliedFilters.current.itemId && !itemId.includes(appliedFilters.current.itemId)) {
      return false;
    }
    if (appliedFilters.current.content && !content.includes(appliedFilters.current.content)) {
      return false;
    }
    return true;
  });

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await fetch("/api/pinecone/vectors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onRefresh();
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
      await fetch("/api/pinecone/vectors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      setRecords((prev) => prev.filter((r) => !selected.has(r.id)));
      setSelected(new Set());
      onRefresh();
    } catch {
      // Ignore
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Delete ALL vectors? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetch("/api/pinecone/vectors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setRecords([]);
      setSelected(new Set());
      setTokens([undefined]);
      setHasNextPage(false);
      setCurrentPage(0);
      onRefresh();
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
    const allIds = filteredRecords.map((r) => r.id);
    if (selected.size === allIds.length && allIds.every((id) => selected.has(id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const truncate = (s: string, len: number) =>
    s.length > len ? s.slice(0, len) + "..." : s;

  const hasActiveFilters =
    appliedFilters.current.prefix ||
    appliedFilters.current.itemId ||
    appliedFilters.current.content;

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <form
        onSubmit={handleSearch}
        className="rounded-lg border border-border/60 bg-card/50 p-4"
      >
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              ID Prefix
            </label>
            <Input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="Filter by vector ID prefix..."
              className="h-8 text-sm bg-background/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Item ID
            </label>
            <Input
              value={itemIdFilter}
              onChange={(e) => setItemIdFilter(e.target.value)}
              placeholder="Filter by item ID..."
              className="h-8 text-sm bg-background/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Content
            </label>
            <Input
              value={contentFilter}
              onChange={(e) => setContentFilter(e.target.value)}
              placeholder="Search content..."
              className="h-8 text-sm bg-background/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" className="h-8 px-4">
              Filter
            </Button>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground"
                onClick={handleClearFilters}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* Actions bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Per page
          </label>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="h-7 rounded-md border border-input bg-background/50 px-2 text-xs focus:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {selected.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-destructive border-destructive/30"
              onClick={handleDeleteSelected}
              disabled={deleting}
            >
              Delete {selected.size} selected
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive"
            onClick={handleDeleteAll}
            disabled={deleting || records.length === 0}
          >
            Delete all
          </Button>
        </div>
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
                    filteredRecords.length > 0 &&
                    filteredRecords.every((r) => selected.has(r.id))
                  }
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Vector ID
              </th>
              <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Item ID
              </th>
              <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Content Preview
              </th>
              <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Chunk
              </th>
              <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dims
              </th>
              <th className="w-16 p-3" />
            </tr>
          </thead>
          <tbody>
            {loading && records.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-xs">Loading vectors...</span>
                  </div>
                </td>
              </tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-muted-foreground">
                  <p className="text-sm">No vectors found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {hasActiveFilters
                      ? "Try adjusting your filters"
                      : "Import data on the Inventory page to populate Pinecone"}
                  </p>
                </td>
              </tr>
            ) : (
              filteredRecords.map((record) => {
                const content =
                  (record.metadata?.content as string) || "";
                const itemId =
                  (record.metadata?.item_id as string) || "\u2014";
                const chunkIndex = record.metadata?.chunk_index;
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
                            <span className="text-muted-foreground">
                              Full ID:{" "}
                            </span>
                            <span className="font-mono break-all">{record.id}</span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              Item ID:{" "}
                            </span>
                            <span className="font-mono break-all">{itemId}</span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              Chunk Index:{" "}
                            </span>
                            <span className="font-mono">
                              {String(chunkIndex ?? "\u2014")}
                            </span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              Dimensions:{" "}
                            </span>
                            <span className="font-mono">
                              {record.dimension || "\u2014"}
                            </span>
                          </p>
                          {content && (
                            <div className="mt-2">
                              <p className="text-muted-foreground mb-1">
                                Content:
                              </p>
                              <p className="whitespace-pre-wrap text-foreground/70 bg-background/50 p-2 rounded border border-border/30 max-h-[200px] overflow-y-auto">
                                {content}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {truncate(itemId, 20)}
                    </td>
                    <td className="p-3 text-xs text-foreground/60 max-w-[300px]">
                      {content ? (
                        truncate(content, 80)
                      ) : (
                        <span className="text-muted-foreground/40">&mdash;</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono text-xs text-muted-foreground">
                      {chunkIndex != null ? String(chunkIndex) : "\u2014"}
                    </td>
                    <td className="p-3 text-right font-mono text-xs text-muted-foreground">
                      {record.dimension || "\u2014"}
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

      {/* Pagination footer */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-mono">
          Page {currentPage + 1}
          {" \u00b7 "}
          {filteredRecords.length}
          {filteredRecords.length !== records.length && ` of ${records.length}`}
          {" vectors"}
          {fetching && (
            <span className="ml-2 text-primary animate-pulse">
              fetching details...
            </span>
          )}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-3 text-xs"
            disabled={currentPage === 0 || loading}
            onClick={goPrev}
          >
            Prev
          </Button>
          <span className="px-2 text-muted-foreground font-mono tabular-nums">
            {currentPage + 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-3 text-xs"
            disabled={!hasNextPage || loading}
            onClick={goNext}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
