import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type MemoryStory = {
  id?: string;
  headline: string;
  category?: string;
  candidate_ids: string[];
  source_urls: string[];
  content: unknown;
  status?: "generated" | "approved" | "scheduled" | "published" | "rejected";
  generated_at?: string;
  llm_provider?: string;
  llm_model?: string;
};

type HistoryRow = {
  id: string;
  headline: string;
  normalized_headline: string;
  category: string | null;
  candidate_ids: string[];
  source_urls: string[];
  generated_at: string;
  status: string;
  content_fingerprint: string;
};

const MEMORY_WINDOW_HOURS = 24;

let cached: SupabaseClient | null = null;

function db() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY to Vercel Environment Variables.");
  cached = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return cached;
}

export function normalizeHeadline(value: string) {
  return value.toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function headlineTokens(value: string) {
  const stop = new Set(["the","a","an","and","or","of","to","from","in","on","for","with","across","after","before","as","at","by","is","are","was","were","this","that","crypto","web3"]);
  return new Set(normalizeHeadline(value).split(" ").filter(token => token.length >= 3 && !stop.has(token)));
}

function headlineSimilarity(a: string, b: string) {
  const aa = headlineTokens(a), bb = headlineTokens(b);
  if (!aa.size || !bb.size) return 0;
  let overlap = 0;
  for (const token of aa) if (bb.has(token)) overlap++;
  return overlap / Math.min(aa.size, bb.size);
}

function fingerprint(headline: string, candidateIds: string[], sourceUrls: string[]) {
  return `${normalizeHeadline(headline)}|${[...candidateIds].sort().join(",")}|${sourceUrls.map(normalizeHeadline).sort().join(",")}`;
}

function memoryCutoff() {
  return new Date(Date.now() - MEMORY_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
}

export async function rememberCandidates(candidates: Array<{ id: string; title: string; url: string; source: string; category: string; publishedAt: string }>) {
  if (!candidates.length) return;
  const unique = Array.from(new Map(candidates.map((candidate) => [candidate.id, candidate])).values());
  const rows = unique.map((candidate) => ({
    id: candidate.id,
    title: candidate.title,
    normalized_title: normalizeHeadline(candidate.title),
    url: candidate.url,
    source: candidate.source,
    category: candidate.category,
    published_at: candidate.publishedAt,
    last_seen_at: new Date().toISOString(),
  }));
  const { error } = await db().from("web3pulse_candidates").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Supabase candidate memory failed: ${error.message}`);
}

function primaryCandidateIds(row: Pick<HistoryRow, "candidate_ids">) {
  const ids = Array.isArray(row.candidate_ids) ? row.candidate_ids.filter(id => typeof id === "string" && id.trim()) : [];
  return ids.slice(0, 1);
}

function primarySourceUrls(row: Pick<HistoryRow, "source_urls">) {
  const urls = Array.isArray(row.source_urls) ? row.source_urls.filter(url => typeof url === "string" && url.trim()) : [];
  return urls.slice(0, 1);
}

export async function getUsedCandidateIds(limit = 500) {
  const { data, error } = await db()
    .from("web3pulse_content_history")
    .select("candidate_ids")
    .gte("generated_at", memoryCutoff())
    .order("generated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Supabase history lookup failed: ${error.message}`);
  const ids = new Set<string>();
  for (const row of data || []) for (const id of primaryCandidateIds(row as HistoryRow)) ids.add(id);
  return [...ids];
}

export async function getRecentHistory(limit = 300): Promise<HistoryRow[]> {
  const { data, error } = await db()
    .from("web3pulse_content_history")
    .select("id,headline,normalized_headline,category,candidate_ids,source_urls,generated_at,status,content_fingerprint")
    .gte("generated_at", memoryCutoff())
    .order("generated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Supabase history lookup failed: ${error.message}`);
  return (data || []) as HistoryRow[];
}

export async function getLatestSavedStories(limit = 5): Promise<MemoryStory[]> {
  const { data, error } = await db()
    .from("web3pulse_content_history")
    .select("headline,category,candidate_ids,source_urls,content,status,generated_at,llm_provider,llm_model")
    .order("generated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Supabase latest briefing lookup failed: ${error.message}`);
  return (data || []).map((row: any) => ({
    headline: row.headline,
    category: row.category || undefined,
    candidate_ids: primaryCandidateIds(row as HistoryRow),
    source_urls: primarySourceUrls(row as HistoryRow),
    content: row.content,
    status: row.status,
    generated_at: row.generated_at,
    llm_provider: row.llm_provider || undefined,
    llm_model: row.llm_model || undefined,
  })) as MemoryStory[];
}

export async function filterPreviouslyCovered<T extends { id: string; title: string; url: string }>(candidates: T[]) {
  if (!candidates.length) return candidates;
  const history = await getRecentHistory();
  const usedIds = new Set(history.flatMap(primaryCandidateIds));
  const usedUrls = new Set(history.flatMap(primarySourceUrls).map(normalizeHeadline));
  const usedHeadlines = history.map(row => row.headline || row.normalized_headline || "");
  return candidates.filter((candidate) => {
    if (usedIds.has(candidate.id)) return false;
    if (usedUrls.has(normalizeHeadline(candidate.url))) return false;
    if (usedHeadlines.some(headline => headlineSimilarity(candidate.title, headline) >= 0.72)) return false;
    return true;
  });
}

export async function saveGeneratedStories(stories: MemoryStory[]) {
  if (!stories.length) return;
  const uniqueByFingerprint = new Map<string, MemoryStory>();
  for (const story of stories) {
    const normalizedStory = {
      ...story,
      candidate_ids: Array.isArray(story.candidate_ids) ? story.candidate_ids.slice(0, 1) : [],
      source_urls: Array.isArray(story.source_urls) ? story.source_urls : [],
    };
    const key = fingerprint(normalizedStory.headline, normalizedStory.candidate_ids, normalizedStory.source_urls);
    if (!uniqueByFingerprint.has(key)) uniqueByFingerprint.set(key, normalizedStory);
  }

  for (const story of uniqueByFingerprint.values()) {
    const row = {
      headline: story.headline,
      normalized_headline: normalizeHeadline(story.headline),
      category: story.category || null,
      candidate_ids: story.candidate_ids,
      source_urls: story.source_urls,
      content: story.content,
      status: story.status || "generated",
      generated_at: story.generated_at || new Date().toISOString(),
      content_fingerprint: fingerprint(story.headline, story.candidate_ids, story.source_urls),
      llm_provider: story.llm_provider || null,
      llm_model: story.llm_model || null,
    };
    const { error } = await db().from("web3pulse_content_history").upsert([row], { onConflict: "content_fingerprint", ignoreDuplicates: true });
    if (error) throw new Error(`Supabase content history save failed: ${error.message}`);
  }
}

export async function listContentHistory(limit = 100) {
  const { data, error } = await db().from("web3pulse_content_history").select("id,headline,category,candidate_ids,source_urls,status,generated_at,published_at,content,llm_provider,llm_model").order("generated_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Supabase content history failed: ${error.message}`);
  return data || [];
}
