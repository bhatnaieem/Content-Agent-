import { NextRequest, NextResponse } from 'next/server';
import { generateImage, generatePost } from '../../../lib/agent';
import { createImagePost, initializeImageUpload, uploadImage } from '../../../lib/linkedin';
import { getConnection, logPost, wasPostedThisWeekend } from '../../../lib/store';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Vercel cron uses UTC. Sunday 04:30 UTC is Sunday 10:00 IST.
  const day = new Date().getUTCDay();
  if (day !== 0) return NextResponse.json({ skipped: true, reason: 'Not weekend post day' });
  if (await wasPostedThisWeekend()) return NextResponse.json({ skipped: true, reason: 'Already posted this weekend' });

  const connection = await getConnection();
  if (!connection) return NextResponse.json({ error: 'Connect LinkedIn first' }, { status: 400 });

  const generated = await generatePost();
  const image = await generateImage(generated.imagePrompt);
  const upload = await initializeImageUpload(connection.accessToken, connection.person_urn);
  const imageUrn = upload.value.image as string;
  await uploadImage(upload.value.uploadUrl, image);
  const linkedinId = await createImagePost(connection.accessToken, connection.person_urn, generated.post, imageUrn);
  await logPost({ topic: generated.topic, text: generated.post, linkedinId });

  return NextResponse.json({ ok: true, topic: generated.topic, linkedinId, post: generated.post });
}
