import { auth } from "@/lib/auth";
import { syncAsana } from "@/lib/asana-sync";
import { NextRequest, NextResponse } from "next/server";

// Vercel cron jobs use GET requests
export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("authorization");
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) {
    const result = await syncAsana();
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  // Allow cron jobs via secret or authenticated admin users
  const cronSecret = req.headers.get("authorization");
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) {
    const result = await syncAsana();
    return NextResponse.json(result);
  }

  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncAsana();
  return NextResponse.json(result);
}
