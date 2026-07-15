import { NextRequest, NextResponse } from "next/server";
import {
  isPineconeConfigured,
  deletePineconeVector,
  deletePineconeVectors,
  deleteAllPineconeVectors,
  updatePineconeMetadata,
} from "@/lib/rag/pinecone";

export async function DELETE(request: NextRequest) {
  try {
    if (!isPineconeConfigured()) {
      return NextResponse.json(
        { error: "Pinecone is not configured" },
        { status: 400 }
      );
    }

    const { id, ids, all } = await request.json();

    if (all === true) {
      await deleteAllPineconeVectors();
      return NextResponse.json({ success: true, message: "All vectors deleted" });
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      await deletePineconeVectors(ids);
      return NextResponse.json({ success: true, deleted: ids.length });
    }

    if (id) {
      await deletePineconeVector(id);
      return NextResponse.json({ success: true, deleted: 1 });
    }

    return NextResponse.json({ error: "Provide id, ids[], or all:true" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isPineconeConfigured()) {
      return NextResponse.json(
        { error: "Pinecone is not configured" },
        { status: 400 }
      );
    }

    const { id, metadata } = await request.json();

    if (!id || !metadata) {
      return NextResponse.json(
        { error: "id and metadata are required" },
        { status: 400 }
      );
    }

    await updatePineconeMetadata(id, metadata);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
