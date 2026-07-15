"use client";

import type { ExperimentParams, Backend } from "@/lib/rag/types";
import type { ConfigResponse } from "../_types";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface ConfigPanelProps {
  params: ExperimentParams & { dataSource: "inventory" | "documents" };
  onChange: (
    params: ExperimentParams & { dataSource: "inventory" | "documents" }
  ) => void;
  config: ConfigResponse | null;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}

export function ConfigPanel({ params, onChange, config }: ConfigPanelProps) {
  function update<K extends keyof (ExperimentParams & { dataSource: string })>(
    key: K,
    value: (ExperimentParams & { dataSource: "inventory" | "documents" })[K]
  ) {
    onChange({ ...params, [key]: value });
  }

  function toggleBackend(backend: Backend) {
    const current = params.backends;
    if (current.includes(backend)) {
      if (current.length > 1) {
        update(
          "backends",
          current.filter((b) => b !== backend)
        );
      }
    } else {
      update("backends", [...current, backend]);
    }
  }

  const pineconeAvailable = config?.backends.pinecone.available ?? false;

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-sm font-semibold tracking-wide text-foreground">
        Configuration
      </h2>

      {/* Data Source */}
      <div className="flex flex-col gap-2">
        <Label>Data Source</Label>
        <select
          value={params.dataSource}
          onChange={(e) =>
            update("dataSource", e.target.value as "inventory" | "documents")
          }
          className="h-8 rounded-md border border-border/60 bg-background/50 px-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="inventory">
            Inventory
            {config
              ? ` (${config.dataSources.inventory.chunkCount} chunks)`
              : ""}
          </option>
          <option value="documents">
            Documents
            {config
              ? ` (${config.dataSources.documents.chunkCount} chunks)`
              : ""}
          </option>
        </select>
      </div>

      {/* Backends */}
      <div className="flex flex-col gap-2">
        <Label>Backends</Label>
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={params.backends.includes("pgvector")}
              onChange={() => toggleBackend("pgvector")}
              className="accent-primary"
            />
            pgvector
            {config && (
              <span className="text-xs text-muted-foreground">
                ({config.backends.pgvector.chunkCount} chunks)
              </span>
            )}
          </label>
          <label
            className={`flex items-center gap-2 text-sm ${
              pineconeAvailable
                ? "text-foreground"
                : "text-muted-foreground/50 cursor-not-allowed"
            }`}
          >
            <input
              type="checkbox"
              checked={params.backends.includes("pinecone")}
              onChange={() => pineconeAvailable && toggleBackend("pinecone")}
              disabled={!pineconeAvailable}
              className="accent-primary"
            />
            pinecone
            {config && pineconeAvailable && (
              <span className="text-xs text-muted-foreground">
                ({config.backends.pinecone.chunkCount} chunks)
              </span>
            )}
            {!pineconeAvailable && (
              <span className="text-xs">not configured</span>
            )}
          </label>
        </div>
      </div>

      <Separator className="bg-border/40" />

      {/* Top K */}
      <div className="flex flex-col gap-1.5">
        <Label>Top K</Label>
        <Input
          type="number"
          min={1}
          max={20}
          value={params.topK}
          onChange={(e) => update("topK", Number(e.target.value))}
          className="h-8 border-border/60 bg-background/50"
        />
      </div>

      {/* Similarity Threshold */}
      <div className="flex flex-col gap-1.5">
        <Label>Similarity Threshold</Label>
        <Input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={params.similarityThreshold}
          onChange={(e) =>
            update("similarityThreshold", Number(e.target.value))
          }
          className="h-8 border-border/60 bg-background/50"
        />
      </div>

      <Separator className="bg-border/40" />

      {/* Embedding Model */}
      <div className="flex flex-col gap-1.5">
        <Label>Embedding Model</Label>
        <select
          value={params.embeddingModel}
          onChange={(e) => update("embeddingModel", e.target.value)}
          className="h-8 rounded-md border border-border/60 bg-background/50 px-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="text-embedding-3-small">
            text-embedding-3-small
          </option>
          <option value="text-embedding-3-large">
            text-embedding-3-large
          </option>
        </select>
      </div>

      {/* LLM Model */}
      <div className="flex flex-col gap-1.5">
        <Label>LLM Model</Label>
        <select
          value={params.llmModel}
          onChange={(e) => update("llmModel", e.target.value)}
          className="h-8 rounded-md border border-border/60 bg-background/50 px-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="gpt-4.1-nano">gpt-4.1-nano</option>
          <option value="gpt-4.1-mini">gpt-4.1-mini</option>
          <option value="gpt-4.1">gpt-4.1</option>
        </select>
      </div>

      {/* Temperature */}
      <div className="flex flex-col gap-1.5">
        <Label>Temperature</Label>
        <Input
          type="number"
          min={0}
          max={2}
          step={0.1}
          value={params.temperature}
          onChange={(e) => update("temperature", Number(e.target.value))}
          className="h-8 border-border/60 bg-background/50"
        />
      </div>

      {/* Max Tokens */}
      <div className="flex flex-col gap-1.5">
        <Label>Max Tokens</Label>
        <Input
          type="number"
          min={100}
          max={2000}
          step={50}
          value={params.maxTokens}
          onChange={(e) => update("maxTokens", Number(e.target.value))}
          className="h-8 border-border/60 bg-background/50"
        />
      </div>

      {/* Max Context Chunks */}
      <div className="flex flex-col gap-1.5">
        <Label>Max Context Chunks</Label>
        <Input
          type="number"
          min={1}
          max={10}
          value={params.maxContextChunks}
          onChange={(e) => update("maxContextChunks", Number(e.target.value))}
          className="h-8 border-border/60 bg-background/50"
        />
      </div>

      <Separator className="bg-border/40" />

      {/* Generate Answers */}
      <div className="flex items-center justify-between">
        <Label>Generate Answers</Label>
        <button
          type="button"
          role="switch"
          aria-checked={params.generateAnswers}
          onClick={() => update("generateAnswers", !params.generateAnswers)}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            params.generateAnswers
              ? "bg-primary"
              : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              params.generateAnswers ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
