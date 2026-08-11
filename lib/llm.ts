import OpenAI from "openai";

type Provider = "auto" | "gemini" | "nemotron" | "openrouter";
type ConcreteProvider = Exclude<Provider,"auto">;
type GenerateOptions = { system:string; user:string; responseFormat?:"json_object"; temperature?:number; provider?:Provider };

// Give the configured providers enough time to return structured content while
// keeping the whole auto race inside the Vercel route budget.
const LLM_TIMEOUT_MS=22000;
const LLM_BUDGET_MS=30000;

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
  return process.env.OPENROUTER_MODEL||"openrouter/auto";
}
function isRateLimited(error:unknown){const e=error as {status?:number;code?:string;message?:string}|undefined;return e?.status===429||e?.code==="429"||/rate.?limit|quota|too many requests|resource.?exhausted/i.test(e?.message||"");}
function statusOf(error:unknown){const e=error as {status?:number;code?:string;message?:string}|undefined;return e?.status||Number(e?.code)||0;}
function isAbort(error:unknown){const e=error as {name?:string;message?:string}|undefined;return e?.name==="AbortError"||/request was aborted|aborted the request|signal is aborted/i.test(e?.message||"");}
function cleanJson(content:string){return content.replace(/^\s*```(?:json)?\s*/i,"").replace(/\s*```\s*$/i,"").trim()}
function isValidJsonObject(value:string){try{const parsed=JSON.parse(cleanJson(value));return Boolean(parsed&&typeof parsed==="object"&&!Array.isArray(parsed));}catch{return false;}}
function configured():ConcreteProvider[]{return ["nemotron","openrouter","gemini"].filter(p=>Boolean(p==="nemotron"?process.env.NEMOTRON_API_KEY:p==="gemini"?process.env.GEMINI_API_KEY:process.env.OPENROUTER_API_KEY)) as ConcreteProvider[];}
function orderedProviders():ConcreteProvider[]{const all=configured();if(!all.length)return[];const now=Date.now();const available=all.filter(p=>health[p].cooldownUntil<=now);const pool=available.length?available:all;const start=roundRobin++%pool.length;return pool.slice(start).concat(pool.slice(0,start)).sort((a,b)=>health[a].failures-health[b].failures);}
function markSuccess(provider:ConcreteProvider){health[provider]={failures:0,cooldownUntil:0};}
function markFailure(provider:ConcreteProvider,error:unknown){const code=statusOf(error);const rate=isRateLimited(error);const abort=isAbort(error);const cooldown=rate?30000:abort?15000:code===401||code===403?300000:code===404?600000:code>=500?30000:15000;health[provider]={failures:health[provider].failures+1,cooldownUntil:Date.now()+cooldown,lastError:error instanceof Error?error.message:String(error)};}

async function attempt(provider:ConcreteProvider,options:GenerateOptions,signal:AbortSignal){
  const model=modelFor(provider);
  const client=clientFor(provider);
  // Keep the response compact. The downstream schema only needs a handful of
  // short posts plus metadata, so a smaller generation budget materially reduces
  // latency and makes large models such as Nemotron much more reliable on Vercel.
  const request:any={model,messages:[{role:"system",content:options.system},{role:"user",content:options.user}],max_tokens:3500,...(options.responseFormat?{response_format:{type:options.responseFormat}}:{}),temperature:options.temperature??0.2};
  // Nemotron can spend a large amount of time reasoning by default. Content
  // generation is a structured editorial task, so disable thinking for predictable
  // latency on Vercel while keeping the model available as a fallback.
  if(provider==="nemotron") request.extra_body={chat_template_kwargs:{enable_thinking:false}};
  const response=await client.chat.completions.create(request,{signal} as any);
  const content=response.choices[0]?.message?.content;
  if(!content)throw new Error(`${provider}/${model} returned an empty response.`);
  if(options.responseFormat&&!isValidJsonObject(content))throw new Error(`${provider}/${model} returned malformed JSON.`);
  return {content:cleanJson(content),provider,model};
}

export async function generateWithLLM(options:GenerateOptions){
  const requested=options.provider||"auto";
  const providers:ConcreteProvider[]=requested!=="auto"?[requested]:orderedProviders();
  if(!providers.length) throw new Error("No LLM provider is configured. Add NEMOTRON_API_KEY, OPENROUTER_API_KEY or GEMINI_API_KEY.");

  if(requested!=="auto"){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),LLM_TIMEOUT_MS);
    try{
      const result=await attempt(requested,options,controller.signal);
      markSuccess(requested);
      return result;
    }catch(error){
      markFailure(requested,error);
      console.error(`Web3 Pulse ${requested}/${modelFor(requested)} error:`,error);
      if(isRateLimited(error))throw new Error(`${requested} is currently rate-limited. Web3 Pulse stopped without generating stale content.`);
      if(isAbort(error))throw new Error(`${requested} timed out before returning a response.`);
      throw error instanceof Error?error:new Error(String(error));
    }finally{clearTimeout(timer)}
  }

  const active=providers.filter(p=>health[p].cooldownUntil<=Date.now());
  const pool=active.length?active:providers;
  const controllers=pool.map(()=>new AbortController());
  const globalTimer=setTimeout(()=>controllers.forEach(c=>c.abort()),LLM_BUDGET_MS);
  const attempts=pool.map((provider,index)=>attempt(provider,options,controllers[index].signal).catch(error=>{
    markFailure(provider,error);
    console.error(`Web3 Pulse ${provider}/${modelFor(provider)} error:`,error);
    throw error;
  }));

  try{
    try{
      const result=await Promise.any(attempts);
      markSuccess(result.provider);
      return result;
    }catch(error){
      const reasons=error instanceof AggregateError?error.errors:[];
      const sawRate=reasons.some(isRateLimited);
      const sawAbort=reasons.some(isAbort);
      if(sawRate&&!reasons.some((reason)=>!isRateLimited(reason)&&!isAbort(reason)))throw new Error("All available LLM providers are currently rate-limited. Web3 Pulse stopped without generating stale content.");
      if(sawAbort&&!reasons.some((reason)=>!isRateLimited(reason)&&!isAbort(reason)))throw new Error("LLM providers timed out before returning a response. Web3 Pulse stopped without generating stale content.");
      const last=reasons[reasons.length-1];
      throw last instanceof Error?last:new Error("All available LLM providers failed.");
    }
  }finally{clearTimeout(globalTimer);controllers.forEach(c=>c.abort())}
}

export function configuredProviders(){return {openrouter:Boolean(process.env.OPENROUTER_API_KEY),gemini:Boolean(process.env.GEMINI_API_KEY),nemotron:Boolean(process.env.NEMOTRON_API_KEY)};}
export function llmProviderStatus(){const now=Date.now();return configured().map(provider=>({provider,model:modelFor(provider),configured:true,available:health[provider].cooldownUntil<=now,cooldown_seconds:Math.max(0,Math.ceil((health[provider].cooldownUntil-now)/1000)),failures:health[provider].failures,last_error:health[provider].lastError||null}));}
