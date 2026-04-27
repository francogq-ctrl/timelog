import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const config = await prisma.hubConfig.findUnique({ where: { token } });
  if (!config) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const snapshots = await prisma.reportSnapshot.findMany({
    select: {
      id: true,
      type: true,
      source: true,
      label: true,
      periodFrom: true,
      periodTo: true,
      generatedAt: true,
    },
    orderBy: { generatedAt: "desc" },
  });

  return NextResponse.json(snapshots);
}
