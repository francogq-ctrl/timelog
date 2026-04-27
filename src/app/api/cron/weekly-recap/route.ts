import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  generatePersonalRecap,
  generateTeamRecap,
} from "@/lib/recap-generator";
import {
  formatPersonalRecap,
  formatTeamRecap,
} from "@/lib/recap-formatter";
import { postSlackMessage } from "@/lib/slack";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET/POST /api/cron/weekly-recap
 *
 * Sends two weekly recaps every Friday:
 *   1) Personal Recap — Slack DM to each active user with a slackUserId
 *   2) Team Recap     — channel post in SLACK_TEAM_CHANNEL (default #general)
 *
 * Auth:
 *   - Vercel Cron: Authorization: Bearer ${CRON_SECRET}
 *   - Manual (testing): authenticated ADMIN user
 *
 * Soft launch:
 *   - If SLACK_RECAP_SOFT_LAUNCH is set (comma-separated Slack user IDs),
 *     personal DMs only go to those IDs and the team channel post is skipped.
 *   - Leave unset for full broadcast.
 *
 * Dry run:
 *   - Append ?dryRun=true to skip sending anything to Slack and instead
 *     return the rendered messages as JSON. Useful for previewing.
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

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "true";

  if (!dryRun && !process.env.SLACK_BOT_TOKEN) {
    return NextResponse.json(
      { error: "SLACK_BOT_TOKEN env var is not set" },
      { status: 400 },
    );
  }

  const softLaunchRaw = process.env.SLACK_RECAP_SOFT_LAUNCH ?? "";
  const softLaunchIds = softLaunchRaw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const softLaunch = softLaunchIds.length > 0;

  const teamChannel = process.env.SLACK_TEAM_CHANNEL ?? "#general";
  const referenceDate = new Date();

  const usersWithSlack = await prisma.user.findMany({
    where: { active: true, slackUserId: { not: null } },
    select: { id: true, slackUserId: true },
  });

  const recipients = softLaunch
    ? usersWithSlack.filter(
        (u) => u.slackUserId && softLaunchIds.includes(u.slackUserId),
      )
    : usersWithSlack;

  const personalResults: Array<{
    userId: string;
    slackId: string;
    ok: boolean;
    error?: string;
    preview?: string;
  }> = [];

  for (const u of recipients) {
    if (!u.slackUserId) continue;
    const data = await generatePersonalRecap(u.id, referenceDate);
    if (!data) {
      personalResults.push({
        userId: u.id,
        slackId: u.slackUserId,
        ok: false,
        error: "no_user_data",
      });
      continue;
    }
    const text = formatPersonalRecap(data, referenceDate);
    if (dryRun) {
      personalResults.push({
        userId: u.id,
        slackId: u.slackUserId,
        ok: true,
        preview: text,
      });
      continue;
    }
    const r = await postSlackMessage(u.slackUserId, text);
    personalResults.push({
      userId: u.id,
      slackId: u.slackUserId,
      ok: r.ok,
      error: r.ok ? undefined : r.error,
    });
  }

  const teamData = await generateTeamRecap(referenceDate);
  const teamText = formatTeamRecap(teamData);

  let teamResult: {
    ok: boolean;
    error?: string;
    skipped?: boolean;
    preview?: string;
  } = { ok: false, skipped: true };

  if (dryRun) {
    teamResult = { ok: true, skipped: true, preview: teamText };
  } else if (!softLaunch) {
    const r = await postSlackMessage(teamChannel, teamText);
    teamResult = r.ok ? { ok: true } : { ok: false, error: r.error };
  } else {
    for (const slackId of softLaunchIds) {
      const previewText = `🧪 *[Soft-launch preview — would post to ${teamChannel}]*\n\n${teamText}`;
      await postSlackMessage(slackId, previewText);
    }
    teamResult = { ok: true, skipped: true };
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    softLaunch,
    personal: {
      total: recipients.length,
      sent: personalResults.filter((r) => r.ok && !r.preview).length,
      failed: personalResults.filter((r) => !r.ok).length,
      previewed: personalResults.filter((r) => r.preview).length,
      results: personalResults,
    },
    team: teamResult,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
