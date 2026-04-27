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

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      image: true,
      slackUserId: true,
      weeklyContractHours: true,
    },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, name, role, slackUserId, weeklyContractHours } = await req.json();
  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: role || "MEMBER",
      ...(slackUserId !== undefined && { slackUserId: slackUserId || null }),
      ...(weeklyContractHours !== undefined && { weeklyContractHours }),
    },
  });
  return NextResponse.json(user, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, role, active, slackUserId, weeklyContractHours } = await req.json();
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(role !== undefined && { role }),
      ...(active !== undefined && { active }),
      ...(slackUserId !== undefined && { slackUserId: slackUserId || null }),
      ...(weeklyContractHours !== undefined && { weeklyContractHours }),
    },
  });
  return NextResponse.json(user);
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
