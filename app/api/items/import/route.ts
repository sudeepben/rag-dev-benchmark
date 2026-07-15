import { NextRequest, NextResponse } from "next/server";
import { getPglite } from "@/lib/db";
import { parseCSV } from "@/lib/csv";
import { chunkText, itemToText } from "@/lib/rag/chunk";
import { cleanText } from "@/lib/rag/clean";
import { embedTexts } from "@/lib/rag/embed";
import {
  isPineconeConfigured,
  ensureIndex,
  upsertToPinecone,
} from "@/lib/rag/pinecone";

export async function POST(request: NextRequest) {
  try {
    const { csv } = await request.json();

    if (!csv || typeof csv !== "string") {
      return NextResponse.json(
        { error: "CSV content is required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const rows = parseCSV(csv);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No data rows found in CSV" },
        { status: 400 }
      );
    }

    const client = await getPglite();
    const errors: string[] = [];
    let imported = 0;

    // Insert items into DB
    const insertedItems: {
      id: string;
      name: string;
      description?: string;
      category?: string;
      brand?: string;
      price?: string;
      discount?: string;
      sku?: string;
    }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row.name || row.product_name || row.title || row.item_name;

      if (!name) {
        errors.push(`Row ${i + 1}: missing name/product_name/title field`);
        continue;
      }

      const id = crypto.randomUUID();
      const sku = row.sku || row.product_id || row.item_id || null;
      const description =
        row.description || row.desc || row.product_description || null;
      const category = row.category || row.type || row.product_type || null;
      const brand = row.brand || row.manufacturer || null;
      const price = row.price || row.unit_price || row.cost || null;
      const discount =
        row.discount || row.discount_percent || row.sale || null;
      const stock = row.stock || row.quantity || row.inventory || "0";

      try {
        await client.query(
          `INSERT INTO items (id, sku, name, description, category, brand, price, discount, stock)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            id,
            sku,
            name,
            description,
            category,
            brand,
            price ? parseFloat(price) || null : null,
            discount ? parseFloat(discount) || null : null,
            parseInt(stock) || 0,
          ]
        );

        insertedItems.push({
          id,
          name,
          description: description ?? undefined,
          category: category ?? undefined,
          brand: brand ?? undefined,
          price: price ?? undefined,
          discount: discount ?? undefined,
          sku: sku ?? undefined,
        });
        imported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Row ${i + 1} (${name}): ${msg}`);
      }
    }

    // Generate text and embed items
    let pgvectorEmbedded = 0;
    let pineconeEmbedded = 0;
    let pineconeError: string | null = null;

    if (insertedItems.length > 0) {
      const allChunks = insertedItems.flatMap((item) => {
        const text = cleanText(itemToText(item));
        return chunkText(item.id, text);
      });

      if (allChunks.length > 0) {
        const chunkTexts = allChunks.map((c) => c.content);
        const embeddings = await embedTexts(chunkTexts);

        // ── pgvector upsert ──
        for (let i = 0; i < allChunks.length; i++) {
          const chunk = allChunks[i];
          const embedding = embeddings[i];

          await client.query(
            `INSERT INTO chunks (id, item_id, content, metadata, embedding)
             VALUES ($1, $2, $3, $4, $5::vector)
             ON CONFLICT (id) DO UPDATE SET
               content = EXCLUDED.content,
               embedding = EXCLUDED.embedding`,
            [
              chunk.id,
              chunk.itemId,
              chunk.content,
              JSON.stringify(chunk.metadata),
              `[${embedding.join(",")}]`,
            ]
          );
          pgvectorEmbedded++;
        }

        // ── Pinecone upsert (if configured) ──
        if (isPineconeConfigured()) {
          try {
            await ensureIndex(embeddings[0].length);
            const pineconeChunks = allChunks.map((c) => ({
              id: c.id,
              itemId: c.itemId,
              content: c.content,
              metadata: c.metadata,
            }));
            const result = await upsertToPinecone(pineconeChunks, embeddings);
            pineconeEmbedded = result.upserted;
          } catch (err) {
            pineconeError =
              err instanceof Error ? err.message : "Pinecone upsert failed";
          }
        }
      }
    }

    return NextResponse.json({
      imported,
      total: rows.length,
      errors: errors.slice(0, 10),
      backends: {
        pgvector: { embedded: pgvectorEmbedded },
        pinecone: {
          embedded: pineconeEmbedded,
          configured: isPineconeConfigured(),
          error: pineconeError,
        },
      },
      message: `Imported ${imported} items. pgvector: ${pgvectorEmbedded} chunks${isPineconeConfigured() ? `, Pinecone: ${pineconeEmbedded} chunks` : ""}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
