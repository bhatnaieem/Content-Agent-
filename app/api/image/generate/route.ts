import { NextResponse } from "next/server";

export const maxDuration = 60;

const NVIDIA_IMAGE_URL = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b";

function findImage(value: unknown): string | null {
  if (typeof value === "string") {
    if (value.startsWith("data:image/")) return value;
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(value) && value.length > 500) return `data:image/png;base64,${value.replace(/\s/g, "")}`;
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImage(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (["b64_json", "base64", "image", "image_base64", "data"].includes(key)) {
        const found = findImage(item);
        if (found) return found;
      }
    }
    for (const item of Object.values(value)) {
      const found = findImage(item);
      if (found) return found;
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.NEMOTRON_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "NEMOTRON_API_KEY is not configured." }, { status: 500 });
    }

    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return NextResponse.json({ error: "Image prompt is required." }, { status: 400 });
    if (prompt.length > 10000) return NextResponse.json({ error: "Image prompt is too long." }, { status: 400 });

    const response = await fetch(NVIDIA_IMAGE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        mode: "Image Generation",
        prompt,
        width: 1024,
        height: 1024,
        samples: 1,
        steps: 4,
        seed: 0,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = typeof result?.detail === "string" ? result.detail : typeof result?.message === "string" ? result.message : "NVIDIA image generation failed.";
      return NextResponse.json({ error: detail }, { status: response.status });
    }

    const image = findImage(result);
    if (!image) return NextResponse.json({ error: "NVIDIA returned no image data." }, { status: 502 });

    return NextResponse.json({ image, provider: "nvidia", model: "black-forest-labs/flux.2-klein-4b" });
  } catch (error) {
    console.error("CryptoPulse image generation error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Image generation failed." }, { status: 500 });
  }
}
