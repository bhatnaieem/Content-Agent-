import { NextResponse } from "next/server";
import { createBufferPost, ThreadItem } from "../../../../lib/buffer";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.channelId || !body.service || !body.text) return NextResponse.json({ error: "channelId, service and text are required." }, { status: 400 });
    if (!["shareNow", "addToQueue", "customScheduled"].includes(body.mode)) return NextResponse.json({ error: "Invalid Buffer publishing mode." }, { status: 400 });
    if (body.mode === "customScheduled" && !body.dueAt) return NextResponse.json({ error: "dueAt is required for scheduled posts." }, { status: 400 });
    const thread: ThreadItem[] | undefined = Array.isArray(body.thread) && body.thread.length ? body.thread : undefined;
    const post = await createBufferPost({ channelId: body.channelId, service: body.service, text: body.text, mode: body.mode, dueAt: body.dueAt, imageUrl: body.imageUrl, imageAltText: body.imageAltText, thread });
    return NextResponse.json({ ok: true, post });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to publish through Buffer.";
    return NextResponse.json({ ok: false, error: message }, { status: message.includes("not configured") ? 503 : 502 });
  }
}
