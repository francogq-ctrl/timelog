import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activities = await prisma.activity.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
  return NextResponse.json(activities);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, category } = await req.json();
  const maxOrder = await prisma.activity.aggregate({ _max: { sortOrder: true } });

  const activity = await prisma.activity.create({
    data: { name, category, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json(activity, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, active } = await req.json();
  const activity = await prisma.activity.update({
    where: { id },
    data: { ...(name !== undefined && { name }), ...(active !== undefined && { active }) },
  });
  return NextResponse.json(activity);
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, category } = await req.json();

  // Bulk delete all activities in a category
  if (category) {
    const used = await prisma.timeEntry.count({ where: { activity: { category } } });
    if (used > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${used} time entries use activities in this category.` },
        { status: 409 }
      );
    }
    await prisma.activity.deleteMany({ where: { category } });
    return NextResponse.json({ success: true });
  }

  // Single delete
  const count = await prisma.timeEntry.count({ where: { activityId: id } });
  if (count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${count} time entries use this activity.` },
      { status: 409 }
    );
  }
  await prisma.activity.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
