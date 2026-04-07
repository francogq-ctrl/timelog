import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [workTypes, activities, asanaProjects] = await Promise.all([
    prisma.workType.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.activity.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, category: true },
    }),
    prisma.asanaProject.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, gid: true, name: true },
    }),
  ]);

  return NextResponse.json({ workTypes, activities, asanaProjects });
}
