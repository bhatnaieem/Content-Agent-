type Generated = { post: string; imagePrompt: string; topic: string };

const system = `You are a high-quality LinkedIn personal-brand writer. Write for a real professional, not a corporate content bot. Posts should be useful, specific, human and slightly opinionated. Avoid generic motivational filler, fake statistics, engagement bait, excessive emojis and phrases like 'agree?'. Use short paragraphs and natural LinkedIn formatting. Return strict JSON only.`;

export async function generatePost(): Promise<Generated> {
  const topic = process.env.LINKEDIN_TOPICS || 'AI, marketing, entrepreneurship, Web3, technology and lessons from building projects';
  const tone = process.env.LINKEDIN_TONE || 'smart, practical, conversational and authentic';
  const profile = process.env.LINKEDIN_PROFILE_CONTEXT || 'A marketing professional building AI/Web3 projects and exploring entrepreneurship.';
  const prompt = `${system}\n\nProfile: ${profile}\nTopics: ${topic}\nTone: ${tone}\n\nCreate one original weekend LinkedIn post. It should teach or explain one concrete idea, observation, lesson or framework. 120-220 words. No fabricated personal experience. Include 0-5 relevant hashtags at the end. Also create a detailed image prompt for a professional editorial-style image that visually supports the post; do not put text in the image.\n\nJSON schema: {"topic":"string","post":"string","imagePrompt":"string"}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini generation failed: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
  const clean = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(clean) as Generated;
  if (!parsed.post || !parsed.imagePrompt) throw new Error('Gemini returned incomplete content');
  return parsed;
}

export async function generateImage(prompt: string) {
  const model = process.env.POLLINATIONS_IMAGE_MODEL || 'flux';
  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=${encodeURIComponent(model)}&width=1200&height=627`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` } });
  if (!res.ok) throw new Error(`Image generation failed: ${await res.text()}`);
  return res.arrayBuffer();
}
