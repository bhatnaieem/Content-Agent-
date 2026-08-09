import { NextResponse } from "next/server";
import { generateWithLLM } from "../../../lib/llm";

export const maxDuration = 60;

type Story = {
  headline: string; category: string; score: number; format: "thread" | "single post";
  reason: string; summary: string; keywords: string[]; hashtags: string[]; sources: string[];
  posting_time_utc: string; cta: string; graphic_prompt: string; alt_text: string;
  thread: { title: string; tweets: string[] };
  engagement?: { reply: string; quote_tweet: string; poll: string; blog_expansion: string };
};

const RESEARCH_PROMPT = `You are CryptoPulse, a Web3 PR research and content intelligence agent.
Find the TWO strongest recent crypto/Web3 opportunities and return strict JSON.
Prioritize genuinely recent, high-impact stories and include source names/URLs when available.
Create the core X thread/post plus metadata and a visual concept.
JSON schema:
{"date":"YYYY-MM-DD","generated_at_utc":"ISO","stories":[{"headline":"","category":"","score":0,"format":"thread|single post","reason":"","summary":"","keywords":[],"hashtags":[],"sources":[],"posting_time_utc":"","cta":"","graphic_prompt":"","alt_text":"","thread":{"title":"","tweets":[]}}]}`;

const FORMAT_PROMPT = `You are the CryptoPulse Content Studio. Create SIX genuinely different assets from the supplied story.
Do NOT rewrite the same post six times. Each asset must have a different communication job.

REPLY: 1-2 conversational sentences responding to the story, adding one specific insight or question. No headline-style repetition.
QUOTE TWEET: 1-3 punchy sentences expressing a distinct opinion, interpretation, or counterpoint. Do not sound like a reply.
POLL: A concise question followed by exactly 4 distinct answer choices. The choices must be plausible and mutually useful.
BLOG: A substantial article draft/outline with a title, introduction, at least 3 sections, evidence/context, implications, and conclusion. It must be much longer than the social assets.
CREATIVE: A detailed image-generation prompt describing a visual scene, composition, subject, lighting, mood, camera/style, and Web3 symbolism. Never paste the social copy into it.
ALT_TEXT: One concise accessibility description of the proposed image. Do not repeat the creative prompt verbatim.

Return ONLY JSON:
{"reply":"","quote_tweet":"","poll":"","blog_expansion":"","creative":"","alt_text":""}`;

export async function POST(request: Request) {
  try {
    let requestedProvider: "auto" | "gemini" | "nemotron" = "auto";
    try {
      const body = await request.json();
      if (["auto", "gemini", "nemotron"].includes(body?.provider)) requestedProvider = body.provider;
    } catch {}

    const research = await generateWithLLM({
      provider: requestedProvider,
      system: RESEARCH_PROMPT,
      user: "Research the latest high-value Web3/crypto developments and select the two strongest opportunities. Return strict JSON.",
      responseFormat: "json_object",
      temperature: 0.2,
    });

    const data = JSON.parse(research.content);
    const stories: Story[] = Array.isArray(data.stories) ? data.stories : [];

    // Generate format-specific assets separately so the model cannot simply reuse one block of text.
    const enriched = await Promise.all(stories.map(async (story) => {
      try {
        const formats = await generateWithLLM({
          provider: requestedProvider,
          system: FORMAT_PROMPT,
          user: `Create the six distinct Content Studio assets for this story.\n\nHeadline: ${story.headline}\nCategory: ${story.category}\nSummary: ${story.summary}\nReason: ${story.reason}\nSources: ${(story.sources || []).join(" | ")}\nKeywords: ${(story.keywords || []).join(", ")}\nCore thread: ${(story.thread?.tweets || []).join("\n")}`,
          responseFormat: "json_object",
          temperature: 0.65,
        });
        const assets = JSON.parse(formats.content);
        return {
          ...story,
          graphic_prompt: assets.creative || story.graphic_prompt,
          alt_text: assets.alt_text || story.alt_text,
          engagement: {
            reply: assets.reply || "",
            quote_tweet: assets.quote_tweet || "",
            poll: assets.poll || "",
            blog_expansion: assets.blog_expansion || "",
          },
        };
      } catch (error) {
        console.error("Content format generation failed:", error);
        return {
          ...story,
          engagement: {
            reply: "Add a specific reaction or question to this story.",
            quote_tweet: `This development deserves a closer look: ${story.headline}`,
            poll: `Question: What matters most here?\nOptions: A) Adoption B) Innovation C) Regulation D) Market impact`,
            blog_expansion: `${story.headline}\n\nIntroduction\n\n${story.summary}\n\nKey implications\n\n${story.reason}\n\nConclusion\n\n${story.cta}`,
          },
        };
      }
    }));

    return NextResponse.json({
      ...data,
      stories: enriched,
      llm_provider: research.provider,
      llm_model: research.model,
    });
  } catch (error: any) {
    console.error("CryptoPulse Generation Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate content intelligence." }, { status: 500 });
  }
}
