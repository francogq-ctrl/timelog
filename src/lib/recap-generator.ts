import { prisma } from "@/lib/db";
import { normalizeClientName } from "@/lib/report-generator";
import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfWeek,
  subWeeks,
} from "date-fns";

const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (num: number, den: number) =>
  den > 0 ? Math.round((num / den) * 100) : 0;

export interface PersonalRecapData {
  userId: string;
  userName: string;
  weekStart: Date;
  weekEnd: Date;
  hoursLogged: number;
  hoursPossible: number;
  ptoHours: number;
  billablePercent: number;
  internalPercent: number;
  streakDays: number;
  topClients: { name: string; hours: number }[];
  fourWeekAvgHours: number;
  fourWeekAvgBillablePercent: number;
  hoursDelta: number;
  billableDelta: number;
  incompleteDays: string[];
}

export interface TeamRecapData {
  weekStart: Date;
  weekEnd: Date;
  totalHours: number;
  capacityHours: number;
  ptoHours: number;
  utilizationPercent: number;
  byClient: { name: string; hours: number; percent: number }[];
  trainingHours: number;
  trainingPercent: number;
  billableHours: number;
  billablePercent: number;
  internalHours: number;
  internalPercent: number;
}

function getWeekRange(referenceDate: Date) {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const friday = addDays(weekStart, 4);
  return { weekStart: startOfDay(weekStart), weekEnd: startOfDay(friday) };
}

export async function generatePersonalRecap(
  userId: string,
  referenceDate: Date = new Date(),
): Promise<PersonalRecapData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, weeklyContractHours: true },
  });
  if (!user) return null;

  const { weekStart, weekEnd } = getWeekRange(referenceDate);
  const fourWeeksBackStart = startOfDay(subWeeks(weekStart, 4));
  const fourWeeksBackEnd = startOfDay(addDays(weekStart, -1));

  const [thisWeek, fourWeeks] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        userId,
        date: { gte: weekStart, lte: weekEnd },
      },
      select: {
        date: true,
        hours: true,
        category: true,
        clientName: true,
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        userId,
        date: { gte: fourWeeksBackStart, lte: fourWeeksBackEnd },
      },
      select: { hours: true, category: true },
    }),
  ]);

  const ptoHours = r2(
    thisWeek.filter((e) => e.category === "TIME_OFF").reduce((s, e) => s + e.hours, 0),
  );
  const workEntries = thisWeek.filter((e) => e.category !== "TIME_OFF");
  const hoursLogged = r2(workEntries.reduce((s, e) => s + e.hours, 0));
  const billableHours = r2(
    workEntries
      .filter((e) => e.category === "CLIENT_WORK")
      .reduce((s, e) => s + e.hours, 0),
  );
  const billablePercent = pct(billableHours, hoursLogged);
  const internalPercent = hoursLogged > 0 ? 100 - billablePercent : 0;

  const fourWeekWork = fourWeeks.filter((e) => e.category !== "TIME_OFF");
  const fourWeekHours = r2(fourWeekWork.reduce((s, e) => s + e.hours, 0));
  const fourWeekBillable = r2(
    fourWeekWork
      .filter((e) => e.category === "CLIENT_WORK")
      .reduce((s, e) => s + e.hours, 0),
  );
  const fourWeekAvgHours = r2(fourWeekHours / 4);
  const fourWeekAvgBillablePercent = pct(fourWeekBillable, fourWeekHours);

  const clientMap: Record<string, number> = {};
  for (const e of workEntries) {
    if (e.category !== "CLIENT_WORK" || !e.clientName) continue;
    const key = normalizeClientName(e.clientName);
    clientMap[key] = r2((clientMap[key] ?? 0) + e.hours);
  }
  const topClients = Object.entries(clientMap)
    .map(([name, hours]) => ({ name, hours }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 3);

  const daysWithEntries = new Set(
    thisWeek.map((e) => format(e.date, "yyyy-MM-dd")),
  );
  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const incompleteDays: string[] = [];
  for (let i = 0; i < 5; i++) {
    const day = addDays(weekStart, i);
    if (day > new Date()) break;
    if (!daysWithEntries.has(format(day, "yyyy-MM-dd"))) {
      incompleteDays.push(weekdayLabels[i]);
    }
  }

  let streakDays = 0;
  for (let i = differenceInCalendarDays(new Date(), weekStart); i >= 0; i--) {
    const day = addDays(weekStart, i);
    if (day > new Date()) continue;
    if (daysWithEntries.has(format(day, "yyyy-MM-dd"))) {
      streakDays++;
    } else {
      break;
    }
  }

  return {
    userId: user.id,
    userName: user.name ?? user.email,
    weekStart,
    weekEnd,
    hoursLogged,
    hoursPossible: Math.max(0, user.weeklyContractHours - ptoHours),
    ptoHours,
    billablePercent,
    internalPercent,
    streakDays,
    topClients,
    fourWeekAvgHours,
    fourWeekAvgBillablePercent,
    hoursDelta: r2(hoursLogged - fourWeekAvgHours),
    billableDelta: billablePercent - fourWeekAvgBillablePercent,
    incompleteDays,
  };
}

export async function generateTeamRecap(
  referenceDate: Date = new Date(),
): Promise<TeamRecapData> {
  const { weekStart, weekEnd } = getWeekRange(referenceDate);

  const [entries, activeUsers] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        date: { gte: weekStart, lte: weekEnd },
        user: { excludeFromReports: false },
      },
      select: {
        hours: true,
        category: true,
        clientName: true,
      },
    }),
    prisma.user.findMany({
      where: { active: true, excludeFromReports: false },
      select: { weeklyContractHours: true },
    }),
  ]);

  const ptoHours = r2(
    entries.filter((e) => e.category === "TIME_OFF").reduce((s, e) => s + e.hours, 0),
  );
  const workEntries = entries.filter((e) => e.category !== "TIME_OFF");
  const totalHours = r2(workEntries.reduce((s, e) => s + e.hours, 0));
  const grossCapacity = activeUsers.reduce(
    (s, u) => s + u.weeklyContractHours,
    0,
  );
  const capacityHours = Math.max(0, grossCapacity - ptoHours);
  const utilizationPercent = pct(totalHours, capacityHours);

  const billableHours = r2(
    workEntries
      .filter((e) => e.category === "CLIENT_WORK")
      .reduce((s, e) => s + e.hours, 0),
  );
  const trainingHours = r2(
    workEntries
      .filter((e) => e.category === "TRAINING")
      .reduce((s, e) => s + e.hours, 0),
  );
  const internalHours = r2(totalHours - billableHours);

  const clientMap: Record<string, number> = {};
  for (const e of workEntries) {
    if (e.category !== "CLIENT_WORK" || !e.clientName) continue;
    const key = normalizeClientName(e.clientName);
    clientMap[key] = r2((clientMap[key] ?? 0) + e.hours);
  }
  const byClient = Object.entries(clientMap)
    .map(([name, hours]) => ({
      name,
      hours,
      percent: pct(hours, totalHours),
    }))
    .sort((a, b) => b.hours - a.hours);

  return {
    weekStart,
    weekEnd,
    totalHours,
    capacityHours,
    ptoHours,
    utilizationPercent,
    byClient,
    trainingHours,
    trainingPercent: pct(trainingHours, totalHours),
    billableHours,
    billablePercent: pct(billableHours, totalHours),
    internalHours,
    internalPercent: pct(internalHours, totalHours),
  };
}
