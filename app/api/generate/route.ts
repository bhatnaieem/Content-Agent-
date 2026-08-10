import { NextResponse } from "next/server";
import { generateWithLLM } from "../../../lib/llm";
import { runResearch } from "../../../lib/research-engine";

export const maxDuration = 60;

type SourceDetail = { name: string; url: string; published_at: string };
type ClientProfile = { name?: string; description?: string; sector?: string; chains?: string; topics?: string; competitors?: string; audience?: string; tone?: string; objectives?: string; avoid?: string };
type Story = { headline: string; category: string; score: number; format: "thread" | "single post"; reason: string; summary: string; keywords: string[]; hashtags: string[]; sources: string[]; source_details?: SourceDetail[]; posting_time_utc: string; cta: string; graphic_prompt: string; alt_text: string; thread: { title: string; tweets: string[] }; engagement?: { reply: string; quote_tweet: string; poll: string; blog_expansion: string } };

const RESEARCH_PROMPT = `You are Web3 Pulse, a Web3 PR research and content intelligence agent.
You are NOT allowed to independently invent or recall stories. The application supplies a FRESH RESEARCH CANDIDATE SET below. Your job is to select and transform only those candidates into content opportunities.

DATE FRESHNESS — ABSOLUTE RULE:
CURRENT_DATE and CUTOFF_UTC are authoritative. Only select candidates whose supplied publishedAt is inside the freshness window. Do not use model memory to add older events. Do not turn a 2024/2025/2026-old event into a current story unless the supplied candidate itself contains a clearly dated new update inside the window.
If there are not two valid candidates, return fewer stories rather than inventing stories. Never fabricate a source, URL, publication date, exploit, airdrop, eligibility requirement, claim link, victim, amount or deadline.

CONTENT PRIORITY:
1. EXPLOITS & HACKS — highest priority.
2. AIRDROPS — very high priority.
3. AIRDROP GUIDES — very high priority.
4. OTHER HIGH-INTEREST WEB3 — only if the supplied fresh candidates do not provide enough priority stories.
Prefer 2 priority stories when genuinely supported by the supplied candidates. Generic crypto news is a fallback, not the default.

For airdrops: only state eligibility, claims, points, quests, testnets, deadlines and official links when supported by the supplied candidate/source details. Clearly label uncertainty.
For exploits/hacks: only state affected protocol, impact, losses, attacker details, status and recommended user action when supported by the supplied candidates/source details.

Return strict JSON using only supplied candidate facts. Preserve real source dates and URLs.
Schema: {"date":"CURRENT_DATE","generated_at_utc":"ISO","stories":[{"headline":"","category":"Airdrops|Airdrop Guides|Exploits & Hacks|Other","score":0,"format":"thread|single post","reason":"","summary":"","keywords":[],"hashtags":[],"sources":[],"source_details":[{"name":"","url":"","published_at":"ISO or YYYY-MM-DD or empty"}],"posting_time_utc":"","cta":"","graphic_prompt":"","alt_text":"","thread":{"title":"","tweets":[]}}]}`;

const FORMAT_PROMPT = `You are the Web3 Pulse Content Studio.
Create six genuinely different assets from the supplied CURRENT story. Use only the supplied facts and dates. Do not introduce old facts, invented claims or unrelated historical context as if current.
REPLY: 1-2 conversational sentences adding one specific insight or question.
QUOTE TWEET: 1-3 punchy sentences with a distinct opinion or counterpoint.
POLL: concise question plus exactly 4 distinct choices.
BLOG: substantial article draft/outline with title, introduction, at least 3 sections, evidence/context, implications and conclusion.
CREATIVE: detailed image-generation prompt describing visual scene, composition, subject, lighting, mood, camera/style and Web3 symbolism.
ALT_TEXT: concise accessibility description.
If the story is an airdrop, make content practical and clearly separate confirmed eligibility/claim information from speculation. If it is an exploit/hack, prioritize verified facts, user safety and current status.
Return ONLY JSON with keys reply, quote_tweet, poll, blog_expansion, creative, alt_text.`;

