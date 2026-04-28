/**
 * Bulk-populate slackUserId for users based on the AND Gather Slack workspace mapping.
 *
 * Source of truth: SLACK-BOT-SETUP.md (the 21 users documented for the daily reminder).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/populate-slack-ids.ts          # dry run, prints the plan
 *   npx tsx --env-file=.env.local scripts/populate-slack-ids.ts --apply  # writes to DB
 *
 * Matching: case-insensitive substring match on `name` first, then on email
 * local part. Ambiguous matches are skipped and printed for manual review.
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SLACK_MAPPING: { slackId: string; match: string }[] = [
  { slackId: "U08FGPCEKQX", match: "chelsea" },
  { slackId: "U0ACKQN5BRS", match: "ignacio" },
  { slackId: "U0AHY1ULDML", match: "john ty" },
  { slackId: "U09QWA6FK53", match: "agustina" },
  { slackId: "U071S7EJ0PQ", match: "saul" },
  { slackId: "U0A78LZ14R2", match: "juan" },
  { slackId: "U08L1S6PG9K", match: "raniel" },
  { slackId: "U099HP6STKR", match: "camilee" },
  { slackId: "U0ASNMMNJ68", match: "conor" },
  { slackId: "U09JB8REWJY", match: "manuel" },
  { slackId: "U09US12HS1H", match: "ailen" },
  { slackId: "U0ACE235Y14", match: "raphael" },
  { slackId: "U08EUS30QJY", match: "hermerson" },
  { slackId: "U09RFCSRTU6", match: "nacho peña" },
  { slackId: "U098ZBXHA2H", match: "jericho" },
  { slackId: "U097P05MY7J", match: "hayes" },
  { slackId: "U0AM6AXCS7M", match: "franco" },
  { slackId: "U09K18J0T3M", match: "bruno" },
  { slackId: "U0AEA89C42Z", match: "phil" },
  { slackId: "U0AU6TBRWFN", match: "debbie" },
  { slackId: "U0ATV5JRPFV", match: "stephanie" },
];

const apply = process.argv.includes("--apply");

async function main() {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true, slackUserId: true },
    orderBy: { name: "asc" },
  });

  console.log(`Active users in DB: ${users.length}`);
  console.log(`Slack mappings to try: ${SLACK_MAPPING.length}`);
  console.log("---");

  const plan: { user: (typeof users)[number]; slackId: string }[] = [];
  const unmatchedSlack: typeof SLACK_MAPPING = [];
  const unmatchedDb = new Set(users.map((u) => u.id));

  for (const m of SLACK_MAPPING) {
    const candidates = users.filter((u) => {
      const haystack = `${u.name ?? ""} ${u.email.split("@")[0]}`.toLowerCase();
      return haystack.includes(m.match);
    });

    if (candidates.length === 0) {
      unmatchedSlack.push(m);
    } else if (candidates.length > 1) {
      console.log(
        `⚠️  Ambiguous match for "${m.match}" (${m.slackId}): ${candidates
          .map((c) => c.email)
          .join(", ")} — skipping`,
      );
    } else {
      const u = candidates[0];
      plan.push({ user: u, slackId: m.slackId });
      unmatchedDb.delete(u.id);
    }
  }

  console.log("\nPlan:");
  for (const p of plan) {
    const status =
      p.user.slackUserId === p.slackId
        ? "= already set"
        : p.user.slackUserId
          ? `~ change ${p.user.slackUserId} -> ${p.slackId}`
          : `+ set ${p.slackId}`;
    console.log(`  ${(p.user.name ?? p.user.email).padEnd(28)}  ${status}`);
  }

  if (unmatchedSlack.length > 0) {
    console.log("\nSlack IDs with NO matching DB user:");
    for (const m of unmatchedSlack) {
      console.log(`  - "${m.match}" (${m.slackId})`);
    }
  }

  if (unmatchedDb.size > 0) {
    console.log("\nActive DB users with NO matching Slack ID (set manually):");
    for (const u of users.filter((u) => unmatchedDb.has(u.id))) {
      console.log(`  - ${u.email} (${u.name ?? "no name"})`);
    }
  }

  if (!apply) {
    console.log(
      "\nDry run only. Re-run with --apply to write these changes to the DB.",
    );
    await prisma.$disconnect();
    return;
  }

  console.log("\nApplying...");
  for (const p of plan) {
    if (p.user.slackUserId === p.slackId) continue;
    await prisma.user.update({
      where: { id: p.user.id },
      data: { slackUserId: p.slackId },
    });
    console.log(`  ✓ ${p.user.email} -> ${p.slackId}`);
  }
  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
