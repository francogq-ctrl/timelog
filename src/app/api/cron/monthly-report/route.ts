import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateReportData } from "@/lib/report-generator";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (authHeader !== `Bearer ${cronSecret}`) {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Cron runs 1st of each month at 3am UTC (= 10pm EST last day of prev month)
  // Generate for the previous month
  const prevMonth = subMonths(new Date(), 1);
  const monthStart = startOfMonth(prevMonth);
  const monthEnd = endOfMonth(prevMonth);

  const from = format(monthStart, "yyyy-MM-dd");
  const to = format(monthEnd, "yyyy-MM-dd");

  const data = await generateReportData(from, to);

  const label = format(prevMonth, "MMMM yyyy");

  const snapshot = await prisma.reportSnapshot.create({
    data: {
      type: "MONTHLY",
      source: "AUTO",
      periodFrom: monthStart,
      periodTo: monthEnd,
      label,
      data: data as object,
    },
  });

  return NextResponse.json({ ok: true, snapshotId: snapshot.id, label });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
