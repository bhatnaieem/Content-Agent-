import { NextResponse } from "next/server";
import { generateWithLLM } from "../../../lib/llm";
import { runMultiAgentResearch } from "../../../lib/multi-agent";

export const maxDuration = 60;

type SourceDetail = { name: string; url: string; published_at: string };
type ClientProfile = { name?: string; description?: string; sector?: string; chains?: string; topics?: string; competitors?: string; audience?: string; tone?: string; objectives?: string; avoid?: string };
type Story = { headline: string; category: string; score: number; format: "thread" | "single post"; reason: string; summary: string; keywords: string[]; hashtags: string[]; sources: string[]; source_details?: SourceDetail[]; posting_time_utc: string; cta: string; graphic_prompt: string; alt_text: string; thread: { title: string; tweets: string[] }; engagement?: { reply: string; quote_tweet: string; poll: string; blog_expansion: string }; candidate_ids?: string[] };
type FreshCandidate = { id: string; title: string; url: string; source: string; publishedAt: string; summary: string; category: string; keywords: string[]; score: number; opportunity: string };

const CONTENT_PROMPT = `You are the Web3 Pulse Content Director Agent.
Work ONLY from the supplied VERIFIED CURRENT candidates. Do not use model memory to add current events, old facts, invented claims, sources, URLs or dates.

PRIORITY ORDER:
1. Exploits & Hacks
2. Airdrops
3. Airdrop Guides
4. Other high-interest Web3 only when no stronger priority candidate exists.

Every story must reference candidate_ids copied exactly from the supplied candidates. Preserve the supplied source URL and publication date. If evidence is insufficient, omit the story.
For airdrops, never invent eligibility, tasks, claim links, rewards or deadlines. For security incidents, never invent affected users, losses, attacker identity or remediation.

Return strict JSON: {"date":"CURRENT_DATE","generated_at_utc":"ISO","stories":[{"candidate_ids":["EXACT_ID"],"headline":"","category":"Airdrops|Airdrop Guides|Exploits & Hacks|Other","score":0,"format":"thread|single post","reason":"","summary":"","keywords":[],"hashtags":[],"sources":[],"source_details":[],"posting_time_utc":"","cta":"","graphic_prompt":"","alt_text":"","thread":{"title":"","tweets":[]}}]}`;

const FORMAT_PROMPT = `You are the Web3 Pulse Content Studio Agent.
Create six genuinely different assets from the supplied CURRENT story. Use only supplied facts and dates. Do not introduce old facts or unrelated historical context as current.
REPLY: 1-2 conversational sentences with one specific insight or question.
QUOTE TWEET: 1-3 punchy sentences with a distinct opinion or counterpoint.
POLL: concise question plus exactly 4 distinct choices.
BLOG: substantial article draft/outline with title, introduction, at least 3 sections, evidence/context, implications and conclusion.
CREATIVE: detailed image-generation prompt with visual scene, composition, subject, lighting, mood, camera/style and Web3 symbolism.
ALT_TEXT: concise accessibility description.
For airdrops, clearly separate confirmed information from speculation. For exploits/hacks, prioritize verified facts, user safety and current status.
Return ONLY JSON with keys reply, quote_tweet, poll, blog_expansion, creative, alt_text.`;

function clientContext(client?: ClientProfile): string { if (!client) return ""; return ["", "CLIENT PROFILE", `Name: ${client.name || ""}`, `Description: ${client.description || ""}`, `Sector: ${client.sector || ""}`, `Chains/ecosystems: ${client.chains || ""}`, `Priority topics: ${client.topics || ""}`, `Competitors: ${client.competitors || ""}`, `Audience: ${client.audience || ""}`, `Tone: ${client.tone || ""}`, `PR objectives: ${client.objectives || ""}`, `Avoid/guardrails: ${client.avoid || ""}`].join("\n"); }

function normalizeStory(story: any, currentDate: string, candidateMap: Map<string, FreshCandidate>): Story | null {
  const ids: string[] = Array.isArray(story?.candidate_ids) ? Array.from(new Set((story.candidate_ids as unknown[]).filter((id): id is string => typeof id === "string" && candidateMap.has(id)))) : [];
  if (!ids.length) return null;
  const supported = ids.map((id) => candidateMap.get(id)).filter((item): item is FreshCandidate => Boolean(item));
  const sourceDetails: SourceDetail[] = supported.map((item) => ({ name: item.source, url: item.url, published_at: item.publishedAt }));
  return { ...story, date: currentDate, candidate_ids: ids, sources: sourceDetails.map((item) => item.url), source_details: sourceDetails };
}

