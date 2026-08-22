const api = 'https://api.linkedin.com';
const version = process.env.LINKEDIN_VERSION || '202608';

function headers(token: string, json = false) {
  return {
    Authorization: `Bearer ${token}`,
    'Linkedin-Version': version,
    'X-Restli-Protocol-Version': '2.0.0',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

export async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
  });
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) throw new Error(`LinkedIn token exchange failed: ${await res.text()}`);
  return res.json();
}

export async function getProfile(token: string) {
  const res = await fetch(`${api}/v2/userinfo`, { headers: headers(token) });
  if (!res.ok) throw new Error(`LinkedIn profile lookup failed: ${await res.text()}`);
  return res.json();
}

export async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
  });
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) throw new Error(`LinkedIn token refresh failed: ${await res.text()}`);
  return res.json();
}

export async function initializeImageUpload(token: string, owner: string) {
  const res = await fetch(`${api}/rest/images?action=initializeUpload`, {
    method: 'POST', headers: headers(token, true),
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  if (!res.ok) throw new Error(`LinkedIn image initialization failed: ${await res.text()}`);
  return res.json();
}

export async function uploadImage(uploadUrl: string, bytes: ArrayBuffer) {
  const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: bytes });
  if (!res.ok) throw new Error(`LinkedIn image upload failed: ${await res.text()}`);
}

export async function createImagePost(token: string, author: string, commentary: string, imageUrn: string) {
  const res = await fetch(`${api}/rest/posts`, {
    method: 'POST', headers: headers(token, true),
    body: JSON.stringify({
      author, commentary, visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { altText: commentary.slice(0, 120), id: imageUrn } },
      lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false,
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn post creation failed: ${await res.text()}`);
  return res.headers.get('x-restli-id') || 'published';
}
