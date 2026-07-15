import { NextResponse } from "next/server";
import { getPglite } from "@/lib/db";
import { isPineconeConfigured, getPineconeStats } from "@/lib/rag/pinecone";

export async function GET() {
  try {
    const client = await getPglite();

    const [chunksResult, docChunksResult] = await Promise.all([
      client.query<{ count: string }>(`SELECT count(*) FROM chunks`),
      client.query<{ count: string }>(`SELECT count(*) FROM doc_chunks`),
    ]);

    const pgvectorChunkCount = parseInt(chunksResult.rows[0]?.count ?? "0", 10);
    const docChunkCount = parseInt(docChunksResult.rows[0]?.count ?? "0", 10);

    const pineconeAvailable = isPineconeConfigured();
    let pineconeChunkCount = 0;

    if (pineconeAvailable) {
      const stats = await getPineconeStats();
      pineconeChunkCount = stats.vectorCount;
    }

    return NextResponse.json({
      backends: {
        pgvector: {
          available: true,
          chunkCount: pgvectorChunkCount,
        },
        pinecone: {
          available: pineconeAvailable,
          chunkCount: pineconeChunkCount,
        },
      },
      dataSources: {
        inventory: {
          chunkCount: pgvectorChunkCount,
        },
        documents: {
          chunkCount: docChunkCount,
        },
      },
    });
  } catch (err) {
    console.error("Config endpoint error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
