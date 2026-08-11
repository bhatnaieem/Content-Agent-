import OpenAI from "openai";

type Provider = "auto" | "gemini" | "nemotron" | "openrouter";
type GenerateOptions = { system:string; user:string; responseFormat?:"json_object"; temperature?:number; provider?:Provider };
const LLM_TIMEOUT_MS=15000;

function clientFor(provider:Exclude<Provider,"auto">){
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

function modelFor(provider:Exclude<Provider,"auto">){
  if(provider==="gemini") return process.env.GEMINI_MODEL||"gemini-3.6-flash";
  if(provider==="nemotron") return process.env.NEMOTRON_MODEL||"nvidia/nemotron-3-ultra-253b-v1";
  return process.env.OPENROUTER_MODEL||"openai/gpt-oss-20b:free";
}
function isRateLimited(error:unknown){const e=error as {status?:number;code?:string;message?:string}|undefined;return e?.status===429||e?.code==="429"||/rate.?limit|quota|too many requests|resource.?exhausted/i.test(e?.message||"");}
function isValidJsonObject(value:string){try{const parsed=JSON.parse(value.replace(/^\s*```(?:json)?\s*/i,"").replace(/\s*```\s*$/i,"").trim());return Boolean(parsed&&typeof parsed==="object"&&!Array.isArray(parsed));}catch{return false;}}

export async function generateWithLLM(options:GenerateOptions){
  const requested=options.provider||"auto";
  const configured:Exclude<Provider,"auto">[]=requested==="auto"?[
    ...(process.env.OPENROUTER_API_KEY?["openrouter" as const]:[]),
    ...(process.env.GEMINI_API_KEY?["gemini" as const]:[]),
    ...(process.env.NEMOTRON_API_KEY?["nemotron" as const]:[])
  ]:[requested];
  if(!configured.length) throw new Error("No LLM provider is configured. Add OPENROUTER_API_KEY, GEMINI_API_KEY or NEMOTRON_API_KEY.");
  let lastError:unknown;
  for(const provider of configured){
    const model=modelFor(provider);
    try{
      const client=clientFor(provider);
      const request={model,messages:[{role:"system",content:options.system},{role:"user",content:options.user}],...(options.responseFormat?{response_format:{type:options.responseFormat}}:{}),temperature:options.temperature??0.2};
      let response=await client.chat.completions.create(request as any);
      let content=response.choices[0]?.message?.content;
      if(!content) throw new Error(`${provider}/${model} returned an empty response.`);
      if(options.responseFormat&&!isValidJsonObject(content)){
        response=await client.chat.completions.create({model,messages:[{role:"system",content:`${options.system}\n\nCRITICAL OUTPUT CONTRACT: Return ONLY one valid JSON object. No Markdown, no code fences, no explanation, no preamble.`},{role:"user",content:options.user}],temperature:options.temperature??0.2} as any);
        content=response.choices[0]?.message?.content;
        if(!content||!isValidJsonObject(content)) throw new Error(`${provider}/${model} returned malformed JSON after structured-output retry.`);
      }
      return {content,provider,model};
    }catch(error){
      lastError=error;
      console.error(`Web3 Pulse ${provider}/${model} error:`,error);
      if(requested!=="auto") break;
    }
  }
  throw new Error(isRateLimited(lastError)?"All configured LLM providers are currently rate-limited. Try again later or configure a second provider.":lastError instanceof Error?lastError.message:"All configured LLM providers failed.");
}

export function configuredProviders(){return {openrouter:Boolean(process.env.OPENROUTER_API_KEY),gemini:Boolean(process.env.GEMINI_API_KEY),nemotron:Boolean(process.env.NEMOTRON_API_KEY)};}
