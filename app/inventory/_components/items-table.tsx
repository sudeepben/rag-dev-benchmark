"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ItemDialog } from "./item-dialog";
import type { Item, ItemsResponse } from "../_types";

interface ItemsTableProps {
  refreshKey: number;
}

export function ItemsTable({ refreshKey }: ItemsTableProps) {
  const [data, setData] = useState<ItemsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", "20");
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      if (brand) params.set("brand", brand);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);

      const res = await fetch(`/api/items?${params}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [page, search, category, brand, minPrice, maxPrice]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshKey]);

  const handleDelete = async (id: string) => {
    await fetch("/api/items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchItems();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchItems();
  };

  const resetFilters = () => {
    setSearch("");
    setCategory("");
    setBrand("");
    setMinPrice("");
    setMaxPrice("");
    setPage(1);
  };

  const formatPrice = (price: string | null) =>
    price ? `$${parseFloat(price).toFixed(2)}` : "\u2014";

  const hasFilters = search || category || brand || minPrice || maxPrice;

  return (
    <div className="space-y-4">
      {/* Edit Dialog */}
      <ItemDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        item={editItem}
        onSaved={fetchItems}
      />

      {/* Filters */}
      <form
        onSubmit={handleSearch}
        className="grid grid-cols-[1fr_1fr_1fr_auto_auto_auto] items-end gap-x-4 gap-y-3 rounded-lg border border-border/60 bg-card/50 p-5"
      >
        <div className="space-y-2">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Search
          </label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, SKU..."
            className="h-9 text-sm bg-background/50"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="h-9 w-full rounded-md border border-input bg-background/50 px-3 text-sm focus:outline-none"
          >
            <option value="">All</option>
            {data?.filters.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Brand
          </label>
          <select
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
              setPage(1);
            }}
            className="h-9 w-full rounded-md border border-input bg-background/50 px-3 text-sm focus:outline-none"
          >
            <option value="">All</option>
            {data?.filters.brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Price range
          </label>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min"
              className="w-[80px] h-9 text-sm bg-background/50"
            />
            <span className="text-muted-foreground/40 text-xs">&ndash;</span>
            <Input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max"
              className="w-[80px] h-9 text-sm bg-background/50"
            />
          </div>
        </div>

        <Button type="submit" size="sm" className="h-9 px-5 glow-amber-sm self-end">
          Filter
        </Button>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground self-end"
            onClick={resetFilters}
          >
            Reset
          </Button>
        )}
      </form>

      {/* Table */}
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <table className="w-full text-sm data-table">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                SKU
              </th>
              <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Name
              </th>
              <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Category
              </th>
              <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Brand
              </th>
              <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Price
              </th>
              <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Discount
              </th>
              <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Stock
              </th>
              <th className="w-24 p-3" />
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr>
                <td colSpan={8} className="p-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-xs">Loading inventory...</span>
                  </div>
                </td>
              </tr>
            ) : !data || data.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-10 w-10 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground/40">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"
                        />
                      </svg>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No items found
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      Import a CSV or add items manually
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              data.items.map((item: Item) => (
                <tr
                  key={item.id}
                  className="border-b border-border/40 last:border-0"
                >
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {item.sku || "\u2014"}
                  </td>
                  <td className="p-3">
                    <div>
                      <span className="font-medium text-foreground/90">
                        {item.name}
                      </span>
                      {item.description && (
                        <p className="text-xs text-muted-foreground/70 line-clamp-1 mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    {item.category ? (
                      <Badge
                        variant="secondary"
                        className="text-xs font-medium"
                      >
                        {item.category}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground/40">&mdash;</span>
                    )}
                  </td>
                  <td className="p-3 text-foreground/70">
                    {item.brand || (
                      <span className="text-muted-foreground/40">&mdash;</span>
                    )}
                  </td>
                  <td className="p-3 text-right text-xs tabular-nums">
                    {item.price ? (
                      <span className="text-primary/90">
                        {formatPrice(item.price)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">&mdash;</span>
                    )}
                  </td>
                  <td className="p-3 text-right text-xs tabular-nums">
                    {item.discount ? (
                      <span className="text-emerald-400">{item.discount}%</span>
                    ) : (
                      <span className="text-muted-foreground/40">&mdash;</span>
                    )}
                  </td>
                  <td className="p-3 text-right text-xs tabular-nums">
                    <span
                      className={cn(
                        item.stock > 0
                          ? "text-foreground/70"
                          : "text-destructive/70"
                      )}
                    >
                      {item.stock}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditItem(item);
                          setEditOpen(true);
                        }}
                        className="text-xs text-muted-foreground/50 hover:text-primary transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-xs text-muted-foreground/50 hover:text-destructive transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground tabular-nums">
            {(page - 1) * data.pageSize + 1}&ndash;
            {Math.min(page * data.pageSize, data.total)}{" "}
            <span className="text-muted-foreground/50">of {data.total}</span>
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Total count */}
      {data && data.total > 0 && (
        <div className="text-xs text-muted-foreground/40">
          {data.total} items &middot; page {data.page}/{data.totalPages}
        </div>
      )}
    </div>
  );
}
