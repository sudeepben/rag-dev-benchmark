# RAG Testing System

A Next.js application for testing and benchmarking Retrieval-Augmented Generation (RAG) pipelines. Compare vector search backends (PGlite/pgvector vs Pinecone) side-by-side with configurable parameters.

## Tech Stack

- **Next.js 16** — App Router, API Routes
- **PGlite** — In-browser PostgreSQL (no binaries needed)
- **pgvector** — Vector similarity search via PGlite extension
- **Pinecone** — Cloud vector database (optional)
- **Drizzle ORM** — Type-safe database queries
- **OpenAI** — Embeddings (`text-embedding-3-small`) and generation (`gpt-4.1-nano`)
- **shadcn/ui + @ai-elements** — UI components
- **Tailwind CSS v4** — Styling with dark/light theme

## Prerequisites

- **Node.js** 18+
- **pnpm** (recommended) — `npm install -g pnpm`
- **OpenAI API key** — Required for embeddings and answer generation
- **Pinecone API key** — Optional, for dual-backend comparison

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd rag_dev
pnpm install
```

### 2. Environment variables

Create a `.env.local` file in the project root:

```env
# Required
OPENAI_API_KEY=sk-proj-your-openai-key-here

# Optional — Pinecone (for dual-backend comparison)
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=rag-benchmark-index
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1
```

PGlite runs entirely locally — no PostgreSQL installation needed. Data is stored in `./pglite-data/` which is git-ignored.

### 3. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

| Route | Purpose |
|-------|---------|
| `/inventory` | Import CSV, browse items with filters and pagination |
| `/documents` | Upload raw text documents for RAG testing (isolated from inventory) |
| `/search` | Simple RAG search with answer generation |
| `/experiment` | **Playground** — Side-by-side backend comparison with configurable parameters |
| `/settings` | Configuration (coming soon) |

## Usage

### 1. Import inventory data

Go to **Inventory** and click **Import CSV**. The CSV should have columns like:

```csv
sku,name,description,category,brand,price,discount,stock
SKU001,Widget A,A great widget for daily use,Electronics,BrandX,29.99,10,100
SKU002,Gadget B,Premium gadget with features,Electronics,BrandY,49.99,,50
```

Supported column names (auto-mapped):

| Field | Accepted columns |
|-------|-----------------|
| Name | `name`, `product_name`, `title`, `item_name` |
| SKU | `sku`, `product_id`, `item_id` |
| Price | `price`, `unit_price`, `cost` |
| Category | `category`, `type`, `product_type` |
| Brand | `brand`, `manufacturer` |
| Discount | `discount`, `discount_percent`, `sale` |
| Stock | `stock`, `quantity`, `inventory` |

On import, items are stored in PGlite, chunked, embedded via OpenAI, and upserted to both pgvector and Pinecone (if configured).

### 2. Run experiments

Go to **Experiment** to open the playground:

- **Left panel** — Configure: data source, backends, top_k, similarity threshold, embedding model, LLM model, temperature, max tokens
- **Center** — Enter a query and view results with metrics
- **Right panel** — Inspect retrieved chunks with similarity scores

### 3. Compare backends

Enable both **pgvector** and **pinecone** checkboxes. The system:

1. Embeds your query **once** (shared across backends)
2. Searches both backends in parallel (independently timed)
3. Optionally generates answers for each
4. Shows side-by-side comparison with latency winner, score delta, and chunk overlap

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/items` | GET | List items with filters and pagination |
| `/api/items` | DELETE | Delete an item |
| `/api/items/import` | POST | Import CSV, embed, dual upsert |
| `/api/documents` | GET, DELETE | Document CRUD |
| `/api/documents/ingest` | POST | Ingest document, chunk, embed |
| `/api/query` | POST | Simple RAG query |
| `/api/experiment/compare` | POST | Dual-backend comparison with metrics |
| `/api/experiment/history` | GET | Past experiment runs |
| `/api/experiment/config` | GET | Available backends and chunk counts |

## Project Structure

```
app/
  _components/             # Shared: nav tabs, theme toggle
  inventory/
    _components/           # CSV import, items table
    _types/
    page.tsx
  documents/
    _components/           # Document upload
    _types/
    page.tsx
  search/
    _components/           # Query panel
    _types/
    page.tsx
  experiment/
    _components/           # Config panel, results, chunks viewer
    _types/
    page.tsx
  api/
    items/                 # Inventory CRUD + CSV import
    documents/             # Document CRUD + ingest
    query/                 # Simple RAG query
    experiment/            # Compare, history, config

lib/
  db/
    schema.ts              # Drizzle schema (items, chunks, documents, experiments)
    index.ts               # PGlite + Drizzle initialization
  rag/
    types.ts               # Shared types (SearchResult, BackendResult, ExperimentParams)
    chunk.ts               # Text chunking + item-to-text
    embed.ts               # OpenAI embeddings (configurable model)
    search.ts              # pgvector search
    pinecone.ts            # Pinecone client (upsert, search, stats)
    generate.ts            # LLM answer generation (configurable model/temp/tokens)
    guardrails.ts          # Confidence threshold checks
  csv.ts                   # CSV parser

components/
  ui/                      # shadcn/ui components
  ai-elements/             # @ai-elements (sources, citations, model selector, prompt input)
```

## Notes

- **PGlite data** is stored in `./pglite-data/`. Delete this folder to reset the database.
- **Pinecone is optional.** Everything works with just pgvector. Pinecone features are greyed out when not configured.
- **Theme** — Toggle light/dark mode with the button in the top-right corner.
- **Embedding dimension** — Fixed at 1536 (`text-embedding-3-small`). Switching to `text-embedding-3-large` (3072) requires deleting `./pglite-data/` to recreate tables.
