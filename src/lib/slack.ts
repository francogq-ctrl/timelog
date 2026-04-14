/**
 * Slack Web API helper for sending DMs from the TimeLog bot.
 *
 * Auth: uses SLACK_BOT_TOKEN (bot-scoped xoxb-... token) from env.
 * Required bot scopes: chat:write, im:write
 *
 * To DM a user, pass their Slack user ID (U0XXXXXXX) as the channel.
 * Slack auto-opens the DM conversation on the bot's behalf.
 */

const SLACK_API = "https://slack.com/api";

export type SlackPostResult =
  | { ok: true; ts: string; channel: string }
  | { ok: false; error: string };

export async function postSlackMessage(
  userIdOrChannel: string,
  text: string,
): Promise<SlackPostResult> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "SLACK_BOT_TOKEN is not set" };
  }

  try {
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: userIdOrChannel,
        text,
        // Keep markdown-style rendering (default true, but explicit for clarity)
        mrkdwn: true,
        unfurl_links: false,
      }),
    });

    const data = (await res.json()) as {
      ok: boolean;
      ts?: string;
      channel?: string;
      error?: string;
    };

    if (!data.ok) {
      return { ok: false, error: data.error ?? "unknown_slack_error" };
    }

    return { ok: true, ts: data.ts ?? "", channel: data.channel ?? "" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "fetch_failed",
    };
  }
}

/**
 * Send the same message to a list of Slack user IDs.
 * Returns a summary with per-user results.
 */
export async function broadcastDM(
  userIds: string[],
  text: string,
): Promise<{
  sent: number;
  failed: number;
  results: Array<{ userId: string; ok: boolean; error?: string }>;
}> {
  const results: Array<{ userId: string; ok: boolean; error?: string }> = [];

  for (const userId of userIds) {
    const r = await postSlackMessage(userId, text);
    if (r.ok) {
      results.push({ userId, ok: true });
    } else {
      results.push({ userId, ok: false, error: r.error });
    }
  }

  return {
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
