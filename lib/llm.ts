import OpenAI from "openai";

type Provider = "auto" | "gemini" | "nemotron" | "openrouter";
type ConcreteProvider = Exclude<Provider,"auto">;
type GenerateOptions = { system:string; user:string; responseFormat?:"json_object"; temperature?:number; provider?:Provider };

// Keep enough time for Nemotron to answer, while reserving time for fallback providers.
const LLM_TIMEOUT_MS=9000;
const LLM_BUDGET_MS=24000;

type Health={failures:number;cooldownUntil:number;lastError?:string};
const health:Record<ConcreteProvider,Health>={gemini:{failures:0,cooldownUntil:0},nemotron:{failures:0,cooldownUntil:0},openrouter:{failures:0,cooldownUntil:0}};
let roundRobin=0;

function clientFor(provider:ConcreteProvider){
  if(provider==="gemini"){
    const apiKey=process.env.GEMINI_API_KEY;
    if(!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
    return new OpenAI({apiKey,baseURL:"https://generativelanguage.googleapis.com/v1beta/openai/",timeout:LLM_TIMEOUT_MS,maxRetries:0});
  }
  if(provider==="nemotron"){
    const apiKey=process.env.NEMOTRON_API_KEY;
    if(!apiKey) throw new Error("NEMOTRON_API_KEY is not configured.");
    return new OpenAI({apiKey,baseURL:process.env.NEMOTRON_BASE_URL||"https://integrate.api.nvidia.com/v1",timeout:LLM_TIMEOUT_MS,maxRetries:0});
  }
  const apiKey=process.env.OPENROUTER_API_KEY;
  if(!apiKey) throw new Error("OPENROUTER_API_KEY is not configured.");
  return new OpenAI({apiKey,baseURL:"https://openrouter.ai/api/v1",timeout:LLM_TIMEOUT_MS,maxRetries:0,defaultHeaders:{"HTTP-Referer":process.env.OPENROUTER_SITE_URL||"https://web3pulse.app","X-Title":"Web3 Pulse"}});
}

function modelFor(provider:ConcreteProvider){
  if(provider==="gemini") return process.env.GEMINI_MODEL||"gemini-3.6-flash";
  if(provider==="nemotron") return process.env.NEMOTRON_MODEL||"nvidia/nemotron-3-ultra-550b-a55b";
  // Do not pin Web3 Pulse to a shared free model. OpenRouter can select a healthy model/provider itself.
  return process.env.OPENROUTER_MODEL||"openrouter/auto";
}
function isRateLimited(error:unknown){const e=error as {status?:number;code?:string;message?:string}|undefined;return e?.status===429||e?.code==="429"||/rate.?limit|quota|too many requests|resource.?exhausted/i.test(e?.message||"");}
function statusOf(error:unknown){const e=error as {status?:number;code?:string;message?:string}|undefined;return e?.status||Number(e?.code)||0;}
function cleanJson(content:string){return content.replace(/^\s*```(?:json)?\s*/i,"").replace(/\s*```\s*$/i,"").trim()}
function isValidJsonObject(value:string){try{const parsed=JSON.parse(cleanJson(value));return Boolean(parsed&&typeof parsed==="object"&&!Array.isArray(parsed));}catch{return false;}}
function configured():ConcreteProvider[]{return ["nemotron","openrouter","gemini"].filter(p=>Boolean(p==="nemotron"?process.env.NEMOTRON_API_KEY:p==="gemini"?process.env.GEMINI_API_KEY:process.env.OPENROUTER_API_KEY)) as ConcreteProvider[];}
function orderedProviders():ConcreteProvider[]{const all=configured();if(!all.length)return[];const now=Date.now();const available=all.filter(p=>health[p].cooldownUntil<=now);const pool=available.length?available:all;const start=roundRobin++%pool.length;return pool.slice(start).concat(pool.slice(0,start)).sort((a,b)=>health[a].failures-health[b].failures);}
function markSuccess(provider:ConcreteProvider){health[provider]={failures:0,cooldownUntil:0};}
function markFailure(provider:ConcreteProvider,error:unknown){const code=statusOf(error);const rate=isRateLimited(error);const cooldown=rate?30000:code===401||code===403?300000:code===404?600000:code>=500?30000:15000;health[provider]={failures:health[provider].failures+1,cooldownUntil:Date.now()+cooldown,lastError:error instanceof Error?error.message:String(error)};}

export async function generateWithLLM(options:GenerateOptions){
  const requested=options.provider||"auto";
  const providers:ConcreteProvider[]=requested!=="auto"?[requested]:orderedProviders();
  if(!providers.length) throw new Error("No LLM provider is configured. Add NEMOTRON_API_KEY, OPENROUTER_API_KEY or GEMINI_API_KEY.");
  const deadline=Date.now()+LLM_BUDGET_MS;
  let lastError:unknown;
  for(const provider of providers){
    if(requested==="auto"&&health[provider].cooldownUntil>Date.now())continue;
    const remaining=deadline-Date.now();
    if(remaining<1500)break;
    const model=modelFor(provider);
    const attemptTimeout=Math.min(LLM_TIMEOUT_MS,Math.max(1500,remaining-750));
    try{
      const client=clientFor(provider);
      const request={model,messages:[{role:"system",content:options.system},{role:"user",content:options.user}],...(options.responseFormat?{response_format:{type:options.responseFormat}}:{}),temperature:options.temperature??0.2};
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),attemptTimeout);
      try{
        const response=await client.chat.completions.create(request as any,{signal:controller.signal} as any);
        const content=response.choices[0]?.message?.content;
        if(!content)throw new Error(`${provider}/${model} returned an empty response.`);
        if(options.responseFormat&&!isValidJsonObject(content))throw new Error(`${provider}/${model} returned malformed JSON.`);
        markSuccess(provider);
        return {content:cleanJson(content),provider,model};
      }finally{clearTimeout(timer)}
    }catch(error){
      lastError=error;
      markFailure(provider,error);
      console.error(`Web3 Pulse ${provider}/${model} error:`,error);
      if(requested!=="auto")break;
    }
  }
  if(isRateLimited(lastError))throw new Error("All available LLM providers are currently rate-limited. Web3 Pulse stopped without generating stale content.");
  throw new Error(lastError instanceof Error?lastError.message:"All available LLM providers failed.");
}

export function configuredProviders(){return {openrouter:Boolean(process.env.OPENROUTER_API_KEY),gemini:Boolean(process.env.GEMINI_API_KEY),nemotron:Boolean(process.env.NEMOTRON_API_KEY)};}
export function llmProviderStatus(){const now=Date.now();return configured().map(provider=>({provider,model:modelFor(provider),configured:true,available:health[provider].cooldownUntil<=now,cooldown_seconds:Math.max(0,Math.ceil((health[provider].cooldownUntil-now)/1000)),failures:health[provider].failures,last_error:health[provider].lastError||null}));}
