"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface ResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
}

export function ResetDialog({ open, onOpenChange, onReset }: ResetDialogProps) {
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const handleReset = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/items/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult(data.error || "Reset failed");
      } else {
        setResult(data.message);
        setConfirmation("");
        onReset();
        setTimeout(() => {
          onOpenChange(false);
          setResult(null);
        }, 1500);
      }
    } catch {
      setResult("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); setConfirmation(""); setResult(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">Hard Reset Inventory</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>all items</strong>, their <strong>vector embeddings</strong> from pgvector, and <strong>all related vectors from Pinecone</strong>. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Type &quot;RESET&quot; to confirm
            </label>
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="RESET"
              className="bg-background/50 text-sm font-mono"
            />
          </div>

          {result && (
            <div className="p-2 rounded-md text-xs bg-destructive/10 border border-destructive/20 text-destructive">
              {result}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={loading || confirmation !== "RESET"}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Resetting...
              </span>
            ) : (
              "Delete Everything"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
