import { NextRequest, NextResponse } from 'next/server';
import { generateImage, generatePost } from '../../../lib/agent';
import { createImagePost, initializeImageUpload, uploadImage } from '../../../lib/linkedin';
import { getConnection, logPost, wasPostedThisWeekend } from '../../../lib/store';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (new Date().getUTCDay() !== 0) return NextResponse.json({ skipped: true, reason: 'Not Sunday' });
  if (await wasPostedThisWeekend()) return NextResponse.json({ skipped: true, reason: 'Already posted this weekend' });

  const connection = await getConnection();
  if (!connection) return NextResponse.json({ error: 'LinkedIn is not connected' }, { status: 400 });

  try {
    const generated = await generatePost();
    const image = await generateImage(generated.imagePrompt);
    const upload = await initializeImageUpload(connection.accessToken, connection.person_urn);
    const imageUrn = upload.value.image as string;
    await uploadImage(upload.value.uploadUrl, image);
    const linkedinId = await createImagePost(connection.accessToken, connection.person_urn, generated.post, imageUrn);
    await logPost({ topic: generated.topic, text: generated.post, linkedinId });
    return NextResponse.json({ ok: true, topic: generated.topic, linkedinId });
  } catch (error) {
    console.error('LinkedIn weekend publish failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Publishing failed' }, { status: 500 });
  }
}
