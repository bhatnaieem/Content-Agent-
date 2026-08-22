type Generated = { post: string; imagePrompt: string; topic: string };

const system = `You are an expert LinkedIn personal-brand writer focused ONLY on marketing, entrepreneurship and business in India. Write like a smart Indian marketing professional: human, practical, specific and slightly opinionated. Avoid generic motivation, fake statistics, corporate jargon, excessive emojis, engagement bait and fabricated personal experiences. Prefer a strong opening, useful insight and a clear takeaway. Return strict JSON only.`;

export async function generatePost(): Promise<Generated> {
  const prompt = `${system}\n\nCreate one original weekend LinkedIn post about a current or evergreen topic connected to marketing, entrepreneurship or business in India. Rotate topics naturally so posts don't feel repetitive. Possible areas include Indian startups, D2C, MSMEs, consumer behaviour, advertising, branding, digital marketing, AI in business, founder lessons, distribution, sales, business models and Indian market opportunities.\n\nLength: 120-220 words. Use short paragraphs. Do not claim breaking/current facts unless you are given a source. Include 0-5 useful hashtags. Also create a detailed professional editorial image prompt supporting the idea; no text, logos or watermarks in the image.\n\nJSON schema: {"topic":"string","post":"string","imagePrompt":"string"}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini generation failed: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
  const clean = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(clean) as Generated;
  if (!parsed.post || !parsed.imagePrompt || !parsed.topic) throw new Error('Gemini returned incomplete content');
  return parsed;
}

export async function generateImage(prompt: string) {
  const model = process.env.POLLINATIONS_IMAGE_MODEL || 'flux';
  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=${encodeURIComponent(model)}&width=1200&height=627`;
  const headers: Record<string, string> = {};
  if (process.env.POLLINATIONS_API_KEY) headers.Authorization = `Bearer ${process.env.POLLINATIONS_API_KEY}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Image generation failed: ${await res.text()}`);
  return res.arrayBuffer();
}
