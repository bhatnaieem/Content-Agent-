import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "cryptopulse_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be set and at least 32 characters long.");
  return value;
}

export function createSessionToken() {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `cryptopulse:${expires}`;
  const signature = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

export function verifySessionToken(token?: string | null) {
  if (!token) return false;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return false;
  try {
    const payload = Buffer.from(encoded, "base64url").toString("utf8");
    const [, expiresText] = payload.split(":");
    const expires = Number(expiresText);
    if (!payload.startsWith("cryptopulse:") || !Number.isFinite(expires) || Date.now() > expires) return false;
    const expected = createHmac("sha256", secret()).update(payload).digest("hex");
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function passwordIsValid(password: string) {
  const configured = process.env.AUTH_PASSWORD;
  if (!configured || !password) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(configured);
  return a.length === b.length && timingSafeEqual(a, b);
}
