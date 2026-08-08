import { NextResponse } from "next/server";
import { runResearch } from "@/lib/research-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runResearch();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Research engine failed", error);
    return NextResponse.json({ error: "Research engine failed", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
