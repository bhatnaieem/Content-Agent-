import OpenAI from "openai";

type Provider = "auto" | "gemini" | "nemotron" | "openrouter";
type ConcreteProvider = Exclude<Provider,"auto">;
type GenerateOptions = { system:string; user:string; responseFormat?:"json_object"; temperature?:number; provider?:Provider; maxTokens?:number };

const LLM_TIMEOUT_MS=22000;
const LLM_BUDGET_MS=30000;
type Health={failures:number;cooldownUntil:number;lastError?:string};
const health:Record<ConcreteProvider,Health>={gemini:{failures:0,cooldownUntil:0},nemotron:{failures:0,cooldownUntil:0},openrouter:{failures:0,cooldownUntil:0}};
let roundRobin=0;

function clientFor(provider:ConcreteProvider){
  if(provider==="gemini"){
    const apiKey=process.env.GEMINI_API_KEY;if(!apiKey)throw new Error("GEMINI_API_KEY is not configured.");
    return new OpenAI({apiKey,baseURL:"https://generativelanguage.googleapis.com/v1beta/openai/",timeout:LLM_TIMEOUT_MS,maxRetries:0});
  }
  if(provider==="nemotron"){
    const apiKey=process.env.NEMOTRON_API_KEY;if(!apiKey)throw new Error("NEMOTRON_API_KEY is not configured.");
    return new OpenAI({apiKey,baseURL:process.env.NEMOTRON_BASE_URL||"https://integrate.api.nvidia.com/v1",timeout:LLM_TIMEOUT_MS,maxRetries:0});
  }
  const apiKey=process.env.OPENROUTER_API_KEY;if(!apiKey)throw new Error("OPENROUTER_API_KEY is not configured.");
  return new OpenAI({apiKey,baseURL:"https://openrouter.ai/api/v1",timeout:LLM_TIMEOUT_MS,maxRetries:0,defaultHeaders:{"HTTP-Referer":process.env.OPENROUTER_SITE_URL||"https://web3pulse.app","X-Title":"Web3 Pulse"}});
}
function modelFor(provider:ConcreteProvider){if(provider==="gemini")return process.env.GEMINI_MODEL||"gemini-3.6-flash";if(provider==="nemotron")return process.env.NEMOTRON_MODEL||"nvidia/nemotron-3-ultra-550b-a55b";return process.env.OPENROUTER_MODEL||"openrouter/auto";}
function isRateLimited(error:unknown){const e=error as {status?:number;code?:string;message?:string}|undefined;return e?.status===429||e?.code==="429"||/rate.?limit|quota|too many requests|resource.?exhausted/i.test(e?.message||"");}
function statusOf(error:unknown){const e=error as {status?:number;code?:string;message?:string}|undefined;return e?.status||Number(e?.code)||0;}
function isAbort(error:unknown){const e=error as {name?:string;message?:string}|undefined;return e?.name==="AbortError"||/request was aborted|aborted the request|signal is aborted/i.test(e?.message||"");}
function cleanJson(content:string){return content.replace(/^\s*```(?:json)?\s*/i,"").replace(/\s*```\s*$/i,"").trim();}
function isValidJsonObject(value:string){try{const parsed=JSON.parse(cleanJson(value));return Boolean(parsed&&typeof parsed==="object"&&!Array.isArray(parsed));}catch{return false;}}
function configured():ConcreteProvider[]{return ["nemotron","openrouter","gemini"].filter(p=>Boolean(p==="nemotron"?process.env.NEMOTRON_API_KEY:p==="gemini"?process.env.GEMINI_API_KEY:process.env.OPENROUTER_API_KEY)) as ConcreteProvider[];}
function orderedProviders():ConcreteProvider[]{const all=configured();if(!all.length)return[];const now=Date.now();const available=all.filter(p=>health[p].cooldownUntil<=now);const pool=available.length?available:all;const start=roundRobin++%pool.length;return pool.slice(start).concat(pool.slice(0,start)).sort((a,b)=>health[a].failures-health[b].failures);}
function markSuccess(provider:ConcreteProvider){health[provider]={failures:0,cooldownUntil:0};}
function markFailure(provider:ConcreteProvider,error:unknown){const code=statusOf(error);const rate=isRateLimited(error);const abort=isAbort(error);const cooldown=rate?30000:abort?15000:code===401||code===403?300000:code===404?600000:code>=500?30000:15000;health[provider]={failures:health[provider].failures+1,cooldownUntil:Date.now()+cooldown,lastError:error instanceof Error?error.message:String(error)};}

async function attempt(provider:ConcreteProvider,options:GenerateOptions,signal:AbortSignal){
  const model=modelFor(provider),client=clientFor(provider);
  const request:any={model,messages:[{role:"system",content:options.system},{role:"user",content:options.user}],max_tokens:options.maxTokens??3500,...(options.responseFormat?{response_format:{type:options.responseFormat}}:{}),temperature:options.temperature??0.2};
  // NVIDIA's endpoint currently rejects OpenAI's extra_body parameter. Keep the
  // request strictly OpenAI-compatible so Nemotron can actually be reached.
  const response=await client.chat.completions.create(request,{signal} as any);
  const content=response.choices[0]?.message?.content;if(!content)throw new Error(`${provider}/${model} returned an empty response.`);
  if(options.responseFormat&&!isValidJsonObject(content))throw new Error(`${provider}/${model} returned malformed JSON.`);
  return {content:cleanJson(content),provider,model};
}

