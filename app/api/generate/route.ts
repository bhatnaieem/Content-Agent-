import { NextResponse } from "next/server";
import { generateWithLLM } from "../../../lib/llm";

export const maxDuration = 60;

type SourceDetail = { name: string; url: string; published_at: string };
type ClientProfile = { name?: string; description?: string; sector?: string; chains?: string; topics?: string; competitors?: string; audience?: string; tone?: string; objectives?: string; avoid?: string };
type Story = { headline: string; category: string; score: number; format: "thread" | "single post"; reason: string; summary: string; keywords: string[]; hashtags: string[]; sources: string[]; source_details?: SourceDetail[]; posting_time_utc: string; cta: string; graphic_prompt: string; alt_text: string; thread: { title: string; tweets: string[] }; engagement?: { reply: string; quote_tweet: string; poll: string; blog_expansion: string } };

const RESEARCH_PROMPT = `You are Web3 Pulse, a Web3 PR research and content intelligence agent.
Find the TWO strongest CURRENT Web3 opportunities and return strict JSON.

DATE FRESHNESS — THIS IS CRITICAL:
The application will provide CURRENT_DATE and CUTOFF_UTC in the user instruction. Treat CURRENT_DATE as today's date, not a historical date. Only use developments published, announced, updated, or materially active on/after CUTOFF_UTC unless an older event has a genuinely new development today. Never present an old story as today's news. Always set the JSON date field to CURRENT_DATE. For every source, use its real publication/update date when known. If a source is older, say so and explain the new development rather than implying it is new.

CONTENT PRIORITY — THIS IS CRITICAL:
Web3 Pulse is NOT a generic crypto news aggregator. Prioritize content people actively search for, save, share and act on.
1. EXPLOITS & HACKS — highest priority: protocol exploits, wallet/bridge hacks, drained funds, vulnerabilities, attacks, security incidents, post-mortems and urgent warnings.
2. AIRDROPS — very high priority: newly announced airdrops, token distributions, eligibility changes, claim windows, points programs, retroactive rewards and high-signal farming opportunities.
3. AIRDROP GUIDES — very high priority: actionable eligibility/claim guides, testnets, quests, points campaigns and step-by-step opportunities. Only include guides when supported by a real current project/campaign and clearly distinguish confirmed information from speculation.
4. OTHER HIGH-INTEREST WEB3 — only when there is not enough strong airdrop/security material: major launches, protocol updates, funding, adoption, regulation, market-moving developments and important ecosystem news.

Target mix: aim for at least ONE airdrop/airdrop-guide story and/or ONE exploit/security story whenever a genuinely relevant CURRENT opportunity exists. If there are multiple strong opportunities, prefer 2 from these priority categories over generic news. Generic market/news stories should normally be excluded when a strong priority story is available.
Do NOT invent airdrops, eligibility requirements, claim links, exploits, victims, amounts, dates or deadlines. Airdrop content must be based on a credible source or official project information. Security incidents must be verified with a primary source or reputable security/news source where possible.
Prefer genuinely recent, high-impact stories from the supplied freshness window. For every story, provide source details ONLY when actually known. NEVER invent a URL, source name, or publication date.
For airdrop guides, make the angle actionable: project, why it matters, eligibility/requirements, current status, deadline if verified, official source/claim page if verified, and risk warning. Never present speculative farming as guaranteed rewards.
For exploits/hacks, make the angle useful: affected protocol, what happened, estimated impact only if verified, current status, user action if officially recommended, and source.
Prefer primary/official sources, security researchers, major crypto publications, regulatory filings, company announcements, reputable community signals, and reputable market data.
When a CLIENT PROFILE is supplied, personalize research while preserving the priority above: prioritize stories relevant to its sector, chains, topics, audience, objectives and competitors; identify direct PR opportunities; deprioritize unrelated stories; respect avoid/guardrails. Do not claim a client is involved without evidence.
Return JSON matching this schema:
{"date":"CURRENT_DATE","generated_at_utc":"ISO","stories":[{"headline":"","category":"Airdrops|Airdrop Guides|Exploits & Hacks|Other","score":0,"format":"thread|single post","reason":"","summary":"","keywords":[],"hashtags":[],"sources":[],"source_details":[{"name":"","url":"","published_at":"ISO or YYYY-MM-DD or empty"}],"posting_time_utc":"","cta":"","graphic_prompt":"","alt_text":"","thread":{"title":"","tweets":[]}}]}`;

