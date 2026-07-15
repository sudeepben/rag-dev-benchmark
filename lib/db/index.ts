import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  pglitePromise: Promise<PGlite> | undefined;
};

function initPglite(): Promise<PGlite> {
  if (globalForDb.pglitePromise) return globalForDb.pglitePromise;

  globalForDb.pglitePromise = (async () => {
    const client = new PGlite({
      dataDir: "./pglite-data",
      extensions: { vector },
    });

    await client.exec("CREATE EXTENSION IF NOT EXISTS vector");

    await client.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        sku TEXT,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        brand TEXT,
        price NUMERIC(10,2),
        discount NUMERIC(5,2),
        stock INTEGER DEFAULT 0,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        metadata JSONB,
        embedding vector(1536),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Documents testing tables (isolated from inventory)
    await client.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        chunk_count INTEGER DEFAULT 0,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.exec(`
      CREATE TABLE IF NOT EXISTS doc_chunks (
        id TEXT PRIMARY KEY,
        doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        metadata JSONB,
        embedding vector(1536),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Experiment history
    await client.exec(`
      CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        parameters JSONB,
        pgvector_result JSONB,
        pinecone_result JSONB,
        metrics JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    return client;
  })();

  return globalForDb.pglitePromise;
}

export async function getDb() {
  const client = await initPglite();
  return drizzle(client, { schema });
}

export async function getPglite() {
  return initPglite();
}
