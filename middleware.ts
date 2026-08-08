import { NextRequest, NextResponse } from "next/server";

const COOKIE = "cryptopulse_session";

function base64UrlToString(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}
function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
async function verifySession(token: string | undefined) {
  if (!token) return false;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return false;
  try {
    const payload = base64UrlToString(encoded);
    const [, expiresText] = payload.split(":");
    const expires = Number(expiresText);
    if (!payload.startsWith("cryptopulse:") || !Number.isFinite(expires) || Date.now() > expires) return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    return crypto.subtle.verify("HMAC", key, hexToBytes(signature), new TextEncoder().encode(payload));
  } catch { return false; }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/login" || pathname === "/favicon.ico" || pathname.startsWith("/_next/") || pathname === "/api/auth/login" || pathname === "/api/auth/logout") return NextResponse.next();
  const valid = await verifySession(request.cookies.get(COOKIE)?.value);
  if (valid) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
