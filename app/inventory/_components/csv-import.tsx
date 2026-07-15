"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { ImportResponse } from "../_types";

interface CsvImportProps {
  onImported: () => void;
}

export function CsvImport({ onImported }: CsvImportProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const csv = await file.text();
      const res = await fetch("/api/items/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
      } else {
        setResult(data);
        onImported();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-xs font-medium text-primary animate-fade-in">
          {result.imported} imported
          {result.errors.length > 0 && (
            <span className="text-destructive ml-1">
              · {result.errors.length} errors
            </span>
          )}
        </span>
      )}

      {error && (
        <span className="text-xs font-medium text-destructive animate-fade-in">
          {error}
        </span>
      )}

      <label className="cursor-pointer">
        <Button variant="outline" size="sm" asChild disabled={loading}>
          <span className="gap-2">
            {loading ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Importing...
              </>
            ) : (
              <>
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Import CSV
              </>
            )}
          </span>
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleImport}
          className="hidden"
          disabled={loading}
        />
      </label>
    </div>
  );
}
