import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string }[];
  status?: string;
}

async function getValidAccessToken(
  userId: string,
  account: {
    access_token: string | null;
    refresh_token: string | null;
    expires_at: number | null;
  }
): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);

  if (account.access_token && account.expires_at && account.expires_at > now + 300) {
    return account.access_token;
  }

  if (!account.refresh_token) return account.access_token;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: account.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) return account.access_token;

    const data = await res.json();
    const newToken = data.access_token as string;
    const expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in as number);

    prisma.account
      .updateMany({
        where: { userId, provider: "google" },
        data: { access_token: newToken, expires_at: expiresAt },
      })
      .catch(() => {});

    return newToken;
  } catch {
    return account.access_token;
  }
}

/** Match event title against known client names. Returns the client name if found. */
function detectClient(title: string, clientNames: string[]): string | null {
  const lowerTitle = title.toLowerCase();
  // Sort by length descending so longer names match first (e.g. "Acme Corp" before "Acme")
  const sorted = [...clientNames].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (lowerTitle.includes(name.toLowerCase())) {
      return name;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "Date required" }, { status: 400 });
  }

  // Fetch tokens, known clients, and Meeting work type in parallel
  const [account, clientRows, meetingWorkType] = await Promise.all([
    prisma.account.findFirst({
      where: { userId: session.user.id, provider: "google" },
      select: { access_token: true, refresh_token: true, expires_at: true },
    }),
    prisma.timeEntry.findMany({
      where: { clientName: { not: null } },
      select: { clientName: true },
      distinct: ["clientName"],
      orderBy: { createdAt: "desc" },
    }),
    prisma.workType.findFirst({
      where: { name: { equals: "Meeting", mode: "insensitive" }, active: true },
      select: { id: true, name: true },
    }),
  ]);

  if (!account) {
    return NextResponse.json({ error: "No Google account linked" }, { status: 400 });
  }

  const accessToken = await getValidAccessToken(session.user.id, account);
  if (!accessToken) {
    return NextResponse.json(
      { error: "Could not get a valid Google token. Please sign out and back in." },
      { status: 401 }
    );
  }

  const clientNames = clientRows
    .map((r) => r.clientName!)
    .filter(Boolean);

  // Fetch Google Calendar events
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  const params = new URLSearchParams({
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });

  const gcalRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!gcalRes.ok) {
    if (gcalRes.status === 401 || gcalRes.status === 403) {
      return NextResponse.json(
        {
          error: "calendar_scope_missing",
          message:
            "Calendar access not authorized. Please sign out and sign in again to grant calendar access.",
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Failed to fetch Google Calendar" }, { status: 502 });
  }

  const gcalData = await gcalRes.json();
  const items: GoogleCalendarEvent[] = gcalData.items ?? [];

  const timedEvents = items.filter(
    (e) => e.start?.dateTime && e.end?.dateTime && e.status !== "cancelled"
  );

  if (timedEvents.length === 0) {
    return NextResponse.json([]);
  }

  // Check which events are already logged
  const eventIds = timedEvents.map((e) => e.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingEntries = await (prisma.timeEntry as any).findMany({
    where: { userId: session.user.id, calendarEventId: { in: eventIds } },
    select: { calendarEventId: true },
  });
  const loggedIds = new Set<string>(
    existingEntries.map((e: { calendarEventId: string }) => e.calendarEventId)
  );

  const result = timedEvents
    .map((e) => {
      const start = new Date(e.start.dateTime!);
      const end = new Date(e.end.dateTime!);
      const durationMinutes = (end.getTime() - start.getTime()) / 60000;
      const hours = Math.max(0.25, Math.round(durationMinutes / 15) * 0.25);

      const title = e.summary ?? "(No title)";
      const matchedClient = detectClient(title, clientNames);

      return {
        id: e.id,
        title,
        start: e.start.dateTime,
        end: e.end.dateTime,
        hours,
        attendeesCount: e.attendees?.length ?? 0,
        alreadyLogged: loggedIds.has(e.id),
        // Suggested entry fields
        suggestedCategory: matchedClient ? "CLIENT_WORK" : "INTERNAL",
        suggestedClientName: matchedClient ?? null,
        meetingWorkTypeId: meetingWorkType?.id ?? null,
      };
    })
    .filter((e) => e.hours > 0);

  return NextResponse.json(result);
}
