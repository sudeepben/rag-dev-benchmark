import { NextRequest, NextResponse } from "next/server";
import { getDb, getPglite } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { desc, eq, ilike, and, gte, lte, or, sql } from "drizzle-orm";
import { chunkText, itemToText } from "@/lib/rag/chunk";
import { embedTexts } from "@/lib/rag/embed";
import {
  isPineconeConfigured,
  ensureIndex,
  upsertToPinecone,
  deletePineconeVectors,
} from "@/lib/rag/pinecone";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(params.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(params.get("pageSize") || "20")));
    const category = params.get("category");
    const brand = params.get("brand");
    const minPrice = params.get("minPrice");
    const maxPrice = params.get("maxPrice");
    const search = params.get("search");

    const db = await getDb();

    // Build filter conditions
    const conditions = [];
    if (category) conditions.push(eq(items.category, category));
    if (brand) conditions.push(eq(items.brand, brand));
    if (minPrice) conditions.push(gte(items.price, minPrice));
    if (maxPrice) conditions.push(lte(items.price, maxPrice));
    if (search) {
      conditions.push(
        or(
          ilike(items.name, `%${search}%`),
          ilike(items.description, `%${search}%`),
          ilike(items.sku, `%${search}%`)
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(items)
      .where(where);
    const total = Number(countResult[0]?.count || 0);

    // Get paginated items
    const rows = await db
      .select()
      .from(items)
      .where(where)
      .orderBy(desc(items.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Get distinct categories and brands for filter dropdowns
    const client = await getPglite();
    const cats = await client.query<{ category: string }>(
      "SELECT DISTINCT category FROM items WHERE category IS NOT NULL AND category != '' ORDER BY category"
    );
    const brands = await client.query<{ brand: string }>(
      "SELECT DISTINCT brand FROM items WHERE brand IS NOT NULL AND brand != '' ORDER BY brand"
    );

    return NextResponse.json({
      items: rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      filters: {
        categories: cats.rows.map((r) => r.category),
        brands: brands.rows.map((r) => r.brand),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, sku, description, category, brand, price, discount, stock } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
    }

    const id = crypto.randomUUID();
    const client = await getPglite();

    await client.query(
      `INSERT INTO items (id, sku, name, description, category, brand, price, discount, stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        sku || null,
        name,
        description || null,
        category || null,
        brand || null,
        price ? parseFloat(price) || null : null,
        discount ? parseFloat(discount) || null : null,
        parseInt(stock) || 0,
      ]
    );

    // Generate chunks and embeddings
    const item = { id, name, description, category, brand, price, discount, sku };
    const text = itemToText(item);
    const chunks = chunkText(id, text);

    if (chunks.length > 0) {
      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await embedTexts(chunkTexts);

      for (let i = 0; i < chunks.length; i++) {
        await client.query(
          `INSERT INTO chunks (id, item_id, content, metadata, embedding)
           VALUES ($1, $2, $3, $4, $5::vector)
           ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
          [
            chunks[i].id,
            chunks[i].itemId,
            chunks[i].content,
            JSON.stringify(chunks[i].metadata),
            `[${embeddings[i].join(",")}]`,
          ]
        );
      }

      if (isPineconeConfigured()) {
        try {
          await ensureIndex(embeddings[0].length);
          const pineconeChunks = chunks.map((c) => ({
            id: c.id,
            itemId: c.itemId,
            content: c.content,
            metadata: c.metadata,
          }));
          await upsertToPinecone(pineconeChunks, embeddings);
        } catch {
          // Pinecone upsert failure is non-fatal
        }
      }
    }

    return NextResponse.json({ success: true, id, chunksCreated: chunks.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, sku, description, category, brand, price, discount, stock } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
    }

    const client = await getPglite();

    // Update the item
    await client.query(
      `UPDATE items SET sku=$2, name=$3, description=$4, category=$5, brand=$6, price=$7, discount=$8, stock=$9, updated_at=NOW()
       WHERE id=$1`,
      [
        id,
        sku || null,
        name,
        description || null,
        category || null,
        brand || null,
        price ? parseFloat(price) || null : null,
        discount ? parseFloat(discount) || null : null,
        parseInt(stock) || 0,
      ]
    );

    // Get old chunk IDs for Pinecone cleanup
    const oldChunks = await client.query<{ id: string }>(
      "SELECT id FROM chunks WHERE item_id = $1",
      [id]
    );
    const oldChunkIds = oldChunks.rows.map((r) => r.id);

    // Delete old chunks from pgvector
    await client.query("DELETE FROM chunks WHERE item_id = $1", [id]);

    // Delete old chunks from Pinecone
    if (isPineconeConfigured() && oldChunkIds.length > 0) {
      try {
        await deletePineconeVectors(oldChunkIds);
      } catch {
        // Non-fatal
      }
    }

    // Re-chunk and re-embed
    const item = { id, name, description, category, brand, price, discount, sku };
    const text = itemToText(item);
    const chunks = chunkText(id, text);

    if (chunks.length > 0) {
      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await embedTexts(chunkTexts);

      for (let i = 0; i < chunks.length; i++) {
        await client.query(
          `INSERT INTO chunks (id, item_id, content, metadata, embedding)
           VALUES ($1, $2, $3, $4, $5::vector)`,
          [
            chunks[i].id,
            chunks[i].itemId,
            chunks[i].content,
            JSON.stringify(chunks[i].metadata),
            `[${embeddings[i].join(",")}]`,
          ]
        );
      }

      if (isPineconeConfigured()) {
        try {
          await ensureIndex(embeddings[0].length);
          const pineconeChunks = chunks.map((c) => ({
            id: c.id,
            itemId: c.itemId,
            content: c.content,
            metadata: c.metadata,
          }));
          await upsertToPinecone(pineconeChunks, embeddings);
        } catch {
          // Non-fatal
        }
      }
    }

    return NextResponse.json({ success: true, chunksCreated: chunks.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const client = await getPglite();

    // Get chunk IDs for Pinecone cleanup before deleting
    const chunkRows = await client.query<{ id: string }>(
      "SELECT id FROM chunks WHERE item_id = $1",
      [id]
    );
    const chunkIds = chunkRows.rows.map((r) => r.id);

    // Delete from pgvector (CASCADE handles chunks)
    await client.query("DELETE FROM items WHERE id = $1", [id]);

    // Delete from Pinecone
    if (isPineconeConfigured() && chunkIds.length > 0) {
      try {
        await deletePineconeVectors(chunkIds);
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
