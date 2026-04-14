import { auth } from "@/lib/auth";
import { broadcastDM } from "@/lib/slack";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_MESSAGE = `Friendly ping!⏰
Don't forget to log your hours in the TimeLog app
 https://timelog-sable.vercel.app/`;

/**
 * GET/POST /api/cron/log-reminder
 *
 * Sends a daily Slack DM reminder to every user listed in SLACK_REMINDER_USERS
 * (comma-separated Slack user IDs, e.g. "U08FGPCEKQX,U0ACKQN5BRS,...").
 *
 * Auth:
 *  - Vercel Cron: Authorization: Bearer ${CRON_SECRET}
 *  - Manual (for testing): must be an authenticated ADMIN user in the app
 *
 * Phase 1 (current): reads recipient list from env var.
 * Phase 2 (future): pull active users with slackUserId from the Timelog DB,
 *   and skip anyone who has already logged a TimeEntry for today.
 */
async function handle(req: NextRequest) {
  const cronSecret = req.headers.get("authorization");
  const isCron = cronSecret === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const raw = process.env.SLACK_REMINDER_USERS ?? "";
  const userIds = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (userIds.length === 0) {
    return NextResponse.json(
      { error: "SLACK_REMINDER_USERS env var is empty" },
      { status: 400 },
    );
  }

  if (!process.env.SLACK_BOT_TOKEN) {
    return NextResponse.json(
      { error: "SLACK_BOT_TOKEN env var is not set" },
      { status: 400 },
    );
  }

  const summary = await broadcastDM(userIds, DEFAULT_MESSAGE);

  return NextResponse.json({
    ok: true,
    total: userIds.length,
    sent: summary.sent,
    failed: summary.failed,
    failures: summary.results.filter((r) => !r.ok),
    timestamp: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
