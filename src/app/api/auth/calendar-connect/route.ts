import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = req.nextUrl.origin;

  // Generate a cryptographic CSRF state token
  const state = randomBytes(32).toString("hex");

  // Save state in account.session_state for validation later
  try {
    await prisma.account.updateMany({
      where: { userId: session.user.id, provider: "google" },
      data: { session_state: state },
    });
  } catch {
    return NextResponse.json({ error: "Failed to save state" }, { status: 500 });
  }

  // Build Google OAuth URL
  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!,
    redirect_uri: `${origin}/auth/calendar-callback`,
    scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    prompt: "consent",
    response_type: "code",
    state,
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  return NextResponse.redirect(googleAuthUrl);
}
