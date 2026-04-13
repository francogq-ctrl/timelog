import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const workTypeCount = await prisma.workType.count();
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, active: true },
    });
    const accounts = await prisma.account.findMany({
      select: { userId: true, provider: true, type: true },
    });
    return NextResponse.json({
      status: "ok",
      db: "connected",
      users,
      accounts,
      workTypes: workTypeCount,
      authGoogleId: process.env.AUTH_GOOGLE_ID ? "set" : "missing",
      authSecret: process.env.AUTH_SECRET ? "set" : "missing",
      dbUrl: process.env.DATABASE_URL?.replace(/\/\/.*@/, "//***@"),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        status: "error",
        error: message,
        dbUrl: process.env.DATABASE_URL?.replace(/\/\/.*@/, "//***@"),
      },
      { status: 500 }
    );
  }
}
