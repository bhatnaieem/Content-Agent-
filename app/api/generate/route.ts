import { NextResponse } from "next/server";
import { generateWithLLM } from "../../../lib/llm";

export const maxDuration = 60;

type SourceDetail = {
  name: string;
  url: string;
  published_at: string;
};

type ClientProfile = {
  name?: string;
  description?: string;
  sector?: string;
  chains?: string;
  topics?: string;
  competitors?: string;
  audience?: string;
  tone?: string;
  objectives?: string;
  avoid?: string;
};

type Story = {
  headline: string;
  category: string;
  score: number;
  format: "thread" | "single post";
  reason: string;
  summary: string;
  keywords: string[];
  hashtags: string[];
  sources: string[];
  source_details?: SourceDetail[];
  posting_time_utc: string;
  cta: string;
  graphic_prompt: string;
  alt_text: string;
  thread: { title: string; tweets: string[] };
  engagement?: {
    reply: string;
    quote_tweet: string;
    poll: string;
    blog_expansion: string;
  };
};

const RESEARCH_PROMPT = `You are CryptoPulse, a Web3 PR research and content intelligence agent.
Find the TWO strongest recent crypto/Web3 opportunities and return strict JSON.
Prioritize genuinely recent, high-impact stories from the latest 48 hours when possible.
For every story, provide source details ONLY when you actually know them. NEVER invent a URL, source name, or publication date.
Prefer primary/official sources, major crypto publications, regulatory filings, company announcements, and reputable market data.
When a CLIENT PROFILE is supplied, personalize the research: prioritize stories relevant to its sector, chains, topics, audience, objectives and competitors; identify direct PR opportunities for that client; deprioritize unrelated stories; respect its avoid/guardrails. Do not claim a client is involved in a story unless the evidence supports it.
Return JSON matching this schema:
{"date":"YYYY-MM-DD","generated_at_utc":"ISO","stories":[{"headline":"","category":"","score":0,"format":"thread|single post","reason":"","summary":"","keywords":[],"hashtags":[],"sources":[],"source_details":[{"name":"","url":"","published_at":"ISO or YYYY-MM-DD or empty"}],"posting_time_utc":"","cta":"","graphic_prompt":"","alt_text":"","thread":{"title":"","tweets":[]}}]}`;

const FORMAT_PROMPT = `You are the CryptoPulse Content Studio.
Create six genuinely different assets from the supplied story.
REPLY: 1-2 conversational sentences adding one specific insight or question.
QUOTE TWEET: 1-3 punchy sentences with a distinct opinion or counterpoint.
POLL: concise question plus exactly 4 distinct choices.
BLOG: substantial article draft/outline with title, introduction, at least 3 sections, evidence/context, implications and conclusion.
CREATIVE: detailed image-generation prompt describing visual scene, composition, subject, lighting, mood, camera/style and Web3 symbolism.
ALT_TEXT: concise accessibility description.
Return ONLY JSON with keys reply, quote_tweet, poll, blog_expansion, creative, alt_text.`;

function cleanSourceDetails(value: unknown): SourceDetail[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const x = item as Record<string, unknown>;
      return {
        name: typeof x.name === "string" ? x.name.trim() : "",
        url: typeof x.url === "string" && /^https?:\/\//i.test(x.url.trim()) ? x.url.trim() : "",
        published_at: typeof x.published_at === "string" ? x.published_at.trim() : "",
      };
    })
    .filter((item) => item.name || item.url || item.published_at);
}

function normalizeStory(story: any): Story {
  const sourceDetails = cleanSourceDetails(story?.source_details);
  const legacySources = Array.isArray(story?.sources)
    ? story.sources.filter((item: unknown) => typeof item === "string")
    : [];

  return {
    ...story,
    sources: legacySources.length
      ? legacySources
      : sourceDetails.map((item) => item.url || item.name).filter(Boolean),
    source_details: sourceDetails,
  };
}

function clientContext(client?: ClientProfile): string {
  if (!client) return "";

  return [
    "",
    "CLIENT PROFILE",
    `Name: ${client.name || ""}`,
    `Description: ${client.description || ""}`,
    `Sector: ${client.sector || ""}`,
    `Chains/ecosystems: ${client.chains || ""}`,
    `Priority topics: ${client.topics || ""}`,
    `Competitors: ${client.competitors || ""}`,
    `Audience: ${client.audience || ""}`,
    `Tone: ${client.tone || ""}`,
    `PR objectives: ${client.objectives || ""}`,
    `Avoid/guardrails: ${client.avoid || ""}`,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    let body: { provider?: string; clientProfile?: ClientProfile } = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const provider = ["auto", "gemini", "nemotron"].includes(body.provider || "")
      ? (body.provider as "auto" | "gemini" | "nemotron")
      : "auto";

    const research = await generateWithLLM({
      provider,
      system: RESEARCH_PROMPT,
      user:
        "Research the latest high-value Web3/crypto developments and select the two strongest opportunities. Return strict JSON." +
        clientContext(body.clientProfile),
      responseFormat: "json_object",
      temperature: 0.2,
    });

    const data = JSON.parse(research.content);
    const stories: Story[] = Array.isArray(data.stories)
      ? data.stories.map(normalizeStory)
      : [];

    const enriched = await Promise.all(
      stories.map(async (story) => {
        try {
          const formats = await generateWithLLM({
            provider,
            system: FORMAT_PROMPT,
            user: [
              "Create the six distinct Content Studio assets for this story.",
              `Headline: ${story.headline}`,
              `Category: ${story.category}`,
              `Summary: ${story.summary}`,
              `Reason: ${story.reason}`,
              `Sources: ${(story.sources || []).join(" | ")}`,
              `Keywords: ${(story.keywords || []).join(", ")}`,
              `Core thread: ${(story.thread?.tweets || []).join("\n")}`,
              clientContext(body.clientProfile),
            ].join("\n"),
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
              poll: "Question: What matters most here?\nOptions: A) Adoption\nB) Innovation\nC) Regulation\nD) Market impact",
              blog_expansion: [
                story.headline,
                "",
                "Introduction",
                story.summary,
                "",
                "Key implications",
                story.reason,
                "",
                "Conclusion",
                story.cta,
              ].join("\n\n"),
            },
          };
        }
      })
    );

    return NextResponse.json({
      ...data,
      stories: enriched,
      llm_provider: research.provider,
      llm_model: research.model,
      client_mode: Boolean(body.clientProfile),
      client_name: body.clientProfile?.name || null,
    });
  } catch (error: any) {
    console.error("CryptoPulse Generation Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate content intelligence." },
      { status: 500 }
    );
  }
}
