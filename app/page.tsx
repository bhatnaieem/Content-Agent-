"use client";

import { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, BarChart3, Bell, BookOpen, Check, ChevronDown,
  ChevronRight, Clipboard, Clock3, Copy, ExternalLink, FileText, Flame,
  Hash, Image as ImageIcon, Layers3, MessageCircle, PenLine, RefreshCw,
  Sparkles, Target, TrendingUp, Twitter, Wand2, X, Zap
} from "lucide-react";

interface Story {
  headline: string;
  category: string;
  score: number;
  format: "thread" | "single post";
  reason: string;
  summary: string;
  keywords: string[];
  hashtags: string[];
  sources: string[];
  posting_time_utc: string;
  cta: string;
  graphic_prompt: string;
  alt_text: string;
  thread: { title: string; tweets: string[] };
  engagement: { reply: string; quote_tweet: string; poll: string; blog_expansion: string };
}

interface CryptoPulseData { date: string; generated_at_utc: string; stories: Story[]; }
type WorkspaceTab = "briefing" | "narratives" | "studio";
type StudioMode = "thread" | "reply" | "quote" | "poll" | "blog" | "creative";

const navItems = [
  { id: "briefing" as WorkspaceTab, label: "Daily Briefing", icon: Activity },
  { id: "narratives" as WorkspaceTab, label: "Narrative Radar", icon: TrendingUp },
  { id: "studio" as WorkspaceTab, label: "Content Studio", icon: PenLine },
];

