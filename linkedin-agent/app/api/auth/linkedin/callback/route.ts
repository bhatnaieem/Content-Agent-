import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, getProfile } from '../../../../../lib/linkedin';
import { saveConnection } from '../../../../../lib/store';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = req.cookies.get('linkedin_oauth_state')?.value;
  if (!code || !state || state !== expected) return NextResponse.json({ error: 'Invalid OAuth state' }, { status: 400 });
  try {
    const token = await exchangeCode(code);
    const profile = await getProfile(token.access_token);
    await saveConnection({
      accessToken: token.access_token, refreshToken: token.refresh_token,
      expiresIn: token.expires_in, refreshExpiresIn: token.refresh_token_expires_in,
      personUrn: `urn:li:person:${profile.sub}`, name: profile.name,
    });
    const response = NextResponse.redirect(new URL('/', req.url));
    response.cookies.delete('linkedin_oauth_state');
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'OAuth failed' }, { status: 500 });
  }
}
