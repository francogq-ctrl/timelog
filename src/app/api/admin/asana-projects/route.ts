import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.asanaProject.findMany({
    orderBy: { name: "asc" },
    select: { id: true, gid: true, name: true, active: true, lastSynced: true },
  });
  return NextResponse.json(projects);
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, active } = await req.json();
  const project = await prisma.asanaProject.update({
    where: { id },
    data: { active },
  });
  return NextResponse.json(project);
}

// Delete a single project or purge all inactive ones
export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, purgeInactive } = await req.json();

  if (purgeInactive) {
    const result = await prisma.asanaProject.deleteMany({ where: { active: false } });
    return NextResponse.json({ deleted: result.count });
  }

  await prisma.asanaProject.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
