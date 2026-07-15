import { NextRequest, NextResponse } from "next/server";
import { getPglite } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get("action") || "stats";
    const client = await getPglite();

    if (action === "stats") {
      const [chunksCount, docChunksCount, itemsCount, docsCount] =
        await Promise.all([
          client.query<{ count: string }>("SELECT count(*) as count FROM chunks"),
          client.query<{ count: string }>("SELECT count(*) as count FROM doc_chunks"),
          client.query<{ count: string }>("SELECT count(*) as count FROM items"),
          client.query<{ count: string }>("SELECT count(*) as count FROM documents"),
        ]);

      return NextResponse.json({
        chunks: Number(chunksCount.rows[0]?.count || 0),
        docChunks: Number(docChunksCount.rows[0]?.count || 0),
        items: Number(itemsCount.rows[0]?.count || 0),
        documents: Number(docsCount.rows[0]?.count || 0),
        dimension: 1536,
        metric: "cosine",
      });
    }

    if (action === "list") {
      const table = request.nextUrl.searchParams.get("table") || "chunks";
      const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
      const pageSize = parseInt(request.nextUrl.searchParams.get("pageSize") || "50");
      const search = request.nextUrl.searchParams.get("search") || "";

      const tableName = table === "doc_chunks" ? "doc_chunks" : "chunks";
      const idCol = table === "doc_chunks" ? "doc_id" : "item_id";
      const offset = (page - 1) * pageSize;

      let countQuery = `SELECT count(*) as count FROM ${tableName}`;
      let dataQuery = `SELECT id, ${idCol} as ref_id, content, metadata, created_at FROM ${tableName}`;
      const params: unknown[] = [];

      if (search) {
        const clause = ` WHERE id ILIKE $1 OR content ILIKE $1 OR ${idCol} ILIKE $1`;
        countQuery += clause;
        dataQuery += clause;
        params.push(`%${search}%`);
      }

      dataQuery += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

      const [countRes, dataRes] = await Promise.all([
        client.query<{ count: string }>(countQuery, params),
        client.query<{
          id: string;
          ref_id: string;
          content: string;
          metadata: unknown;
          created_at: string;
        }>(dataQuery, [...params, pageSize, offset]),
      ]);

      const total = Number(countRes.rows[0]?.count || 0);

      return NextResponse.json({
        records: dataRes.rows.map((r) => ({
          id: r.id,
          refId: r.ref_id,
          content: r.content,
          metadata: r.metadata,
          createdAt: r.created_at,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    }

    if (action === "fetch") {
      const id = request.nextUrl.searchParams.get("id");
      const table = request.nextUrl.searchParams.get("table") || "chunks";
      if (!id) {
        return NextResponse.json({ error: "id required" }, { status: 400 });
      }

      const tableName = table === "doc_chunks" ? "doc_chunks" : "chunks";
      const idCol = table === "doc_chunks" ? "doc_id" : "item_id";

      const res = await client.query<{
        id: string;
        ref_id: string;
        content: string;
        metadata: unknown;
        created_at: string;
      }>(
        `SELECT id, ${idCol} as ref_id, content, metadata, created_at FROM ${tableName} WHERE id = $1`,
        [id]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const row = res.rows[0];
      return NextResponse.json({
        id: row.id,
        refId: row.ref_id,
        content: row.content,
        metadata: row.metadata,
        createdAt: row.created_at,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id, ids, table } = await request.json();
    const client = await getPglite();
    const tableName = table === "doc_chunks" ? "doc_chunks" : "chunks";

    if (ids && Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map((_: string, i: number) => `$${i + 1}`).join(",");
      await client.query(`DELETE FROM ${tableName} WHERE id IN (${placeholders})`, ids);
      return NextResponse.json({ success: true, deleted: ids.length });
    }

    if (id) {
      await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
      return NextResponse.json({ success: true, deleted: 1 });
    }

    return NextResponse.json({ error: "Provide id or ids[]" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
