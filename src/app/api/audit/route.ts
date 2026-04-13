import { auth } from "@/lib/auth";
import {
  fetchProjects,
  fetchSections,
  fetchTasksDetailed,
  type AsanaTaskDetailed,
  type AsanaSectionResponse,
} from "@/lib/asana";
import { NextRequest, NextResponse } from "next/server";

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

// ── Constants ──

const REQUIRED_SECTIONS = [
  "Queue", "To-Do", "In Progress", "Internal Review",
  "In Revision", "External Review", "Approved", "Launched", "Hold",
];

const REQUIRED_FIELDS = [
  "Due Date", "Deliverable Type", "# of Assets", "Lead",
];

// ANDG-[CLIENT]-[PRODUCT] required; anything after (no spaces)
const NAMING_REGEX = /^ANDG-[^\s-]+-[^\s-]+[^\s]*$/;

const BOTTLENECK_THRESHOLDS: Record<string, number> = {
  "To-Do": 2,
  "External Review": 5,
  "Approved": 1,
};

// ── Helpers ──

function countBusinessDays(from: Date, to: Date): number {
  let count = 0;
  const d = new Date(from);
  while (d < to) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function getGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

function getCurrentSection(task: AsanaTaskDetailed): string | null {
  const raw = task.memberships?.[0]?.section?.name ?? null;
  return raw ? normalizeSectionName(raw) : null;
}

// ── Audit Checks ──

const SKIP_SECTIONS = new Set(["approved", "launched"]);

function isAuditable(task: AsanaTaskDetailed): boolean {
  if (task.completed) return false;
  const section = getCurrentSection(task);
  if (section && SKIP_SECTIONS.has(section.toLowerCase())) return false;
  return true;
}

function checkTaskNaming(tasks: AsanaTaskDetailed[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const t of tasks) {
    if (!isAuditable(t)) continue;
    if (!NAMING_REGEX.test(t.name.trim())) {
      issues.push({
        check: "task-naming",
        severity: "warning",
        taskGid: t.gid,
        taskName: t.name,
        assignee: t.assignee?.name,
        creator: t.created_by?.name,
        message: `Task name doesn't follow ANDG convention`,
        suggestion: "Rename to ANDG-[CLIENT]-[PRODUCT]-[Concept]",
      });
    }
  }
  return issues;
}

function checkRequiredFields(tasks: AsanaTaskDetailed[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const t of tasks) {
    if (!isAuditable(t)) continue;
    const missing: string[] = [];

    for (const fieldName of REQUIRED_FIELDS) {
      if (fieldName === "Due Date") {
        if (t.due_on) continue;
        const cf = t.custom_fields?.find(
          (f) => f.name.toLowerCase() === "due date"
        );
        if (cf?.display_value) continue;
        missing.push("Due Date");
        continue;
      }
      // Lead = Asana assignee
      if (fieldName === "Lead") {
        if (!t.assignee) missing.push("Lead (Assignee)");
        continue;
      }
      // Other fields: check custom_fields
      const cf = t.custom_fields?.find(
        (f) => f.name.toLowerCase() === fieldName.toLowerCase()
      );
      if (!cf || !cf.display_value) {
        missing.push(fieldName);
      }
    }

    if (missing.length > 0) {
      issues.push({
        check: "required-fields",
        severity: "critical",
        taskGid: t.gid,
        taskName: t.name,
        assignee: t.assignee?.name,
        creator: t.created_by?.name,
        message: `Missing: ${missing.join(", ")}`,
        suggestion: `Fill in the missing fields on this task`,
      });
    }
  }
  return issues;
}

function normalizeSectionName(name: string): string {
  return name.replace(/:$/, "").trim();
}

function checkBoardStructure(sections: AsanaSectionResponse[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const sectionNames = sections.map((s) => normalizeSectionName(s.name));

  // Missing sections
  for (const required of REQUIRED_SECTIONS) {
    const found = sectionNames.some(
      (s) => s.toLowerCase() === required.toLowerCase()
    );
    if (!found) {
      issues.push({
        check: "board-structure",
        severity: "critical",
        message: `Missing column: ${required}`,
        suggestion: `Add a "${required}" section to this project board`,
      });
    }
  }

  // Check order (only matched sections)
  const matched = sectionNames.filter((s) =>
    REQUIRED_SECTIONS.some((r) => r.toLowerCase() === s.toLowerCase())
  );
  const expectedOrder = REQUIRED_SECTIONS.filter((r) =>
    matched.some((m) => m.toLowerCase() === r.toLowerCase())
  );
  const isOrdered = matched.every(
    (s, i) => s.toLowerCase() === expectedOrder[i]?.toLowerCase()
  );
  if (!isOrdered && matched.length > 1) {
    issues.push({
      check: "board-structure",
      severity: "warning",
      message: "Columns are out of standard order",
      suggestion: `Expected order: ${REQUIRED_SECTIONS.join(" → ")}`,
    });
  }

  // Extra sections
  for (const s of sectionNames) {
    const isStandard = REQUIRED_SECTIONS.some(
      (r) => r.toLowerCase() === s.toLowerCase()
    );
    if (!isStandard && s.toLowerCase() !== "untitled section") {
      issues.push({
        check: "board-structure",
        severity: "info",
        message: `Non-standard column: ${s}`,
        suggestion: "Consider removing or renaming to match the standard",
      });
    }
  }

  return issues;
}

function checkBottlenecks(tasks: AsanaTaskDetailed[]): {
  issues: AuditIssue[];
  bottlenecks: ProjectAudit["bottlenecks"];
} {
  const issues: AuditIssue[] = [];
  const bottleneckMap: Record<string, { gid: string; name: string; daysStuck: number }[]> = {};
  const now = new Date();

  for (const t of tasks) {
    if (!isAuditable(t)) continue;
    const section = getCurrentSection(t);
    if (!section || !(section in BOTTLENECK_THRESHOLDS)) continue;

    const threshold = BOTTLENECK_THRESHOLDS[section];
    const days = countBusinessDays(new Date(t.modified_at), now);

    if (days > threshold) {
      const severity: Severity = days > threshold * 2 ? "critical" : "warning";
      issues.push({
        check: "bottleneck",
        severity,
        taskGid: t.gid,
        taskName: t.name,
        sectionName: section,
        assignee: t.assignee?.name,
        creator: t.created_by?.name,
        message: `Stuck in ${section} for ${days} business days (limit: ${threshold})`,
        suggestion: "Move or update this task",
      });

      if (!bottleneckMap[section]) bottleneckMap[section] = [];
      bottleneckMap[section].push({ gid: t.gid, name: t.name, daysStuck: days });
    }
  }

  const bottlenecks = Object.entries(bottleneckMap).map(([sectionName, tasks]) => ({
    sectionName,
    tasks: tasks.sort((a, b) => b.daysStuck - a.daysStuck),
  }));

  return { issues, bottlenecks };
}

function checkHoldReview(tasks: AsanaTaskDetailed[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const now = new Date();

  for (const t of tasks) {
    if (t.completed) continue; // Hold check uses its own filter — completed only
    const section = getCurrentSection(t);
    if (section?.toLowerCase() !== "hold") continue;

    const daysInHold = Math.floor(
      (now.getTime() - new Date(t.modified_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysInHold > 21) {
      issues.push({
        check: "hold-review",
        severity: daysInHold > 42 ? "warning" : "info",
        taskGid: t.gid,
        taskName: t.name,
        sectionName: "Hold",
        assignee: t.assignee?.name,
        creator: t.created_by?.name,
        message: `On hold for ${daysInHold} days — needs review`,
        suggestion:
          daysInHold > 42
            ? "This task has been on hold for over 6 weeks. Archive or reactivate."
            : "Review if this task should be archived or moved back to Queue",
      });
    }
  }

  return issues;
}

// ── Audit a single project ──

async function auditProject(
  projectGid: string,
  projectName: string
): Promise<ProjectAudit> {
  const [sections, tasks] = await Promise.all([
    fetchSections(projectGid),
    fetchTasksDetailed(projectGid),
  ]);

  const activeTasks = tasks.filter((t) => !t.completed);

  // Run all checks
  const namingIssues = checkTaskNaming(tasks);
  const fieldIssues = checkRequiredFields(tasks);
  const boardIssues = checkBoardStructure(sections);
  const { issues: bottleneckIssues, bottlenecks } = checkBottlenecks(tasks);
  const holdIssues = checkHoldReview(tasks);

  const allIssues = [
    ...namingIssues,
    ...fieldIssues,
    ...boardIssues,
    ...bottleneckIssues,
    ...holdIssues,
  ];

  const issuesBySeverity = {
    critical: allIssues.filter((i) => i.severity === "critical").length,
    warning: allIssues.filter((i) => i.severity === "warning").length,
    info: allIssues.filter((i) => i.severity === "info").length,
  };

  const score = Math.max(
    0,
    100 -
      issuesBySeverity.critical * 10 -
      issuesBySeverity.warning * 5 -
      issuesBySeverity.info * 2
  );

  return {
    projectGid,
    projectName,
    grade: getGrade(score),
    score,
    totalTasks: tasks.length,
    activeTasks: activeTasks.length,
    issues: allIssues,
    issuesBySeverity,
    sectionNames: sections.map((s) => normalizeSectionName(s.name)),
    bottlenecks,
  };
}

// ── Generate suggestions ──

function generateSuggestions(
  projects: ProjectAudit[]
): { priority: Severity; text: string }[] {
  const suggestions: { priority: Severity; text: string }[] = [];
  const allIssues = projects.flatMap((p) => p.issues);

  const namingCount = allIssues.filter((i) => i.check === "task-naming").length;
  if (namingCount > 5) {
    suggestions.push({
      priority: "warning",
      text: `${namingCount} tasks don't follow the ANDG naming convention. Consider a team training on the standard format: ANDG-[CLIENT]-[PRODUCT]-[Concept].`,
    });
  } else if (namingCount > 0) {
    suggestions.push({
      priority: "info",
      text: `${namingCount} task${namingCount === 1 ? "" : "s"} with non-standard naming. Fix individually.`,
    });
  }

  const missingSections = allIssues.filter(
    (i) => i.check === "board-structure" && i.severity === "critical"
  );
  if (missingSections.length > 0) {
    const cols = [...new Set(missingSections.map((i) => i.message.replace("Missing column: ", "")))];
    suggestions.push({
      priority: "critical",
      text: `Missing board columns across projects: ${cols.join(", ")}. Add them to standardize the workflow.`,
    });
  }

  const fieldIssues = allIssues.filter((i) => i.check === "required-fields");
  if (fieldIssues.length > 10) {
    suggestions.push({
      priority: "critical",
      text: `${fieldIssues.length} missing required fields across tasks. This blocks delivery tracking. Prioritize filling in Due Date, Lead, and Deliverable Type.`,
    });
  }

  const extReview = allIssues.filter(
    (i) => i.check === "bottleneck" && i.sectionName === "External Review"
  );
  if (extReview.length > 0) {
    suggestions.push({
      priority: "warning",
      text: `${extReview.length} task${extReview.length === 1 ? "" : "s"} overdue in External Review. Follow up with clients for approvals.`,
    });
  }

  const holdIssues = allIssues.filter((i) => i.check === "hold-review");
  if (holdIssues.length > 0) {
    suggestions.push({
      priority: "info",
      text: `${holdIssues.length} task${holdIssues.length === 1 ? "" : "s"} on hold for over 3 weeks. Schedule a hold-review to archive or reactivate.`,
    });
  }

  const todoStuck = allIssues.filter(
    (i) => i.check === "bottleneck" && i.sectionName === "To-Do"
  );
  if (todoStuck.length > 0) {
    suggestions.push({
      priority: "warning",
      text: `${todoStuck.length} task${todoStuck.length === 1 ? "" : "s"} stuck in To-Do for over 48h. Assign and move to In Progress or return to Queue.`,
    });
  }

  return suggestions.sort((a, b) => {
    const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
    return order[a.priority] - order[b.priority];
  });
}

// ── Main handler ──

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectGids = req.nextUrl.searchParams.get("projectGids");

  try {
    let projectsToAudit: { gid: string; name: string }[];
    const allProjects = await fetchProjects();

    if (projectGids) {
      const gidSet = new Set(projectGids.split(","));
      projectsToAudit = allProjects
        .filter((p) => gidSet.has(p.gid))
        .map((p) => ({ gid: p.gid, name: p.name }));
    } else {
      projectsToAudit = allProjects.map((p) => ({ gid: p.gid, name: p.name }));
    }

    // Audit all projects in parallel
    const projectAudits = await Promise.all(
      projectsToAudit.map((p) => auditProject(p.gid, p.name))
    );

    // Overall score (weighted by active tasks)
    const totalActiveTasks = projectAudits.reduce((s, p) => s + p.activeTasks, 0);
    const overallScore =
      totalActiveTasks > 0
        ? Math.round(
            projectAudits.reduce((s, p) => s + p.score * p.activeTasks, 0) /
              totalActiveTasks
          )
        : 100;

    const totalIssues = projectAudits.reduce((s, p) => s + p.issues.length, 0);
    const issuesBySeverity = {
      critical: projectAudits.reduce((s, p) => s + p.issuesBySeverity.critical, 0),
      warning: projectAudits.reduce((s, p) => s + p.issuesBySeverity.warning, 0),
      info: projectAudits.reduce((s, p) => s + p.issuesBySeverity.info, 0),
    };

    const suggestions = generateSuggestions(projectAudits);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overallGrade: getGrade(overallScore),
      overallScore,
      totalProjects: projectAudits.length,
      totalIssues,
      totalTasksScanned: projectAudits.reduce((s, p) => s + p.totalTasks, 0),
      issuesBySeverity,
      projects: projectAudits.sort((a, b) => a.score - b.score),
      suggestions,
    });
  } catch (error) {
    console.error("Audit error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data from Asana" },
      { status: 502 }
    );
  }
}
