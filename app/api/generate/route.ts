import { NextResponse } from "next/server";
import { generateWithLLM } from "../../../lib/llm";
import { runMultiAgentResearch } from "../../../lib/multi-agent";
import { filterPreviouslyCovered, filterGeneratedDuplicates, rememberCandidates, saveGeneratedStories } from "../../../lib/content-memory";

export const runtime = "nodejs";
export const maxDuration = 60;

type Provider = "auto" | "gemini" | "nemotron" | "openrouter";
type SourceDetail = { name:string; url:string; published_at:string };
type ClientProfile = { name?:string; description?:string; sector?:string; chains?:string; topics?:string; competitors?:string; audience?:string; tone?:string; objectives?:string; avoid?:string };
type FreshCandidate = { id:string; title:string; url:string; source:string; publishedAt:string; summary:string; category:string; keywords:string[]; score:number; opportunity:string };
type Story = { headline:string; category:string; score:number; format:"thread"|"single post"; reason:string; summary:string; keywords:string[]; hashtags:string[]; sources:string[]; source_details?:SourceDetail[]; posting_time_utc:string; cta:string; graphic_prompt:string; alt_text:string; thread:{title:string;tweets:string[]}; engagement:{reply:string;quote_tweet:string;poll:string;blog_expansion:string}; candidate_ids:string[] };
type GenerateBody = { provider?:string; clientProfile?:ClientProfile };

const CONTENT_PROMPT = `You are Web3 Pulse's senior crypto journalist, social editor and PR strategist.

Your job is NOT to rewrite a headline. Turn a verified current candidate into sharp, original, publication-ready X content.

EDITORIAL STANDARD:
- Lead with the most interesting fact, tension, consequence or insight — never simply repeat the source headline.
- Write like an experienced Web3 journalist, not an AI assistant.
- Be specific, concise and information-dense. No filler, generic introductions, corporate language, fake excitement or empty phrases.
- Never invent facts, numbers, quotes, motives, dates or implications not supported by the supplied candidate.
- Distinguish clearly between what happened and why it matters.
- Use the candidate's facts to add useful context and interpretation.
- Preserve the supplied source URL exactly.
- Never discuss a different event.

X THREAD STANDARD:
- Default to a 4-6 post thread for substantive news.
- Post 1 must be a strong hook that creates curiosity without clickbait and must NOT merely copy the headline.
- Post 2 explains what actually happened with concrete facts.
- Post 3 explains why it matters to crypto/Web3 users, markets, builders or the relevant ecosystem.
- Post 4 adds the most useful implication, context or open question.
- Post 5 may add nuance, risk, what to watch, or the source; Post 6 only if genuinely useful.
- Each post must add new information. Never repeat the same sentence or idea.
- Keep every tweet comfortably within X's 280-character limit.
- Do not number tweets inside their text.
- Do not use hashtags in every tweet. Use at most 2-3 relevant hashtags across the whole thread.
- Avoid phrases such as "Here's what you need to know", "In a major development", "This is huge", "The crypto world", "Only time will tell", and similar AI clichés.

SINGLE-POST STANDARD:
- Only use format single post when the event is genuinely better communicated in one compact post.
- It must still contain a hook, the key fact and why it matters.

QUALITY GATE:
A story without a strong original hook and a 4-6 tweet thread is NOT acceptable. Return fewer stories rather than low-quality filler.

Return ONLY valid JSON with a stories array.`;

