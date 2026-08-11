import { NextResponse } from "next/server";
import { listContentHistory } from "../../../lib/content-memory";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") || 100);
    const limit = Math.min(200, Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 100));
    const history = await listContentHistory(limit);
    return NextResponse.json({ history, count: history.length, memory: "supabase" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load Web3 Pulse history." }, { status: 500 });
  }
}
