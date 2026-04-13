import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekStart = req.nextUrl.searchParams.get("weekStart");
  if (!weekStart) {
    return NextResponse.json({ error: "weekStart required" }, { status: 400 });
  }

  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const isAdmin = session.user.role === "ADMIN";
  const requestedUserId = req.nextUrl.searchParams.get("userId");
  const targetUserId = isAdmin && requestedUserId ? requestedUserId : session.user.id;

  const entries = await prisma.timeEntry.findMany({
    where: {
      userId: targetUserId,
      date: { gte: start, lt: end },
    },
    select: { date: true, hours: true },
  });

  // Group by day of week (0=Mon .. 6=Sun)
  const hoursByDay = [0, 0, 0, 0, 0, 0, 0];
  for (const entry of entries) {
    const dayOfWeek = (entry.date.getDay() + 6) % 7; // Convert Sun=0 to Mon=0
    hoursByDay[dayOfWeek] += entry.hours;
  }

  return NextResponse.json(hoursByDay);
}
