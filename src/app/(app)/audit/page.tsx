"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertCircle,
  Info,
  Check,
  Download,
  User,
  Copy,
  MessageSquare,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──

type Severity = "critical" | "warning" | "info";
type Grade = "A" | "B" | "C" | "D" | "F";

interface AuditIssue {
  check: string;
  severity: Severity;
  taskGid?: string;
  taskName?: string;
  sectionName?: string;
  assignee?: string;
  creator?: string;
  message: string;
  suggestion: string;
}

interface ProjectAudit {
  projectGid: string;
  projectName: string;
  grade: Grade;
  score: number;
  totalTasks: number;
  activeTasks: number;
  issues: AuditIssue[];
  issuesBySeverity: { critical: number; warning: number; info: number };
  sectionNames: string[];
  bottlenecks: {
    sectionName: string;
    tasks: { gid: string; name: string; daysStuck: number }[];
  }[];
}

interface AuditData {
  timestamp: string;
  overallGrade: Grade;
  overallScore: number;
  totalProjects: number;
  totalIssues: number;
  totalTasksScanned: number;
  issuesBySeverity: { critical: number; warning: number; info: number };
  projects: ProjectAudit[];
  suggestions: { priority: Severity; text: string }[];
}

// ── HTML Export ──

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function gradeColor(grade: Grade): string {
  if (grade === "A" || grade === "B") return "#c8ff00";
  if (grade === "C" || grade === "D") return "#ffaa4d";
  return "#ff4d4d";
}

function severityColor(s: Severity): string {
  if (s === "critical") return "#ff4d4d";
  if (s === "warning") return "#ffaa4d";
  return "#4da6ff";
}

function severityDim(s: Severity): string {
  if (s === "critical") return "rgba(255,77,77,0.1)";
  if (s === "warning") return "rgba(255,170,77,0.1)";
  return "rgba(77,166,255,0.1)";
}

function scoreColor(score: number): string {
  if (score >= 90) return "#c8ff00";
  if (score >= 75) return "rgba(200,255,0,0.7)";
  if (score >= 60) return "#ffaa4d";
  if (score >= 40) return "rgba(255,170,77,0.7)";
  return "#ff4d4d";
}

