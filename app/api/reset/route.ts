import { NextResponse } from "next/server";
import { getPglite } from "@/lib/db";
import {
  isPineconeConfigured,
  deleteAllPineconeVectors,
} from "@/lib/rag/pinecone";

export async function POST() {
  try {
    const client = await getPglite();

    // Delete in order respecting foreign key constraints
    const experimentsRes = await client.query<{ count: string }>(
      "WITH deleted AS (DELETE FROM experiments RETURNING *) SELECT count(*) FROM deleted"
    );
    const docChunksRes = await client.query<{ count: string }>(
      "WITH deleted AS (DELETE FROM doc_chunks RETURNING *) SELECT count(*) FROM deleted"
    );
    const documentsRes = await client.query<{ count: string }>(
      "WITH deleted AS (DELETE FROM documents RETURNING *) SELECT count(*) FROM deleted"
    );
    const chunksRes = await client.query<{ count: string }>(
      "WITH deleted AS (DELETE FROM chunks RETURNING *) SELECT count(*) FROM deleted"
    );
    const itemsRes = await client.query<{ count: string }>(
      "WITH deleted AS (DELETE FROM items RETURNING *) SELECT count(*) FROM deleted"
    );

    const deleted = {
      experiments: Number(experimentsRes.rows[0]?.count ?? 0),
      doc_chunks: Number(docChunksRes.rows[0]?.count ?? 0),
      documents: Number(documentsRes.rows[0]?.count ?? 0),
      chunks: Number(chunksRes.rows[0]?.count ?? 0),
      items: Number(itemsRes.rows[0]?.count ?? 0),
    };

    // Clear Pinecone if configured
    let pineconeCleared = false;
    if (isPineconeConfigured()) {
      try {
        await deleteAllPineconeVectors();
        pineconeCleared = true;
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json({ deleted, pineconeCleared });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
