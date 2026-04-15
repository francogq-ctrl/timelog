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

// Hardcoded client detection map.
// Each entry: keywords to match (case-insensitive) → canonical client name used in entries.
const CLIENT_MAP: Array<{ patterns: string[]; name: string }> = [
  { patterns: ["bodi"],                            name: "BODi" },
  { patterns: ["myprize", "my prize"],             name: "MyPrize" },
  { patterns: ["h2tab"],                           name: "H2tab" },
  { patterns: ["veloci"],                          name: "Veloci" },
  { patterns: ["morphe"],                          name: "Morphe" },
  { patterns: ["promix"],                          name: "Promix" },
  { patterns: ["goodwipes"],                       name: "Goodwipes" },
  { patterns: ["hygienelab", "hygiene lab"],       name: "HygieneLab" },
  { patterns: ["the normal brand", "normalbrand"], name: "The Normal Brand" },
];

function detectClient(title: string): string | null {
  const lower = title.toLowerCase();
  for (const { patterns, name } of CLIENT_MAP) {
    if (patterns.some((p) => lower.includes(p))) return name;
  }
  return null;
}

async function getValidAccessToken(
  userId: string,
  account: { access_token: string | null; refresh_token: string | null; expires_at: number | null }
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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "Date required" }, { status: 400 });
  }

  // Fetch tokens, Asana projects cache, and Meeting work type in parallel
  const [account, asanaProjects, meetingWorkType] = await Promise.all([
    prisma.account.findFirst({
      where: { userId: session.user.id, provider: "google" },
      select: { access_token: true, refresh_token: true, expires_at: true },
    }),
    prisma.asanaProject.findMany({
      where: { active: true },
      select: { gid: true, name: true },
    }),
    prisma.workType.findFirst({
      where: { name: { equals: "Meeting", mode: "insensitive" }, active: true },
      select: { id: true },
    }),
  ]);

  if (!account) {
    return NextResponse.json({ error: "No Google account linked" }, { status: 400 });
  }

  const accessToken = await getValidAccessToken(session.user.id, account);
  if (!accessToken) {
    return NextResponse.json(
      { error: "token_expired", message: "Your calendar token expired. Please sign out and back in." },
      { status: 401 }
    );
  }

  // Build Asana project lookup: clientName → gid (match project whose name contains client name)
  const projectByClient = new Map<string, string>();
  for (const { patterns, name } of CLIENT_MAP) {
    const project = asanaProjects.find((p) =>
      patterns.some((pat) => p.name.toLowerCase().includes(pat))
    );
    if (project) projectByClient.set(name, project.gid);
  }

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
    if (gcalRes.status === 401) {
      return NextResponse.json(
        { error: "token_expired", message: "Your calendar token expired. Please reconnect." },
        { status: 401 }
      );
    }
    if (gcalRes.status === 403) {
      return NextResponse.json(
        { error: "calendar_scope_missing", message: "Calendar access not authorized." },
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

  if (timedEvents.length === 0) return NextResponse.json([]);

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

      const clientName = detectClient(title);
      const asanaProjectId = clientName ? (projectByClient.get(clientName) ?? null) : null;

      return {
        id: e.id,
        title,
        start: e.start.dateTime,
        end: e.end.dateTime,
        hours,
        attendeesCount: e.attendees?.length ?? 0,
        alreadyLogged: loggedIds.has(e.id),
        suggestedCategory: clientName ? "CLIENT_WORK" : "INTERNAL",
        suggestedClientName: clientName,
        suggestedAsanaProjectId: asanaProjectId,
        meetingWorkTypeId: meetingWorkType?.id ?? null,
      };
    })
    .filter((e) => e.hours > 0);

  return NextResponse.json(result);
}
