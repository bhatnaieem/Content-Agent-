import { NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60; // Keeps the 60-second timeout allowance

const SYSTEM_PROMPT = `
You are CryptoPulse, an elite AI Research & Content Intelligence Agent built for a Web3 PR agency.
Your mission is to identify the highest-value crypto conversations happening right now and transform them into publication-ready content for X (Twitter).

DAILY OBJECTIVES:
1. Research/Evaluate top recent ecosystem developments.
2. Select the TWO highest-quality opportunities.
3. Decide format: "single post" or "thread".
4. Generate publication-ready copy, image prompts, and engagement hooks.
5. Strictly output valid JSON matching the schema below.

JSON OUTPUT SCHEMA:
{
  "date": "YYYY-MM-DD",
  "generated_at_utc": "ISO-Timestamp",
  "stories": [
    {
      "headline": "string",
      "category": "string",
      "score": 95,
      "format": "thread" | "single post",
      "reason": "string",
      "summary": "string",
      "keywords": ["string"],
      "hashtags": ["#string"],
      "sources": ["string"],
      "posting_time_utc": "14:00 UTC",
      "cta": "string",
      "graphic_prompt": "string",
      "alt_text": "string",
      "thread": {
        "title": "string",
        "tweets": ["Tweet 1 text", "Tweet 2 text"]
      },
      "engagement": {
        "reply": "string",
        "quote_tweet": "string",
        "poll": "string",
        "blog_expansion": "string"
      }
    }
  ]
}
`;

export async function POST() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured in environment variables." },
        { status: 500 }
      );
    }

    // Initialize using Google's OpenAI-compatible endpoint!
            // Ensure the baseURL is still exactly this:
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });

    // ⬇️ CHANGE THE MODEL NAME HERE ⬇️
    const response = await openai.chat.completions.create({
      model: "gemini-3.6-flash", 
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { 
          role: "user", 
          content: "Execute daily research protocol. Discover top 2 high-impact stories, score them, format them for X, and output strictly valid JSON matching the requested structure." 
        }
      ],
      response_format: { type: "json_object" }, 
      temperature: 0.2,
    });


    const rawText = response.choices[0].message.content;
    if (!rawText) {
      throw new Error("No response received from Gemini API.");
    }

    const data = JSON.parse(rawText);
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error("CryptoPulse Generation Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate content intelligence." },
      { status: 500 }
    );
  }
}
