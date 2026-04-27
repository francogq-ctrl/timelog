import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ valid: false }, { status: 400 });

  const config = await prisma.hubConfig.findUnique({ where: { token } });
  if (!config) return NextResponse.json({ valid: false }, { status: 401 });

  return NextResponse.json({ valid: true });
}
