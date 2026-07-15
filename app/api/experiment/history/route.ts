import { NextResponse } from "next/server";
import { getPglite } from "@/lib/db";

export async function GET() {
  try {
    const client = await getPglite();
    const result = await client.query(
      `SELECT * FROM experiments ORDER BY created_at DESC LIMIT 50`
    );

    return NextResponse.json({ experiments: result.rows });
  } catch (err) {
    console.error("Experiment history error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
