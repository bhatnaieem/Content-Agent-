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

Select the strongest 1-2 opportunities from the supplied candidates. Every story must reference candidate_ids copied exactly from the supplied candidates. Preserve the supplied source URL and publication date. If evidence is insufficient, omit the story.

For EACH selected story generate the COMPLETE CONTENT PACKAGE in this single response:
- Master thread with a strong hook and useful, factual tweets
- Single X post
- Reply
- Quote tweet
- Poll with exactly 4 distinct choices
- Blog expansion with title, introduction, at least 3 sections, evidence/context, implications and conclusion
- Creative/image-generation prompt
- Alt text

The engagement fields are part of the same story object: engagement.reply, engagement.quote_tweet, engagement.poll, engagement.blog_expansion.

For airdrops, never invent eligibility, tasks, claim links, rewards or deadlines. For security incidents, never invent affected users, losses, attacker identity or remediation.

Return ONLY valid JSON. Do not wrap it in markdown fences. Do not add commentary before or after the JSON. Shape: {"date":"CURRENT_DATE","generated_at_utc":"ISO","stories":[{"candidate_ids":["EXACT_ID"],"headline":"","category":"Airdrops|Airdrop Guides|Exploits & Hacks|Other","score":0,"format":"thread|single post","reason":"","summary":"","keywords":[],"hashtags":[],"sources":[],"source_details":[],"posting_time_utc":"","cta":"","graphic_prompt":"","alt_text":"","thread":{"title":"","tweets":[]},"engagement":{"reply":"","quote_tweet":"","poll":"","blog_expansion":""}}]}`;

function clientContext(client?: ClientProfile): string { if (!client) return ""; return ["", "CLIENT PROFILE", `Name: ${client.name || ""}`, `Description: ${client.description || ""}`, `Sector: ${client.sector || ""}`, `Chains/ecosystems: ${client.chains || ""}`, `Priority topics: ${client.topics || ""}`, `Competitors: ${client.competitors || ""}`, `Audience: ${client.audience || ""}`, `Tone: ${client.tone || ""}`, `PR objectives: ${client.objectives || ""}`, `Avoid/guardrails: ${client.avoid || ""}`].join("\n"); }

function normalizeStory(story: any, currentDate: string, candidateMap: Map<string, FreshCandidate>): Story | null {
  const ids: string[] = Array.isArray(story?.candidate_ids) ? Array.from(new Set((story.candidate_ids as unknown[]).filter((id): id is string => typeof id === "string" && candidateMap.has(id)))) : [];
  if (!ids.length) return null;
  const supported = ids.map((id) => candidateMap.get(id)).filter((item): item is FreshCandidate => Boolean(item));
  const sourceDetails: SourceDetail[] = supported.map((item) => ({ name: item.source, url: item.url, published_at: item.publishedAt }));
  return { ...story, date: currentDate, candidate_ids: ids, sources: sourceDetails.map((item) => item.url), source_details: sourceDetails };
}

function isRateLimitError(error: unknown): boolean { const text = error instanceof Error ? error.message : String(error); return /429|rate.?limit|quota|resource.?exhausted/i.test(text); }

function parseLLMJson(content: string): any {
  const cleaned = content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf("{");
  if (start < 0) throw new Error("LLM returned no JSON object.");
  let depth = 0; let inString = false; let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === '"') inString = false; continue; }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { const candidate = cleaned.slice(start, i + 1); try { return JSON.parse(candidate); } catch { break; } } }
  }
  throw new Error("LLM returned invalid JSON. The provider may have returned prose instead of the requested JSON format.");
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
    const freshCandidates: FreshCandidate[] = packet.candidates.filter((item) => { const t = Date.parse(item.publishedAt); return Number.isFinite(t) && t >= Date.parse(cutoffUtc) && t <= now.getTime(); }).map((item) => ({ id: item.id, title: item.title, url: item.url, source: item.source, publishedAt: item.publishedAt, summary: item.summary, category: item.category, keywords: item.keywords, score: item.scores.overall, opportunity: item.opportunity }));
    if (!freshCandidates.length) return NextResponse.json({ error: "No fresh verified candidates were selected by the multi-agent research system. Web3 Pulse will not generate stale or invented content.", date: currentDate, cutoff_utc: cutoffUtc, agents: packet.agents, verification: packet.verification }, { status: 503 });

    const candidateMap = new Map(freshCandidates.map((candidate) => [candidate.id, candidate]));
    const context = [`CURRENT_DATE: ${currentDate}`, `CURRENT_TIME_UTC: ${now.toISOString()}`, `CUTOFF_UTC: ${cutoffUtc}`, "The candidates below are the only allowed factual source for this generation run.", `MULTI_AGENT_REPORTS: ${JSON.stringify(packet.agents)}`, `VERIFICATION: ${JSON.stringify(packet.verification)}`, `PRIORITY_FOCUS: ${packet.priority_focus.join(", ")}`, `NARRATIVES: ${JSON.stringify(packet.narratives.slice(0, 8))}`].join("\n");
    const candidateContext = `VERIFIED CURRENT CANDIDATES (${freshCandidates.length}):\n${JSON.stringify(freshCandidates, null, 2)}`;

    let generation;
    try { generation = await generateWithLLM({ provider, system: CONTENT_PROMPT, user: `${context}\n\n${candidateContext}\n\nSelect the strongest opportunities and generate the COMPLETE CONTENT PACKAGE for each selected story. Do not use information outside these candidates.` + clientContext(body.clientProfile), responseFormat: "json_object", temperature: 0.2 }); }
    catch (error) { if (isRateLimitError(error)) return NextResponse.json({ error: "LLM rate limit or quota reached. Web3 Pulse stopped generation instead of returning stale content. Try again after the provider quota resets or configure a second LLM provider.", code: "LLM_RATE_LIMIT", date: currentDate, agents: packet.agents, verification: packet.verification, candidate_count: freshCandidates.length }, { status: 429 }); throw error; }

    let data: any;
    try { data = parseLLMJson(generation.content); } catch (error) { console.error("Web3 Pulse JSON parse error:", error, "Provider:", generation.provider, "Model:", generation.model); return NextResponse.json({ error: error instanceof Error ? error.message : "LLM returned invalid JSON.", code: "INVALID_LLM_JSON", provider: generation.provider, model: generation.model, date: currentDate }, { status: 502 }); }
    const stories: Story[] = Array.isArray(data.stories) ? data.stories.map((story: any) => normalizeStory(story, currentDate, candidateMap)).filter((story: Story | null): story is Story => Boolean(story)) : [];
    const freshStories = stories.filter((story) => story.candidate_ids?.every((id) => { const candidate = candidateMap.get(id); const t = candidate ? Date.parse(candidate.publishedAt) : NaN; return Number.isFinite(t) && t >= Date.parse(cutoffUtc) && t <= now.getTime(); }));
    if (!freshStories.length) return NextResponse.json({ error: "The LLM did not return a story grounded in the verified current candidates. Web3 Pulse refused to display stale or unsupported content.", code: "NO_GROUNDED_STORIES", date: currentDate, agents: packet.agents, verification: packet.verification }, { status: 503 });

    return NextResponse.json({ ...data, date: currentDate, generated_at_utc: now.toISOString(), stories: freshStories, research_window: { cutoff_utc: cutoffUtc, hours: 48, candidate_count: freshCandidates.length }, research_sources: packet.narratives, agents: packet.agents, verification: packet.verification, llm_provider: generation.provider, llm_model: generation.model, client_mode: Boolean(body.clientProfile), client_name: body.clientProfile?.name || null, priority_focus: packet.priority_focus, llm_calls: 1 });
  } catch (error: any) { console.error("Web3 Pulse Multi-Agent Generation Error:", error); return NextResponse.json({ error: error?.message || "Failed to generate current multi-agent content intelligence." }, { status: 500 }); }
}
