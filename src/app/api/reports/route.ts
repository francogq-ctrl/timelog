import { auth } from "@/lib/auth";
import { generateReportData } from "@/lib/report-generator";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !["MANAGER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const userId = req.nextUrl.searchParams.get("userId") || undefined;
  const clientName = req.nextUrl.searchParams.get("client") || undefined;
  const includeHidden =
    session.user.role === "ADMIN" &&
    req.nextUrl.searchParams.get("includeHidden") === "1";

  if (!from || !to) {
    return NextResponse.json({ error: "from and to required" }, { status: 400 });
  }

  const data = await generateReportData(from, to, {
    userId,
    clientName,
    includeHidden,
  });
  return NextResponse.json(data);
}
