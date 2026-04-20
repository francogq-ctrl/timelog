import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateReportData } from "@/lib/report-generator";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
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

  // Generate for the week that just ended (Mon–Fri)
  // Cron runs Friday 10pm EST — we want Mon–Fri of the current week
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });     // Sunday (use Friday)
  // Clamp to Friday if needed
  const friday = new Date(weekStart);
  friday.setDate(weekStart.getDate() + 4);

  const from = format(weekStart, "yyyy-MM-dd");
  const to = format(friday, "yyyy-MM-dd");

  const data = await generateReportData(from, to);

  const label = `Week of ${format(weekStart, "MMM d")}–${format(friday, "d, yyyy")}`;

  const snapshot = await prisma.reportSnapshot.create({
    data: {
      type: "WEEKLY",
      source: "AUTO",
      periodFrom: weekStart,
      periodTo: friday,
      label,
      data: data as object,
    },
  });

  return NextResponse.json({ ok: true, snapshotId: snapshot.id, label });
}

// Also support GET for Vercel cron (which uses GET)
export async function GET(req: NextRequest) {
  return POST(req);
}
