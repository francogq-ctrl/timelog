import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function generateToken() {
  return randomBytes(32).toString("hex");
}

async function getOrCreateConfig() {
  const existing = await prisma.hubConfig.findFirst();
  if (existing) return existing;
  return prisma.hubConfig.create({ data: { token: generateToken() } });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getOrCreateConfig();
  return NextResponse.json({ token: config.token });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, snapshotId } = await req.json();

  if (action === "regenerate") {
    const existing = await prisma.hubConfig.findFirst();
    const newToken = generateToken();
    const config = existing
      ? await prisma.hubConfig.update({ where: { id: existing.id }, data: { token: newToken } })
      : await prisma.hubConfig.create({ data: { token: newToken } });
    return NextResponse.json({ token: config.token });
  }

  if (action === "delete" && snapshotId) {
    await prisma.reportSnapshot.delete({ where: { id: snapshotId } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
