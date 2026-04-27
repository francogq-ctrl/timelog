import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const config = await prisma.hubConfig.findUnique({ where: { token } });
  if (!config) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { id } = await params;
  const snapshot = await prisma.reportSnapshot.findUnique({ where: { id } });
  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(snapshot);
}