const FORMAT_PROMPT = `You are the Web3 Pulse Content Studio.
Create six genuinely different assets from the supplied story.
REPLY: 1-2 conversational sentences adding one specific insight or question.
QUOTE TWEET: 1-3 punchy sentences with a distinct opinion or counterpoint.
POLL: concise question plus exactly 4 distinct choices.
BLOG: substantial article draft/outline with title, introduction, at least 3 sections, evidence/context, implications and conclusion.
CREATIVE: detailed image-generation prompt describing visual scene, composition, subject, lighting, mood, camera/style and Web3 symbolism.
ALT_TEXT: concise accessibility description.
If the story is an airdrop, make content practical and clearly separate confirmed eligibility/claim information from speculation. If it is an exploit/hack, prioritize verified facts, user safety and current status; do not exaggerate or invent losses.
Do not add stale facts as if they happened today. Preserve the supplied story date and source dates.
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
    const freshnessContext = [`CURRENT_DATE: ${currentDate}`, `CURRENT_TIME_UTC: ${now.toISOString()}`, `CUTOFF_UTC: ${cutoffUtc}`, "Use these timestamps as authoritative for freshness. Research only current developments within this window unless there is a clearly new update to an older event.", "Return the real source publication/update dates; never fabricate dates."].join("\n");
    const research = await generateWithLLM({ provider, system: RESEARCH_PROMPT, user: `${freshnessContext}\n\nResearch the latest high-interest Web3 opportunities. Strongly prioritize current airdrops, actionable airdrop guides, exploits and hacks over generic crypto news. Return strict JSON.` + clientContext(body.clientProfile), responseFormat: "json_object", temperature: 0.2 });
    const data = JSON.parse(research.content);
    const stories: Story[] = Array.isArray(data.stories) ? data.stories.map((story: any) => normalizeStory(story, currentDate)) : [];
    const enriched = await Promise.all(stories.map(async (story) => {
      try {
        const formats = await generateWithLLM({ provider, system: FORMAT_PROMPT, user: [freshnessContext, "Create the six distinct Content Studio assets for this story.", `Story date: ${currentDate}`, `Headline: ${story.headline}`, `Category: ${story.category}`, `Summary: ${story.summary}`, `Reason: ${story.reason}`, `Sources: ${(story.sources || []).join(" | ")}`, `Source details: ${JSON.stringify(story.source_details || [])}`, `Keywords: ${(story.keywords || []).join(", ")}`, `Core thread: ${(story.thread?.tweets || []).join("\n")}`, clientContext(body.clientProfile)].join("\n"), responseFormat: "json_object", temperature: 0.65 });
        const assets = JSON.parse(formats.content);
        return { ...story, graphic_prompt: assets.creative || story.graphic_prompt, alt_text: assets.alt_text || story.alt_text, engagement: { reply: assets.reply || "", quote_tweet: assets.quote_tweet || "", poll: assets.poll || "", blog_expansion: assets.blog_expansion || "" } };
      } catch (error) {
        console.error("Content format generation failed:", error);
        return { ...story, engagement: { reply: "Add a specific reaction or question to this story.", quote_tweet: `This development deserves a closer look: ${story.headline}`, poll: ["Question: What matters most here?", "Options: A) Adoption", "B) Innovation", "C) Regulation", "D) Market impact"].join("\n"), blog_expansion: [story.headline, "", "Introduction", story.summary, "", "Key implications", story.reason, "", "Conclusion", story.cta].join("\n\n") } };
      }
    }));
    return NextResponse.json({ ...data, date: currentDate, generated_at_utc: now.toISOString(), stories: enriched, llm_provider: research.provider, llm_model: research.model, client_mode: Boolean(body.clientProfile), client_name: body.clientProfile?.name || null, priority_focus: ["Exploits & Hacks", "Airdrops", "Airdrop Guides"] });
  } catch (error: any) { console.error("Web3 Pulse Generation Error:", error); return NextResponse.json({ error: error?.message || "Failed to generate content intelligence." }, { status: 500 }); }
}
