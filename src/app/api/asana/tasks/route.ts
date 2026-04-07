import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectGid = req.nextUrl.searchParams.get("projectGid");
  if (!projectGid) {
    return NextResponse.json({ error: "projectGid required" }, { status: 400 });
  }

  const tasks = await prisma.asanaTask.findMany({
    where: {
      project: { gid: projectGid },
      completed: false,
    },
    orderBy: { name: "asc" },
    select: { id: true, gid: true, name: true },
  });

  return NextResponse.json(tasks);
}
