import { NextResponse } from "next/server";
import { generateWithLLM } from "../../../lib/llm";

export const maxDuration = 45;

type Format = "reply" | "quote" | "poll" | "blog" | "creative";

const instructions: Record<Format, string> = {
  reply: "Write a concise, natural X reply to the story. Add one specific insight, implication, or useful question. Do not summarize the story, do not write a thread, and do not mention that you are an AI.",
  quote: "Write a standalone quote-tweet caption reacting to the story. Take a clear opinion, interpretation, counterpoint, or framing angle. Do not repeat the headline or write a generic summary.",
  poll: "Create an X poll. Return exactly this structure: Question: [one concise question]\nOptions: A) [option] B) [option] C) [option] D) [option]. Options must be meaningfully different and answerable from the story context.",
  blog: "Write a substantial blog draft about the story. Include a strong title, introduction, 3-5 useful sections, evidence/context, implications, and conclusion. This must be much longer and more analytical than an X post or reply.",
  creative: "Write a detailed image-generation prompt for a premium editorial Web3 visual based on the story. Describe subject, composition, hierarchy, mood, lighting, camera/style, symbolism, and social-safe cropping. Do not write the social post itself and do not require readable text in the image."
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const format = body?.format as Format;
    const story = body?.story;
    if (!["reply", "quote", "poll", "blog", "creative"].includes(format)) {
      return NextResponse.json({ error: "Unsupported content format." }, { status: 400 });
    }
    if (!story?.headline) return NextResponse.json({ error: "Story is required." }, { status: 400 });

    const result = await generateWithLLM({
      provider: body?.provider || "auto",
      system: `You are CryptoPulse's Content Studio. Generate ONLY the requested format. ${instructions[format]}

Use only the supplied story facts. Never invent statistics, quotes, sources, dates, or claims. Return plain text only, with no JSON, markdown fences, or preamble.`,
      user: `Create the ${format} now.

Headline: ${story.headline}
Category: ${story.category || "Web3"}
Summary: ${story.summary || ""}
Why it matters: ${story.reason || ""}
Sources: ${(story.sources || []).join(" | ")}
Keywords: ${(story.keywords || []).join(", ")}`,
      temperature: format === "creative" ? 0.7 : 0.5,
    });

    return NextResponse.json({ content: result.content, provider: result.provider, model: result.model, format });
  } catch (error: any) {
    console.error("CryptoPulse format generation error:", error);
    return NextResponse.json({ error: error?.message || "Failed to generate content." }, { status: 500 });
  }
}
