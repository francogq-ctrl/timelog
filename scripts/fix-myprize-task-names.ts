/**
 * Fix MyPrize task names in Asana that don't follow the ANDG naming convention.
 *
 * Cleans up spacing irregularities like:
 *   "ANDG-MYPRIZE-UGC-JXYMIEN-APRIL- VIDEO-4"
 *   → "ANDG-MYPRIZE-UGC-JXYMIEN-APRIL-VIDEO-4"
 *
 * Source of truth is Asana, so the script PUTs renames to Asana's API.
 * The DB cache will refresh on the next sync.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/fix-myprize-task-names.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/fix-myprize-task-names.ts --apply  # apply
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { updateTaskName } from "../src/lib/asana";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const apply = process.argv.includes("--apply");

function normalizeTaskName(raw: string): string {
  return raw
    // Collapse spaces around dashes: "APRIL- VIDEO" → "APRIL-VIDEO"
    .replace(/\s*-\s*/g, "-")
    // Collapse internal multiple whitespace to single space
    .replace(/\s+/g, " ")
    // Collapse repeated dashes
    .replace(/-+/g, "-")
    .trim();
}

async function main() {
  // MyPrize projects (any project name containing "MyPrize" / "myprize")
  const projects = await prisma.asanaProject.findMany({
    where: {
      OR: [
        { name: { contains: "MyPrize", mode: "insensitive" } },
        { name: { contains: "myprize", mode: "insensitive" } },
      ],
    },
    select: { id: true, gid: true, name: true },
  });

  if (projects.length === 0) {
    console.log("No MyPrize projects found in cache.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${projects.length} MyPrize project(s):`);
  for (const p of projects) console.log(`  • ${p.name}`);
  console.log("---");

  const tasks = await prisma.asanaTask.findMany({
    where: { projectId: { in: projects.map((p) => p.id) } },
    select: { id: true, gid: true, name: true },
    orderBy: { name: "asc" },
  });

  const violations: { gid: string; old: string; new: string }[] = [];
  for (const t of tasks) {
    // Only touch ANDG-prefixed tasks to avoid breaking regular titles
    // that have intentional spaces around dashes (e.g. "Feb. Week 2 - AI Streamers")
    if (!/^ANDG-/i.test(t.name)) continue;
    const normalized = normalizeTaskName(t.name);
    if (normalized !== t.name) {
      violations.push({ gid: t.gid, old: t.name, new: normalized });
    }
  }

  console.log(
    `Scanned ${tasks.length} tasks · ${violations.length} need fixing`,
  );
  if (violations.length === 0) {
    console.log("Nothing to do. ✅");
    await prisma.$disconnect();
    return;
  }

  console.log("\nPlan:");
  for (const v of violations) {
    console.log(`  ${v.old}`);
    console.log(`  → ${v.new}\n`);
  }

  if (!apply) {
    console.log(
      `Dry run only. Re-run with --apply to push these renames to Asana.`,
    );
    await prisma.$disconnect();
    return;
  }

  console.log("\nApplying renames in Asana...");
  let ok = 0;
  let failed = 0;
  for (const v of violations) {
    try {
      await updateTaskName(v.gid, v.new);
      console.log(`  ✓ ${v.new}`);
      ok++;
    } catch (e) {
      console.error(
        `  ✗ ${v.gid}: ${e instanceof Error ? e.message : String(e)}`,
      );
      failed++;
    }
  }

  console.log(`\nDone. ${ok} renamed · ${failed} failed.`);
  console.log(
    `Cache will refresh on the next /api/asana/sync run (≤5 min) or trigger it manually.`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
