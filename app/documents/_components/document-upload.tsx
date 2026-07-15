"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Document } from "../_types";

export function DocumentUpload() {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Edit state
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Reset state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) setDocuments(await res.json());
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleSubmit = async () => {
    if (!name.trim() || !content.trim()) {
      setMessage({ text: "Name and content are required", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/documents/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), content: content.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({
          text: data.error || "Failed to ingest document",
          type: "error",
        });
      } else {
        setMessage({ text: data.message, type: "success" });
        setName("");
        setContent("");
        fetchDocuments();
      }
    } catch {
      setMessage({ text: "Network error", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // PDF files: send directly via FormData (binary)
    if (file.name.toLowerCase().endsWith(".pdf")) {
      setLoading(true);
      setMessage(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", file.name);

        const res = await fetch("/api/documents/ingest", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage({ text: data.error || "Failed to ingest PDF", type: "error" });
        } else {
          setMessage({ text: data.message, type: "success" });
          setName("");
          setContent("");
          fetchDocuments();
        }
      } catch {
        setMessage({ text: "Network error", type: "error" });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Non-PDF: read as text and show in textarea
    const text = await file.text();
    setName(file.name);
    setContent(text);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchDocuments();
    } catch {
      // Ignore
    }
  };

  const openEdit = (doc: Document) => {
    setEditDoc(doc);
    setEditName(doc.name);
    setEditContent(doc.content);
    setEditError(null);
  };

  const handleEdit = async () => {
    if (!editDoc) return;
    if (!editName.trim() || !editContent.trim()) {
      setEditError("Name and content are required");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch("/api/documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editDoc.id,
          name: editName.trim(),
          content: editContent.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Failed to update");
      } else {
        setEditDoc(null);
        fetchDocuments();
      }
    } catch {
      setEditError("Network error");
    } finally {
      setEditLoading(false);
    }
  };

  const handleReset = async () => {
    setResetLoading(true);
    setResetResult(null);
    try {
      const res = await fetch("/api/documents/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResetResult(data.error || "Reset failed");
      } else {
        setResetResult(data.message);
        setResetConfirmation("");
        fetchDocuments();
        setTimeout(() => {
          setResetOpen(false);
          setResetResult(null);
        }, 1500);
      }
    } catch {
      setResetResult("Network error");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="card-hover border-border/60">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Add Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., product-catalog.txt"
              className="bg-background/50 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Content
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your document content here..."
              rows={8}
              className="bg-background/50 resize-none text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className={loading ? "" : "glow-amber-sm"}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </span>
              ) : (
                "Ingest Document"
              )}
            </Button>
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/30 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors">
              Upload File
              <input
                type="file"
                accept=".txt,.md,.json,.jsonl,.csv,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {message && (
            <div
              className={`p-3 rounded-md text-sm animate-fade-in ${
                message.type === "error"
                  ? "bg-destructive/10 border border-destructive/20 text-destructive"
                  : "bg-emerald-400/10 border border-emerald-400/20 text-emerald-400"
              }`}
            >
              {message.text}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="card-hover border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              Documents
              <span className="text-muted-foreground/50 font-normal ml-2">
                {documents.length}
              </span>
            </CardTitle>
            {documents.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setResetOpen(true)}
              >
                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                Hard Reset
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-muted-foreground/60 text-sm py-4 text-center">
              No documents ingested yet.
            </p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border/40 hover:border-border/60 transition-colors"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground/85">
                      {doc.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="text-xs"
                      >
                        {doc.chunkCount} chunks
                      </Badge>
                      <span className="text-xs text-muted-foreground/40">
                        {doc.createdAt
                          ? new Date(doc.createdAt).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(doc)}
                      className="text-xs text-muted-foreground/40 hover:text-primary transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-xs text-muted-foreground/40 hover:text-destructive transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Document Dialog */}
      <Dialog open={!!editDoc} onOpenChange={(v) => { if (!v) setEditDoc(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Name
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-background/50 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Content
              </label>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={10}
                className="bg-background/50 resize-none text-sm"
              />
            </div>
            {editError && (
              <div className="p-2 rounded-md text-xs bg-destructive/10 border border-destructive/20 text-destructive">
                {editError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDoc(null)} disabled={editLoading}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={editLoading} className={editLoading ? "" : "glow-amber-sm"}>
              {editLoading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Updating...
                </span>
              ) : (
                "Update Document"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard Reset Dialog */}
      <Dialog open={resetOpen} onOpenChange={(v) => { setResetOpen(v); setResetConfirmation(""); setResetResult(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Hard Reset Documents</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>all documents</strong>, their <strong>vector embeddings</strong> from pgvector, and <strong>all related vectors from Pinecone</strong>. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Type &quot;RESET&quot; to confirm
              </label>
              <Input
                value={resetConfirmation}
                onChange={(e) => setResetConfirmation(e.target.value)}
                placeholder="RESET"
                className="bg-background/50 text-sm font-mono"
              />
            </div>
            {resetResult && (
              <div className="p-2 rounded-md text-xs bg-destructive/10 border border-destructive/20 text-destructive">
                {resetResult}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)} disabled={resetLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={resetLoading || resetConfirmation !== "RESET"}
            >
              {resetLoading ? (
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
    </div>
  );
}
