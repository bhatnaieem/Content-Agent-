import { NextResponse } from "next/server";
import { generateWithLLM } from "../../../lib/llm";

export const maxDuration = 60;

type Format = "reply" | "quote" | "poll" | "blog" | "creative";
const instructions: Record<Format, string> = {
  reply: "Write a concise, natural X reply to the story. Add one specific insight, implication, or useful question. Do not summarize the story, do not write a thread, and do not mention that you are an AI.",
  quote: "Write a standalone quote-tweet caption reacting to the story. Take a clear opinion, interpretation, counterpoint, or framing angle. Do not repeat the headline or write a generic summary.",
  poll: "Create an X poll. Return exactly this structure: Question: [one concise question]\nOptions: A) [option] B) [option] C) [option] D) [option]. Options must be meaningfully different and answerable from the story context.",
  blog: "Write a substantial blog draft about the story. Include a strong title, introduction, 3-5 useful sections, evidence/context, implications, and conclusion. This must be much longer and more analytical than an X post or reply.",
  creative: "Write a detailed image-generation prompt for a premium editorial Web3 visual based on the story. Describe subject, composition, hierarchy, mood, lighting, camera/style, symbolism, and social-safe cropping. Do not write the social post itself and do not require readable text in the image."
};

function rateLimited(error: unknown){const text=error instanceof Error?error.message:String(error);return /429|rate.?limit|quota|resource.?exhausted/i.test(text);}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const format = body?.format as Format;
    const story = body?.story;
    if (!["reply", "quote", "poll", "blog", "creative"].includes(format)) return NextResponse.json({ ok:false, error:"Unsupported content format." }, { status:400 });
    if (!story?.headline) return NextResponse.json({ ok:false, error:"Story is required." }, { status:400 });

    // Use the same provider router as the main generation pipeline. Auto prefers OpenRouter.
    const provider = body?.provider && ["auto","gemini","nemotron","openrouter"].includes(body.provider) ? body.provider : "auto";
    const result = await generateWithLLM({
      provider,
      system: `You are Web3 Pulse's Content Studio. Generate ONLY the requested format. ${instructions[format]}\n\nUse only the supplied story facts. Never invent statistics, quotes, sources, dates, eligibility, deadlines or claims. Return plain text only, with no JSON, markdown fences, or preamble.`,
      user: `Create the ${format} now.\n\nHeadline: ${story.headline}\nCategory: ${story.category || "Web3"}\nSummary: ${story.summary || ""}\nWhy it matters: ${story.reason || ""}\nSources: ${(story.sources || []).join(" | ")}\nKeywords: ${(story.keywords || []).join(", ")}`,
      temperature: format === "creative" ? 0.7 : 0.5,
    });
    return NextResponse.json({ ok:true, content:result.content, provider:result.provider, model:result.model, format });
  } catch (error: any) {
    console.error("Web3 Pulse format generation error:", error);
    const status = rateLimited(error) ? 429 : 500;
    return NextResponse.json({ ok:false, error:rateLimited(error)?"LLM rate limit or quota reached. Try again or configure another provider.":error?.message||"Failed to generate content.", code:rateLimited(error)?"LLM_RATE_LIMIT":"FORMAT_GENERATION_ERROR" }, { status });
  }
}
