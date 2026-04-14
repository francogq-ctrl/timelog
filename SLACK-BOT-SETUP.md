# Slack Bot Setup — TimeLog Reminder

This guide walks through creating a Slack bot that sends the daily time-log reminder, replacing the Claude-based automation so reminders come from a bot account, not Franco's personal Slack.

**Estimated time:** 15–25 minutes.

---

## Overview

The flow becomes:

```
Vercel Cron (weekdays 4:50 PM ET)
        ↓
POST /api/cron/log-reminder  (protected by CRON_SECRET)
        ↓
Slack Web API → DMs sent by "TimeLog Reminder" bot
```

Nothing depends on Franco's Slack session anymore.

---

## Part 1 — Create the Slack app & bot

1. Go to <https://api.slack.com/apps> and click **Create New App** → **From scratch**.
2. Name: `TimeLog Reminder` · Workspace: `AND Gather` · click **Create App**.
3. Left sidebar → **OAuth & Permissions**.
4. Scroll to **Scopes** → **Bot Token Scopes** → **Add an OAuth Scope** and add these three:
   - `chat:write` — send messages
   - `im:write` — open DMs with users
   - `users:read` — (optional, for future smarter logic)
5. Scroll up → click **Install to AND Gather** → authorize.
6. After install, copy the **Bot User OAuth Token** (starts with `xoxb-`). You'll use this as `SLACK_BOT_TOKEN`.
7. Left sidebar → **App Home** → toggle on **Messages Tab** and check **Allow users to send Slash commands and messages from the messages tab** (optional, but makes the bot a real user).
8. Left sidebar → **Basic Information** → under **Display Information**, set:
   - **App name:** TimeLog Reminder
   - **Short description:** Daily ping to log your hours in TimeLog
   - **App icon:** upload a clock emoji or TimeLog logo
   - **Background color:** whatever matches AND Gather brand

---

## Part 2 — Add env vars in Vercel

Go to **Vercel → timelog project → Settings → Environment Variables** and add:

| Variable | Value | Environments |
|---|---|---|
| `SLACK_BOT_TOKEN` | `xoxb-...` (from step 6 above) | Production, Preview, Development |
| `SLACK_REMINDER_USERS` | comma-separated Slack user IDs, see below | Production, Preview, Development |

`CRON_SECRET` is already set (used by the Asana cron) — reuse it, don't change it.

### Current reminder list (19 users)

Paste this exactly as the value for `SLACK_REMINDER_USERS`:

```
U08FGPCEKQX,U0ACKQN5BRS,U0AHY1ULDML,U09QWA6FK53,U071S7EJ0PQ,U0A78LZ14R2,U08L1S6PG9K,U099HP6STKR,U0ASNMMNJ68,U09JB8REWJY,U09US12HS1H,U0ACE235Y14,U08EUS30QJY,U09RFCSRTU6,U098ZBXHA2H,U097P05MY7J,U0AM6AXCS7M,U09K18J0T3M,U0AEA89C42Z
```

Which maps to:

| # | Name | Slack ID |
|---|---|---|
| 1 | Chelsea Cheng | U08FGPCEKQX |
| 2 | Ignacio | U0ACKQN5BRS |
| 3 | John Ty | U0AHY1ULDML |
| 4 | Agustina Rezola | U09QWA6FK53 |
| 5 | Saul | U071S7EJ0PQ |
| 6 | Juan | U0A78LZ14R2 |
| 7 | Raniel | U08L1S6PG9K |
| 8 | Camilee Naidoo | U099HP6STKR |
| 9 | Conor | U0ASNMMNJ68 |
| 10 | Manuel Behrens | U09JB8REWJY |
| 11 | Ailen Jarkoswky | U09US12HS1H |
| 12 | Raphael | U0ACE235Y14 |
| 13 | Hermerson Hernandez | U08EUS30QJY |
| 14 | Nacho Peña | U09RFCSRTU6 |
| 15 | Jericho Dris | U098ZBXHA2H |
| 16 | Hayes Gotsick | U097P05MY7J |
| 17 | Franco Garcia Quevedo | U0AM6AXCS7M |
| 18 | Bruno Torquato | U09K18J0T3M |
| 19 | Phil Edlan Dimailig | U0AEA89C42Z |

To edit this list later, just update the env var in Vercel and redeploy (or trigger a new deployment).

---

## Part 3 — Deploy

1. Commit and push the new files:
   - `src/lib/slack.ts`
   - `src/app/api/cron/log-reminder/route.ts`
   - `vercel.json` (added new cron entry)
2. Wait for Vercel deployment to go green.

### Cron schedule

`vercel.json` uses `"50 20 * * 1-5"` = **20:50 UTC, Mon–Fri** = **4:50 PM EDT**.

**Note on DST:** Vercel cron is always UTC. Between November and March (EST, UTC-5), this cron fires at 3:50 PM ET instead of 4:50 PM ET. To keep it at 4:50 PM year-round, you'd need to update the cron twice a year (or migrate to a timezone-aware solution). For now, set-and-forget is fine.

---

## Part 4 — Test it

### Smoke test (manual trigger)

From your terminal:

```bash
curl -X POST https://timelog-sable.vercel.app/api/cron/log-reminder \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected response:

```json
{
  "ok": true,
  "total": 19,
  "sent": 19,
  "failed": 0,
  "failures": [],
  "timestamp": "2026-04-14T..."
}
```

All 19 recipients should receive a DM from **TimeLog Reminder** bot (not from Franco).

### If `failed > 0`

Common causes:
- `not_in_channel` — bot needs to be installed in the workspace (redo step 5 in Part 1)
- `invalid_auth` — `SLACK_BOT_TOKEN` wrong or not deployed
- `user_not_found` — typo in a user ID in `SLACK_REMINDER_USERS`
- `cannot_dm_bot` — one of the IDs is a bot account, remove it

---

## Part 5 — Switch over

Once the bot smoke test passes:

1. Tell Franco to pause the Claude-based `timelog-daily-reminder` scheduled task (Scheduled section in Cowork sidebar → disable).
2. Bot takes over tomorrow at 4:50 PM ET.

---

## Phase 2 — Smart reminders (planned, not built yet)

Per spec: **"starting next week, only ping people who haven't logged their hours that day."**

Planned changes:

1. **Schema migration** — add to `User`:
   ```prisma
   slackUserId    String?  // Slack ID for DM reminders
   wantsReminders Boolean  @default(true)
   ```

2. **Admin UI** — add a Slack ID field + reminder toggle per user on the admin page.

3. **Route logic** — replace the env-var lookup with:
   ```typescript
   const today = startOfDay(new Date());
   const tomorrow = addDays(today, 1);

   const usersToRemind = await prisma.user.findMany({
     where: {
       active: true,
       wantsReminders: true,
       slackUserId: { not: null },
       timeEntries: {
         none: {
           date: { gte: today, lt: tomorrow },
         },
       },
     },
     select: { slackUserId: true, name: true },
   });
   ```

4. **Keep env var as fallback** — if `SLACK_REMINDER_USERS` is set, use it; otherwise fall back to DB query. Makes rollback trivial.

**Estimated effort:** 1–2 hours of engineering. Do it next week once Phase 1 is stable.

---

## Files created / modified

- ✅ `src/lib/slack.ts` (new) — Slack Web API helper
- ✅ `src/app/api/cron/log-reminder/route.ts` (new) — the cron endpoint
- ✅ `vercel.json` (modified) — added new cron entry
- ✅ `SLACK-BOT-SETUP.md` (new) — this guide
