import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateReportData } from "@/lib/report-generator";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, from, to, label } = await req.json() as {
    type: "WEEKLY" | "MONTHLY";
    from: string;
    to: string;
    label: string;
  };

  if (!type || !from || !to || !label) {
    return NextResponse.json({ error: "type, from, to and label required" }, { status: 400 });
  }

  const data = await generateReportData(from, to);

  const snapshot = await prisma.reportSnapshot.create({
    data: {
      type,
      source: "MANUAL",
      periodFrom: new Date(from),
      periodTo: new Date(to),
      label,
      data: data as object,
    },
  });

  return NextResponse.json({ ok: true, snapshotId: snapshot.id, label });
}
