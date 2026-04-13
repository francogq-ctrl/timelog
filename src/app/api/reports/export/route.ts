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
  const userId = req.nextUrl.searchParams.get("userId") || undefined;
  const clientName = req.nextUrl.searchParams.get("client") || undefined;

  if (!from || !to) {
    return NextResponse.json({ error: "from and to required" }, { status: 400 });
  }

  const entries = await prisma.timeEntry.findMany({
    where: {
      date: { gte: new Date(from), lte: new Date(to) },
      ...(userId && { userId }),
      ...(clientName && { clientName }),
    },
    include: {
      user: { select: { name: true, email: true } },
      workType: { select: { name: true } },
      activity: { select: { name: true } },
    },
    orderBy: [{ user: { name: "asc" } }, { date: "asc" }],
  });

  const projectGids = [...new Set(entries.map((e) => e.asanaProjectId).filter(Boolean))] as string[];
  const asanaProjects = await prisma.asanaProject.findMany({
    where: { gid: { in: projectGids } },
    select: { gid: true, name: true },
  });
  const projectNameByGid = new Map(asanaProjects.map((p) => [p.gid, p.name]));

  const rows = entries.map((e) => {
    const asanaProjectName = e.asanaProjectId ? projectNameByGid.get(e.asanaProjectId) : undefined;
    const clientCol = asanaProjectName
      ? asanaProjectName.replace(/\s*\[\d{4}\]\s*$/, "").trim()
      : e.clientName ?? "";
    const projectCol = asanaProjectName ?? e.clientName ?? "";

    return {
      person: e.user.name ?? e.user.email ?? e.userId,
      date: e.date.toISOString().split("T")[0],
      client: clientCol,
      project: projectCol,
      task: e.asanaTaskName ?? e.activity?.name ?? e.description ?? "",
      category: e.category,
      workType: e.workType?.name ?? "",
      hours: e.hours,
      notes: e.notes ?? "",
    };
  });

  return NextResponse.json({ rows });
}
