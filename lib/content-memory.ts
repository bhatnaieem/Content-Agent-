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
type HistoryRow = { id: string; headline: string; normalized_headline: string; category: string | null; candidate_ids: string[]; source_urls: string[]; generated_at: string; status: string; content_fingerprint: string };
const MEMORY_LIMIT = 5000;
let cached: SupabaseClient | null = null;
function db() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY to Vercel Environment Variables.");
  cached = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return cached;
}
export function normalizeHeadline(value: string) { return value.toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); }
function headlineTokens(value: string) {
  const stop = new Set(["the","a","an","and","or","of","to","from","in","on","for","with","across","after","before","as","at","by","is","are","was","were","this","that","crypto","web3","report","reports","says","saying","new","latest","today","update","updates"]);
  return new Set(normalizeHeadline(value).split(" ").filter(token => token.length >= 3 && !stop.has(token)));
}
export function headlineSimilarity(a: string, b: string) {
  const aa = headlineTokens(a), bb = headlineTokens(b); if (!aa.size || !bb.size) return 0;
  let overlap = 0; for (const token of aa) if (bb.has(token)) overlap++;
  return overlap / Math.min(aa.size, bb.size);
}
function fingerprint(headline: string, candidateIds: string[], sourceUrls: string[]) { return `${normalizeHeadline(headline)}|${[...candidateIds].sort().join(",")}|${sourceUrls.map(normalizeHeadline).sort().join(",")}`; }
function primaryCandidateIds(row: Pick<HistoryRow, "candidate_ids">) { return (Array.isArray(row.candidate_ids) ? row.candidate_ids.filter(id => typeof id === "string" && id.trim()) : []).slice(0, 1); }
function primarySourceUrls(row: Pick<HistoryRow, "source_urls">) { return (Array.isArray(row.source_urls) ? row.source_urls.filter(url => typeof url === "string" && url.trim()) : []).slice(0, 1); }
export async function rememberCandidates(candidates: Array<{ id: string; title: string; url: string; source: string; category: string; publishedAt: string }>) {
  if (!candidates.length) return;
  const unique = Array.from(new Map(candidates.map(candidate => [candidate.id, candidate])).values());
  const rows = unique.map(candidate => ({ id: candidate.id, title: candidate.title, normalized_title: normalizeHeadline(candidate.title), url: candidate.url, source: candidate.source, category: candidate.category, published_at: candidate.publishedAt, last_seen_at: new Date().toISOString() }));
  const { error } = await db().from("web3pulse_candidates").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Supabase candidate memory failed: ${error.message}`);
}
export async function getUsedCandidateIds(limit = MEMORY_LIMIT) {
  const { data, error } = await db().from("web3pulse_content_history").select("candidate_ids").order("generated_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Supabase history lookup failed: ${error.message}`);
  const ids = new Set<string>(); for (const row of data || []) for (const id of primaryCandidateIds(row as HistoryRow)) ids.add(id); return [...ids];
}
export async function getRecentHistory(limit = MEMORY_LIMIT): Promise<HistoryRow[]> {
  const { data, error } = await db().from("web3pulse_content_history").select("id,headline,normalized_headline,category,candidate_ids,source_urls,generated_at,status,content_fingerprint").order("generated_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Supabase history lookup failed: ${error.message}`); return (data || []) as HistoryRow[];
}
export async function getLatestSavedStories(limit = 5): Promise<MemoryStory[]> {
  const { data, error } = await db().from("web3pulse_content_history").select("headline,category,candidate_ids,source_urls,content,status,generated_at,llm_provider,llm_model").order("generated_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Supabase latest briefing lookup failed: ${error.message}`);
  return (data || []).map((row: any) => ({ headline: row.headline, category: row.category || undefined, candidate_ids: primaryCandidateIds(row as HistoryRow), source_urls: primarySourceUrls(row as HistoryRow), content: row.content, status: row.status, generated_at: row.generated_at, llm_provider: row.llm_provider || undefined, llm_model: row.llm_model || undefined })) as MemoryStory[];
}
export async function filterPreviouslyCovered<T extends { id: string; title: string; url: string }>(candidates: T[]) {
  if (!candidates.length) return candidates;
  const history = await getRecentHistory();
  const usedIds = new Set(history.flatMap(primaryCandidateIds));
  const usedUrls = new Set(history.flatMap(primarySourceUrls).map(normalizeHeadline));
  const usedHeadlines = history.map(row => row.headline || row.normalized_headline || "");
  return candidates.filter(candidate => !usedIds.has(candidate.id) && !usedUrls.has(normalizeHeadline(candidate.url)) && !usedHeadlines.some(headline => headlineSimilarity(candidate.title, headline) >= 0.65));
}

// Final gate for generated output. This is deliberately separate from persistence because
// saveGeneratedStories must never silently remove a duplicate after the API has already decided to return it.
export async function filterGeneratedDuplicates<T extends { headline: string; candidate_ids: string[]; sources: string[] }>(stories: T[]) {
  if (!stories.length) return stories;
  const history = await getRecentHistory();
  const usedIds = new Set(history.flatMap(primaryCandidateIds));
  const usedUrls = new Set(history.flatMap(primarySourceUrls).map(normalizeHeadline));
  const usedHeadlines = history.map(row => row.headline || row.normalized_headline || "");
  const accepted: T[] = [];
  const batchIds = new Set<string>();
  const batchUrls = new Set<string>();
  const batchHeadlines: string[] = [];
  for (const story of stories) {
    const id = Array.isArray(story.candidate_ids) ? story.candidate_ids[0] : "";
    const urls = Array.isArray(story.sources) ? story.sources.filter(Boolean) : [];
    const duplicate = !id || usedIds.has(id) || batchIds.has(id) || urls.some(url => usedUrls.has(normalizeHeadline(url)) || batchUrls.has(normalizeHeadline(url))) || usedHeadlines.some(h => headlineSimilarity(story.headline, h) >= 0.65) || batchHeadlines.some(h => headlineSimilarity(story.headline, h) >= 0.65);
    if (duplicate) continue;
    batchIds.add(id); for (const url of urls) batchUrls.add(normalizeHeadline(url)); batchHeadlines.push(story.headline); accepted.push(story);
  }
  return accepted;
}
export async function saveGeneratedStories(stories: MemoryStory[]) {
  if (!stories.length) return;
  const uniqueByFingerprint = new Map<string, MemoryStory>();
  for (const story of stories) {
    const candidateIds = Array.isArray(story.candidate_ids) ? story.candidate_ids.filter(id => typeof id === "string" && id.trim()).slice(0, 1) : [];
    if (!candidateIds.length) continue;
    const normalizedStory = { ...story, candidate_ids: candidateIds, source_urls: Array.isArray(story.source_urls) ? story.source_urls : [] };
    const key = fingerprint(normalizedStory.headline, normalizedStory.candidate_ids, normalizedStory.source_urls);
    if (!uniqueByFingerprint.has(key)) uniqueByFingerprint.set(key, normalizedStory);
  }
  for (const story of uniqueByFingerprint.values()) {
    const row = { headline: story.headline, normalized_headline: normalizeHeadline(story.headline), category: story.category || null, candidate_ids: story.candidate_ids, source_urls: story.source_urls, content: story.content, status: story.status || "generated", generated_at: story.generated_at || new Date().toISOString(), content_fingerprint: fingerprint(story.headline, story.candidate_ids, story.source_urls), llm_provider: story.llm_provider || null, llm_model: story.llm_model || null };
    const { error } = await db().from("web3pulse_content_history").upsert([row], { onConflict: "content_fingerprint", ignoreDuplicates: true });
    if (error) throw new Error(`Supabase content history save failed: ${error.message}`);
  }
}
export async function listContentHistory(limit = 100) {
  const { data, error } = await db().from("web3pulse_content_history").select("id,headline,category,candidate_ids,source_urls,status,generated_at,published_at,content,llm_provider,llm_model").order("generated_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Supabase content history failed: ${error.message}`); return data || [];
}
