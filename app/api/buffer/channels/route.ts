import { NextResponse } from "next/server";
import { getBufferWorkspace } from "../../../../lib/buffer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspace = await getBufferWorkspace();
    return NextResponse.json(workspace);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to connect to Buffer.";
    const status = message.includes("not configured") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