export async function POST(request: Request) {
  try {
    let body: { provider?: string; clientProfile?: ClientProfile } = {};
    try { body = await request.json(); } catch { body = {}; }
    const provider = ["auto", "gemini", "nemotron"].includes(body.provider || "") ? (body.provider as "auto" | "gemini" | "nemotron") : "auto";
    const now = new Date();
    const currentDate = now.toISOString().slice(0, 10);
    const cutoffUtc = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    const packet = await runMultiAgentResearch();
    const freshCandidates: FreshCandidate[] = packet.candidates
      .filter((item) => { const t = Date.parse(item.publishedAt); return Number.isFinite(t) && t >= Date.parse(cutoffUtc) && t <= now.getTime(); })
      .map((item) => ({ id: item.id, title: item.title, url: item.url, source: item.source, publishedAt: item.publishedAt, summary: item.summary, category: item.category, keywords: item.keywords, score: item.scores.overall, opportunity: item.opportunity }));

    if (!freshCandidates.length) return NextResponse.json({ error: "No fresh verified candidates were selected by the multi-agent research system. Web3 Pulse will not generate stale or invented content.", date: currentDate, cutoff_utc: cutoffUtc, agents: packet.agents, verification: packet.verification }, { status: 503 });

    const candidateMap = new Map(freshCandidates.map((candidate) => [candidate.id, candidate]));
    const context = [`CURRENT_DATE: ${currentDate}`, `CURRENT_TIME_UTC: ${now.toISOString()}`, `CUTOFF_UTC: ${cutoffUtc}`, "The candidates below are the only allowed factual source for this generation run.", `MULTI_AGENT_REPORTS: ${JSON.stringify(packet.agents)}`, `VERIFICATION: ${JSON.stringify(packet.verification)}`, `PRIORITY_FOCUS: ${packet.priority_focus.join(", ")}`, `NARRATIVES: ${JSON.stringify(packet.narratives.slice(0, 8))}`].join("\n");
    const candidateContext = `VERIFIED CURRENT CANDIDATES (${freshCandidates.length}):\n${JSON.stringify(freshCandidates, null, 2)}`;

    const research = await generateWithLLM({ provider, system: CONTENT_PROMPT, user: `${context}\n\n${candidateContext}\n\nSelect the strongest opportunities and return strict JSON. Do not use information outside these candidates.` + clientContext(body.clientProfile), responseFormat: "json_object", temperature: 0.12 });
    const data = JSON.parse(research.content);
    const stories: Story[] = Array.isArray(data.stories) ? data.stories.map((story: any) => normalizeStory(story, currentDate, candidateMap)).filter((story: Story | null): story is Story => Boolean(story)) : [];

    const freshStories = stories.filter((story) => story.candidate_ids?.every((id) => { const candidate = candidateMap.get(id); const t = candidate ? Date.parse(candidate.publishedAt) : NaN; return Number.isFinite(t) && t >= Date.parse(cutoffUtc) && t <= now.getTime(); }));

    const enriched = await Promise.all(freshStories.map(async (story) => {
      try {
        const formats = await generateWithLLM({ provider, system: FORMAT_PROMPT, user: [context, "Create the six distinct Content Studio assets for this CURRENT story.", `Story date: ${currentDate}`, `Headline: ${story.headline}`, `Category: ${story.category}`, `Summary: ${story.summary}`, `Reason: ${story.reason}`, `Sources: ${(story.sources || []).join(" | ")}`, `Source details: ${JSON.stringify(story.source_details || [])}`, `Keywords: ${(story.keywords || []).join(", ")}`, `Core thread: ${(story.thread?.tweets || []).join("\n")}`, clientContext(body.clientProfile)].join("\n"), responseFormat: "json_object", temperature: 0.65 });
        const assets = JSON.parse(formats.content);
        return { ...story, graphic_prompt: assets.creative || story.graphic_prompt, alt_text: assets.alt_text || story.alt_text, engagement: { reply: assets.reply || "", quote_tweet: assets.quote_tweet || "", poll: assets.poll || "", blog_expansion: assets.blog_expansion || "" } };
      } catch (error) {
        console.error("Content format generation failed:", error);
        return { ...story, engagement: { reply: "Add a specific reaction or question to this story.", quote_tweet: `This development deserves a closer look: ${story.headline}`, poll: ["Question: What matters most here?", "Options: A) Adoption", "B) Innovation", "C) Regulation", "D) Market impact"].join("\n"), blog_expansion: [story.headline, "", "Introduction", story.summary, "", "Key implications", story.reason, "", "Conclusion", story.cta].join("\n\n") } };
      }
    }));

    return NextResponse.json({ ...data, date: currentDate, generated_at_utc: now.toISOString(), stories: enriched, research_window: { cutoff_utc: cutoffUtc, hours: 48, candidate_count: freshCandidates.length }, research_sources: packet.narratives, agents: packet.agents, verification: packet.verification, llm_provider: research.provider, llm_model: research.model, client_mode: Boolean(body.clientProfile), client_name: body.clientProfile?.name || null, priority_focus: packet.priority_focus });
  } catch (error: any) {
    console.error("Web3 Pulse Multi-Agent Generation Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to generate current multi-agent content intelligence." }, { status: 500 });
  }
}
