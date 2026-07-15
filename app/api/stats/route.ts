import { NextResponse } from "next/server";
import { getPglite } from "@/lib/db";
import { isPineconeConfigured, getPineconeStats } from "@/lib/rag/pinecone";

export async function GET() {
  try {
    const client = await getPglite();

    const [itemsRes, chunksRes, documentsRes, docChunksRes, experimentsRes] =
      await Promise.all([
        client.query<{ count: string }>("SELECT count(*) FROM items"),
        client.query<{ count: string }>("SELECT count(*) FROM chunks"),
        client.query<{ count: string }>("SELECT count(*) FROM documents"),
        client.query<{ count: string }>("SELECT count(*) FROM doc_chunks"),
        client.query<{ count: string }>("SELECT count(*) FROM experiments"),
      ]);

    const counts = {
      items: Number(itemsRes.rows[0]?.count ?? 0),
      chunks: Number(chunksRes.rows[0]?.count ?? 0),
      documents: Number(documentsRes.rows[0]?.count ?? 0),
      doc_chunks: Number(docChunksRes.rows[0]?.count ?? 0),
      experiments: Number(experimentsRes.rows[0]?.count ?? 0),
    };

    // Pinecone stats
    let pinecone: {
      configured: boolean;
      stats?: Awaited<ReturnType<typeof getPineconeStats>>;
    } = { configured: false };

    if (isPineconeConfigured()) {
      try {
        const stats = await getPineconeStats();
        pinecone = { configured: true, stats };
      } catch {
        pinecone = { configured: true };
      }
    }

    // OpenAI status
    const openai = {
      configured: !!process.env.OPENAI_API_KEY,
    };

    // Environment variable flags (no values exposed)
    const env = {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      PINECONE_API_KEY: !!process.env.PINECONE_API_KEY,
      PINECONE_INDEX_NAME: !!process.env.PINECONE_INDEX_NAME,
      PINECONE_CLOUD: !!process.env.PINECONE_CLOUD,
      PINECONE_REGION: !!process.env.PINECONE_REGION,
    };

    return NextResponse.json({ counts, pinecone, openai, env });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
