import { NextRequest, NextResponse } from "next/server";
import {
  isPineconeConfigured,
  getPineconeStats,
  getPineconeIndexInfo,
  listPineconeVectors,
  fetchPineconeVectors,
} from "@/lib/rag/pinecone";

export async function GET(request: NextRequest) {
  try {
    if (!isPineconeConfigured()) {
      return NextResponse.json(
        { error: "Pinecone is not configured. Add PINECONE_API_KEY and PINECONE_INDEX_NAME to .env.local" },
        { status: 400 }
      );
    }

    const action = request.nextUrl.searchParams.get("action") || "stats";

    if (action === "stats") {
      const [stats, info] = await Promise.all([
        getPineconeStats(),
        getPineconeIndexInfo(),
      ]);
      return NextResponse.json({ stats, info });
    }

    if (action === "list") {
      const prefix = request.nextUrl.searchParams.get("prefix") || undefined;
      const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
      const token = request.nextUrl.searchParams.get("token") || undefined;

      const result = await listPineconeVectors({ prefix, limit, paginationToken: token });
      return NextResponse.json(result);
    }

    if (action === "fetch") {
      const idsParam = request.nextUrl.searchParams.get("ids");
      if (!idsParam) {
        return NextResponse.json({ error: "ids parameter required" }, { status: 400 });
      }
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ error: "No valid IDs provided" }, { status: 400 });
      }
      const result = await fetchPineconeVectors(ids);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
