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

function tokens(value: string) {
  return new Set(normalizeHeadline(value).split(" ").filter((x) => x.length > 2));
}

function similarity(a: string, b: string) {
  const aa = tokens(a); const bb = tokens(b);
  if (!aa.size || !bb.size) return 0;
  let intersection = 0;
  aa.forEach((token) => { if (bb.has(token)) intersection++; });
  return intersection / (aa.size + bb.size - intersection);
}

export function fingerprint(headline: string, candidateIds: string[], sourceUrls: string[]) {
  return `${normalizeHeadline(headline)}|${[...candidateIds].sort().join(",")}|${sourceUrls.map(normalizeHeadline).sort().join(",")}`;
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

export async function getUsedCandidateIds(limit = 500) {
  const { data, error } = await db().from("web3pulse_content_history").select("candidate_ids").order("generated_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Supabase history lookup failed: ${error.message}`);
  const ids = new Set<string>();
  for (const row of data || []) for (const id of row.candidate_ids || []) ids.add(id);
  return [...ids];
}

export async function getRecentHistory(limit = 300): Promise<HistoryRow[]> {
  const { data, error } = await db().from("web3pulse_content_history").select("id,headline,normalized_headline,category,candidate_ids,source_urls,generated_at,status,content_fingerprint").order("generated_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Supabase history lookup failed: ${error.message}`);
  return (data || []) as HistoryRow[];
}

export async function filterPreviouslyCovered<T extends { id: string; title: string; url: string }>(candidates: T[]) {
  if (!candidates.length) return candidates;
  const history = await getRecentHistory();
  const usedIds = new Set(history.flatMap((row) => row.candidate_ids || []));
  return candidates.filter((candidate) => {
    if (usedIds.has(candidate.id)) return false;
    const normalizedUrl = normalizeHeadline(candidate.url);
    return !history.some((row) => {
      if ((row.source_urls || []).some((url) => normalizeHeadline(url) === normalizedUrl)) return true;
      return similarity(candidate.title, row.headline) >= 0.78;
    });
  });
}

export async function saveGeneratedStories(stories: MemoryStory[]) {
  if (!stories.length) return;
  const uniqueByFingerprint = new Map<string, MemoryStory>();
  for (const story of stories) uniqueByFingerprint.set(fingerprint(story.headline, story.candidate_ids, story.source_urls), story);
  const rows = Array.from(uniqueByFingerprint.values()).map((story) => ({
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
  }));
  const { error } = await db().from("web3pulse_content_history").upsert(rows, { onConflict: "content_fingerprint" });
  if (error) throw new Error(`Supabase content history save failed: ${error.message}`);
}

export async function listContentHistory(limit = 100) {
  const { data, error } = await db().from("web3pulse_content_history").select("id,headline,category,candidate_ids,source_urls,status,generated_at,published_at,content,llm_provider,llm_model").order("generated_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Supabase content history failed: ${error.message}`);
  return data || [];
}
