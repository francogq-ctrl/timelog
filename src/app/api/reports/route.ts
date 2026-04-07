import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !["MANAGER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "from and to required" }, { status: 400 });
  }

  const dateFilter = {
    date: { gte: new Date(from), lte: new Date(to) },
  };

  const [entries, users] = await Promise.all([
    prisma.timeEntry.findMany({
      where: dateFilter,
      include: {
        user: { select: { id: true, name: true, email: true } },
        workType: { select: { name: true } },
        activity: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true },
    }),
  ]);

  // Overview stats
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const clientHours = entries
    .filter((e) => e.category === "CLIENT_WORK")
    .reduce((sum, e) => sum + e.hours, 0);
  const usersWithEntries = new Set(entries.map((e) => e.userId));

  // By project
  const byProject: Record<string, { hours: number; byType: Record<string, number>; people: Set<string> }> = {};
  for (const e of entries) {
    if (e.category !== "CLIENT_WORK" || !e.clientName) continue;
    const key = e.asanaTaskName ? `${e.clientName} — ${e.asanaTaskName}` : e.clientName;
    if (!byProject[key]) byProject[key] = { hours: 0, byType: {}, people: new Set() };
    byProject[key].hours += e.hours;
    byProject[key].people.add(e.userId);
    const typeName = e.workType?.name ?? "Other";
    byProject[key].byType[typeName] = (byProject[key].byType[typeName] ?? 0) + e.hours;
  }

  // By person
  const byPerson: Record<string, { name: string; total: number; byCategory: Record<string, number> }> = {};
  for (const e of entries) {
    const uid = e.userId;
    if (!byPerson[uid]) {
      byPerson[uid] = { name: e.user.name ?? e.user.email ?? uid, total: 0, byCategory: {} };
    }
    byPerson[uid].total += e.hours;
    byPerson[uid].byCategory[e.category] = (byPerson[uid].byCategory[e.category] ?? 0) + e.hours;
  }

  // Compliance: who hasn't logged
  const missingUsers = users.filter((u) => !usersWithEntries.has(u.id));

  return NextResponse.json({
    overview: {
      totalHours,
      clientHours,
      clientPercent: totalHours > 0 ? Math.round((clientHours / totalHours) * 100) : 0,
      activeUsers: usersWithEntries.size,
      totalUsers: users.length,
      avgDaily: totalHours > 0 ? Math.round((totalHours / usersWithEntries.size) * 10) / 10 : 0,
    },
    byProject: Object.entries(byProject)
      .map(([name, data]) => ({
        name,
        hours: data.hours,
        byType: data.byType,
        peopleCount: data.people.size,
      }))
      .sort((a, b) => b.hours - a.hours),
    byPerson: Object.values(byPerson).sort((a, b) => b.total - a.total),
    missingUsers: missingUsers.map((u) => ({ name: u.name, email: u.email })),
  });
}
