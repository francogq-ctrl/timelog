import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
