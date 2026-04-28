import { prisma } from "@/lib/db";

const r2 = (n: number) => Math.round(n * 100) / 100;

const CLIENT_CANONICAL: Record<string, string> = {
  bodi: "BODi",
  myprize: "MyPrize",
  veloci: "Veloci",
  morphe: "Morphe",
  h2tab: "H2Tab",
  hygienelab: "HygieneLab",
  goodwipes: "Goodwipes",
  promix: "Promix",
};

export function normalizeClientName(name: string): string {
  let stripped = name.replace(/\s*\[\d{4}\]\s*$/, "").trim();
  // Unwrap a single pair of enclosing brackets, e.g. "[Barker Wellness]" → "Barker Wellness"
  const bracketed = stripped.match(/^\[(.+)\]$/);
  if (bracketed) stripped = bracketed[1].trim();
  return CLIENT_CANONICAL[stripped.toLowerCase()] ?? stripped;
}

export interface ReportData {
  overview: {
    totalHours: number;
    clientHours: number;
    clientPercent: number;
    activeUsers: number;
    totalUsers: number;
    totalClients: number;
    avgDaily: number;
  };
  compliance: {
    name: string;
    hours: number;
    entries: number;
    daysActive: number;
    clientHours: number;
    internalHours: number;
    adminHours: number;
    trainingHours: number;
    billablePercent: number;
  }[];
  byClient: {
    name: string;
    hours: number;
    byType: Record<string, number>;
    byPerson: { name: string; hours: number }[];
    peopleCount: number;
  }[];
  byDeliverable: {
    client: string;
    task: string | null;
    hours: number;
    peopleCount: number;
    entries: number;
    topType: string | null;
  }[];
  byProject: {
    projectGid: string;
    projectName: string;
    clientName: string;
    totalHours: number;
    loggedTaskCount: number;
    totalTaskCount: number;
    unlinkedHours: number;
    tasks: {
      taskGid: string;
      taskName: string;
      hours: number;
      entriesCount: number;
      peopleCount: number;
      byWorkType: Record<string, number>;
      completed: boolean;
    }[];
  }[];
  categoryTotals: Record<string, number>;
  workTypeTotals: { name: string; hours: number }[];
  missingUsers: { name: string | null; email: string }[];
}

