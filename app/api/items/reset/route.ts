import { NextResponse } from "next/server";
import { getPglite } from "@/lib/db";
import {
  isPineconeConfigured,
  deleteAllPineconeVectors,
} from "@/lib/rag/pinecone";

export async function POST() {
  try {
    const client = await getPglite();

    // Get counts before deletion
    const itemCount = await client.query<{ count: string }>("SELECT count(*) as count FROM items");
    const chunkCount = await client.query<{ count: string }>("SELECT count(*) as count FROM chunks");

    // Delete all chunks first (FK), then items
    await client.query("DELETE FROM chunks");
    await client.query("DELETE FROM items");

    // Delete all inventory vectors from Pinecone
    let pineconeCleared = false;
    if (isPineconeConfigured()) {
      try {
        await deleteAllPineconeVectors();
        pineconeCleared = true;
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json({
      success: true,
      deleted: {
        items: Number(itemCount.rows[0]?.count || 0),
        chunks: Number(chunkCount.rows[0]?.count || 0),
        pinecone: pineconeCleared,
      },
      message: `Reset complete. Deleted ${itemCount.rows[0]?.count || 0} items, ${chunkCount.rows[0]?.count || 0} chunks${pineconeCleared ? ", cleared Pinecone" : ""}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
