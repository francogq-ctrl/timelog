import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.json({ error, message: "Google auth failed" }, { status: 400 });
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  // Validate state against saved state in DB
  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "google" },
    select: { session_state: true },
  });

  if (!account || account.session_state !== state) {
    return NextResponse.json({ error: "Invalid state token" }, { status: 401 });
  }

  const origin = req.nextUrl.origin;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        code,
        redirect_uri: `${origin}/auth/calendar-callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.json({ error: "Token exchange failed" }, { status: 502 });
    }

    const tokens = (await tokenRes.json()) as GoogleTokenResponse;

    // Update account with new tokens
    await prisma.account.updateMany({
      where: { userId: session.user.id, provider: "google" },
      data: {
        access_token: tokens.access_token,
        ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
        expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
        scope: tokens.scope,
        session_state: null, // Clear state token
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Calendar callback error:", err);
    return NextResponse.json({ error: "Token exchange failed" }, { status: 500 });
  }
}
