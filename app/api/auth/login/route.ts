import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, passwordIsValid, SESSION_COOKIE } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    let password = "";
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const raw = await request.text();
      if (raw) {
        try {
          const body = JSON.parse(raw) as { password?: unknown };
          password = typeof body.password === "string" ? body.password : "";
        } catch {
          return NextResponse.json({ error: "Invalid request format" }, { status: 400 });
        }
      }
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const value = form.get("password");
      password = typeof value === "string" ? value : "";
    }

    if (!password) {
      return NextResponse.json({ error: "Please enter your workspace password." }, { status: 400 });
    }

    if (!process.env.AUTH_PASSWORD || !process.env.AUTH_SECRET) {
      console.error("Authentication is not configured: AUTH_PASSWORD and AUTH_SECRET are required.");
      return NextResponse.json({ error: "Authentication is not configured on this deployment." }, { status: 503 });
    }

    if (process.env.AUTH_SECRET.length < 32) {
      console.error("AUTH_SECRET must be at least 32 characters long.");
      return NextResponse.json({ error: "Authentication secret is misconfigured." }, { status: 503 });
    }

    if (!passwordIsValid(password)) {
      return NextResponse.json({ error: "Incorrect workspace password." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: createSessionToken(),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Unable to process login request." }, { status: 500 });
  }
}