function scoreLabel(score: number) {
  if (score >= 85) return { label: "High impact", className: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20" };
  if (score >= 70) return { label: "Strong", className: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20" };
  return { label: "Watch", className: "text-amber-300 bg-amber-400/10 border-amber-400/20" };
}

export default function CryptoPulseDashboard() {
  const [data, setData] = useState<CryptoPulseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("briefing");
  const [activeStory, setActiveStory] = useState(0);
  const [studioMode, setStudioMode] = useState<StudioMode>("thread");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(0);
  const [manualStatus, setManualStatus] = useState<Record<number, "draft" | "ready">>({});

  const stories = data?.stories ?? [];
  const categories = useMemo(() => ["All", ...Array.from(new Set(stories.map((s) => s.category).filter(Boolean)))], [stories]);
  const filteredStories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stories.filter((story) => {
      const matchesCategory = category === "All" || story.category === category;
      const text = `${story.headline} ${story.summary} ${story.category} ${story.keywords?.join(" ")}`.toLowerCase();
      return matchesCategory && (!q || text.includes(q));
    });
  }, [stories, search, category]);
  const selectedStory = stories[activeStory] ?? filteredStories[0];

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {}
  };

  const fetchBriefing = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/generate", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate briefing");
      setData(json); setActiveTab("briefing"); setActiveStory(0);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to connect to CryptoPulse engine.");
    } finally { setLoading(false); }
  };

  const updateTweet = (storyIdx: number, tweetIdx: number, value: string) => {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        stories: current.stories.map((story, index) => index === storyIdx
          ? { ...story, thread: { ...story.thread, tweets: story.thread.tweets.map((tweet, i) => i === tweetIdx ? value : tweet) } }
          : story),
      };
    });
  };

  const studioContent = (story: Story) => {
    switch (studioMode) {
      case "reply": return story.engagement.reply;
      case "quote": return story.engagement.quote_tweet;
      case "poll": return story.engagement.poll;
      case "blog": return story.engagement.blog_expansion;
      case "creative": return `${story.graphic_prompt}\n\nAlt text: ${story.alt_text}`;
      default: return story.thread.tweets.join("\n\n");
    }
  };

  const narrativeCards = useMemo(() => {
    const map = new Map<string, { name: string; stories: number; score: number; keywords: string[] }>();
    stories.forEach((story) => {
      const key = story.category || "Emerging narrative";
      const current = map.get(key) ?? { name: key, stories: 0, score: 0, keywords: [] };
      current.stories += 1; current.score = Math.max(current.score, story.score || 0);
      current.keywords.push(...(story.keywords || []).slice(0, 3)); map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.score - a.score);
  }, [stories]);

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[38rem] w-[55rem] -translate-x-1/2 rounded-full bg-cyan-500/[0.08] blur-[120px]" />
        <div className="absolute right-[-15rem] top-[35%] h-[30rem] w-[30rem] rounded-full bg-indigo-500/[0.07] blur-[120px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#05070d]/85 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20"><Sparkles className="h-5 w-5 text-white" /></div>
            <div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-sm font-bold tracking-tight text-white sm:text-base">CryptoPulse AI</span><span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 sm:inline-flex">Research online</span></div><p className="hidden text-[11px] text-slate-500 sm:block">Web3 PR & content intelligence workspace</p></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-amber-400/15 bg-amber-400/[0.06] px-3 py-1.5 text-xs text-amber-200 md:flex"><Clipboard className="h-3.5 w-3.5" /> Manual publishing</div>
            <button onClick={fetchBriefing} disabled={loading} className="group inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-slate-950 shadow-lg transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:text-sm"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : "transition-transform group-hover:rotate-180"}`} /><span>{loading ? "Analyzing…" : "Run briefing"}</span></button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex max-w-[1500px]">
        <aside className="sticky top-[65px] hidden h-[calc(100vh-65px)] w-60 shrink-0 border-r border-white/[0.06] px-4 py-6 lg:block">
          <div className="mb-5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Workspace</div>
          <nav className="space-y-1">{navItems.map((item) => { const Icon = item.icon; const active = activeTab === item.id; return <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${active ? "bg-cyan-400/10 text-cyan-200 ring-1 ring-inset ring-cyan-400/15" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"}`}><Icon className={`h-4 w-4 ${active ? "text-cyan-300" : "text-slate-500"}`} />{item.label}{item.id === "briefing" && stories.length > 0 && <span className="ml-auto rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-400">{stories.length}</span>}</button>; })}</nav>
          <div className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300"><Bell className="h-3.5 w-3.5 text-cyan-300" /> Workflow</div><div className="space-y-2 text-[11px] text-slate-500"><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Research</div><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Score & select</div><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400" /> Edit content</div><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Copy & publish manually</div></div></div>
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-20 pt-5 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 lg:hidden">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === item.id ? "bg-white/[0.08] text-white" : "text-slate-500"}`}><Icon className="h-3.5 w-3.5" />{item.label}</button>; })}</div>

          <section className="mb-7 overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5 shadow-2xl sm:p-7">
            <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
              <div className="max-w-3xl"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/[0.07] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-200"><Zap className="h-3.5 w-3.5" /> Intelligence layer</div><h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Know what matters before you publish.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">CryptoPulse researches the ecosystem, ranks the strongest narratives, and turns them into review-ready content. <span className="text-slate-200">You stay in control of publishing.</span></p></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[520px]">
                {[{label:"Stories",value:stories.length,Icon:Activity},{label:"Avg. score",value:stories.length ? Math.round(stories.reduce((sum,s)=>sum+(s.score||0),0)/stories.length) : "—",Icon:Target},{label:"Narratives",value:narrativeCards.length || "—",Icon:Layers3},{label:"Publishing",value:"Manual",Icon:Clipboard}].map(({label,value,Icon}) => <div key={label} className="rounded-2xl border border-white/[0.07] bg-black/20 p-3"><Icon className="mb-2 h-4 w-4 text-slate-500" /><div className="text-lg font-bold text-white">{value}</div><div className="text-[10px] uppercase tracking-wider text-slate-600">{label}</div></div>)}
              </div>
            </div>
          </section>

          {activeTab === "briefing" && <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><h2 className="text-lg font-bold text-white">Today’s intelligence</h2>{data?.date && <span className="text-xs text-slate-600">{data.date}</span>}</div><p className="mt-1 text-xs text-slate-500">Highest-value stories selected for PR and social teams.</p></div>{data && <span className="text-[11px] text-slate-600">Generated {data.generated_at_utc || "recently"}</span>}</div>
            {!data && !loading && <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center sm:px-12"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.06]"><BarChart3 className="h-7 w-7 text-cyan-300" /></div><h2 className="text-xl font-bold text-white">Your intelligence feed is ready</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Run a briefing to research current Web3 conversations, score the stories, and build publication-ready drafts.</p><button onClick={fetchBriefing} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg transition hover:bg-cyan-300"><Sparkles className="h-4 w-4" /> Run first briefing</button></div>}
            {loading && <div className="grid gap-4 md:grid-cols-2">{[1,2,3,4].map((i)=><div key={i} className="h-64 animate-pulse rounded-3xl border border-white/[0.06] bg-white/[0.025]" />)}</div>}
            {data && !loading && <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_360px]">
              <div className="space-y-4">
                {filteredStories.map((story) => { const index=stories.indexOf(story); const impact=scoreLabel(story.score); const isOpen=expanded===index; const status=manualStatus[index]||"draft"; return <article key={`${story.headline}-${index}`} className={`overflow-hidden rounded-3xl border bg-white/[0.025] transition ${isOpen ? "border-cyan-400/20 shadow-xl" : "border-white/[0.07] hover:border-white/[0.13]"}`}>
                  <div className="p-5 sm:p-6"><div className="mb-4 flex items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="mb-3 flex flex-wrap items-center gap-2"><span className="rounded-full border border-cyan-400/15 bg-cyan-400/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-200">{story.category||"Market"}</span><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${impact.className}`}>{impact.label}</span><span className="flex items-center gap-1 text-[10px] text-slate-600"><Clock3 className="h-3 w-3" /> {story.posting_time_utc}</span></div><button onClick={()=>setExpanded(isOpen?null:index)} className="text-left"><h3 className="text-xl font-extrabold leading-tight text-white transition hover:text-cyan-100 sm:text-2xl">{story.headline}</h3></button></div><div className="hidden shrink-0 text-right sm:block"><div className="text-3xl font-black text-white">{story.score}</div><div className="text-[9px] uppercase tracking-widest text-slate-600">impact</div></div></div>
                    <p className="mb-4 line-clamp-3 text-sm leading-6 text-slate-400">{story.summary}</p>
                    <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4"><button onClick={()=>{setActiveStory(index);setActiveTab("studio");setStudioMode("thread")}} className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-50"><PenLine className="h-3.5 w-3.5" /> Open in Studio</button><button onClick={()=>copyText(story.thread.tweets.join("\n\n"),`story-${index}`)} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.07]">{copied===`story-${index}`?<Check className="h-3.5 w-3.5 text-emerald-300"/>:<Copy className="h-3.5 w-3.5"/>} Copy draft</button><button onClick={()=>setManualStatus((s)=>({...s,[index]:"ready"}))} className={`ml-auto inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold ${status==="ready"?"border-emerald-400/20 bg-emerald-400/10 text-emerald-300":"border-amber-400/15 bg-amber-400/[0.05] text-amber-200"}`}><Check className="h-3.5 w-3.5"/>{status==="ready"?"Ready to publish":"Mark ready"}</button><button onClick={()=>setExpanded(isOpen?null:index)} className="rounded-xl border border-white/[0.08] p-2 text-slate-500 hover:text-white">{isOpen?<ChevronDown className="h-4 w-4"/>:<ChevronRight className="h-4 w-4"/>}</button></div></div>
                    {isOpen && <div className="border-t border-white/[0.06] bg-black/15 p-5 sm:p-6"><div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500"><Target className="h-3.5 w-3.5 text-cyan-300"/> Why this matters</div><p className="text-sm leading-6 text-slate-300">{story.reason}</p></div><div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500"><BookOpen className="h-3.5 w-3.5 text-indigo-300"/> Executive summary</div><p className="text-sm leading-6 text-slate-300">{story.summary}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{(story.keywords||[]).slice(0,8).map((keyword)=><span key={keyword} className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] text-slate-500"><Hash className="h-3 w-3"/>{keyword}</span>)}</div><div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><ExternalLink className="h-3.5 w-3.5"/> {story.sources?.length||0} source(s) attached</div></div>}
                  </article>})}
                {filteredStories.length===0 && <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center"><SearchIcon/><p className="mt-3 text-sm text-slate-600">No stories match your filters.</p></div>}
              </div>
              <aside className="space-y-4"><div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-bold text-white">Narrative momentum</h3><p className="mt-1 text-[11px] text-slate-600">Derived from today’s selected stories</p></div><Flame className="h-4 w-4 text-orange-300"/></div><div className="space-y-3">{narrativeCards.slice(0,5).map((n)=><button key={n.name} onClick={()=>{setCategory(n.name);setActiveTab("briefing")}} className="w-full rounded-2xl border border-white/[0.05] bg-black/15 p-3 text-left transition hover:border-cyan-400/15"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-slate-200">{n.name}</span><span className="text-xs font-bold text-cyan-300">{n.score}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{width:`${Math.min(n.score,100)}%`}}/></div></button>)}{!narrativeCards.length&&<p className="text-xs text-slate-600">Run a briefing to populate the radar.</p>}</div></div><div className="rounded-3xl border border-amber-400/10 bg-amber-400/[0.03] p-5"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-amber-200"><Clipboard className="h-4 w-4"/> Human publishing checkpoint</div><p className="text-xs leading-5 text-slate-500">CryptoPulse prepares and validates content. It does not publish to X automatically. Copy, review, then publish manually from your own account.</p></div></aside>
            </div>}
          </>}

          {activeTab === "narratives" && <section><div className="mb-6"><h2 className="text-2xl font-black text-white">Narrative Radar</h2><p className="mt-1 text-sm text-slate-500">See which themes are dominating your current research set.</p></div>{!stories.length?<div className="rounded-3xl border border-dashed border-white/10 p-14 text-center text-sm text-slate-600">Run a briefing first to build the radar.</div>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{narrativeCards.map((n,index)=><button key={n.name} onClick={()=>{setCategory(n.name);setActiveTab("briefing")}} className="group rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-400/20"><div className="mb-8 flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300"><TrendingUp className="h-5 w-5"/></div><span className="text-xs font-bold text-slate-600">#{index+1}</span></div><h3 className="text-lg font-bold text-white">{n.name}</h3><p className="mt-1 text-xs text-slate-600">{n.stories} selected {n.stories===1?"story":"stories"}</p><div className="mt-5 flex items-end justify-between"><div className="text-3xl font-black text-white">{n.score}<span className="ml-1 text-xs text-slate-600">/100</span></div><div className="h-10 w-28 overflow-hidden rounded-lg bg-white/[0.04]"><div className="mt-5 h-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{width:`${Math.min(n.score,100)}%`}}/></div></div><div className="mt-4 flex flex-wrap gap-1.5">{Array.from(new Set(n.keywords)).slice(0,4).map((word)=><span key={word} className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] text-slate-500">{word}</span>)}</div></button>)}</div>}</section>}

          {activeTab === "studio" && selectedStory && <section>
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-2 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300"><Wand2 className="h-3.5 w-3.5"/> Content Studio</div><h2 className="max-w-4xl text-2xl font-black leading-tight text-white sm:text-3xl">{selectedStory.headline}</h2><p className="mt-2 text-sm text-slate-500">Edit, copy and prepare content for manual publishing.</p></div><button onClick={()=>setActiveTab("briefing")} className="inline-flex items-center gap-2 self-start rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white"><X className="h-3.5 w-3.5"/> Close studio</button></div>
            <div className="mb-5 flex gap-2 overflow-x-auto border-b border-white/[0.07] pb-1">{(["thread","reply","quote","poll","blog","creative"] as StudioMode[]).map((mode)=><button key={mode} onClick={()=>setStudioMode(mode)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-bold capitalize transition ${studioMode===mode?"border-cyan-400 text-cyan-200":"border-transparent text-slate-600 hover:text-slate-300"}`}>{mode==="thread"?<Twitter className="h-3.5 w-3.5"/>:mode==="creative"?<ImageIcon className="h-3.5 w-3.5"/>:mode==="blog"?<FileText className="h-3.5 w-3.5"/>:<MessageCircle className="h-3.5 w-3.5"/>}{mode==="thread"?"X Thread":mode==="quote"?"Quote Tweet":mode==="reply"?"Reply":mode==="poll"?"Poll":mode==="blog"?"Blog":"Creative"}</button>)}</div>
            {studioMode==="thread"?<div className="space-y-3">{selectedStory.thread.tweets.map((tweet,tweetIdx)=>{const over=tweet.length>280;return <div key={tweetIdx} className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-[10px] font-black text-white">CP</div><div><div className="text-xs font-bold text-white">CryptoPulse</div><div className="text-[10px] text-slate-600">Tweet {tweetIdx+1}</div></div></div><button onClick={()=>copyText(tweet,`tweet-${tweetIdx}`)} className="rounded-lg p-2 text-slate-600 hover:bg-white/[0.05] hover:text-white">{copied===`tweet-${tweetIdx}`?<Check className="h-4 w-4 text-emerald-300"/>:<Copy className="h-4 w-4"/>}</button></div><textarea value={tweet} onChange={(e)=>updateTweet(activeStory,tweetIdx,e.target.value)} rows={4} className="w-full resize-y rounded-xl border border-white/[0.05] bg-black/20 p-3 text-sm leading-6 text-slate-200 outline-none focus:border-cyan-400/20"/><div className="mt-2 flex items-center justify-between text-[10px]"><span className={over?"text-red-300":"text-slate-600"}>{over?<span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3"/> Over X limit</span>:"Ready for review"}</span><span className={over?"font-bold text-red-300":"text-slate-500"}>{tweet.length}/280</span></div></div>})}</div>:<div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-7"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-bold capitalize text-white">{studioMode} draft</h3><p className="mt-1 text-xs text-slate-600">AI-generated angle for human review.</p></div><button onClick={()=>copyText(studioContent(selectedStory),`studio-${studioMode}`)} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.07]">{copied===`studio-${studioMode}`?<Check className="h-3.5 w-3.5 text-emerald-300"/>:<Copy className="h-3.5 w-3.5"/>} Copy</button></div><textarea defaultValue={studioContent(selectedStory)} rows={16} className="w-full resize-y rounded-2xl border border-white/[0.06] bg-black/25 p-4 text-sm leading-6 text-slate-200 outline-none focus:border-cyan-400/20"/></div>}
            <div className="mt-5 grid gap-4 lg:grid-cols-3"><div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">CTA</div><p className="text-xs leading-5 text-slate-400">{selectedStory.cta||"No CTA provided."}</p></div><div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">Hashtags</div><p className="text-xs leading-5 text-slate-400">{selectedStory.hashtags?.join(" ")||"None"}</p></div><div className="rounded-2xl border border-amber-400/10 bg-amber-400/[0.03] p-4"><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-200"><Clipboard className="h-3.5 w-3.5"/> Manual publish</div><p className="text-xs leading-5 text-slate-500">Copy the final draft, review it, and publish manually. No automatic X posting is enabled.</p></div></div>
          </section>}
          {activeTab === "studio" && !selectedStory && <div className="rounded-3xl border border-dashed border-white/10 p-14 text-center"><PenLine className="mx-auto h-8 w-8 text-slate-700"/><h2 className="mt-4 font-bold text-white">No story selected</h2><p className="mt-1 text-sm text-slate-600">Generate a briefing and open a story in the Content Studio.</p></div>}
        </main>
      </div>
    </div>
  );
}

function SearchIcon() { return <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-slate-700"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></div>; }
