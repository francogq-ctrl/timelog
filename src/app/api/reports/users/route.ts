import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !["MANAGER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const includeHidden =
    session.user.role === "ADMIN" &&
    req.nextUrl.searchParams.get("includeHidden") === "1";

  const users = await prisma.user.findMany({
    where: {
      active: true,
      ...(includeHidden ? {} : { excludeFromReports: false }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json(users);
}
