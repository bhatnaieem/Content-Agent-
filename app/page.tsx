"use client";

import React, { useState } from "react";
import { 
  Sparkles, 
  Copy, 
  Check, 
  RefreshCw, 
  Layers, 
  Send, 
  Image as ImageIcon, 
  BarChart2, 
  MessageSquare, 
  FileText,
  AlertCircle
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6">
      <header className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pb-8 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              CryptoPulse AI
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Web3 PR & Content Intelligence Agent • Manual Publishing Dashboard
          </p>
        </div>

        <button
          onClick={fetchBriefing}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-medium text-slate-950 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/10 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analyzing Ecosystem..." : "Run Daily Briefing"}
        </button>
      </header>

      <main className="max-w-7xl mx-auto mt-8">
        {!data && !loading && (
          <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center bg-slate-900/30">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-300">No Intelligence Briefing Loaded</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Click "Run Daily Briefing" to activate CryptoPulse.
            </p>
          </div>
        )}

        {loading && (
          <div className="border border-slate-800 rounded-2xl p-12 text-center bg-slate-900/50">
            <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-200">Scanning On-Chain & Media Feeds...</h3>
            <p className="text-sm text-slate-400 mt-1">Filtering noise, scoring impact, and drafting publication-ready copy.</p>
          </div>
        )}

        {data && (
          <div className="space-y-12">
            {data.stories.map((story, storyIdx) => (
              <section 
                key={storyIdx} 
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 uppercase tracking-wider">
                        {story.category}
                      </span>
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 uppercase">
                        {story.format}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-white">{story.headline}</h2>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl">
                    <BarChart2 className="w-5 h-5 text-cyan-400" />
                    <div>
                      <div className="text-xs text-slate-500">Story Score</div>
                      <div className="text-lg font-bold text-cyan-300">{story.score} / 100</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6 p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 text-sm">
                  <div>
                    <span className="text-slate-400 font-medium">Why Selected:</span>
                    <p className="text-slate-300 mt-1">{story.reason}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Executive Summary:</span>
                    <p className="text-slate-300 mt-1">{story.summary}</p>
                  </div>
                </div>

                <div className="space-y-4 my-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                      <Send className="w-4 h-4 text-cyan-400" /> Publication Copy (Editable)
                    </h3>
                    <button
                      onClick={() => handleCopy(story.thread.tweets.join("\n\n---\n\n"), `all-${storyIdx}`)}
                      className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors cursor-pointer"
                    >
                      {copiedIndex === `all-${storyIdx}` ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Entire {story.format === "thread" ? "Thread" : "Post"}
                    </button>
                  </div>

                  {story.thread.tweets.map((tweetText, tweetIdx) => {
                    const charCount = tweetText.length;
                    const isOver = charCount > 280;

                    return (
                      <div key={tweetIdx} className="bg-slate-950 border border-slate-800 rounded-xl p-4 relative group">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                          <span className="font-semibold text-slate-400">
                            {story.format === "thread" ? `Tweet ${tweetIdx + 1}` : "X Post"}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className={`font-mono text-xs ${isOver ? "text-red-400 font-bold" : "text-slate-400"}`}>
                              {charCount} / 280
                            </span>
                            <button
                              onClick={() => handleCopy(tweetText, `t-${storyIdx}-${tweetIdx}`)}
                              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title="Copy Tweet"
                            >
                              {copiedIndex === `t-${storyIdx}-${tweetIdx}` ? (
                                <Check className="w-4 h-4 text-green-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <textarea
                          value={tweetText}
                          onChange={(e) => updateTweet(storyIdx, tweetIdx, e.target.value)}
                          rows={3}
                          className="w-full bg-transparent text-slate-100 text-sm focus:outline-none resize-y border-0 focus:ring-0 p-0"
                        />

                        {isOver && (
                          <div className="flex items-center gap-1.5 text-xs text-red-400 mt-2">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Exceeds X character limit. Trim down before posting.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {story.hashtags.map((tag, i) => (
                    <span key={i} className="text-xs text-cyan-400 font-mono bg-cyan-950/40 border border-cyan-900/50 px-2.5 py-1 rounded-md">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 my-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <ImageIcon className="w-4 h-4 text-purple-400" /> Midjourney / AI Image Prompt
                    </div>
                    <button
                      onClick={() => handleCopy(story.graphic_prompt, `img-${storyIdx}`)}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedIndex === `img-${storyIdx}` ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Prompt
                    </button>
                  </div>
                  <p className="text-xs font-mono text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800 select-all">
                    {story.graphic_prompt}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    <strong>Alt Text:</strong> {story.alt_text}
                  </p>
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
