import OpenAI from "openai";

type Provider = "auto" | "gemini" | "nemotron" | "openrouter";
type GenerateOptions = { system:string; user:string; responseFormat?:"json_object"; temperature?:number; provider?:Provider };

function clientFor(provider:Exclude<Provider,"auto">){
  if(provider==="gemini"){
    const apiKey=process.env.GEMINI_API_KEY;
    if(!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
    return new OpenAI({apiKey,baseURL:"https://generativelanguage.googleapis.com/v1beta/openai/"});
  }
  if(provider==="nemotron"){
    const apiKey=process.env.NEMOTRON_API_KEY;
    if(!apiKey) throw new Error("NEMOTRON_API_KEY is not configured.");
    return new OpenAI({apiKey,baseURL:process.env.NEMOTRON_BASE_URL||"https://integrate.api.nvidia.com/v1"});
  }
  const apiKey=process.env.OPENROUTER_API_KEY;
  if(!apiKey) throw new Error("OPENROUTER_API_KEY is not configured.");
  return new OpenAI({apiKey,baseURL:"https://openrouter.ai/api/v1",defaultHeaders:{"HTTP-Referer":process.env.OPENROUTER_SITE_URL||"https://web3pulse.app","X-Title":"Web3 Pulse"}});
}

function modelFor(provider:Exclude<Provider,"auto">){
  if(provider==="gemini") return process.env.GEMINI_MODEL||"gemini-3.6-flash";
  if(provider==="nemotron") return process.env.NEMOTRON_MODEL||"nvidia/nemotron-3-ultra-253b-v1";
  return process.env.OPENROUTER_MODEL||"openai/gpt-oss-20b:free";
}
function isRateLimited(error:unknown){const e=error as {status?:number;code?:string;message?:string}|undefined;return e?.status===429||e?.code==="429"||/rate.?limit|quota|too many requests/i.test(e?.message||"");}

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
    try{
      const response=await clientFor(provider).chat.completions.create({model:modelFor(provider),messages:[{role:"system",content:options.system},{role:"user",content:options.user}],...(options.responseFormat?{response_format:{type:options.responseFormat}}:{}),temperature:options.temperature??0.2});
      const content=response.choices[0]?.message?.content;
      if(!content) throw new Error(`${provider} returned an empty response.`);
      return {content,provider,model:modelFor(provider)};
    }catch(error){
      lastError=error;
      console.error(`Web3 Pulse ${provider} error:`,error);
      if(requested!=="auto") break;
    }
  }
  throw new Error(isRateLimited(lastError)?"All configured LLM providers are currently rate-limited. Try again later or configure a second provider.":lastError instanceof Error?lastError.message:"All configured LLM providers failed.");
}

export function configuredProviders(){return {openrouter:Boolean(process.env.OPENROUTER_API_KEY),gemini:Boolean(process.env.GEMINI_API_KEY),nemotron:Boolean(process.env.NEMOTRON_API_KEY)};}
