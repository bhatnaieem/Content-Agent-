export type ResearchItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary: string;
  category: string;
  keywords: string[];
  entities: string[];
  scores: {
    relevance: number;
    momentum: number;
    novelty: number;
    credibility: number;
    prPotential: number;
    overall: number;
  };
  opportunity: string;
};

export type Narrative = {
  name: string;
  count: number;
  score: number;
  momentum: number;
  keywords: string[];
  stories: string[];
};

const FEEDS = [
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { name: "Decrypt", url: "https://decrypt.co/feed" },
];

// Keep the research set intentionally fresh. We prefer stories from the last
// 24 hours and allow up to 48 hours only when a feed has older fresh coverage.
const MAX_AGE_HOURS = 48;

const TOPICS: Record<string, string[]> = {
  AI: ["ai", "agent", "agents", "artificial intelligence", "machine learning"],
  DeFi: ["defi", "lending", "dex", "yield", "liquidity", "stablecoin"],
  Ethereum: ["ethereum", "eth", "layer 2", "l2", "rollup", "scaling"],
  Bitcoin: ["bitcoin", "btc", "halving", "ordinals", "lightning"],
  Regulation: ["sec", "regulation", "regulator", "law", "policy", "legislation", "compliance"],
  Institutions: ["institutional", "bank", "etf", "asset manager", "fund", "custody"],
  Infrastructure: ["protocol", "mainnet", "testnet", "upgrade", "network", "infrastructure"],
  Memecoins: ["memecoin", "meme coin", "doge", "shib", "pepe"],
};

const strip = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/<!\[CDATA\[|\]\]>/g, " ").replace(/\s+/g, " ").trim();
const decode = (value: string) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const between = (text: string, tag: string) => {
  const match = text.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decode(strip(match[1])) : "";
};

function parsePublishedDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function parseFeed(xml: string, source: string): ResearchItem[] {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  return blocks.slice(0, 50).map((block, index) => {
    const title = between(block, "title");
    const summary = between(block, "description") || between(block, "summary") || between(block, "content");
    const publishedRaw = between(block, "pubDate") || between(block, "published") || between(block, "updated") || "";
    const publishedAt = parsePublishedDate(publishedRaw);
    const guid = between(block, "guid") || `${source}-${index}-${title}`;
    const linkMatch = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
    const url = linkMatch?.[1] || between(block, "link") || "";
    return {
      id: `${source}:${Buffer.from(guid).toString("base64url").slice(0, 28)}`,
      title,
      url,
      source,
      publishedAt,
      summary: summary.slice(0, 500),
      category: "Emerging",
      keywords: [],
      entities: [],
      scores: { relevance: 0, momentum: 0, novelty: 0, credibility: 0, prPotential: 0, overall: 0 },
      opportunity: "",
    };
  }).filter(item => item.title && item.url && item.publishedAt);
}

function classify(item: ResearchItem) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const matches = Object.entries(TOPICS).map(([name, terms]) => ({ name, hits: terms.filter(term => text.includes(term)) })).filter(x => x.hits.length);
  matches.sort((a, b) => b.hits.length - a.hits.length);
  item.category = matches[0]?.name || "Emerging";
  item.keywords = Array.from(new Set(matches.flatMap(x => x.hits))).slice(0, 8);
  const knownEntities = ["Ethereum", "Bitcoin", "Solana", "Base", "Arbitrum", "Optimism", "Coinbase", "Binance", "Uniswap", "Aave", "OpenAI", "SEC"];
  item.entities = knownEntities.filter(entity => text.includes(entity.toLowerCase()));
}

function score(item: ResearchItem, duplicateCount: number) {
  classify(item);
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const recencyHours = Math.max(0, (Date.now() - new Date(item.publishedAt).getTime()) / 36e5);
  const recency = Number.isFinite(recencyHours) ? Math.max(0, 100 - recencyHours * 3.5) : 0;
  const relevance = Math.min(100, 45 + item.keywords.length * 8 + item.entities.length * 5);
  const momentum = Math.round(Math.max(20, recency));
  const novelty = Math.max(25, 100 - duplicateCount * 22);
  const credibility = item.source === "CoinDesk" ? 92 : item.source === "Cointelegraph" ? 86 : 82;
  const prPotential = Math.min(100, 45 + (/(launch|launches|raises|funding|upgrade|partnership|acquire|approval|adoption|record|surge|integration)/i.test(text) ? 30 : 8) + item.entities.length * 5);
  const overall = Math.round(relevance * .2 + momentum * .25 + novelty * .15 + credibility * .15 + prPotential * .25);
  item.scores = { relevance, momentum, novelty, credibility, prPotential, overall };
  item.opportunity = overall >= 85 ? "High-value trending opportunity" : overall >= 70 ? "Strong current angle worth reviewing" : "Fresh story to monitor";
}

export function detectNarratives(items: ResearchItem[]): Narrative[] {
  const groups = new Map<string, ResearchItem[]>();
  for (const item of items) {
    const key = item.category || "Emerging";
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return Array.from(groups.entries()).map(([name, stories]) => ({
    name,
    count: stories.length,
    score: Math.round(stories.reduce((sum, item) => sum + item.scores.overall, 0) / stories.length),
    momentum: Math.round(stories.reduce((sum, item) => sum + item.scores.momentum, 0) / stories.length),
    keywords: Array.from(new Set(stories.flatMap(item => item.keywords))).slice(0, 8),
    stories: stories.slice(0, 5).map(item => item.id),
  })).sort((a, b) => b.momentum - a.momentum || b.score - a.score);
}

export async function runResearch(): Promise<{ items: ResearchItem[]; narratives: Narrative[]; sources: { name: string; discovered: number; status: string; url: string }[]; generatedAt: string; windowHours: number }> {
  const results = await Promise.all(FEEDS.map(async feed => {
    try {
      const response = await fetch(feed.url, { headers: { "User-Agent": "CryptoPulseResearch/1.0" }, next: { revalidate: 300 } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      return { feed, items: parseFeed(xml, feed.name), status: "connected" };
    } catch {
      return { feed, items: [], status: "unavailable" };
    }
  }));

  const cutoff = Date.now() - MAX_AGE_HOURS * 36e5;
  const raw = results.flatMap(result => result.items).filter(item => {
    const time = new Date(item.publishedAt).getTime();
    return Number.isFinite(time) && time >= cutoff && time <= Date.now() + 15 * 60 * 1000;
  });

  const seen = new Map<string, number>();
  for (const item of raw) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    seen.set(key, (seen.get(key) || 0) + 1);
  }

  const unique = Array.from(new Map(raw.map(item => [item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(), item])).values());
  unique.forEach(item => score(item, seen.get(item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()) || 1));
  unique.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime() || b.scores.overall - a.scores.overall);

  // Only surface the strongest current stories, while keeping the newest first.
  const trending = unique.sort((a, b) => b.scores.overall - a.scores.overall).slice(0, 30);
  trending.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime() || b.scores.overall - a.scores.overall);

  return {
    items: trending,
    narratives: detectNarratives(trending),
    sources: results.map(result => ({ name: result.feed.name, discovered: result.items.filter(item => { const t = new Date(item.publishedAt).getTime(); return Number.isFinite(t) && t >= cutoff; }).length, status: result.status, url: result.feed.url })),
    generatedAt: new Date().toISOString(),
    windowHours: MAX_AGE_HOURS,
  };
}
