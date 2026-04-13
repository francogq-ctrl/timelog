import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "Date required" }, { status: 400 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const requestedUserId = req.nextUrl.searchParams.get("userId");
  const targetUserId = isAdmin && requestedUserId ? requestedUserId : session.user.id;

  const entries = await prisma.timeEntry.findMany({
    where: {
      userId: targetUserId,
      date: new Date(date),
    },
    include: {
      workType: { select: { id: true, name: true } },
      activity: { select: { id: true, name: true, category: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await req.json();

  // Validate hours
  if (!data.hours || data.hours <= 0 || data.hours % 0.25 !== 0) {
    return NextResponse.json(
      { error: "Hours must be positive and in 0.25 increments" },
      { status: 400 }
    );
  }

  // Validate date within last 7 days
  const entryDate = new Date(data.date);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  if (entryDate < sevenDaysAgo) {
    return NextResponse.json(
      { error: "Cannot log entries older than 7 days" },
      { status: 400 }
    );
  }

  const isAdmin = session.user.role === "ADMIN";
  const targetUserId = isAdmin && data.userId ? data.userId : session.user.id;

  const entry = await prisma.timeEntry.create({
    data: {
      userId: targetUserId,
      date: entryDate,
      category: data.category,
      clientName: data.clientName || null,
      asanaProjectId: data.asanaProjectId || null,
      asanaTaskId: data.asanaTaskId || null,
      asanaTaskName: data.asanaTaskName || null,
      workTypeId: data.workTypeId || null,
      activityId: data.activityId || null,
      description: data.description || null,
      hours: data.hours,
      notes: data.notes || null,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