function cleanSourceDetails(value: unknown): SourceDetail[] { if (!Array.isArray(value)) return []; return value.filter((item) => item && typeof item === "object").map((item) => { const x = item as Record<string, unknown>; return { name: typeof x.name === "string" ? x.name.trim() : "", url: typeof x.url === "string" && /^https?:\/\//i.test(x.url.trim()) ? x.url.trim() : "", published_at: typeof x.published_at === "string" ? x.published_at.trim() : "" }; }).filter((item) => item.name || item.url || item.published_at); }
function normalizeStory(story: any, currentDate: string): Story { const sourceDetails = cleanSourceDetails(story?.source_details); const legacySources = Array.isArray(story?.sources) ? story.sources.filter((item: unknown) => typeof item === "string") : []; return { ...story, date: currentDate, sources: legacySources.length ? legacySources : sourceDetails.map((item) => item.url || item.name).filter(Boolean), source_details: sourceDetails }; }
function clientContext(client?: ClientProfile): string { if (!client) return ""; return ["", "CLIENT PROFILE", `Name: ${client.name || ""}`, `Description: ${client.description || ""}`, `Sector: ${client.sector || ""}`, `Chains/ecosystems: ${client.chains || ""}`, `Priority topics: ${client.topics || ""}`, `Competitors: ${client.competitors || ""}`, `Audience: ${client.audience || ""}`, `Tone: ${client.tone || ""}`, `PR objectives: ${client.objectives || ""}`, `Avoid/guardrails: ${client.avoid || ""}`].join("\n"); }

export async function POST(request: Request) {
  try {
    let body: { provider?: string; clientProfile?: ClientProfile } = {};
    try { body = await request.json(); } catch { body = {}; }
    const provider = ["auto", "gemini", "nemotron"].includes(body.provider || "") ? (body.provider as "auto" | "gemini" | "nemotron") : "auto";
    const now = new Date();
    const currentDate = now.toISOString().slice(0, 10);
    const cutoffUtc = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    // IMPORTANT: generation is now grounded in the application's live research engine.
    // The LLM never gets a blank "find the latest news" task, which previously allowed stale model memory to leak into output.
    const researchFeed = await runResearch();
    const freshCandidates = researchFeed.items
      .filter((item) => { const t = new Date(item.publishedAt).getTime(); return Number.isFinite(t) && t >= new Date(cutoffUtc).getTime() && t <= now.getTime(); })
      .slice(0, 24)
      .map((item) => ({ id: item.id, title: item.title, url: item.url, source: item.source, publishedAt: item.publishedAt, summary: item.summary, category: item.category, keywords: item.keywords, score: item.scores.overall, opportunity: item.opportunity }));

    if (!freshCandidates.length) {
      return NextResponse.json({ error: "No fresh research candidates were found in the last 48 hours. Web3 Pulse will not generate stale or invented content.", date: currentDate, cutoff_utc: cutoffUtc, sources: researchFeed.sources }, { status: 503 });
    }

    const freshnessContext = [`CURRENT_DATE: ${currentDate}`, `CURRENT_TIME_UTC: ${now.toISOString()}`, `CUTOFF_UTC: ${cutoffUtc}`, "Only use supplied candidates inside this freshness window. Do not use model memory for current events.", "A candidate's publishedAt is the authoritative freshness timestamp.", "If candidate evidence is insufficient, omit the story rather than filling gaps with historical knowledge."].join("\n");
    const candidateContext = `FRESH RESEARCH CANDIDATES (${freshCandidates.length}):\n${JSON.stringify(freshCandidates, null, 2)}`;

    const research = await generateWithLLM({ provider, system: RESEARCH_PROMPT, user: `${freshnessContext}\n\n${candidateContext}\n\nSelect the strongest current opportunities from ONLY these candidates. Strongly prioritize exploits/hacks, airdrops and actionable airdrop guides. Return strict JSON.` + clientContext(body.clientProfile), responseFormat: "json_object", temperature: 0.15 });
    const data = JSON.parse(research.content);
    const stories: Story[] = Array.isArray(data.stories) ? data.stories.map((story: any) => normalizeStory(story, currentDate)) : [];

    // Hard post-generation guard: discard stories whose supplied source dates are outside the freshness window.
    const freshStories = stories.filter((story) => {
      const dates = (story.source_details || []).map((s) => Date.parse(s.published_at)).filter(Number.isFinite);
      return dates.length === 0 || dates.some((d) => d >= new Date(cutoffUtc).getTime() && d <= now.getTime());
    });

    const enriched = await Promise.all(freshStories.map(async (story) => {
      try {
        const formats = await generateWithLLM({ provider, system: FORMAT_PROMPT, user: [freshnessContext, "Create the six distinct Content Studio assets for this CURRENT story.", `Story date: ${currentDate}`, `Headline: ${story.headline}`, `Category: ${story.category}`, `Summary: ${story.summary}`, `Reason: ${story.reason}`, `Sources: ${(story.sources || []).join(" | ")}`, `Source details: ${JSON.stringify(story.source_details || [])}`, `Keywords: ${(story.keywords || []).join(", ")}`, `Core thread: ${(story.thread?.tweets || []).join("\n")}`, clientContext(body.clientProfile)].join("\n"), responseFormat: "json_object", temperature: 0.65 });
        const assets = JSON.parse(formats.content);
        return { ...story, graphic_prompt: assets.creative || story.graphic_prompt, alt_text: assets.alt_text || story.alt_text, engagement: { reply: assets.reply || "", quote_tweet: assets.quote_tweet || "", poll: assets.poll || "", blog_expansion: assets.blog_expansion || "" } };
      } catch (error) {
        console.error("Content format generation failed:", error);
        return { ...story, engagement: { reply: "Add a specific reaction or question to this story.", quote_tweet: `This development deserves a closer look: ${story.headline}`, poll: ["Question: What matters most here?", "Options: A) Adoption", "B) Innovation", "C) Regulation", "D) Market impact"].join("\n"), blog_expansion: [story.headline, "", "Introduction", story.summary, "", "Key implications", story.reason, "", "Conclusion", story.cta].join("\n\n") } };
      }
    }));

    return NextResponse.json({ ...data, date: currentDate, generated_at_utc: now.toISOString(), stories: enriched, research_window: { cutoff_utc: cutoffUtc, hours: 48, candidate_count: freshCandidates.length }, research_sources: researchFeed.sources, llm_provider: research.provider, llm_model: research.model, client_mode: Boolean(body.clientProfile), client_name: body.clientProfile?.name || null, priority_focus: ["Exploits & Hacks", "Airdrops", "Airdrop Guides"] });
  } catch (error: any) {
    console.error("Web3 Pulse Generation Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to generate current content intelligence." }, { status: 500 });
  }
}