function generateAuditHTML(data: AuditData): string {
  const ts = new Date(data.timestamp).toLocaleString();
  const checkLabelsMap: Record<string, string> = {
    "task-naming": "Naming Convention",
    "required-fields": "Required Fields",
    "board-structure": "Board Structure",
    bottleneck: "Bottlenecks",
    "hold-review": "Hold Review",
  };

  const allBottlenecks = data.projects
    .flatMap((p) => p.bottlenecks.map((b) => ({ ...b, projectName: p.projectName })))
    .sort((a, b) => b.tasks.length - a.tasks.length);

  // Project cards
  const projectCards = data.projects
    .map((p) => {
      const gc = gradeColor(p.grade);
      const sc = scoreColor(p.score);
      const thStyle = "padding:10px 16px;text-align:left;font-family:var(--mono);font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#5a5550";
      const tdBase = "padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.03)";
      const issueRows = p.issues
        .map(
          (i) =>
            `<tr><td style="${tdBase};color:#8a8580;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(i.taskName ?? "—")}</td><td style="${tdBase};color:#8a8580;white-space:nowrap">${escHtml(i.assignee ?? "—")}</td><td style="${tdBase};color:#5a5550;white-space:nowrap">${escHtml(i.creator ?? "—")}</td><td style="${tdBase};color:#e8e6e3">${escHtml(i.message)}</td><td style="${tdBase};text-align:right"><span style="display:inline-block;font-family:var(--mono);font-size:10px;padding:3px 10px;border-radius:100px;background:${severityDim(i.severity)};color:${severityColor(i.severity)}">${i.severity}</span></td></tr>`
        )
        .join("");

      const issueTable =
        p.issues.length > 0
          ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px"><thead><tr style="border-bottom:1px solid rgba(255,255,255,0.06)"><th style="${thStyle}">Task</th><th style="${thStyle}">Assignee</th><th style="${thStyle}">Creator</th><th style="${thStyle}">Issue</th><th style="${thStyle};text-align:right">Severity</th></tr></thead><tbody>${issueRows}</tbody></table>`
          : `<p style="margin-top:12px;font-size:13px;color:#c8ff00">No issues — this project is clean!</p>`;

      return `<div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:4px">
          <div style="width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;border:2px solid ${gc};color:${gc};background:${gc}15;flex-shrink:0">${p.grade}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:15px;font-weight:600;color:#e8e6e3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(p.projectName)}</div>
            <div style="display:flex;gap:12px;margin-top:3px;font-size:11px">
              <span style="color:#5a5550">${p.activeTasks} active tasks</span>
              ${p.issuesBySeverity.critical > 0 ? `<span style="color:#ff4d4d">${p.issuesBySeverity.critical} critical</span>` : ""}
              ${p.issuesBySeverity.warning > 0 ? `<span style="color:#ffaa4d">${p.issuesBySeverity.warning} warnings</span>` : ""}
              ${p.issuesBySeverity.info > 0 ? `<span style="color:#4da6ff">${p.issuesBySeverity.info} info</span>` : ""}
            </div>
          </div>
          <div style="width:80px;flex-shrink:0">
            <div style="height:8px;border-radius:4px;background:rgba(255,255,255,0.05);overflow:hidden"><div style="height:100%;border-radius:4px;width:${p.score}%;background:${sc}"></div></div>
            <div style="text-align:right;font-family:var(--mono);font-size:11px;color:#5a5550;margin-top:3px">${p.score}</div>
          </div>
        </div>
        ${issueTable}
      </div>`;
    })
    .join("");

  // Issues by check
  const issuesByCheck = Object.entries(checkLabelsMap)
    .map(([check, label]) => {
      const issues = data.projects.flatMap((p) => p.issues.filter((i) => i.check === check));
      if (issues.length === 0) return "";
      const thS = "padding:12px 16px;text-align:left;font-family:var(--mono);font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#5a5550";
      const tdB = "padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.03)";
      const rows = issues
        .slice(0, 30)
        .map(
          (i) =>
            `<tr><td style="${tdB};color:#8a8580;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(i.taskName ?? "—")}</td><td style="${tdB};color:#8a8580;white-space:nowrap">${escHtml(i.assignee ?? "—")}</td><td style="${tdB};color:#5a5550;white-space:nowrap">${escHtml(i.creator ?? "—")}</td>${check === "bottleneck" ? `<td style="${tdB};color:#5a5550">${escHtml(i.sectionName ?? "")}</td>` : ""}<td style="${tdB};color:#e8e6e3">${escHtml(i.message)}</td><td style="${tdB};text-align:right"><span style="display:inline-block;font-family:var(--mono);font-size:10px;padding:3px 10px;border-radius:100px;background:${severityDim(i.severity)};color:${severityColor(i.severity)}">${i.severity}</span></td></tr>`
        )
        .join("");
      return `<div style="margin-bottom:32px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
          <span style="font-size:14px;font-weight:600;color:#e8e6e3">${escHtml(label)}</span>
          <span style="font-family:var(--mono);font-size:11px;padding:2px 10px;border-radius:100px;background:rgba(255,255,255,0.05);color:#5a5550">${issues.length}</span>
        </div>
        <div style="border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:rgba(255,255,255,0.02);border-bottom:1px solid rgba(255,255,255,0.06)"><th style="${thS}">Task</th><th style="${thS}">Assignee</th><th style="${thS}">Creator</th>${check === "bottleneck" ? `<th style="${thS}">Section</th>` : ""}<th style="${thS}">Issue</th><th style="${thS};text-align:right">Severity</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${issues.length > 30 ? `<p style="margin-top:8px;font-size:11px;color:#5a5550">Showing 30 of ${issues.length} issues</p>` : ""}
      </div>`;
    })
    .join("");

  // Bottleneck bars
  const bottleneckSection = allBottlenecks.length > 0
    ? allBottlenecks
        .map((b) => {
          const maxDays = Math.max(...b.tasks.map((t) => t.daysStuck));
          const bars = b.tasks
            .map((t) => {
              const pct = Math.min((t.daysStuck / maxDays) * 100, 100);
              const barColor = t.daysStuck > 10 ? "rgba(255,77,77,0.4)" : "rgba(255,170,77,0.3)";
              return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <div style="flex:1;height:22px;border-radius:4px;background:rgba(255,255,255,0.03);overflow:hidden">
                  <div style="height:100%;width:${pct}%;border-radius:4px;background:${barColor};display:flex;align-items:center;padding-left:8px">
                    <span style="font-size:10px;font-weight:500;color:#e8e6e3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(t.name)}</span>
                  </div>
                </div>
                <span style="width:40px;text-align:right;font-family:var(--mono);font-size:11px;color:#5a5550;flex-shrink:0">${t.daysStuck}d</span>
              </div>`;
            })
            .join("");
          return `<div style="margin-bottom:24px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <span style="font-size:13px;font-weight:500;color:#e8e6e3">${escHtml(b.sectionName)}</span>
              <span style="font-size:11px;color:#5a5550">${escHtml(b.projectName)}</span>
              <span style="font-family:var(--mono);font-size:11px;padding:2px 10px;border-radius:100px;background:rgba(255,170,77,0.1);color:#ffaa4d">${b.tasks.length} stuck</span>
            </div>
            <div style="margin-left:16px">${bars}</div>
          </div>`;
        })
        .join("")
    : "";

  // Suggestions
  const suggestionsHtml = data.suggestions
    .map(
      (s) =>
        `<div style="display:flex;align-items:flex-start;gap:12px;padding:16px 20px;border-radius:16px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);margin-bottom:8px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${severityColor(s.priority)};margin-top:5px;flex-shrink:0"></span>
          <p style="font-size:13px;color:#8a8580;line-height:1.6;margin:0">${escHtml(s.text)}</p>
        </div>`
    )
    .join("");

  const gc = gradeColor(data.overallGrade);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Asana Audit Report — ${ts}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#050505;--bg-alt:#0a0a0a;--border:rgba(255,255,255,0.06);--text:#e8e6e3;--text-muted:#8a8580;--text-dim:#5a5550;--accent:#c8ff00;--serif:'Instrument Serif',Georgia,serif;--sans:'DM Sans',-apple-system,sans-serif;--mono:'JetBrains Mono',monospace}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:var(--sans);-webkit-font-smoothing:antialiased}
.wrap{max-width:880px;margin:0 auto;padding:60px 24px 80px}
.section{margin-bottom:64px}
.section-num{font-family:var(--mono);font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);display:flex;align-items:center;gap:10px;margin-bottom:6px}
.section-num::after{content:'';flex:1;max-width:60px;height:1px;background:var(--accent);opacity:0.3}
.section-title{font-family:var(--serif);font-size:clamp(28px,4vw,44px);font-weight:400;line-height:1.1;letter-spacing:-0.03em;margin-bottom:32px}
.section-title em{color:var(--accent);font-style:normal}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.stat{background:rgba(255,255,255,0.025);border:1px solid var(--border);border-radius:16px;padding:20px;text-align:center}
.stat-val{font-family:var(--mono);font-size:24px;font-weight:700}
.stat-label{font-family:var(--mono);font-size:10px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-dim);margin-top:4px}
.footer{text-align:center;padding:40px 0;border-top:1px solid var(--border);margin-top:40px;font-family:var(--mono);font-size:11px;color:var(--text-dim);letter-spacing:0.05em}
@media(max-width:600px){.hero-row{flex-direction:column;align-items:flex-start}.stats{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<div class="wrap">

<!-- Hero -->
<div class="section">
<div style="display:inline-flex;gap:8px;align-items:center;padding:6px 16px;border-radius:100px;background:rgba(200,255,0,0.1);border:1px solid rgba(200,255,0,0.15);font-family:var(--mono);font-size:11px;color:var(--accent);margin-bottom:20px">
<span style="width:6px;height:6px;background:var(--accent);border-radius:50%"></span>
AUDIT REPORT
</div>
<h1 style="font-family:var(--serif);font-size:clamp(36px,6vw,64px);font-weight:400;line-height:1.0;letter-spacing:-0.04em;margin-bottom:12px">Asana <em style="color:var(--accent);font-style:normal">Audit</em></h1>
<p style="font-size:14px;color:var(--text-muted)">AND Gather Delivery Control Standard · ${escHtml(ts)}</p>
</div>

<!-- 01 Overall Health -->
<div class="section">
<div class="section-num">01 — OVERALL HEALTH</div>
<h2 class="section-title">Overall <em>Health</em></h2>
<div class="hero-row" style="display:flex;align-items:flex-start;gap:24px;margin-bottom:24px">
<div style="text-align:center">
<div style="width:80px;height:80px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:32px;border:2px solid ${gc};color:${gc};background:${gc}15">${data.overallGrade}</div>
<div style="font-family:var(--mono);font-size:12px;color:var(--text-dim);margin-top:6px">${data.overallScore}/100</div>
</div>
<div class="stats" style="flex:1">
<div class="stat"><div class="stat-val" style="color:var(--text)">${data.totalProjects}</div><div class="stat-label">Projects</div></div>
<div class="stat"><div class="stat-val" style="color:var(--text)">${data.totalTasksScanned}</div><div class="stat-label">Tasks Scanned</div></div>
<div class="stat"><div class="stat-val" style="color:${data.issuesBySeverity.critical > 0 ? "#ff4d4d" : "var(--text-dim)"}">${data.issuesBySeverity.critical}</div><div class="stat-label">Critical</div></div>
<div class="stat"><div class="stat-val" style="color:${data.totalIssues > 0 ? "#ffaa4d" : "#c8ff00"}">${data.totalIssues}</div><div class="stat-label">Total Issues</div></div>
</div>
</div>
</div>

<!-- 02 Project Health -->
<div class="section">
<div class="section-num">02 — PROJECT HEALTH</div>
<h2 class="section-title">Project <em>Health</em></h2>
${projectCards}
</div>

<!-- 03 Issues by Check Type -->
${data.totalIssues > 0 ? `<div class="section">
<div class="section-num">03 — ISSUES BY CHECK TYPE</div>
<h2 class="section-title">Issues by <em>Check Type</em></h2>
${issuesByCheck}
</div>` : ""}

<!-- 04 Bottleneck Radar -->
${allBottlenecks.length > 0 ? `<div class="section">
<div class="section-num">04 — BOTTLENECK RADAR</div>
<h2 class="section-title">Bottleneck <em>Radar</em></h2>
${bottleneckSection}
</div>` : ""}

<!-- 05 Action Items -->
${data.suggestions.length > 0 ? `<div class="section">
<div class="section-num">05 — ACTION ITEMS</div>
<h2 class="section-title">Action <em>Items</em></h2>
${suggestionsHtml}
</div>` : ""}

<div class="footer">Generated by TimeLog · AND Gather · ${escHtml(ts)}</div>
</div>
</body>
</html>`;
}

function downloadAuditHTML(data: AuditData) {
  const html = generateAuditHTML(data);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `asana-audit-${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ──

export default function AuditPage() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGids, setSelectedGids] = useState<Set<string>>(new Set());
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [personFilter, setPersonFilter] = useState("");
  const [personFilterOpen, setPersonFilterOpen] = useState(false);
  const [msgMode, setMsgMode] = useState<"assignee" | "creator" | "project">("assignee");
  const [msgPerson, setMsgPerson] = useState("");
  const [msgPersonOpen, setMsgPersonOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const runAudit = useCallback(async (gids?: Set<string>) => {
    setLoading(true);
    setError(null);
    try {
      const active = gids ?? selectedGids;
      const params = active.size > 0 ? `?projectGids=${[...active].join(",")}` : "";
      const res = await fetch(`/api/audit${params}`);
      if (!res.ok) throw new Error("Failed to fetch audit data");
      const json = await res.json();
      setData(json);
    } catch {
      setError("Failed to connect to Asana. Check your PAT configuration.");
    } finally {
      setLoading(false);
    }
  }, [selectedGids]);

  // Run on first load (all projects)
  useEffect(() => {
    runAudit(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allProjects = data?.projects ?? [];

  // Collect unique projects for the filter (from last full audit)
  const [projectList, setProjectList] = useState<{ gid: string; name: string }[]>([]);
  useEffect(() => {
    if (data && data.projects.length > 0) {
      setProjectList(
        data.projects
          .map((p) => ({ gid: p.projectGid, name: p.projectName }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    }
  }, [data]);

  function toggleProject(gid: string) {
    setSelectedGids((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  }

  function selectAll() {
    setSelectedGids(new Set());
  }

  // Collect unique people (assignees + creators) from issues
  const peopleList = (() => {
    if (!data) return [];
    const names = new Set<string>();
    for (const p of data.projects) {
      for (const i of p.issues) {
        if (i.assignee) names.add(i.assignee);
        if (i.creator) names.add(i.creator);
      }
    }
    return [...names].sort();
  })();

  function issueMatchesPerson(issue: AuditIssue): boolean {
    if (!personFilter) return true;
    return issue.assignee === personFilter || issue.creator === personFilter;
  }

  // People/project list for message generator
  const msgPeopleList = (() => {
    if (!data) return [];
    if (msgMode === "project") {
      return data.projects
        .filter((p) => p.issues.length > 0)
        .map((p) => p.projectName)
        .sort();
    }
    const names = new Set<string>();
    for (const p of data.projects)
      for (const i of p.issues) {
        const name = msgMode === "assignee" ? i.assignee : i.creator;
        if (name) names.add(name);
      }
    return [...names].sort();
  })();

  function generateSlackMessage(target: string): string {
    // By Project mode — group all issues in the project by assignee
    if (msgMode === "project") {
      const project = data!.projects.find((p) => p.projectName === target);
      if (!project || project.issues.length === 0) return "";

      const byPerson = new Map<string, AuditIssue[]>();
      for (const issue of project.issues) {
        const person = issue.assignee ?? issue.creator ?? "Unassigned";
        if (!byPerson.has(person)) byPerson.set(person, []);
        byPerson.get(person)!.push(issue);
      }

      const lines: string[] = [];
      lines.push("Hey team 👋");
      lines.push("");
      lines.push(
        `Quick heads-up — I ran an Asana audit on *${target}* and found a few tasks that need some attention. Could everyone take a look at their items below? Would really appreciate it!`
      );

      for (const [person, issues] of byPerson) {
        const firstName = person.split(" ")[0];
        lines.push("");
        lines.push(`*${firstName}*`);
        lines.push("");
        for (const issue of issues) {
          lines.push(`• *${issue.taskName ?? "Untitled task"}*`);
          lines.push(`  Issue: ${issue.message}`);
          lines.push(`  Fix: ${issue.suggestion}`);
        }
      }

      lines.push("");
      lines.push("Thanks so much for helping keep things tidy! Let me know if anything is unclear 🙌");
      lines.push("");
      lines.push("Franco");
      return lines.join("\n");
    }

    // By Assignee / By Creator — group this person's issues by project
    const byProject: { projectName: string; issues: AuditIssue[] }[] = [];
    for (const p of data!.projects) {
      const issues = p.issues.filter((i) =>
        msgMode === "assignee" ? i.assignee === target : i.creator === target
      );
      if (issues.length > 0) byProject.push({ projectName: p.projectName, issues });
    }
    if (byProject.length === 0) return "";

    const firstName = target.split(" ")[0];
    const lines: string[] = [];
    lines.push(`Hey ${firstName} 👋`);
    lines.push("");
    lines.push(
      "Quick heads-up — I ran an Asana audit and found a few tasks that need some attention. Would really appreciate it if you could take a look when you get a chance!"
    );

    for (const { projectName, issues } of byProject) {
      lines.push("");
      lines.push(`📁 *${projectName}*`);
      lines.push("");
      for (const issue of issues) {
        lines.push(`• *${issue.taskName ?? "Untitled task"}*`);
        lines.push(`  Issue: ${issue.message}`);
        lines.push(`  Fix: ${issue.suggestion}`);
      }
    }

    lines.push("");
    lines.push("Thanks so much for helping keep things tidy! Let me know if anything is unclear 🙌");
    lines.push("");
    lines.push("Franco");

    return lines.join("\n");
  }

  const filterLabel =
    selectedGids.size === 0
      ? "All Projects"
      : selectedGids.size === 1
        ? projectList.find((p) => selectedGids.has(p.gid))?.name ?? "1 project"
        : `${selectedGids.size} projects`;

  const checkLabels: Record<string, string> = {
    "task-naming": "Naming Convention",
    "required-fields": "Required Fields",
    "board-structure": "Board Structure",
    bottleneck: "Bottlenecks",
    "hold-review": "Hold Review",
  };

  const checkIcons: Record<string, string> = {
    "task-naming": "ANDG",
    "required-fields": "5F",
    "board-structure": "9C",
    bottleneck: "!",
    "hold-review": "H",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <ShieldCheck className="h-6 w-6 text-lime-400" />
          <h1 className="text-2xl font-bold">Asana Audit</h1>
        </div>
        <p className="text-[13px] text-zinc-500">AND Gather Delivery Control Standard</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Multi-select dropdown */}
        <div className="relative">
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-zinc-300 outline-none transition hover:border-white/[0.12] focus:border-lime-400/30"
          >
            <span className="max-w-[200px] truncate">{filterLabel}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-500 transition", filterOpen && "rotate-180")} />
          </button>

          {filterOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-white/[0.08] bg-[#141416] p-1 shadow-2xl">
                <button
                  onClick={selectAll}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition hover:bg-white/[0.04]",
                    selectedGids.size === 0 ? "text-lime-400" : "text-zinc-400"
                  )}
                >
                  {selectedGids.size === 0 && <Check className="h-3.5 w-3.5 shrink-0" />}
                  {selectedGids.size > 0 && <span className="w-3.5 shrink-0" />}
                  All Projects
                </button>
                <div className="my-1 h-px bg-white/[0.06]" />
                <div className="max-h-60 overflow-y-auto">
                  {projectList.map((p) => {
                    const selected = selectedGids.has(p.gid);
                    return (
                      <button
                        key={p.gid}
                        onClick={() => toggleProject(p.gid)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition hover:bg-white/[0.04]",
                          selected ? "text-white" : "text-zinc-400"
                        )}
                      >
                        <span className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border shrink-0",
                          selected
                            ? "border-lime-400 bg-lime-400/20"
                            : "border-white/[0.12] bg-white/[0.03]"
                        )}>
                          {selected && <Check className="h-3 w-3 text-lime-400" />}
                        </span>
                        <span className="truncate">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Person filter */}
        {data && peopleList.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setPersonFilterOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-zinc-300 outline-none transition hover:border-white/[0.12] focus:border-lime-400/30"
            >
              <User className="h-3.5 w-3.5 text-zinc-500" />
              <span className="max-w-[140px] truncate">{personFilter || "All People"}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-500 transition", personFilterOpen && "rotate-180")} />
            </button>

            {personFilterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPersonFilterOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-white/[0.08] bg-[#141416] p-1 shadow-2xl">
                  <button
                    onClick={() => { setPersonFilter(""); setPersonFilterOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition hover:bg-white/[0.04]",
                      !personFilter ? "text-lime-400" : "text-zinc-400"
                    )}
                  >
                    {!personFilter && <Check className="h-3.5 w-3.5 shrink-0" />}
                    {personFilter && <span className="w-3.5 shrink-0" />}
                    All People
                  </button>
                  <div className="my-1 h-px bg-white/[0.06]" />
                  <div className="max-h-60 overflow-y-auto">
                    {peopleList.map((name) => (
                      <button
                        key={name}
                        onClick={() => { setPersonFilter(name); setPersonFilterOpen(false); }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition hover:bg-white/[0.04]",
                          personFilter === name ? "text-lime-400" : "text-zinc-400"
                        )}
                      >
                        {personFilter === name && <Check className="h-3.5 w-3.5 shrink-0" />}
                        {personFilter !== name && <span className="w-3.5 shrink-0" />}
                        <span className="truncate">{name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <button
          onClick={() => runAudit()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-lime-400 px-4 py-2 text-[13px] font-semibold text-[#0a0a0b] transition hover:bg-lime-300 disabled:opacity-60"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          {loading ? "Auditing..." : "Run Audit"}
        </button>
        {data && (
          <button
            onClick={() => downloadAuditHTML(data)}
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[13px] text-zinc-300 transition hover:border-white/[0.12] hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            Export HTML
          </button>
        )}
        {data && (
          <span className="text-[11px] text-zinc-600">
            Last run: {new Date(data.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && !data && (
        <div className="py-20 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-400" />
          <p className="mt-3 text-[13px] text-zinc-500">Fetching live data from Asana...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.04] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-red-400 shrink-0" />
          <p className="text-[13px] text-red-400">{error}</p>
        </div>
      )}

      {data && (
        <div className="space-y-10">
          {/* ── 01 OVERALL HEALTH ── */}
          <Section num="01" title="Overall" em="Health">
            <div className="flex items-start gap-6">
              {/* Grade badge */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-20 w-20 items-center justify-center rounded-2xl border-2 text-3xl font-bold",
                    gradeStyle(data.overallGrade)
                  )}
                >
                  {data.overallGrade}
                </div>
                <span className="mt-1.5 text-[12px] font-mono text-zinc-500">
                  {data.overallScore}/100
                </span>
              </div>

              {/* Stat cards */}
              <div className="flex-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label="Projects" value={data.totalProjects} />
                <MiniStat label="Tasks Scanned" value={data.totalTasksScanned} />
                <MiniStat
                  label="Critical"
                  value={data.issuesBySeverity.critical}
                  color={data.issuesBySeverity.critical > 0 ? "text-red-400" : "text-zinc-400"}
                />
                <MiniStat
                  label="Total Issues"
                  value={data.totalIssues}
                  color={data.totalIssues > 0 ? "text-amber-400" : "text-lime-400"}
                />
              </div>
            </div>
          </Section>

          {/* ── 02 PROJECT HEALTH ── */}
          <Section num="02" title="Project" em="Health">
            {allProjects.length > 0 ? (
              <div className="space-y-2">
                {allProjects.map((p) => {
                  const isExpanded = expandedProject === p.projectGid;
                  return (
                    <div key={p.projectGid}>
                      <button
                        onClick={() =>
                          setExpandedProject(isExpanded ? null : p.projectGid)
                        }
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-left transition hover:bg-white/[0.04]"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-zinc-500 shrink-0" />
                          )}
                          <GradeBadge grade={p.grade} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-white truncate">
                              {p.projectName}
                            </p>
                            <div className="flex gap-3 mt-0.5">
                              <span className="text-[11px] text-zinc-500">
                                {p.activeTasks} active tasks
                              </span>
                              {p.issuesBySeverity.critical > 0 && (
                                <span className="text-[11px] text-red-400">
                                  {p.issuesBySeverity.critical} critical
                                </span>
                              )}
                              {p.issuesBySeverity.warning > 0 && (
                                <span className="text-[11px] text-amber-400">
                                  {p.issuesBySeverity.warning} warnings
                                </span>
                              )}
                              {p.issuesBySeverity.info > 0 && (
                                <span className="text-[11px] text-blue-400">
                                  {p.issuesBySeverity.info} info
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Score bar */}
                          <div className="w-20 shrink-0">
                            <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", scoreBarColor(p.score))}
                                style={{ width: `${p.score}%` }}
                              />
                            </div>
                            <p className="mt-0.5 text-right text-[11px] font-mono text-zinc-500">
                              {p.score}
                            </p>
                          </div>
                        </div>
                      </button>

                      {/* Expanded issues */}
                      {isExpanded && (() => {
                        const filtered = p.issues.filter(issueMatchesPerson);
                        if (filtered.length > 0) return (
                          <div className="ml-8 mt-1 mb-2 space-y-1">
                            {filtered.map((issue, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2 rounded-lg bg-white/[0.02] px-3 py-2"
                              >
                                <SeverityIcon severity={issue.severity} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[12px] text-zinc-300">
                                    {issue.taskName && (
                                      <span className="font-medium text-white">
                                        {issue.taskName}
                                      </span>
                                    )}
                                    {issue.taskName && " — "}
                                    {issue.message}
                                  </p>
                                  <div className="flex gap-3 mt-0.5">
                                    {issue.assignee && (
                                      <span className="text-[11px] text-zinc-500">
                                        Assignee: <span className="text-zinc-400">{issue.assignee}</span>
                                      </span>
                                    )}
                                    {issue.creator && (
                                      <span className="text-[11px] text-zinc-500">
                                        Creator: <span className="text-zinc-400">{issue.creator}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <SeverityBadge severity={issue.severity} />
                              </div>
                            ))}
                          </div>
                        );
                        return (
                          <div className="ml-8 mt-1 mb-2 rounded-lg bg-lime-400/[0.04] border border-lime-400/10 px-3 py-2">
                            <p className="text-[12px] text-lime-400">
                              {p.issues.length === 0 ? "No issues found — this project is clean!" : "No issues matching this person filter"}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState />
            )}
          </Section>

          {/* ── 03 ISSUES BY CHECK ── */}
          {data.totalIssues > 0 && (
            <Section num="03" title="Issues by" em="Check Type">
              {Object.keys(checkLabels).map((check) => {
                const allIssues = allProjects.flatMap((p) =>
                  p.issues.filter((i) => i.check === check)
                );
                const issues = allIssues.filter(issueMatchesPerson);
                if (issues.length === 0) return null;
                return (
                  <div key={check} className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.05] text-[10px] font-bold text-zinc-400">
                        {checkIcons[check]}
                      </span>
                      <h3 className="text-[14px] font-semibold text-white">
                        {checkLabels[check]}
                      </h3>
                      <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-zinc-400">
                        {issues.length}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="border-b border-white/[0.06]">
                            <th className="pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                              Task
                            </th>
                            <th className="pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                              Assignee
                            </th>
                            <th className="pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                              Creator
                            </th>
                            {check === "bottleneck" && (
                              <th className="pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                                Section
                              </th>
                            )}
                            <th className="pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                              Issue
                            </th>
                            <th className="pb-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                              Severity
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {issues.slice(0, 20).map((issue, i) => (
                            <tr key={i} className="border-b border-white/[0.03]">
                              <td className="py-2 text-zinc-400 max-w-[160px] truncate" title={issue.taskName ?? ""}>
                                {issue.taskName ?? "—"}
                              </td>
                              <td className="py-2 text-zinc-400 whitespace-nowrap">
                                {issue.assignee ?? "—"}
                              </td>
                              <td className="py-2 text-zinc-500 whitespace-nowrap">
                                {issue.creator ?? "—"}
                              </td>
                              {check === "bottleneck" && (
                                <td className="py-2 text-zinc-500">
                                  {issue.sectionName}
                                </td>
                              )}
                              <td className="py-2 text-zinc-300">{issue.message}</td>
                              <td className="py-2 text-right">
                                <SeverityBadge severity={issue.severity} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {issues.length > 20 && (
                        <p className="mt-2 text-[11px] text-zinc-600">
                          Showing 20 of {issues.length} issues
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </Section>
          )}

          {/* ── 04 BOTTLENECK RADAR ── */}
          {allProjects.some((p) => p.bottlenecks.length > 0) && (
            <Section num="04" title="Bottleneck" em="Radar">
              <div className="space-y-4">
                {allProjects
                  .flatMap((p) =>
                    p.bottlenecks.map((b) => ({
                      ...b,
                      projectName: p.projectName,
                    }))
                  )
                  .sort((a, b) => b.tasks.length - a.tasks.length)
                  .map((b, i) => {
                    const maxDays = Math.max(...b.tasks.map((t) => t.daysStuck));
                    return (
                      <div key={i}>
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-3.5 w-3.5 text-amber-400" />
                          <span className="text-[13px] font-medium text-white">
                            {b.sectionName}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            {b.projectName}
                          </span>
                          <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                            {b.tasks.length} stuck
                          </span>
                        </div>
                        <div className="space-y-1 ml-5">
                          {b.tasks.map((t) => (
                            <div
                              key={t.gid}
                              className="flex items-center gap-2"
                            >
                              <div className="flex-1 h-5 rounded bg-white/[0.03] overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded flex items-center pl-2",
                                    t.daysStuck > 10
                                      ? "bg-red-400/40"
                                      : "bg-amber-400/30"
                                  )}
                                  style={{
                                    width: `${Math.min((t.daysStuck / maxDays) * 100, 100)}%`,
                                  }}
                                >
                                  <span className="text-[10px] font-medium text-white whitespace-nowrap truncate">
                                    {t.name}
                                  </span>
                                </div>
                              </div>
                              <span className="w-12 text-right text-[11px] font-mono text-zinc-500 shrink-0">
                                {t.daysStuck}d
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Section>
          )}

          {/* ── 05 SUGGESTIONS ── */}
          {data.suggestions.length > 0 && (
            <Section num="05" title="Action" em="Items">
              <div className="space-y-2">
                {data.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                  >
                    <SeverityIcon severity={s.priority} />
                    <p className="text-[13px] text-zinc-300 leading-relaxed">
                      {s.text}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── 06 MESSAGE GENERATOR ── */}
          <Section num="06" title="Message" em="Generator">
            <div className="space-y-4">
              {/* Controls row */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Mode toggle */}
                <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
                  {(["assignee", "creator", "project"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => { setMsgMode(mode); setMsgPerson(""); }}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-[12px] font-medium capitalize transition",
                        msgMode === mode
                          ? "bg-white/[0.08] text-white"
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      By {mode}
                    </button>
                  ))}
                </div>

                {/* Person picker */}
                <div className="relative">
                  <button
                    onClick={() => setMsgPersonOpen((v) => !v)}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-zinc-300 outline-none transition hover:border-white/[0.12]"
                  >
                    {msgMode === "project"
                      ? <Folder className="h-3.5 w-3.5 text-zinc-500" />
                      : <MessageSquare className="h-3.5 w-3.5 text-zinc-500" />}
                    <span className="max-w-[160px] truncate">
                      {msgPerson || (msgMode === "project" ? "Select project…" : "Select person…")}
                    </span>
                    <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-500 transition", msgPersonOpen && "rotate-180")} />
                  </button>

                  {msgPersonOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMsgPersonOpen(false)} />
                      <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-white/[0.08] bg-[#141416] p-1 shadow-2xl">
                        {msgPeopleList.length === 0 ? (
                          <p className="px-3 py-2 text-[12px] text-zinc-500">No people found</p>
                        ) : (
                          <div className="max-h-60 overflow-y-auto">
                            {msgPeopleList.map((name) => (
                              <button
                                key={name}
                                onClick={() => { setMsgPerson(name); setMsgPersonOpen(false); setCopied(false); }}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition hover:bg-white/[0.04]",
                                  msgPerson === name ? "text-lime-400" : "text-zinc-400"
                                )}
                              >
                                {msgPerson === name && <Check className="h-3.5 w-3.5 shrink-0" />}
                                {msgPerson !== name && <span className="w-3.5 shrink-0" />}
                                <span className="truncate">{name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Message preview */}
              {msgPerson && (() => {
                const msg = generateSlackMessage(msgPerson);
                if (!msg) return (
                  <p className="text-[12px] text-zinc-600">
                    {msgMode === "project"
                      ? `No issues found for project "${msgPerson}".`
                      : `No issues found for ${msgPerson} as ${msgMode}.`}
                  </p>
                );
                return (
                  <div className="relative">
                    <pre className="whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-[12px] leading-relaxed text-zinc-300 font-sans">
                      {msg}
                    </pre>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className={cn(
                        "absolute right-3 top-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition",
                        copied
                          ? "bg-lime-400/20 text-lime-400"
                          : "bg-white/[0.06] text-zinc-400 hover:bg-white/[0.10] hover:text-white"
                      )}
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                );
              })()}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

// ── Components ──

function Section({
  num,
  title,
  em,
  children,
}: {
  num: string;
  title: string;
  em: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-lime-400/60 font-mono">
        {num}
      </p>
      <h2 className="mb-5 text-xl font-semibold text-white">
        {title} <span className="text-lime-400">{em}</span>
      </h2>
      {children}
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
      <p className={cn("text-xl font-bold font-mono", color ?? "text-white")}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">
        {label}
      </p>
    </div>
  );
}

function GradeBadge({ grade }: { grade: Grade }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-bold shrink-0",
        gradeStyle(grade)
      )}
    >
      {grade}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    critical: "bg-red-400/10 border-red-400/20 text-red-400",
    warning: "bg-amber-400/10 border-amber-400/20 text-amber-400",
    info: "bg-blue-400/10 border-blue-400/20 text-blue-400",
  };
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-medium",
        styles[severity]
      )}
    >
      {severity}
    </span>
  );
}

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === "critical")
    return <AlertCircle className="mt-0.5 h-3.5 w-3.5 text-red-400 shrink-0" />;
  if (severity === "warning")
    return <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-400 shrink-0" />;
  return <Info className="mt-0.5 h-3.5 w-3.5 text-blue-400 shrink-0" />;
}

function EmptyState() {
  return (
    <p className="py-8 text-center text-[13px] text-zinc-600">
      No projects to audit
    </p>
  );
}

function gradeStyle(grade: Grade): string {
  const styles: Record<Grade, string> = {
    A: "bg-lime-400/10 border-lime-400/30 text-lime-400",
    B: "bg-lime-400/[0.06] border-lime-400/20 text-lime-400/80",
    C: "bg-amber-400/10 border-amber-400/30 text-amber-400",
    D: "bg-amber-400/[0.06] border-amber-400/20 text-amber-400/80",
    F: "bg-red-400/10 border-red-400/30 text-red-400",
  };
  return styles[grade];
}

function scoreBarColor(score: number): string {
  if (score >= 90) return "bg-lime-400";
  if (score >= 75) return "bg-lime-400/70";
  if (score >= 60) return "bg-amber-400";
  if (score >= 40) return "bg-amber-400/70";
  return "bg-red-400";
}
