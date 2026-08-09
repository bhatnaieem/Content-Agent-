import { NextResponse } from "next/server";
import { generateWithLLM } from "../../../lib/llm";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are CryptoPulse, a Web3 PR research and content intelligence agent. Identify the TWO highest-quality recent crypto/Web3 opportunities and return valid JSON. Create genuinely different content assets; never reuse the same wording across formats.`;
const SCHEMA = `Return {"date":"YYYY-MM-DD","generated_at_utc":"ISO timestamp","stories":[{"headline":"string","category":"string","score":95,"format":"thread|single post","reason":"string","summary":"string","keywords":["string"],"hashtags":["#string"],"sources":["string"],"posting_time_utc":"14:00 UTC","cta":"string","graphic_prompt":"string","alt_text":"string","thread":{"title":"string","tweets":["string"]},"engagement":{"reply":"string","quote_tweet":"string","poll":"Question + A/B/C/D options","blog_expansion":"substantial article draft"}}]}`;

async function enrichFormats(data:any, provider:"auto"|"gemini"|"nemotron") {
  if (!Array.isArray(data?.stories) || !data.stories.length) return data;
  const result = await generateWithLLM({
    provider,
    system: `You are a senior Web3 social strategist. Create six DIFFERENT assets from each supplied story.
REPLY: 1-2 conversational sentences adding a new insight or useful question; not a summary.
QUOTE TWEET: a strong standalone opinion/reaction to accompany the original source; different angle from reply.
POLL: one question plus exactly four concise options formatted Question:, A), B), C), D).
BLOG: a real mini-article with title, introduction, 3-5 sections, implications and conclusion; substantially longer than social copy.
GRAPHIC PROMPT: visual-only image-generation instructions covering subject, composition, style, lighting and layout; never write social copy into it.
ALT TEXT: short accessibility description of the proposed image.
Do not copy sentences between any assets. Return JSON only.`,
    user:`For each story below, return {"assets":[{"reply":"","quote_tweet":"","poll":"","blog_expansion":"","graphic_prompt":"","alt_text":""}]} in the same order. Preserve facts and do not invent statistics.
${JSON.stringify(data.stories.map((s:any)=>({headline:s.headline,summary:s.summary,category:s.category,keywords:s.keywords,thread:s.thread,sources:s.sources})))}`,
    responseFormat:"json_object", temperature:0.55,
  });
  const parsed=JSON.parse(result.content);
  const assets=Array.isArray(parsed?.assets)?parsed.assets:[];
  return {...data,stories:data.stories.map((s:any,i:number)=>({...s,
    graphic_prompt:assets[i]?.graphic_prompt||s.graphic_prompt||"",
    alt_text:assets[i]?.alt_text||s.alt_text||"",
    engagement:{
      reply:assets[i]?.reply||s.engagement?.reply||"",
      quote_tweet:assets[i]?.quote_tweet||s.engagement?.quote_tweet||"",
      poll:assets[i]?.poll||s.engagement?.poll||"",
      blog_expansion:assets[i]?.blog_expansion||s.engagement?.blog_expansion||""
    }
  }))};
}

export async function POST(request:Request){
  try{
    let provider:"auto"|"gemini"|"nemotron"="auto";
    try{const body=await request.json();if(["auto","gemini","nemotron"].includes(body?.provider))provider=body.provider;}catch{}
    const result=await generateWithLLM({provider,system:SYSTEM_PROMPT,user:`Research the latest high-impact crypto/Web3 stories, select the top two, generate an X thread/single post plus metadata. ${SCHEMA}`,responseFormat:"json_object",temperature:0.25});
    let data=JSON.parse(result.content);
    try{data=await enrichFormats(data,result.provider);}catch(error){console.error("Format enrichment failed",error);}
    return NextResponse.json({...data,llm_provider:result.provider,llm_model:result.model});
  }catch(error:any){console.error("CryptoPulse Generation Error:",error);return NextResponse.json({error:error.message||"Failed to generate content intelligence."},{status:500});}
}
