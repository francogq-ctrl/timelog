import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const { id } = await params;
  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry || (entry.userId !== session.user.id && !isAdmin)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = await req.json();

  const updated = await prisma.timeEntry.update({
    where: { id },
    data: {
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

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const { id } = await params;
  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry || (entry.userId !== session.user.id && !isAdmin)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.timeEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
