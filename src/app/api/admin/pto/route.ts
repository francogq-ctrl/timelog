import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

function parseUtcDate(s: string): Date {
  return new Date(s + "T00:00:00.000Z");
}

function expandWorkdays(start: Date, end: Date, skipWeekends: boolean): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getUTCDay();
    if (!skipWeekends || (dow !== 0 && dow !== 6)) {
      days.push(new Date(cur));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, startDate, endDate, hoursPerDay = 8, skipWeekends = true, notes } = await req.json();

  if (!userId || !startDate || !endDate) {
    return NextResponse.json({ error: "userId, startDate, endDate required" }, { status: 400 });
  }
  if (hoursPerDay <= 0 || hoursPerDay % 0.25 !== 0) {
    return NextResponse.json({ error: "hoursPerDay must be positive and in 0.25 increments" }, { status: 400 });
  }

  const start = parseUtcDate(startDate);
  const end = parseUtcDate(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date format (use YYYY-MM-DD)" }, { status: 400 });
  }
  if (end < start) {
    return NextResponse.json({ error: "endDate must be on or after startDate" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const days = expandWorkdays(start, end, skipWeekends);
  if (days.length === 0) {
    return NextResponse.json({ error: "No workdays in range" }, { status: 400 });
  }

  const existing = await prisma.timeEntry.findMany({
    where: { userId, date: { in: days }, category: "TIME_OFF" },
    select: { date: true },
  });
  const existingKeys = new Set(existing.map((e) => e.date.toISOString().slice(0, 10)));

  const toCreate = days.filter((d) => !existingKeys.has(d.toISOString().slice(0, 10)));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.timeEntry as any).createMany({
    data: toCreate.map((d) => ({
      userId,
      date: d,
      category: "TIME_OFF",
      hours: hoursPerDay,
      notes: notes || null,
    })),
  });

  return NextResponse.json({
    created: toCreate.length,
    skipped: days.length - toCreate.length,
    days: days.map((d) => d.toISOString().slice(0, 10)),
  }, { status: 201 });
}
