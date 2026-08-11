"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Send } from "lucide-react";

const READY_KEY = "web3pulse:ready-to-publish";

type ReadyItem = {
  id: string;
  story: {
    headline: string;
    summary: string;
    format: "thread" | "single post";
    thread: { tweets: string[] };
    alt_text: string;
  };
  readyAt: string;
};

function readStudioStory(): ReadyItem | null {
  const headline = document.querySelector(".cp-studio-title")?.textContent?.trim() || "";
  if (!headline) return null;

  const tweets = Array.from(document.querySelectorAll<HTMLTextAreaElement>(".cp-textarea"))
    .map((el) => el.value.trim())
    .filter(Boolean);
  if (!tweets.length) return null;

  return {
    id: `ready:${Date.now()}:${headline.slice(0, 24)}`,
    story: {
      headline,
      summary: "",
      format: tweets.length > 1 ? "thread" : "single post",
      thread: { tweets },
      alt_text: "",
    },
    readyAt: new Date().toISOString(),
  };
}

export default function ClientNav() {
  const [inStudio, setInStudio] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const check = () => setInStudio(Boolean(document.querySelector(".cp-studio-title")));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const markReady = () => {
    const item = readStudioStory();
    if (!item) {
      window.alert("Open a generated story in Content Studio first.");
      return;
    }

    try {
      const existing = JSON.parse(localStorage.getItem(READY_KEY) || "[]") as ReadyItem[];
      const normalized = item.story.headline.toLowerCase().trim();
      const next = [
        ...existing.filter((x) => x.story?.headline?.toLowerCase().trim() !== normalized),
        item,
      ].slice(-50);
      localStorage.setItem(READY_KEY, JSON.stringify(next));
      setSaved(true);
      window.location.href = "/publish";
    } catch {
      window.alert("Could not save this item for Publishing Studio.");
    }
  };

  return (
    <>
      {inStudio && (
        <button
          type="button"
          onClick={markReady}
          aria-label="Mark this story ready to publish"
          style={{
            position: "fixed",
            right: 20,
            bottom: 76,
            zIndex: 10000,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 16px",
            borderRadius: 999,
            border: "1px solid rgba(8,127,145,.18)",
            background: saved ? "#0f766e" : "#087f91",
            color: "#fff",
            boxShadow: "0 10px 28px rgba(8,127,145,.25)",
            fontSize: 12,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {saved ? <Check size={15} /> : <Send size={15} />}
          {saved ? "Sent to Publishing Studio" : "Mark Ready to Publish"}
        </button>
      )}
      <Link
        href="/client-mode"
        aria-label="Open Client Mode"
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 9999,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 15px",
          borderRadius: 999,
          background: "#ffffff",
          color: "#172033",
          border: "1px solid #dbe4ee",
          boxShadow: "0 8px 24px rgba(15,23,42,.12)",
          fontSize: 12,
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        <span style={{ fontSize: 14 }}>◉</span>
        Client Mode
      </Link>
    </>
  );
}