function clip(value:string,max=245){const s=String(value||"").replace(/\s+/g," ").trim();return s.length<=max?s:`${s.slice(0,max-1).trim()}…`;}
function extractCandidate(user:string){
  const marker="VERIFIED CANDIDATE:";const start=user.indexOf(marker);if(start<0)return null;
  const tail=user.slice(start+marker.length);const jsonStart=tail.indexOf("{");if(jsonStart<0)return null;
  let depth=0,inString=false,escaped=false;
  for(let i=jsonStart;i<tail.length;i++){
    const ch=tail[i];
    if(inString){if(escaped)escaped=false;else if(ch==="\\")escaped=true;else if(ch==='"')inString=false;continue;}
    if(ch==='"'){inString=true;continue;} if(ch==="{")depth++; else if(ch==="}"&&--depth===0){try{return JSON.parse(tail.slice(jsonStart,i+1));}catch{return null;}}
  }
  return null;
}
function groundedFallback(options:GenerateOptions){
  const c=extractCandidate(options.user);if(!c)return null;
  const id=String(c.id||"");if(!id)return null;
  const title=clip(c.title||"Current Web3 development",210),summary=clip(c.summary||"",220),category=clip(c.category||"Web3",40),source=clip(c.source||"Source",80),url=clip(c.url||"",180),opportunity=clip(c.opportunity||"Review the verified development and its implications.",190);
  const tweets=[
    `${title} — a fresh ${category} signal worth watching.`,
    `What happened: ${summary||title}`,
    `Why it matters: ${opportunity}`,
    `Context: the verified research record identifies ${source} as the source for this development. No additional facts are assumed here.`,
    `What to watch next: follow the source for updates and verify the details before publishing. ${url}`
  ].map(t=>clip(t,275));
  return {content:JSON.stringify({stories:[{headline:title,category,score:Number(c.score)||70,format:"thread",reason:opportunity,summary,keywords:Array.isArray(c.keywords)?c.keywords.slice(0,8):[],hashtags:[],sources:[String(c.url||"")],source_details:[{name:String(c.source||"Verified source"),url:String(c.url||""),published_at:String(c.publishedAt||"")}],posting_time_utc:String(c.publishedAt||new Date().toISOString()),cta:"Verify the source before publishing.",graphic_prompt:`Create a premium editorial Web3 visual about ${title}.`,alt_text:`Editorial visual about ${title}.`,thread:{title,tweets},engagement:{reply:"",quote_tweet:"",poll:"",blog_expansion:""},candidate_ids:[id],degraded_generation:true}}]}),provider:"fallback",model:"research-draft"};
}

export async function generateWithLLM(options:GenerateOptions){
  const requested=options.provider||"auto";const providers:ConcreteProvider[]=requested!=="auto"?[requested]:orderedProviders();
  if(!providers.length){const fallback=groundedFallback(options);if(fallback)return fallback;throw new Error("No LLM provider is configured. Add NEMOTRON_API_KEY, OPENROUTER_API_KEY or GEMINI_API_KEY.");}
  if(requested!=="auto"){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),LLM_TIMEOUT_MS);
    try{const result=await attempt(requested,options,controller.signal);markSuccess(requested);return result;}
    catch(error){markFailure(requested,error);console.error(`Web3 Pulse ${requested}/${modelFor(requested)} error:`,error);const fallback=groundedFallback(options);if(fallback)return fallback;if(isRateLimited(error))throw new Error(`${requested} is currently rate-limited.`);if(isAbort(error))throw new Error(`${requested} timed out before returning a response.`);throw error instanceof Error?error:new Error(String(error));}
    finally{clearTimeout(timer);}
  }
  const active=providers.filter(p=>health[p].cooldownUntil<=Date.now()),pool=active.length?active:providers;
  const controllers=pool.map(()=>new AbortController()),globalTimer=setTimeout(()=>controllers.forEach(c=>c.abort()),LLM_BUDGET_MS);
  const attempts=pool.map((p,index)=>attempt(p,options,controllers[index].signal).catch(error=>{markFailure(p,error);console.error(`Web3 Pulse ${p}/${modelFor(p)} error:`,error);throw error;}));
  try{
    try{const result=await Promise.any(attempts);markSuccess(result.provider);return result;}
    catch(error){
      const fallback=groundedFallback(options);if(fallback){console.warn("Web3 Pulse: all LLM providers failed; returning grounded research draft.");return fallback;}
      const reasons=error instanceof AggregateError?error.errors:[],sawRate=reasons.some(isRateLimited),sawAbort=reasons.some(isAbort);
      if(sawRate&&!reasons.some(reason=>!isRateLimited(reason)&&!isAbort(reason)))throw new Error("All available LLM providers are currently rate-limited.");
      if(sawAbort&&!reasons.some(reason=>!isRateLimited(reason)&&!isAbort(reason)))throw new Error("LLM providers timed out before returning a response.");
      const last=reasons[reasons.length-1];throw last instanceof Error?last:new Error("All available LLM providers failed.");
    }
  }finally{clearTimeout(globalTimer);controllers.forEach(c=>c.abort());}
}

export function configuredProviders(){return {openrouter:Boolean(process.env.OPENROUTER_API_KEY),gemini:Boolean(process.env.GEMINI_API_KEY),nemotron:Boolean(process.env.NEMOTRON_API_KEY)};}
export function llmProviderStatus(){const now=Date.now();return configured().map(provider=>({provider,model:modelFor(provider),configured:true,available:health[provider].cooldownUntil<=now,cooldown_seconds:Math.max(0,Math.ceil((health[provider].cooldownUntil-now)/1000)),failures:health[provider].failures,last_error:health[provider].lastError||null}));}
