import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

export async function GET() {
  const state = crypto.randomBytes(24).toString('hex');
  const params = new URLSearchParams({
    response_type: 'code', client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    state,
    scope: 'openid profile w_member_social',
  });
  const response = NextResponse.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
  response.cookies.set('linkedin_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  return response;
}