function clientContext(client?:ClientProfile){
  if(!client)return "";
  return ["","CLIENT PROFILE",`Name: ${client.name||""}`,`Description: ${client.description||""}`,`Sector: ${client.sector||""}`,`Chains/ecosystems: ${client.chains||""}`,`Priority topics: ${client.topics||""}`,`Competitors: ${client.competitors||""}`,`Audience: ${client.audience||""}`,`Tone: ${client.tone||""}`,`PR objectives: ${client.objectives||""}`,`Avoid/guardrails: ${client.avoid||""}`].join("\n");
}
function normalizeUrl(url:string){return String(url||"").trim().replace(/\/$/,"");}
function resolveCandidateIds(story:any,candidates:FreshCandidate[],fallbackIndex?:number):string[]{
  const byId=new Map(candidates.map(c=>[c.id,c]));
  const explicit=Array.isArray(story?.candidate_ids)?story.candidate_ids:[story?.candidate_id];
  const ids=explicit.filter((id:unknown)=>typeof id==="string"&&byId.has(id));
  if(ids.length)return [ids[0]];
  const urls=new Set<string>();
  if(Array.isArray(story?.sources))for(const url of story.sources)if(typeof url==="string")urls.add(normalizeUrl(url));
  if(Array.isArray(story?.source_details))for(const detail of story.source_details)if(typeof detail?.url==="string")urls.add(normalizeUrl(detail.url));
  const urlMatch=candidates.find(c=>urls.has(normalizeUrl(c.url)));if(urlMatch)return [urlMatch.id];
  const headline=String(story?.headline||story?.thread?.title||"");
  if(headline){const exact=candidates.find(c=>c.title.trim().toLowerCase()===headline.trim().toLowerCase());if(exact)return [exact.id];}
  if(typeof fallbackIndex==="number"&&candidates[fallbackIndex])return [candidates[fallbackIndex].id];
  return [];
}
function normalizeStory(story:any,candidates:FreshCandidate[],fallbackIndex?:number):Story|null{
  const ids=resolveCandidateIds(story,candidates,fallbackIndex);if(ids.length!==1)return null;
  const first=candidates.find(c=>c.id===ids[0]);if(!first)return null;
  const threadSource=story?.thread&&typeof story.thread==="object"?story.thread:{};
  const engagement=story?.engagement&&typeof story.engagement==="object"?story.engagement:{};
  const tweets=Array.isArray(threadSource.tweets)?threadSource.tweets.filter((x:unknown)=>typeof x==="string"&&x.trim()).map((x:string)=>x.trim()):[];
  return {headline:String(story?.headline||first.title),category:String(story?.category||first.category||"Emerging"),score:Number.isFinite(Number(story?.score))?Number(story.score):first.score,format:story?.format==="single post"?"single post":"thread",reason:String(story?.reason||first.opportunity||"Current verified Web3 development."),summary:String(story?.summary||first.summary||""),keywords:Array.isArray(story?.keywords)?story.keywords.filter((x:unknown)=>typeof x==="string"):first.keywords||[],hashtags:Array.isArray(story?.hashtags)?story.hashtags.filter((x:unknown)=>typeof x==="string"):[],sources:[first.url],source_details:[{name:first.source,url:first.url,published_at:first.publishedAt}],posting_time_utc:String(story?.posting_time_utc||first.publishedAt),cta:String(story?.cta||"Read the source and verify the details before publishing."),graphic_prompt:String(story?.graphic_prompt||`Create a premium editorial Web3 visual for: ${story?.headline||first.title}.`),alt_text:String(story?.alt_text||`Editorial visual representing ${story?.headline||first.title}.`),thread:{title:String(threadSource.title||story?.headline||first.title),tweets},engagement:{reply:String(engagement.reply||""),quote_tweet:String(engagement.quote_tweet||""),poll:String(engagement.poll||""),blog_expansion:String(engagement.blog_expansion||"")},candidate_ids:ids};
}
function isQualityStory(story:Story|null){
  if(!story||story.format!=="thread")return false;
  const tweets=story.thread?.tweets||[];
  if(tweets.length<4||tweets.length>6)return false;
  if(tweets.some(t=>t.length<35||t.length>280))return false;
  const normalized=tweets.map(t=>t.toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim());
  if(new Set(normalized).size!==normalized.length)return false;
  if(/^(here's what you need to know|in a major development|this is huge|the crypto world)/i.test(tweets[0]))return false;
  return true;
}
function parseLLMJson(content:string):any{
  const cleaned=content.replace(/^\s*```(?:json)?\s*/i,"").replace(/\s*```\s*$/i,"").trim();
  try{return JSON.parse(cleaned);}catch{}
  const start=cleaned.indexOf("{");if(start<0)throw new Error("LLM returned no JSON object.");let depth=0,inString=false,escaped=false;
  for(let i=start;i<cleaned.length;i++){const ch=cleaned[i];if(inString){if(escaped)escaped=false;else if(ch==="\\")escaped=true;else if(ch==='"')inString=false;continue;}if(ch==='"'){inString=true;continue;}if(ch==="{")depth++;else if(ch==="}"&&--depth===0){try{return JSON.parse(cleaned.slice(start,i+1));}catch{break;}}}
  throw new Error("LLM returned invalid JSON.");
}

async function generateOne(candidate:FreshCandidate,provider:Provider,client?:ClientProfile):Promise<Story|null>{
  const prompt=`Generate EXACTLY ONE high-quality publication-ready X thread from ONLY this verified candidate.

MANDATORY OUTPUT:
- format must be "thread"
- exactly 5 tweets
- every tweet must be 280 characters or fewer
- tweet 1 = original hook, not the source headline
- tweet 2 = concrete facts
- tweet 3 = why it matters
- tweet 4 = implication/context/open question
- tweet 5 = what to watch next + concise source/CTA
- every tweet must add new information
- candidate_ids must contain exactly: ${candidate.id}
- do not invent anything

Return ONLY JSON with a stories array containing exactly one story.

VERIFIED CANDIDATE:
${JSON.stringify(candidate,null,2)}${clientContext(client)}`;
  const result=await generateWithLLM({provider,system:CONTENT_PROMPT,user:prompt,responseFormat:"json_object",temperature:0.55,maxTokens:2200});
  const data=parseLLMJson(result.content);const raw=Array.isArray(data.stories)?data.stories:[];const story=raw.length?normalizeStory(raw[0],[candidate],0):null;return isQualityStory(story)?story:null;
}

export async function POST(request:Request){
  const started=Date.now();
  try{
    let body:GenerateBody={};try{body=await request.json();}catch{}
    const provider:Provider=["auto","gemini","nemotron","openrouter"].includes(body.provider||"")?(body.provider as Provider):"auto";
    const now=new Date();const currentDate=now.toISOString().slice(0,10);const cutoffUtc=new Date(now.getTime()-48*60*60*1000).toISOString();
    try{
      const packet=await runMultiAgentResearch([]);
      let candidates:FreshCandidate[]=packet.candidates.filter(item=>{const t=Date.parse(item.publishedAt);return Number.isFinite(t)&&t>=Date.parse(cutoffUtc)&&t<=now.getTime()+15*60*1000}).map(item=>({id:item.id,title:item.title,url:item.url,source:item.source,publishedAt:item.publishedAt,summary:item.summary,category:item.category,keywords:item.keywords,score:item.scores.overall,opportunity:item.opportunity}));
      const rawCandidateCount=candidates.length;await rememberCandidates(candidates);candidates=await filterPreviouslyCovered(candidates);let memoryFilteredCount=candidates.length;
      if(memoryFilteredCount===0){const retryPacket=await runMultiAgentResearch([]);const retryCandidates:FreshCandidate[]=retryPacket.candidates.filter(item=>{const t=Date.parse(item.publishedAt);return Number.isFinite(t)&&t>=Date.parse(cutoffUtc)&&t<=now.getTime()+15*60*1000}).map(item=>({id:item.id,title:item.title,url:item.url,source:item.source,publishedAt:item.publishedAt,summary:item.summary,category:item.category,keywords:item.keywords,score:item.scores.overall,opportunity:item.opportunity}));const retryFiltered=await filterPreviouslyCovered(retryCandidates);if(retryFiltered.length){candidates=retryFiltered;memoryFilteredCount=retryFiltered.length;}}
      const diverse:FreshCandidate[]=Array.from(new Map(candidates.sort((a,b)=>b.score-a.score).map(c=>[c.id,c])).values()).slice(0,40);
      console.info("Web3 Pulse briefing gate",{rawCandidateCount,memoryFilteredCount,diverseCount:diverse.length,historyGuard:"exact-url-or-headline",elapsed_ms:Date.now()-started});
      if(!diverse.length)return NextResponse.json({date:currentDate,generated_at_utc:now.toISOString(),stories:[],no_new_stories:true,code:"NO_NEW_STORIES",error:"No genuinely new verified stories were found. Nothing old was reused.",diagnostics:{raw_candidates:rawCandidateCount,after_memory_filter:memoryFilteredCount},cutoff_utc:cutoffUtc,memory:"supabase"},{status:200});

      const targetCount=Math.min(5,diverse.length);
      const selected=diverse.slice(0,targetCount);
      // Generate each story independently so every thread receives enough output budget for quality.
      const results=await Promise.allSettled(selected.map(candidate=>generateOne(candidate,provider,body.clientProfile)));
      let stories:Story[]=results.filter((r):r is PromiseFulfilledResult<Story|null>=>r.status==="fulfilled").map(r=>r.value).filter((s):s is Story=>isQualityStory(s));
      stories=await filterGeneratedDuplicates(stories);

      // Retry only failed quality candidates once. Weak/incomplete content is never returned to the user.
      if(stories.length<targetCount){
        const used=new Set(stories.flatMap(s=>s.candidate_ids));
        const retryCandidates=selected.filter(c=>!used.has(c.id));
        const retryResults=await Promise.allSettled(retryCandidates.map(c=>generateOne(c,provider,body.clientProfile)));
        const retries=retryResults.filter((r):r is PromiseFulfilledResult<Story|null>=>r.status==="fulfilled").map(r=>r.value).filter((s):s is Story=>isQualityStory(s));
        stories=await filterGeneratedDuplicates([...stories,...retries]);
      }

      if(!stories.length)return NextResponse.json({date:currentDate,generated_at_utc:now.toISOString(),stories:[],no_new_stories:true,code:"QUALITY_GATE_BLOCKED",error:"Fresh candidates were found, but the content model did not produce publication-quality threads. No weak content was returned.",diagnostics:{raw_candidates:rawCandidateCount,after_memory_filter:memoryFilteredCount,selected_candidates:targetCount},candidate_count:diverse.length,memory:"supabase"},{status:200});
      stories=stories.slice(0,targetCount);
      try{await saveGeneratedStories(stories.map(story=>({headline:story.headline,category:story.category,candidate_ids:story.candidate_ids,source_urls:story.sources,content:story,status:"generated",generated_at:now.toISOString(),llm_provider:provider,llm_model:"auto"})))}catch(error){return NextResponse.json({error:"Persistent content memory could not be written. Nothing was returned to prevent duplicates.",code:"MEMORY_WRITE_FAILED",detail:error instanceof Error?error.message:"Supabase write failed"},{status:503});}
      return NextResponse.json({date:currentDate,generated_at_utc:now.toISOString(),stories,research_window:{cutoff_utc:cutoffUtc,hours:48,candidate_count:diverse.length},llm_provider:provider,llm_calls:targetCount,elapsed_ms:Date.now()-started,memory:"supabase"});
    }catch(error){console.error("Duplicate memory/research gate failed:",error);return NextResponse.json({error:"Persistent duplicate protection is unavailable. Generation was blocked so an old story cannot be shown again.",code:"MEMORY_REQUIRED",detail:error instanceof Error?error.message:"Memory unavailable",elapsed_ms:Date.now()-started},{status:503});}
  }catch(error:any){console.error("Web3 Pulse Generation Error:",error);return NextResponse.json({error:error?.message||"Failed to generate current Web3 Pulse intelligence.",code:"GENERATION_ERROR",elapsed_ms:Date.now()-started},{status:500});}
}
