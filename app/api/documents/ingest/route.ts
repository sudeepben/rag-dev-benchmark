import { NextRequest, NextResponse } from "next/server";
import { getDb, getPglite } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { chunkText } from "@/lib/rag/chunk";
import { cleanText } from "@/lib/rag/clean";
import { embedTexts } from "@/lib/rag/embed";
import { extractPdfText } from "@/lib/rag/pdf";

async function ingestDocument(name: string, content: string) {
  if (!name || !content) {
    return NextResponse.json(
      { error: "Name and content are required" },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const docId = crypto.randomUUID();
  const db = await getDb();
  const client = await getPglite();

  await db.insert(documents).values({
    id: docId,
    name,
    content,
    chunkCount: 0,
  });

  const docChunks = chunkText(docId, cleanText(content));

  if (docChunks.length === 0) {
    return NextResponse.json({
      id: docId,
      name,
      chunkCount: 0,
      message: "Document saved but no chunks created (content too short?)",
    });
  }

  const texts = docChunks.map((c) => c.content);
  const embeddings = await embedTexts(texts);

  for (let i = 0; i < docChunks.length; i++) {
    const chunk = docChunks[i];
    const embedding = embeddings[i];

    await client.query(
      `INSERT INTO doc_chunks (id, doc_id, content, metadata, embedding)
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
  }

  await db
    .update(documents)
    .set({ chunkCount: docChunks.length })
    .where(eq(documents.id, docId));

  return NextResponse.json({
    id: docId,
    name,
    chunkCount: docChunks.length,
    message: `Document ingested: ${docChunks.length} chunks created and embedded`,
  });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    // Handle file upload (multipart/form-data)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "File is required" }, { status: 400 });
      }

      const fileName = file.name;
      let content: string;

      if (fileName.toLowerCase().endsWith(".pdf")) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const pdf = await extractPdfText(buffer);
        content = pdf.text;
      } else {
        content = await file.text();
      }

      const name = (formData.get("name") as string) || fileName;
      return ingestDocument(name, content);
    }

    // Handle JSON body (existing behavior)
    const { name, content } = await request.json();
    return ingestDocument(name, content);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
