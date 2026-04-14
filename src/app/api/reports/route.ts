import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/** Round to 2 decimal places to avoid floating point accumulation errors */
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !["MANAGER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const userId = req.nextUrl.searchParams.get("userId") || undefined;
  const clientName = req.nextUrl.searchParams.get("client") || undefined;

  if (!from || !to) {
    return NextResponse.json({ error: "from and to required" }, { status: 400 });
  }

  const dateFilter = {
    date: { gte: new Date(from), lte: new Date(to) },
    ...(userId && { userId }),
    ...(clientName && { clientName }),
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
      where: { active: true, ...(userId && { id: userId }) },
      select: { id: true, name: true, email: true },
    }),
  ]);

  // Overview
  const totalHours = r2(entries.reduce((sum, e) => sum + e.hours, 0));
  const clientHours = r2(entries
    .filter((e) => e.category === "CLIENT_WORK")
    .reduce((sum, e) => sum + e.hours, 0));
  const usersWithEntries = new Set(entries.map((e) => e.userId));
  const uniqueClients = new Set(
    entries.filter((e) => e.clientName).map((e) => e.clientName)
  );

  // Compliance: per-person detail
  const complianceMap: Record<string, {
    name: string;
    hours: number;
    entries: number;
    daysActive: Set<string>;
    byCategory: Record<string, number>;
  }> = {};

  for (const u of users) {
    complianceMap[u.id] = {
      name: u.name ?? u.email,
      hours: 0,
      entries: 0,
      daysActive: new Set(),
      byCategory: {},
    };
  }

  for (const e of entries) {
    const uid = e.userId;
    if (!complianceMap[uid]) {
      complianceMap[uid] = {
        name: e.user.name ?? e.user.email ?? uid,
        hours: 0,
        entries: 0,
        daysActive: new Set(),
        byCategory: {},
      };
    }
    complianceMap[uid].hours = r2(complianceMap[uid].hours + e.hours);
    complianceMap[uid].entries += 1;
    complianceMap[uid].daysActive.add(e.date.toISOString().split("T")[0]);
    complianceMap[uid].byCategory[e.category] =
      r2((complianceMap[uid].byCategory[e.category] ?? 0) + e.hours);
  }

  const compliance = Object.values(complianceMap)
    .map((p) => ({
      name: p.name,
      hours: p.hours,
      entries: p.entries,
      daysActive: p.daysActive.size,
      clientHours: p.byCategory.CLIENT_WORK ?? 0,
      internalHours: p.byCategory.INTERNAL ?? 0,
      adminHours: p.byCategory.ADMIN ?? 0,
      trainingHours: p.byCategory.TRAINING ?? 0,
      billablePercent:
        p.hours > 0
          ? Math.round(((p.byCategory.CLIENT_WORK ?? 0) / p.hours) * 100)
          : 0,
    }))
    .sort((a, b) => b.hours - a.hours);

  // By project (grouped by clientName, not task)
  const byClientMap: Record<string, {
    hours: number;
    byType: Record<string, number>;
    people: Set<string>;
  }> = {};
  for (const e of entries) {
    if (e.category !== "CLIENT_WORK" || !e.clientName) continue;
    const key = e.clientName;
    if (!byClientMap[key])
      byClientMap[key] = { hours: 0, byType: {}, people: new Set() };
    byClientMap[key].hours = r2(byClientMap[key].hours + e.hours);
    byClientMap[key].people.add(e.userId);
    const typeName = e.workType?.name ?? "Other";
    byClientMap[key].byType[typeName] =
      r2((byClientMap[key].byType[typeName] ?? 0) + e.hours);
  }

  const byClient = Object.entries(byClientMap)
    .map(([name, data]) => ({
      name,
      hours: data.hours,
      byType: data.byType,
      peopleCount: data.people.size,
    }))
    .sort((a, b) => b.hours - a.hours);

  // By project+task detail (for deliverables table)
  const byDeliverableMap: Record<string, {
    client: string;
    task: string | null;
    hours: number;
    people: Set<string>;
    entries: number;
    byType: Record<string, number>;
  }> = {};
  for (const e of entries) {
    if (e.category !== "CLIENT_WORK" || !e.clientName) continue;
    const key = `${e.clientName}|||${e.asanaTaskName ?? "(no task)"}`;
    if (!byDeliverableMap[key])
      byDeliverableMap[key] = {
        client: e.clientName,
        task: e.asanaTaskName,
        hours: 0,
        people: new Set(),
        entries: 0,
        byType: {},
      };
    byDeliverableMap[key].hours = r2(byDeliverableMap[key].hours + e.hours);
    byDeliverableMap[key].people.add(e.userId);
    byDeliverableMap[key].entries += 1;
    const typeName = e.workType?.name ?? "Other";
    byDeliverableMap[key].byType[typeName] =
      r2((byDeliverableMap[key].byType[typeName] ?? 0) + e.hours);
  }

  const byDeliverable = Object.values(byDeliverableMap)
    .map((d) => ({
      client: d.client,
      task: d.task,
      hours: d.hours,
      peopleCount: d.people.size,
      entries: d.entries,
      topType:
        Object.entries(d.byType).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort((a, b) => b.hours - a.hours);

  // Category totals
  const categoryTotals: Record<string, number> = {};
  for (const e of entries) {
    categoryTotals[e.category] = r2((categoryTotals[e.category] ?? 0) + e.hours);
  }

  // Work type totals
  const workTypeTotals: Record<string, number> = {};
  for (const e of entries) {
    if (e.category === "CLIENT_WORK" && e.workType) {
      workTypeTotals[e.workType.name] =
        r2((workTypeTotals[e.workType.name] ?? 0) + e.hours);
    }
  }

  // Missing users
  const missingUsers = users.filter((u) => !usersWithEntries.has(u.id));

  return NextResponse.json({
    overview: {
      totalHours,
      clientHours,
      clientPercent:
        totalHours > 0 ? Math.round((clientHours / totalHours) * 100) : 0,
      activeUsers: usersWithEntries.size,
      totalUsers: users.length,
      totalClients: uniqueClients.size,
      avgDaily:
        usersWithEntries.size > 0
          ? Math.round((totalHours / usersWithEntries.size) * 10) / 10
          : 0,
    },
    compliance,
    byClient,
    byDeliverable,
    categoryTotals,
    workTypeTotals: Object.entries(workTypeTotals)
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours),
    missingUsers: missingUsers.map((u) => ({ name: u.name, email: u.email })),
  });
}
