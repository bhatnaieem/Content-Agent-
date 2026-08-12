import { NextResponse } from "next/server";
import { generateWithLLM } from "../../../lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

type Candidate = { id:string; title:string; url:string; source:string; publishedAt:string; summary:string; category:string; keywords:string[]; score:number; opportunity:string };

const SYSTEM = `You are Web3 Pulse's senior crypto journalist and X editor. Turn the supplied source into an original publication-ready X thread. Use ONLY facts present in the supplied source. Never invent facts, numbers, quotes, dates or claims. Do not copy the headline or source wording. Return ONLY valid JSON with a stories array containing exactly one story. The story must have format=thread and exactly 5 tweets, each under 280 characters. Tweet 1 is an original hook, tweet 2 concrete facts, tweet 3 why it matters, tweet 4 context/implication, tweet 5 what to watch plus the source URL. Every tweet must add information.`;

function cleanHtml(html:string){
  return html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<noscript[\s\S]*?<\/noscript>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/\s+/g," ").trim();
}
function meta(html:string,name:string){const r=new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,'i');return html.match(r)?.[1]||"";}
function titleFrom(html:string){return meta(html,"og:title")||meta(html,"twitter:title")||html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g," ").trim()||"Source development";}
function sourceName(url:string){try{return new URL(url).hostname.replace(/^www\./,"");}catch{return "Source";}}
function fallback(c:Candidate){const t=c.title, s=c.summary;const tweets=[`Source analysis: ${t}`,`What the source says: ${s}` ,`Why it matters: ${c.opportunity}`,`Context: this thread is based only on the supplied source. Verify the original report before publishing.`,`Read the original source and watch for follow-up details: ${c.url}`].map(x=>x.slice(0,280));return {headline:t,category:c.category,score:70,format:"thread",reason:c.opportunity,summary:s,keywords:c.keywords,hashtags:[],sources:[c.url],source_details:[{name:c.source,url:c.url,published_at:c.publishedAt}],posting_time_utc:c.publishedAt,cta:"Verify the original source before publishing.",graphic_prompt:`Premium editorial Web3 visual about: ${t}`,alt_text:`Editorial visual about ${t}`,thread:{title:t,tweets},engagement:{reply:"",quote_tweet:"",poll:"",blog_expansion:""},candidate_ids:[c.id],degraded:true};}
function parse(content:string){const x=content.replace(/^\s*```(?:json)?\s*/i,"").replace(/\s*```\s*$/i,"").trim();try{return JSON.parse(x)}catch{}const a=x.indexOf("{");const b=x.lastIndexOf("}");if(a>=0&&b>a)return JSON.parse(x.slice(a,b+1));throw new Error("The model returned invalid JSON.");}

export async function POST(request:Request){
  try{
    const body=await request.json().catch(()=>({}));
    const raw=String(body?.url||"").trim();
    if(!/^https?:\/\//i.test(raw))return NextResponse.json({error:"Please paste a valid http(s) article URL."},{status:400});
    const url=new URL(raw).toString();
    const r=await fetch(url,{cache:"no-store",headers:{"User-Agent":"Mozilla/5.0 (compatible; Web3Pulse/1.0; +https://vercel.com)"}});
    if(!r.ok)throw new Error(`The source returned HTTP ${r.status}. Try the original article URL or another public source.`);
    const html=await r.text();
    const title=titleFrom(html).slice(0,240);
    const text=cleanHtml(html).slice(0,14000);
    if(text.length<120)throw new Error("Could not extract enough readable text from that page. Try a public article page.");
    const candidate:Candidate={id:`url:${Buffer.from(url).toString("base64url").slice(0,40)}`,title,url,source:sourceName(url),publishedAt:new Date().toISOString(),summary:text,category:/bitcoin|btc/i.test(`${title} ${text}`)?"Bitcoin":/ethereum|eth|layer 2|l2/i.test(`${title} ${text}`)?"Ethereum":/defi|dex|stablecoin|yield/i.test(`${title} ${text}`)?"DeFi":"Emerging",keywords:[],score:80,opportunity:"Assess the reported development, its immediate implications and what credible follow-up information would confirm it."};
    try{
      const result=await generateWithLLM({provider:"auto",system:SYSTEM,user:`VERIFIED CANDIDATE:\n${JSON.stringify(candidate,null,2)}`,responseFormat:"json_object",temperature:0.35,maxTokens:2200});
      const data=parse(result.content);const story=data?.stories?.[0];
      if(!story)throw new Error("No story returned.");
      story.sources=[url];story.source_details=[{name:candidate.source,url,published_at:candidate.publishedAt}];story.candidate_ids=[candidate.id];story.thread={title:String(story.thread?.title||story.headline||title),tweets:Array.isArray(story.thread?.tweets)?story.thread.tweets.slice(0,5):[]};
      return NextResponse.json({generated_at_utc:new Date().toISOString(),stories:[story],source:{title,url,name:candidate.source},degraded:Boolean(result.provider==="fallback")});
    }catch{
      return NextResponse.json({generated_at_utc:new Date().toISOString(),stories:[fallback(candidate)],source:{title,url,name:candidate.source},degraded:true});
    }
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to process this URL."},{status:502});}
}
