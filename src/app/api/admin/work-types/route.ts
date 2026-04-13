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

  const workTypes = await prisma.workType.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(workTypes);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  const maxOrder = await prisma.workType.aggregate({ _max: { sortOrder: true } });

  const workType = await prisma.workType.create({
    data: { name, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json(workType, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, active } = await req.json();
  const workType = await prisma.workType.update({
    where: { id },
    data: { ...(name !== undefined && { name }), ...(active !== undefined && { active }) },
  });
  return NextResponse.json(workType);
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const count = await prisma.timeEntry.count({ where: { workTypeId: id } });
  if (count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${count} time entries use this work type.` },
      { status: 409 }
    );
  }
  await prisma.workType.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
