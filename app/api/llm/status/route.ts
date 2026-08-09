import { NextResponse } from "next/server";
import { configuredProviders } from "../../../../lib/llm";

export async function GET() {
  const providers = configuredProviders();
  return NextResponse.json({
    providers,
    available: Object.values(providers).some(Boolean),
    mode: process.env.LLM_PROVIDER || "auto",
    models: {
      gemini: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      nemotron: process.env.NEMOTRON_MODEL || "nvidia/nemotron-3-ultra-253b-v1",
    },
  });
}
