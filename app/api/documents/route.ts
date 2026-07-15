import { NextRequest, NextResponse } from "next/server";
import { getDb, getPglite } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { chunkText } from "@/lib/rag/chunk";
import { embedTexts } from "@/lib/rag/embed";
import {
  isPineconeConfigured,
  deletePineconeVectors,
} from "@/lib/rag/pinecone";

export async function GET() {
  try {
    const db = await getDb();
    const docs = await db
      .select()
      .from(documents)
      .orderBy(desc(documents.createdAt));
    return NextResponse.json(docs);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, content } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }
    if (!name || !content) {
      return NextResponse.json({ error: "Name and content are required" }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
    }

    const db = await getDb();
    const client = await getPglite();

    // Get old chunk IDs for Pinecone cleanup
    const oldChunks = await client.query<{ id: string }>(
      "SELECT id FROM doc_chunks WHERE doc_id = $1",
      [id]
    );
    const oldChunkIds = oldChunks.rows.map((r) => r.id);

    // Delete old chunks
    await client.query("DELETE FROM doc_chunks WHERE doc_id = $1", [id]);

    if (isPineconeConfigured() && oldChunkIds.length > 0) {
      try {
        await deletePineconeVectors(oldChunkIds);
      } catch {
        // Non-fatal
      }
    }

    // Update document
    await db
      .update(documents)
      .set({ name, content, chunkCount: 0 })
      .where(eq(documents.id, id));

    // Re-chunk and re-embed
    const docChunks = chunkText(id, content);

    if (docChunks.length > 0) {
      const texts = docChunks.map((c) => c.content);
      const embeddings = await embedTexts(texts);

      for (let i = 0; i < docChunks.length; i++) {
        const chunk = docChunks[i];
        const embedding = embeddings[i];
        await client.query(
          `INSERT INTO doc_chunks (id, doc_id, content, metadata, embedding)
           VALUES ($1, $2, $3, $4, $5::vector)`,
          [
            chunk.id,
            chunk.itemId,
            chunk.content,
            JSON.stringify(chunk.metadata),
            `[${embedding.join(",")}]`,
          ]
        );
      }
    }

    await db
      .update(documents)
      .set({ chunkCount: docChunks.length })
      .where(eq(documents.id, id));

    return NextResponse.json({
      success: true,
      chunkCount: docChunks.length,
      message: `Document updated: ${docChunks.length} chunks re-embedded`,
    });
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

    // Get chunk IDs for Pinecone cleanup
    const chunkRows = await client.query<{ id: string }>(
      "SELECT id FROM doc_chunks WHERE doc_id = $1",
      [id]
    );
    const chunkIds = chunkRows.rows.map((r) => r.id);

    // Delete from pgvector (CASCADE handles doc_chunks)
    await client.query("DELETE FROM documents WHERE id = $1", [id]);

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
