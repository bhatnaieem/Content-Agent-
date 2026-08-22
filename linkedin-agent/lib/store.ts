import { supabase } from './supabase';
import { decrypt, encrypt } from './crypto';
import { refreshAccessToken } from './linkedin';

export async function saveConnection(data: { accessToken: string; refreshToken?: string; expiresIn: number; refreshExpiresIn?: number; personUrn: string; name?: string }) {
  const now = new Date();
  const { error } = await supabase.from('linkedin_connection').upsert({
    id: 1, person_urn: data.personUrn, name: data.name || null,
    access_token: encrypt(data.accessToken), refresh_token: data.refreshToken ? encrypt(data.refreshToken) : null,
    access_token_expires_at: new Date(now.getTime() + data.expiresIn * 1000).toISOString(),
    refresh_token_expires_at: data.refreshExpiresIn ? new Date(now.getTime() + data.refreshExpiresIn * 1000).toISOString() : null,
    updated_at: now.toISOString(),
  });
  if (error) throw error;
}

export async function getConnection() {
  const { data, error } = await supabase.from('linkedin_connection').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  let accessToken = decrypt(data.access_token);
  let refreshToken = data.refresh_token ? decrypt(data.refresh_token) : null;
  if (new Date(data.access_token_expires_at).getTime() < Date.now() + 5 * 60_000 && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken);
    accessToken = refreshed.access_token;
    refreshToken = refreshed.refresh_token || refreshToken;
    await saveConnection({ accessToken, refreshToken, expiresIn: refreshed.expires_in, refreshExpiresIn: refreshed.refresh_token_expires_in, personUrn: data.person_urn, name: data.name });
  }
  return { ...data, accessToken, refreshToken };
}

export async function wasPostedThisWeekend() {
  const { data, error } = await supabase.from('linkedin_posts').select('id').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

export async function logPost(post: { topic: string; text: string; linkedinId: string }) {
  const { error } = await supabase.from('linkedin_posts').insert({ topic: post.topic, content: post.text, linkedin_post_id: post.linkedinId });
  if (error) throw error;
}
