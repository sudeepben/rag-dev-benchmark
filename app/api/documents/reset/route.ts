import { NextResponse } from "next/server";
import { getPglite } from "@/lib/db";
import {
  isPineconeConfigured,
  deletePineconeVectors,
} from "@/lib/rag/pinecone";

export async function POST() {
  try {
    const client = await getPglite();

    // Get counts and chunk IDs before deletion
    const docCount = await client.query<{ count: string }>("SELECT count(*) as count FROM documents");
    const chunkRows = await client.query<{ id: string }>("SELECT id FROM doc_chunks");
    const chunkIds = chunkRows.rows.map((r) => r.id);

    // Delete all doc_chunks first (FK), then documents
    await client.query("DELETE FROM doc_chunks");
    await client.query("DELETE FROM documents");

    // Delete document vectors from Pinecone
    let pineconeCleared = false;
    if (isPineconeConfigured() && chunkIds.length > 0) {
      try {
        await deletePineconeVectors(chunkIds);
        pineconeCleared = true;
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json({
      success: true,
      deleted: {
        documents: Number(docCount.rows[0]?.count || 0),
        chunks: chunkIds.length,
        pinecone: pineconeCleared,
      },
      message: `Reset complete. Deleted ${docCount.rows[0]?.count || 0} documents, ${chunkIds.length} chunks${pineconeCleared ? ", cleared Pinecone vectors" : ""}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
