import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";

export const vectorCol = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === "string") {
      return value
        .replace(/[\[\]]/g, "")
        .split(",")
        .map(Number);
    }
    if (Array.isArray(value)) return value;
    return Array.from(value as ArrayLike<number>);
  },
});

export const items = pgTable("items", {
  id: text("id").primaryKey(),
  sku: text("sku"),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  brand: text("brand"),
  price: numeric("price", { precision: 10, scale: 2 }),
  discount: numeric("discount", { precision: 5, scale: 2 }),
  stock: integer("stock").default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chunks = pgTable("chunks", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  embedding: vectorCol("embedding"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Documents testing — isolated from inventory
export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  chunkCount: integer("chunk_count").default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const docChunks = pgTable("doc_chunks", {
  id: text("id").primaryKey(),
  docId: text("doc_id").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  embedding: vectorCol("embedding"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Experiment history
export const experiments = pgTable("experiments", {
  id: text("id").primaryKey(),
  question: text("question").notNull(),
  parameters: jsonb("parameters"),
  pgvectorResult: jsonb("pgvector_result"),
  pineconeResult: jsonb("pinecone_result"),
  metrics: jsonb("metrics"),
  createdAt: timestamp("created_at").defaultNow(),
});