export async function generateReportData(
  from: string,
  to: string,
  options?: { userId?: string; clientName?: string }
): Promise<ReportData> {
  const { userId, clientName } = options ?? {};

  const dateFilter = {
    date: { gte: new Date(from), lte: new Date(to) },
    ...(userId && { userId }),
  };

  const [entries, users, asanaProjects] = await Promise.all([
    prisma.timeEntry.findMany({
      where: dateFilter,
      include: {
        user: { select: { id: true, name: true, email: true } },
        workType: { select: { name: true } },
        activity: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true, ...(userId && { id: userId }) },
      select: { id: true, name: true, email: true },
    }),
    prisma.asanaProject.findMany({
      where: { active: true },
      include: {
        tasks: {
          where: { completed: false },
          select: { gid: true, name: true, completed: true },
        },
      },
    }),
  ]);

  const filteredEntries = clientName
    ? entries.filter(
        (e) => e.clientName && normalizeClientName(e.clientName) === clientName
      )
    : entries;

  const totalHours = r2(filteredEntries.reduce((sum, e) => sum + e.hours, 0));
  const clientHours = r2(
    filteredEntries
      .filter((e) => e.category === "CLIENT_WORK")
      .reduce((sum, e) => sum + e.hours, 0)
  );
  const usersWithEntries = new Set(filteredEntries.map((e) => e.userId));
  const uniqueClients = new Set(
    filteredEntries
      .filter((e) => e.clientName)
      .map((e) => normalizeClientName(e.clientName!))
  );

  const complianceMap: Record<
    string,
    {
      name: string;
      hours: number;
      entries: number;
      daysActive: Set<string>;
      byCategory: Record<string, number>;
    }
  > = {};

  for (const u of users) {
    complianceMap[u.id] = {
      name: u.name ?? u.email,
      hours: 0,
      entries: 0,
      daysActive: new Set(),
      byCategory: {},
    };
  }

  for (const e of filteredEntries) {
    const uid = e.userId;
    if (!complianceMap[uid]) {
      complianceMap[uid] = {
        name: e.user.name ?? e.user.email ?? uid,
        hours: 0,
        entries: 0,
        daysActive: new Set(),
        byCategory: {},
      };
    }
    complianceMap[uid].hours = r2(complianceMap[uid].hours + e.hours);
    complianceMap[uid].entries += 1;
    complianceMap[uid].daysActive.add(e.date.toISOString().split("T")[0]);
    complianceMap[uid].byCategory[e.category] = r2(
      (complianceMap[uid].byCategory[e.category] ?? 0) + e.hours
    );
  }

  const compliance = Object.values(complianceMap)
    .map((p) => ({
      name: p.name,
      hours: p.hours,
      entries: p.entries,
      daysActive: p.daysActive.size,
      clientHours: p.byCategory.CLIENT_WORK ?? 0,
      internalHours: p.byCategory.INTERNAL ?? 0,
      adminHours: p.byCategory.ADMIN ?? 0,
      trainingHours: p.byCategory.TRAINING ?? 0,
      billablePercent:
        p.hours > 0
          ? Math.round(((p.byCategory.CLIENT_WORK ?? 0) / p.hours) * 100)
          : 0,
    }))
    .sort((a, b) => b.hours - a.hours);

  const byClientMap: Record<
    string,
    { hours: number; byType: Record<string, number>; people: Set<string>; personHours: Record<string, number> }
  > = {};
  for (const e of filteredEntries) {
    if (e.category !== "CLIENT_WORK" || !e.clientName) continue;
    const key = normalizeClientName(e.clientName);
    if (!byClientMap[key])
      byClientMap[key] = { hours: 0, byType: {}, people: new Set(), personHours: {} };
    byClientMap[key].hours = r2(byClientMap[key].hours + e.hours);
    byClientMap[key].people.add(e.userId);
    const typeName = e.workType?.name ?? "Other";
    byClientMap[key].byType[typeName] = r2(
      (byClientMap[key].byType[typeName] ?? 0) + e.hours
    );
    const personName = e.user.name ?? e.user.email ?? e.userId;
    byClientMap[key].personHours[personName] = r2(
      (byClientMap[key].personHours[personName] ?? 0) + e.hours
    );
  }

  const byClient = Object.entries(byClientMap)
    .map(([name, data]) => ({
      name,
      hours: data.hours,
      byType: data.byType,
      byPerson: Object.entries(data.personHours)
        .map(([pName, pHours]) => ({ name: pName, hours: pHours }))
        .sort((a, b) => b.hours - a.hours),
      peopleCount: data.people.size,
    }))
    .sort((a, b) => b.hours - a.hours);

  const byDeliverableMap: Record<
    string,
    {
      client: string;
      task: string | null;
      hours: number;
      people: Set<string>;
      entries: number;
      byType: Record<string, number>;
    }
  > = {};
  for (const e of filteredEntries) {
    if (e.category !== "CLIENT_WORK" || !e.clientName) continue;
    const normalizedClient = normalizeClientName(e.clientName);
    const key = `${normalizedClient}|||${e.asanaTaskName ?? "(no task)"}`;
    if (!byDeliverableMap[key])
      byDeliverableMap[key] = {
        client: normalizedClient,
        task: e.asanaTaskName,
        hours: 0,
        people: new Set(),
        entries: 0,
        byType: {},
      };
    byDeliverableMap[key].hours = r2(byDeliverableMap[key].hours + e.hours);
    byDeliverableMap[key].people.add(e.userId);
    byDeliverableMap[key].entries += 1;
    const typeName = e.workType?.name ?? "Other";
    byDeliverableMap[key].byType[typeName] = r2(
      (byDeliverableMap[key].byType[typeName] ?? 0) + e.hours
    );
  }

  const byDeliverable = Object.values(byDeliverableMap)
    .map((d) => ({
      client: d.client,
      task: d.task,
      hours: d.hours,
      peopleCount: d.people.size,
      entries: d.entries,
      topType:
        Object.entries(d.byType).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort((a, b) => b.hours - a.hours);

  // ── BY PROJECT (left-join AsanaProject ⟕ TimeEntry) ───────────────────────
  // Groups CLIENT_WORK entries by asanaProjectId AND surfaces tasks from the
  // Asana cache that have zero logged hours, so we can see what's "tracked"
  // vs "not tracked yet".

  type ProjectAggTask = {
    hours: number;
    people: Set<string>;
    entries: number;
    byWorkType: Record<string, number>;
  };
  type ProjectAgg = {
    hours: number;
    people: Set<string>;
    tasksLogged: Map<string, ProjectAggTask>; // taskGid → agg
    tasksByName: Map<string, ProjectAggTask>; // fallback when asanaTaskId is null
  };

  const projectAggByGid: Map<string, ProjectAgg> = new Map();
  // Track CLIENT_WORK hours per normalized client name with NO asanaProjectId,
  // so we can attribute "unlinked" hours to the right project later.
  const unlinkedHoursByClient: Map<string, number> = new Map();
  // Track which clients appear in filteredEntries at all (to decide which
  // projects are "relevant" for the period).
  const clientsInPeriod: Set<string> = new Set();

  for (const e of filteredEntries) {
    if (e.category !== "CLIENT_WORK") continue;
    if (e.clientName) {
      clientsInPeriod.add(normalizeClientName(e.clientName));
    }
    if (!e.asanaProjectId) {
      if (e.clientName) {
        const key = normalizeClientName(e.clientName);
        unlinkedHoursByClient.set(
          key,
          r2((unlinkedHoursByClient.get(key) ?? 0) + e.hours)
        );
      }
      continue;
    }
    let agg = projectAggByGid.get(e.asanaProjectId);
    if (!agg) {
      agg = {
        hours: 0,
        people: new Set(),
        tasksLogged: new Map(),
        tasksByName: new Map(),
      };
      projectAggByGid.set(e.asanaProjectId, agg);
    }
    agg.hours = r2(agg.hours + e.hours);
    agg.people.add(e.userId);

    const taskMap = e.asanaTaskId ? agg.tasksLogged : agg.tasksByName;
    const taskKey = e.asanaTaskId ?? e.asanaTaskName ?? "(no task)";
    let taskAgg = taskMap.get(taskKey);
    if (!taskAgg) {
      taskAgg = { hours: 0, people: new Set(), entries: 0, byWorkType: {} };
      taskMap.set(taskKey, taskAgg);
    }
    taskAgg.hours = r2(taskAgg.hours + e.hours);
    taskAgg.people.add(e.userId);
    taskAgg.entries += 1;
    const wtName = e.workType?.name ?? "Other";
    taskAgg.byWorkType[wtName] = r2((taskAgg.byWorkType[wtName] ?? 0) + e.hours);
  }

  const byProject = asanaProjects
    .map((proj) => {
      const projClient = normalizeClientName(proj.name);
      const agg = projectAggByGid.get(proj.gid);
      const unlinkedHours = unlinkedHoursByClient.get(projClient) ?? 0;

      // Build task list: cached Asana tasks (incomplete only) + any logged
      // tasks not in the cache (completed/archived/orphaned).
      const cachedGids = new Set(proj.tasks.map((t) => t.gid));

      const fromCache = proj.tasks.map((t) => {
        const logged = agg?.tasksLogged.get(t.gid);
        return {
          taskGid: t.gid,
          taskName: t.name,
          hours: logged?.hours ?? 0,
          entriesCount: logged?.entries ?? 0,
          peopleCount: logged?.people.size ?? 0,
          byWorkType: logged?.byWorkType ?? {},
          completed: t.completed,
        };
      });

      const orphanLogged = agg
        ? Array.from(agg.tasksLogged.entries())
            .filter(([gid]) => !cachedGids.has(gid))
            .map(([gid, t]) => ({
              taskGid: gid,
              taskName: "(unknown task)",
              hours: t.hours,
              entriesCount: t.entries,
              peopleCount: t.people.size,
              byWorkType: t.byWorkType,
              completed: false,
            }))
        : [];

      const namedFallback = agg
        ? Array.from(agg.tasksByName.entries()).map(([name, t]) => ({
            taskGid: `${proj.gid}::${name}`,
            taskName: name === "(no task)" ? "(no task)" : name,
            hours: t.hours,
            entriesCount: t.entries,
            peopleCount: t.people.size,
            byWorkType: t.byWorkType,
            completed: false,
          }))
        : [];

      const tasks = [...fromCache, ...orphanLogged, ...namedFallback].sort(
        (a, b) => b.hours - a.hours
      );

      const loggedTaskCount = tasks.filter((t) => t.hours > 0).length;
      const totalTaskCount = proj.tasks.length;
      const totalHours = agg?.hours ?? 0;

      return {
        projectGid: proj.gid,
        projectName: proj.name,
        clientName: projClient,
        totalHours,
        loggedTaskCount,
        totalTaskCount,
        unlinkedHours,
        tasks,
      };
    })
    // Only include projects that are relevant for the selected period:
    // either they have logged hours OR their client appears in filteredEntries.
    // Also respect the clientName filter.
    .filter((p) => {
      if (clientName && p.clientName !== clientName) return false;
      return p.totalHours > 0 || clientsInPeriod.has(p.clientName);
    })
    .sort((a, b) => b.totalHours - a.totalHours);

  const categoryTotals: Record<string, number> = {};
  for (const e of filteredEntries) {
    categoryTotals[e.category] = r2(
      (categoryTotals[e.category] ?? 0) + e.hours
    );
  }

  const workTypeTotalsMap: Record<string, number> = {};
  for (const e of filteredEntries) {
    if (e.category === "CLIENT_WORK" && e.workType) {
      workTypeTotalsMap[e.workType.name] = r2(
        (workTypeTotalsMap[e.workType.name] ?? 0) + e.hours
      );
    }
  }

  const missingUsers = users.filter((u) => !usersWithEntries.has(u.id));

  return {
    overview: {
      totalHours,
      clientHours,
      clientPercent:
        totalHours > 0 ? Math.round((clientHours / totalHours) * 100) : 0,
      activeUsers: usersWithEntries.size,
      totalUsers: users.length,
      totalClients: uniqueClients.size,
      avgDaily:
        usersWithEntries.size > 0
          ? Math.round((totalHours / usersWithEntries.size) * 10) / 10
          : 0,
    },
    compliance,
    byClient,
    byDeliverable,
    byProject,
    categoryTotals,
    workTypeTotals: Object.entries(workTypeTotalsMap)
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours),
    missingUsers: missingUsers.map((u) => ({ name: u.name, email: u.email })),
  };
}
