"use client";

import React, { useState } from "react";
import { 
  Sparkles, 
  Copy, 
  Check, 
  RefreshCw, 
  Activity, 
  Image as ImageIcon, 
  TrendingUp, 
  MessageCircle, 
  BookOpen,
  AlertTriangle,
  Zap,
  Twitter,
  Clock
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
  thread: {
    title: string;
    tweets: string[];
  };
  engagement: {
    reply: string;
    quote_tweet: string;
    poll: string;
    blog_expansion: string;
  };
}

interface CryptoPulseData {
  date: string;
  generated_at_utc: string;
  stories: Story[];
}

export default function CryptoPulseDashboard() {
  const [data, setData] = useState<CryptoPulseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const fetchBriefing = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/generate", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        alert("Error: " + (json.error || "Failed to fetch briefing"));
      }
    } catch (err) {
      alert("Failed to connect to CryptoPulse engine.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const updateTweet = (storyIdx: number, tweetIdx: number, newText: string) => {
    if (!data) return;
    const updated = { ...data };
    updated.stories[storyIdx].thread.tweets[tweetIdx] = newText;
    setData(updated);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 font-sans selection:bg-cyan-500/30 selection:text-cyan-100 pb-20 relative overflow-hidden">
      {/* Background Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-900/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Glass Navbar */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">CryptoPulse</h1>
              <p className="text-xs text-slate-400 font-medium">Web3 Intelligence Dashboard</p>
            </div>
          </div>

          <button
            onClick={fetchBriefing}
            disabled={loading}
            className="group flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/50 font-medium text-sm text-slate-200 rounded-full transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-cyan-400 ${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
            {loading ? "Running AI Models..." : "Generate Daily Briefing"}
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="max-w-7xl mx-auto mt-10 px-6 relative z-10">
        
        {/* Empty State */}
        {!data && !loading && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mb-6 shadow-2xl">
              <Activity className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">No Active Intelligence</h3>
            <p className="text-slate-400 max-w-md mx-auto mb-8">
              Initiate the daily briefing to deploy the AI agent. It will scan primary Web3 sources, evaluate narratives, and draft publication-ready content.
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 border-t-2 border-cyan-400 rounded-full animate-spin" />
              <div className="absolute inset-2 border-r-2 border-blue-500 rounded-full animate-spin direction-reverse" />
              <Zap className="absolute inset-0 m-auto w-6 h-6 text-cyan-400 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Analyzing Ecosystem Data</h3>
            <p className="text-slate-400 text-sm">Cross-referencing on-chain metrics and primary sources...</p>
          </div>
        )}

        {/* Data Loaded */}
        {data && (
          <div className="space-y-12">
            {data.stories?.map((story, storyIdx) => (
              <section 
                key={storyIdx} 
                className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 sm:p-10 backdrop-blur-md shadow-2xl"
              >
                {/* Header & Badges */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" /> {story.category}
                      </span>
                      <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 uppercase tracking-widest">
                        {story.format}
                      </span>
                      <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 ml-auto sm:ml-0">
                        <Clock className="w-3.5 h-3.5" /> {story.posting_time_utc}
                      </span>
                    </div>
                    <h2 className="text-3xl font-extrabold text-white leading-tight mb-2">{story.headline}</h2>
                  </div>

                  <div className="flex items-center justify-center w-24 h-24 shrink-0 rounded-2xl bg-gradient-to-br from-slate-900 to-black border border-white/10 relative overflow-hidden shadow-inner">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-blue-500" />
                    <div className="text-center">
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Impact</div>
                      <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                        {story.score}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Intelligence Briefing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                  <div className="bg-black/40 border border-white/5 p-5 rounded-2xl">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400" /> Strategic Reason
                    </h4>
                    <p className="text-sm text-slate-300 leading-relaxed">{story.reason}</p>
                  </div>
                  <div className="bg-black/40 border border-white/5 p-5 rounded-2xl">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-cyan-400" /> Executive Summary
                    </h4>
                    <p className="text-sm text-slate-300 leading-relaxed">{story.summary}</p>
                  </div>
                </div>

                <hr className="border-white/5 mb-10" />

                {/* Content Editor Area */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Twitter className="w-5 h-5 text-blue-400" /> Publication Draft
                    </h3>
                    <button
                      onClick={() => handleCopy(story.thread.tweets.join("\n\n---\n\n"), `all-${storyIdx}`)}
                      className="flex items-center gap-2 text-xs font-bold px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all cursor-pointer"
                    >
                      {copiedIndex === `all-${storyIdx}` ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      Copy {story.format === "thread" ? "Thread" : "Post"}
                    </button>
                  </div>

                  {/* Twitter Mockup Editor */}
                  <div className="space-y-4">
                    {story.thread.tweets.map((tweetText, tweetIdx) => {
                      const charCount = tweetText.length;
                      const isOver = charCount > 280;

                      return (
                        <div key={tweetIdx} className="bg-black/60 border border-slate-800/80 rounded-3xl p-5 sm:p-6 relative hover:border-slate-700 transition-colors">
                          <div className="flex gap-4">
                            {/* Fake Avatar */}
                            <div className="hidden sm:flex w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20 shrink-0">
                              PR
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-sm">CryptoPulse</span>
                                  <span className="text-slate-500 text-sm">@CryptoPulseHQ</span>
                                </div>
                                <button
                                  onClick={() => handleCopy(tweetText, `t-${storyIdx}-${tweetIdx}`)}
                                  className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                                  title="Copy Tweet"
                                >
                                  {copiedIndex === `t-${storyIdx}-${tweetIdx}` ? (
                                    <Check className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>

                              <textarea
                                value={tweetText}
                                onChange={(e) => updateTweet(storyIdx, tweetIdx, e.target.value)}
                                rows={3}
                                className="w-full bg-transparent text-slate-200 text-[15px] leading-relaxed focus:outline-none resize-y border-0 focus:ring-0 p-0"
                              />

                              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/5 pt-3">
                                {isOver ? (
                                  <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
                                    <AlertTriangle className="w-4 h-4" />
                                    Exceeds 280 characters limit.
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-500 font-medium">Ready to publish</div>
                                )}
                                
                                {/* Visual Character Ring */}
                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                  <span className={`text-xs font-bold ${isOver ? 'text-red-400' : 'text-slate-400'}`}>
                                    {charCount} / 280
                                  </span>
                                  <svg className="w-5 h-5 transform -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-white/10" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                                    <path className={`${isOver ? 'text-red-500' : 'text-cyan-400'}`} strokeDasharray={`${Math.min((charCount/280)*100, 100)}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Generative AI Graphic Section */}
                <div className="bg-gradient-to-br from-purple-900/20 to-black border border-purple-500/20 rounded-2xl p-6 mb-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[50px] rounded-full pointer-events-none" />
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-purple-300 uppercase tracking-widest">
                      <ImageIcon className="w-5 h-5" /> Image Generation Prompt
                    </div>
                    <button
                      onClick={() => handleCopy(story.graphic_prompt, `img-${storyIdx}`)}
                      className="flex items-center gap-2 text-xs font-bold text-purple-300 hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedIndex === `img-${storyIdx}` ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      Copy Prompt
                    </button>
                  </div>
                  <p className="text-sm font-mono text-purple-100/80 leading-relaxed bg-black/40 p-4 rounded-xl border border-purple-500/10 select-all mb-3">
                    {story.graphic_prompt}
                  </p>
                  <p className="text-xs text-slate-500">
                    <strong className="text-slate-400">Alt Text:</strong> {story.alt_text}
                  </p>
                </div>

                {/* Engagement Hooks */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 bg-blue-900/10 border border-blue-500/20 p-5 rounded-2xl">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">
                      <MessageCircle className="w-4 h-4" /> Reply Hook
                    </div>
                    <p className="text-sm text-slate-300">{story.engagement.reply}</p>
                  </div>

                  <div className="flex-1 bg-cyan-900/10 border border-cyan-500/20 p-5 rounded-2xl">
                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2">
                      <BookOpen className="w-4 h-4" /> Blog Expansion
                    </div>
                    <p className="text-sm text-slate-300">{story.engagement.blog_expansion}</p>
                  </div>
                </div>

              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
