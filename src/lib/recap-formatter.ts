import type { PersonalRecapData, TeamRecapData } from "@/lib/recap-generator";
import { format } from "date-fns";

const WHY_LINES = [
  "Your tracking helps us price projects fairly — without your data, we'd be charging clients blind.",
  "This is how we know when it's time to hire — before anyone gets burned out.",
  "We don't compare individuals — we look at how the team as a whole spends our energy.",
  "Every hour you log helps us sharpen estimates on the next project.",
  "Your training time matters. Logging it tells us how much we're investing in your growth.",
  "The better we track, the less guessing leadership has to do — and the better decisions we make for everyone.",
];

export function pickWhyLine(referenceDate: Date = new Date()): string {
  const start = new Date(Date.UTC(referenceDate.getUTCFullYear(), 0, 1));
  const days = Math.floor(
    (referenceDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  const week = Math.floor(days / 7);
  return WHY_LINES[week % WHY_LINES.length];
}

function bar(percent: number, width = 22): string {
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function shortBar(percent: number): string {
  const width = Math.max(1, Math.min(12, Math.round((percent / 100) * 12)));
  return "█".repeat(width);
}

function formatRange(weekStart: Date, weekEnd: Date): string {
  return `${format(weekStart, "MMM d")}–${format(weekEnd, "d")}`;
}

function deltaLabel(value: number, suffix: string): string {
  if (value > 0) return `↑ +${value}${suffix}`;
  if (value < 0) return `↓ ${value}${suffix}`;
  return `→ 0${suffix}`;
}

export function formatPersonalRecap(
  data: PersonalRecapData,
  referenceDate: Date = new Date(),
): string {
  const lines: string[] = [];
  lines.push(`👋 *Your Week at AND Gather* · ${formatRange(data.weekStart, data.weekEnd)}`);
  lines.push("");
  lines.push(
    `⏱ ${data.hoursLogged}h logged (out of ${data.hoursPossible}h possible)`,
  );
  if (data.ptoHours > 0) {
    lines.push(`🌴 ${data.ptoHours}h time off this week`);
  }
  lines.push(
    `💼 ${data.billablePercent}% billable · ${data.internalPercent}% internal`,
  );
  if (data.streakDays > 0) {
    lines.push(`🔥 Streak: ${data.streakDays} day${data.streakDays === 1 ? "" : "s"} in a row logged`);
  }
  lines.push("");

  if (data.topClients.length > 0) {
    lines.push("🏆 *Top clients this week*");
    data.topClients.forEach((c, i) => {
      lines.push(`   ${i + 1}. ${c.name} · ${c.hours}h`);
    });
    lines.push("");
  }

  lines.push("📊 *Vs. your 4-week average*");
  lines.push(`   Hours:    ${deltaLabel(data.hoursDelta, "h")}`);
  lines.push(`   Billable: ${deltaLabel(data.billableDelta, "%")}`);
  lines.push("");

  if (data.incompleteDays.length > 0) {
    const list =
      data.incompleteDays.length === 1
        ? data.incompleteDays[0]
        : data.incompleteDays.slice(0, -1).join(", ") +
          " and " +
          data.incompleteDays[data.incompleteDays.length - 1];
    lines.push(`📅 Incomplete days: ${list}`);
    lines.push(`   → <https://timelog-sable.vercel.app/log|Complete now>`);
    lines.push("");
  }

  lines.push(`✨ _${pickWhyLine(referenceDate)}_`);

  return lines.join("\n");
}

export function formatTeamRecap(data: TeamRecapData): string {
  const lines: string[] = [];
  lines.push(`📊 *Team Week* · ${formatRange(data.weekStart, data.weekEnd)}`);
  lines.push("");

  lines.push("⏱ *Capacity utilization*");
  lines.push(
    `   ${bar(data.utilizationPercent)}  ${data.utilizationPercent}% (${data.totalHours} / ${data.capacityHours}h available)`,
  );
  if (data.ptoHours > 0) {
    lines.push(`   🌴 ${data.ptoHours}h excluded for time off`);
  }
  lines.push("   🎯 Goal: 100% week in, week out");
  lines.push("");

  if (data.byClient.length > 0) {
    lines.push("📈 *Time by client*");
    const maxNameLen = Math.max(...data.byClient.map((c) => c.name.length), 8);
    for (const c of data.byClient) {
      const namePadded = c.name.padEnd(maxNameLen, " ");
      const pctStr = `${c.percent}%`.padStart(4);
      const hoursStr = `${c.hours}h`;
      lines.push(`   ${namePadded}  ${shortBar(c.percent).padEnd(12, " ")}  ${pctStr} · ${hoursStr}`);
    }
    lines.push("");
  }

  lines.push(
    `🎓 *Training & development*\n   ${data.trainingPercent}% · ${data.trainingHours}h invested in growth this week`,
  );
  lines.push("");

  lines.push(
    `💼 *Billable mix overall*\n   ${data.billablePercent}% billable · ${data.internalPercent}% internal/admin/training`,
  );

  return lines.join("\n");
}
