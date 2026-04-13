import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

interface ImportRow {
  person: string;
  date: string;
  client: string;
  task: string;
  category: string;
  workType: string;
  hours: number;
  notes: string;
}

const VALID_CATEGORIES = ["CLIENT_WORK", "INTERNAL", "ADMIN", "TRAINING"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !["MANAGER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rows }: { rows: ImportRow[] } = await req.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  // Pre-load all users and work types for lookup
  const [allUsers, allWorkTypes] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
    prisma.workType.findMany({ select: { id: true, name: true } }),
  ]);

  const userByName = new Map(
    allUsers.flatMap((u) => {
      const entries: [string, string][] = [];
      if (u.name) entries.push([u.name.toLowerCase(), u.id]);
      if (u.email) entries.push([u.email.toLowerCase(), u.id]);
      return entries;
    })
  );
  const workTypeByName = new Map(
    allWorkTypes.map((w) => [w.name.toLowerCase(), w.id])
  );

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed, +1 for header

    // Resolve userId
    const userId = userByName.get(row.person?.toLowerCase?.() ?? "");
    if (!userId) {
      errors.push(`Row ${rowNum}: Person "${row.person}" not found`);
      continue;
    }

    // Validate date
    const entryDate = new Date(row.date);
    if (isNaN(entryDate.getTime())) {
      errors.push(`Row ${rowNum}: Invalid date "${row.date}"`);
      continue;
    }

    // Validate category
    const category = row.category?.toUpperCase?.().replace(/ /g, "_") ?? "";
    if (!VALID_CATEGORIES.includes(category)) {
      errors.push(`Row ${rowNum}: Invalid category "${row.category}"`);
      continue;
    }

    // Validate hours
    const hours = Number(row.hours);
    if (!hours || hours <= 0 || hours % 0.25 !== 0) {
      errors.push(`Row ${rowNum}: Invalid hours "${row.hours}" (must be positive, in 0.25 increments)`);
      continue;
    }

    // Resolve workTypeId (optional)
    const workTypeId = row.workType
      ? (workTypeByName.get(row.workType.toLowerCase()) ?? null)
      : null;

    const clientName = row.client || null;

    // Deduplication check
    const existing = await prisma.timeEntry.findFirst({
      where: {
        userId,
        date: entryDate,
        hours,
        category: category as "CLIENT_WORK" | "INTERNAL" | "ADMIN" | "TRAINING",
        clientName,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.timeEntry.create({
      data: {
        userId,
        date: entryDate,
        category: category as "CLIENT_WORK" | "INTERNAL" | "ADMIN" | "TRAINING",
        clientName,
        asanaTaskName: row.task || null,
        workTypeId,
        hours,
        notes: row.notes || null,
      },
    });

    imported++;
  }

  return NextResponse.json({ imported, skipped, errors });
}
