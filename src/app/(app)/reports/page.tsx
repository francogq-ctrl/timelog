"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format, startOfWeek, endOfWeek, subWeeks, subMonths } from "date-fns";
import {
  Download,
  AlertTriangle,
  Users,
  Clock,
  Briefcase,
  TrendingUp,
  Filter,
  X,
  ChevronDown,
  Check,
  FileSpreadsheet,
  FileText,
  Upload,
} from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

interface ReportData {
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

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

type Period = "this-week" | "last-week" | "this-month" | "last-month" | "year" | "month" | "custom";

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [period, setPeriod] = useState<Period>("this-week");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [users, setUsers] = useState<UserOption[]>([]);
  const [allClients, setAllClients] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [projectSearch, setProjectSearch] = useState("");

  // Dropdown open states
  const [userDropOpen, setUserDropOpen] = useState(false);
  const [clientDropOpen, setClientDropOpen] = useState(false);

  // Expandable client row state
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  // Date range state for year/month/custom modes
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Target hours configuration for Hours by Person
  const [targetHours, setTargetHours] = useState(40);
  const [weeksInPeriod, setWeeksInPeriod] = useState(1);

  // Import state
  type ImportRow = { person: string; date: string; client: string; task: string; category: string; workType: string; hours: number; notes: string };
  type ImportResult = { imported: number; skipped: number; errors: string[] };
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Fetch users for filter
  useEffect(() => {
    fetch("/api/reports/users")
      .then((r) => r.json())
      .then((json) => setUsers(Array.isArray(json) ? json : []))
      .catch(() => {});
  }, []);

  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (period) {
      case "this-week":
        return {
          from: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
          to: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        };
      case "last-week": {
        const lastWeek = subWeeks(now, 1);
        return {
          from: format(startOfWeek(lastWeek, { weekStartsOn: 1 }), "yyyy-MM-dd"),
          to: format(endOfWeek(lastWeek, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        };
      }
      case "this-month":
        return {
          from: format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd"),
          to: format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd"),
        };
      case "last-month": {
        const lm = subMonths(now, 1);
        return {
          from: format(new Date(lm.getFullYear(), lm.getMonth(), 1), "yyyy-MM-dd"),
          to: format(new Date(lm.getFullYear(), lm.getMonth() + 1, 0), "yyyy-MM-dd"),
        };
      }
      case "year":
        return {
          from: `${selectedYear}-01-01`,
          to: `${selectedYear}-12-31`,
        };
      case "month": {
        const first = new Date(selectedYear, selectedMonth, 1);
        const last = new Date(selectedYear, selectedMonth + 1, 0);
        return {
          from: format(first, "yyyy-MM-dd"),
          to: format(last, "yyyy-MM-dd"),
        };
      }
      case "custom":
        return {
          from: customFrom,
          to: customTo,
        };
    }
  }, [period, selectedYear, selectedMonth, customFrom, customTo]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange();
    const params = new URLSearchParams({ from, to });
    if (selectedUser) params.set("userId", selectedUser.id);
    if (selectedClient) params.set("client", selectedClient);
    try {
      const res = await fetch(`/api/reports?${params}`);
      const json: ReportData = await res.json();
      setData(json);
      // Capture full client list on first unfiltered load
      if (!selectedUser && !selectedClient && json.byClient.length > 0) {
        setAllClients((prev) =>
          prev.length > 0 ? prev : json.byClient.map((c) => c.name).sort()
        );
      }
    } finally {
      setLoading(false);
    }
  }, [getDateRange, selectedUser, selectedClient]);

  useEffect(() => {
    setAllClients([]); // reset client list on period change so it refreshes
  }, [period]);

  // Guard: only fetch if custom mode has both dates
  useEffect(() => {
    if (period === "custom" && (!customFrom || !customTo)) {
      return; // Don't fetch until both dates are filled
    }
    fetchReport();
  }, [fetchReport, period, customFrom, customTo]);

  // Filtered deliverables (project search is client-side only)
  const filteredDeliverables = data?.byDeliverable.filter((d) => {
    if (!projectSearch) return true;
    const q = projectSearch.toLowerCase();
    return (
      d.client.toLowerCase().includes(q) ||
      (d.task ?? "").toLowerCase().includes(q)
    );
  }) ?? [];

  async function exportXLSX() {
    if (!data) return;
    setExporting(true);
    try {
      const { from, to } = getDateRange();
      const params = new URLSearchParams({ from, to });
      if (selectedUser) params.set("userId", selectedUser.id);
      if (selectedClient) params.set("client", selectedClient);

      const res = await fetch(`/api/reports/export?${params}`);
      const { rows } = await res.json() as {
        rows: {
          person: string;
          date: string;
          client: string;
          project: string;
          task: string;
          category: string;
          workType: string;
          hours: number;
          notes: string;
        }[];
      };

      const wb = XLSX.utils.book_new();
      const headers = ["Date", "Client", "Project", "Task", "Category", "Work Type", "Hours", "Notes"];

      // Sheet per person
      const byPerson = new Map<string, typeof rows>();
      for (const r of rows) {
        if (!byPerson.has(r.person)) byPerson.set(r.person, []);
        byPerson.get(r.person)!.push(r);
      }

      for (const [person, personRows] of byPerson) {
        const sheetData = [
          headers,
          ...personRows.map((r) => [r.date, r.client, r.project, r.task, r.category, r.workType, r.hours, r.notes]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        // Column widths
        ws["!cols"] = [14, 18, 30, 30, 16, 18, 8, 30].map((w) => ({ wch: w }));
        const sheetName = person.split(" ")[0].slice(0, 31); // Excel sheet name limit
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      // All sheet
      const allData = [
        ["Person", ...headers],
        ...rows.map((r) => [r.person, r.date, r.client, r.project, r.task, r.category, r.workType, r.hours, r.notes]),
      ];
      const wsAll = XLSX.utils.aoa_to_sheet(allData);
      wsAll["!cols"] = [18, 14, 18, 30, 30, 16, 18, 8, 30].map((w) => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, wsAll, "All");

      XLSX.writeFile(wb, `timelog-${from}-to-${to}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  function exportHTML() {
    if (!data) return;
    const { from, to } = getDateRange();
    const generatedAt = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    const totalHrs = data.overview.totalHours;

    const catColors: Record<string, string> = {
      CLIENT_WORK: "#84cc16",
      INTERNAL: "#a78bfa",
      ADMIN: "#fbbf24",
      TRAINING: "#60a5fa",
    };
    const catLabels: Record<string, string> = {
      CLIENT_WORK: "Client Work",
      INTERNAL: "Internal",
      ADMIN: "Admin",
      TRAINING: "Training",
    };
    const clientColorHex = ["#84cc16","#60a5fa","#34d399","#fb923c","#c084fc","#f87171","#facc15","#22d3ee"];

    const zeroUsers = data.compliance.filter((p) => p.hours === 0);
    const lowUsers = data.compliance.filter((p) => p.hours > 0 && p.entries < 3);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Time Report · ${from} to ${to}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;color:#111827;line-height:1.5}
.page{max-width:860px;margin:0 auto;padding:48px 32px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;border-bottom:2px solid #e5e7eb;padding-bottom:24px}
.header h1{font-size:28px;font-weight:700;letter-spacing:-0.5px}
.header .subtitle{font-size:14px;color:#6b7280;margin-top:4px}
.header-right{text-align:right}
.period-badge{font-size:13px;font-weight:600;color:#374151;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:6px 12px;display:inline-block}
.generated{font-size:11px;color:#9ca3af;margin-top:6px}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px}
.kpi{background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px}
.kpi-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-bottom:8px}
.kpi-value{font-size:28px;font-weight:700;font-variant-numeric:tabular-nums;color:#111827}
.kpi-value.accent{color:#65a30d}
.kpi-value.warn{color:#d97706}
.alerts{margin-bottom:32px;display:flex;flex-direction:column;gap:10px}
.alert{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:10px;font-size:13px}
.alert.green{background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d}
.alert.red{background:#fef2f2;border:1px solid #fecaca;color:#dc2626}
.alert.amber{background:#fffbeb;border:1px solid #fde68a;color:#d97706}
.dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px}
.dot-green{background:#22c55e}.dot-red{background:#ef4444}.dot-amber{background:#f59e0b}
.alert strong{font-weight:600;display:block}
.alert span{opacity:.8}
.section{margin-bottom:32px;background:white;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden}
.section-header{padding:20px 24px 16px;border-bottom:1px solid #f3f4f6}
.section-num{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;font-family:monospace;margin-bottom:2px}
.section-title{font-size:17px;font-weight:700;color:#111827}
.section-title em{font-style:normal;color:#65a30d}
.section-body{padding:20px 24px}
table{width:100%;border-collapse:collapse;font-size:13px}
thead th{padding:0 0 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;border-bottom:1px solid #f3f4f6}
thead th.r{text-align:right}
tbody tr{border-bottom:1px solid #f9fafb}
tbody tr:last-child{border-bottom:none}
tbody td{padding:10px 0;vertical-align:middle}
td.r{text-align:right}td.mono{font-family:monospace}td.bold{font-weight:600}
.badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600}
.badge-green{background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}
.badge-red{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
.badge-amber{background:#fffbeb;color:#d97706;border:1px solid #fde68a}
.bar-row{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.bar-label{width:140px;flex-shrink:0;font-size:13px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{flex:1;height:24px;background:#f3f4f6;border-radius:6px;overflow:hidden}
.bar-fill{height:100%;border-radius:6px;display:flex;align-items:center;padding-left:8px;font-size:11px;font-weight:700;color:#1a1a1a}
.bar-meta{width:60px;text-align:right;font-size:12px;font-family:monospace;color:#9ca3af}
.cat-bar{display:flex;height:28px;border-radius:8px;overflow:hidden;margin-bottom:14px}
.cat-seg{display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#1a1a1a}
.cat-legend{display:flex;flex-wrap:wrap;gap:16px}
.cat-item{display:flex;align-items:center;gap:6px;font-size:12px;color:#6b7280}
.cat-dot{width:10px;height:10px;border-radius:50%}
.footer{margin-top:48px;padding-top:24px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
.footer p{font-size:12px;color:#9ca3af}
</style>
</head>
<body>
<div class="page">

<div class="header">
  <div>
    <h1>Time Report</h1>
    <p class="subtitle">Team hours and activity summary</p>
  </div>
  <div class="header-right">
    <div class="period-badge">${from} → ${to}</div>
    <p class="generated">Generated ${generatedAt}</p>
  </div>
</div>

<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Total Hours</div><div class="kpi-value">${data.overview.totalHours}h</div></div>
  <div class="kpi"><div class="kpi-label">Billable</div><div class="kpi-value ${data.overview.clientPercent >= 60 ? "accent" : data.overview.clientPercent < 40 ? "warn" : ""}">${data.overview.clientPercent}%</div></div>
  <div class="kpi"><div class="kpi-label">Active Trackers</div><div class="kpi-value ${data.overview.activeUsers < data.overview.totalUsers ? "warn" : ""}">${data.overview.activeUsers}/${data.overview.totalUsers}</div></div>
  <div class="kpi"><div class="kpi-label">Clients Served</div><div class="kpi-value">${data.overview.totalClients}</div></div>
</div>

<div class="alerts">
  ${zeroUsers.length > 0 ? `<div class="alert red"><div class="dot dot-red"></div><div><strong>${zeroUsers.length} ${zeroUsers.length === 1 ? "person" : "people"} with no hours logged</strong><span>${zeroUsers.map((p) => p.name).join(", ")}</span></div></div>` : ""}
  ${lowUsers.length > 0 ? `<div class="alert amber"><div class="dot dot-amber"></div><div><strong>${lowUsers.length} ${lowUsers.length === 1 ? "person" : "people"} with low activity (&lt; 3 entries)</strong><span>${lowUsers.map((p) => p.name).join(", ")}</span></div></div>` : ""}
  ${zeroUsers.length === 0 && lowUsers.length === 0 ? `<div class="alert green"><div class="dot dot-green"></div><div><strong>All clear — everyone is tracking time properly.</strong></div></div>` : ""}
</div>

<div class="section">
  <div class="section-header"><div class="section-num">01</div><div class="section-title">Tracking <em>Compliance</em></div></div>
  <div class="section-body">
    <table>
      <thead><tr>
        <th>Person</th><th class="r">Hours</th><th class="r">Entries</th><th class="r">Days Active</th><th class="r">Billable %</th><th class="r">Status</th>
      </tr></thead>
      <tbody>
        ${data.compliance.map((p) => `<tr>
          <td class="bold" style="color:${p.hours === 0 ? "#dc2626" : "#111827"}">${p.name}</td>
          <td class="r mono">${p.hours}h</td>
          <td class="r mono" style="color:#6b7280">${p.entries}</td>
          <td class="r mono" style="color:#6b7280">${p.daysActive}</td>
          <td class="r mono" style="color:${p.billablePercent >= 60 ? "#65a30d" : p.billablePercent >= 40 ? "#111827" : "#d97706"}">${p.billablePercent}%</td>
          <td class="r">${p.hours === 0 ? '<span class="badge badge-red">No entries</span>' : p.entries < 3 ? '<span class="badge badge-amber">Low activity</span>' : '<span class="badge badge-green">Active</span>'}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>
</div>

${data.byClient.length > 0 ? `<div class="section">
  <div class="section-header"><div class="section-num">02</div><div class="section-title">Hours by <em>Client</em></div></div>
  <div class="section-body">
    ${data.byClient.map((c, i) => {
      const maxHrs2 = data.byClient[0]?.hours ?? 1;
      const pct = Math.max((c.hours / maxHrs2) * 100, 4);
      const color = clientColorHex[i % clientColorHex.length];
      const shareOfTotal = totalHrs > 0 ? ((c.hours / totalHrs) * 100).toFixed(1) : "0";
      return `<div class="bar-row"><div class="bar-label" title="${c.name}">${c.name}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}cc">${c.hours}h</div></div><div class="bar-meta">${shareOfTotal}%</div></div>`;
    }).join("")}
  </div>
</div>` : ""}

${totalHrs > 0 ? `<div class="section">
  <div class="section-header"><div class="section-num">03</div><div class="section-title">Category <em>Breakdown</em></div></div>
  <div class="section-body">
    <div class="cat-bar">
      ${Object.entries(data.categoryTotals).map(([cat, hrs]) => {
        const pct = (hrs / totalHrs) * 100;
        const color = catColors[cat] ?? "#9ca3af";
        return `<div class="cat-seg" style="width:${pct}%;background:${color}cc" title="${catLabels[cat] ?? cat}: ${hrs}h">${pct >= 10 ? `${Math.round(pct)}%` : ""}</div>`;
      }).join("")}
    </div>
    <div class="cat-legend">
      ${Object.entries(data.categoryTotals).map(([cat, hrs]) => `<div class="cat-item"><div class="cat-dot" style="background:${catColors[cat] ?? "#9ca3af"}"></div><span>${catLabels[cat] ?? cat}: <strong>${hrs}h</strong></span></div>`).join("")}
    </div>
  </div>
</div>` : ""}

${data.workTypeTotals.length > 0 ? `<div class="section">
  <div class="section-header"><div class="section-num">04</div><div class="section-title">Work Type <em>Breakdown</em></div></div>
  <div class="section-body">
    ${data.workTypeTotals.map((wt) => {
      const maxWt = data.workTypeTotals[0]?.hours ?? 1;
      const pct = Math.max((wt.hours / maxWt) * 100, 4);
      const shareOfBillable = data.overview.clientHours > 0 ? Math.round((wt.hours / data.overview.clientHours) * 100) : 0;
      return `<div class="bar-row"><div class="bar-label">${wt.name}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:#a78bfacc">${wt.hours}h</div></div><div class="bar-meta">${shareOfBillable}%</div></div>`;
    }).join("")}
  </div>
</div>` : ""}

<div class="footer">
  <p>Timelog · Internal Report</p>
  <p>Generated ${generatedAt}</p>
</div>

</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timelog-report-${from}-to-${to}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      // Prefer "All" sheet, fall back to first sheet
      const sheetName = wb.SheetNames.includes("All") ? "All" : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const rows: ImportRow[] = json.map((r) => ({
        person: String(r["Person"] ?? ""),
        date: String(r["Date"] ?? ""),
        client: String(r["Client"] ?? ""),
        task: String(r["Task"] ?? ""),
        category: String(r["Category"] ?? ""),
        workType: String(r["Work Type"] ?? ""),
        hours: Number(r["Hours"] ?? 0),
        notes: String(r["Notes"] ?? ""),
      })).filter((r) => r.person && r.date && r.hours > 0);
      setImportRows(rows);
      setImportResult(null);
    };
    reader.readAsArrayBuffer(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  async function submitImport() {
    if (!importRows) return;
    setImporting(true);
    try {
      const res = await fetch("/api/entries/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: importRows }),
      });
      const result: ImportResult = await res.json();
      setImportResult(result);
    } finally {
      setImporting(false);
    }
  }

  const hasFilters = !!selectedUser || !!selectedClient;

  function clearFilters() {
    setSelectedUser(null);
    setSelectedClient("");
    setProjectSearch("");
  }

  const periodLabels: Record<Period, string> = {
    "this-week": "This week",
    "last-week": "Last week",
    "this-month": "This month",
    "last-month": "Last month",
    "year": "Year",
    "month": "Month",
    "custom": "Custom",
  };

  const categoryColors: Record<string, string> = {
    CLIENT_WORK: "bg-lime-400",
    INTERNAL: "bg-violet-400",
    ADMIN: "bg-amber-400",
    TRAINING: "bg-blue-400",
  };

  const categoryLabels: Record<string, string> = {
    CLIENT_WORK: "Client Work",
    INTERNAL: "Internal",
    ADMIN: "Admin",
    TRAINING: "Training",
  };

  // Use hex colors with inline styles — Tailwind JIT purges dynamically-constructed class names
  const CLIENT_COLORS_HEX = [
    "#a3e635", // lime-400
    "#60a5fa", // blue-400
    "#34d399", // emerald-400
    "#fb923c", // orange-400
    "#c084fc", // purple-400
    "#f87171", // red-400
    "#facc15", // yellow-400
    "#22d3ee", // cyan-400
  ];

  const totalHours = data?.overview.totalHours ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex items-center gap-2">
          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={() => importFileRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-[13px] font-medium text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
          >
            <Upload className="h-3.5 w-3.5" />
            Import XLSX
          </button>
          <button
            onClick={exportXLSX}
            disabled={!data || exporting}
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-[13px] font-medium text-zinc-400 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-40"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {exporting ? "Exporting…" : "Export XLSX"}
          </button>
          <button
            onClick={exportHTML}
            disabled={!data}
            className="flex items-center gap-2 rounded-lg border border-lime-400/20 bg-lime-400/5 px-3 py-2 text-[13px] font-medium text-lime-400 transition hover:bg-lime-400/10 disabled:opacity-40"
          >
            <FileText className="h-3.5 w-3.5" />
            Share Report
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="space-y-3">
        <div className="flex gap-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-1 w-fit flex-wrap">
          {(["this-week", "last-week", "this-month", "last-month", "year", "month", "custom"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriod(p);
                // Reset custom dates when switching away from custom mode
                if (p !== "custom") {
                  setCustomFrom("");
                  setCustomTo("");
                }
              }}
              className={cn(
                "rounded-lg px-4 py-2 text-[13px] font-medium transition",
                period === p
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {/* Contextual controls */}
        {period === "year" && (
          <div className="flex gap-2 items-center">
            <label className="text-[13px] text-zinc-400">Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-[#141416] border border-white/[0.06] text-zinc-400 rounded-lg px-3 py-2 text-[13px] cursor-pointer hover:border-white/[0.12] transition"
            >
              {Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => 2024 + i).reverse().map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        )}

        {period === "month" && (
          <div className="flex gap-2 items-center">
            <label className="text-[13px] text-zinc-400">Month:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-[#141416] border border-white/[0.06] text-zinc-400 rounded-lg px-3 py-2 text-[13px] cursor-pointer hover:border-white/[0.12] transition"
            >
              {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                <option key={i} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <label className="text-[13px] text-zinc-400 ml-2">Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-[#141416] border border-white/[0.06] text-zinc-400 rounded-lg px-3 py-2 text-[13px] cursor-pointer hover:border-white/[0.12] transition"
            >
              {Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => 2024 + i).reverse().map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        )}

        {period === "custom" && (
          <div className="flex gap-2 items-center">
            <label className="text-[13px] text-zinc-400">From:</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-[#141416] border border-white/[0.06] text-zinc-400 rounded-lg px-3 py-2 text-[13px] cursor-pointer hover:border-white/[0.12] transition"
            />
            <label className="text-[13px] text-zinc-400">To:</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-[#141416] border border-white/[0.06] text-zinc-400 rounded-lg px-3 py-2 text-[13px] cursor-pointer hover:border-white/[0.12] transition"
            />
          </div>
        )}
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
          <Filter className="h-3 w-3" />
          Filter
        </div>

        {/* Person filter */}
        <div className="relative">
          <button
            onClick={() => { setUserDropOpen((v) => !v); setClientDropOpen(false); }}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] transition",
              selectedUser
                ? "border-lime-400/40 bg-lime-400/10 text-lime-400"
                : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/[0.12] hover:text-zinc-300"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            <span>{selectedUser ? (selectedUser.name ?? selectedUser.email) : "All People"}</span>
            <ChevronDown className={cn("h-3 w-3 opacity-50 transition", userDropOpen && "rotate-180")} />
          </button>
          {userDropOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserDropOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-white/[0.08] bg-[#141416] p-1 shadow-2xl">
                <button
                  onClick={() => { setSelectedUser(null); setUserDropOpen(false); }}
                  className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition hover:bg-white/[0.04]", !selectedUser ? "text-lime-400" : "text-zinc-400")}
                >
                  {!selectedUser ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className="w-3.5 shrink-0" />}
                  All People
                </button>
                <div className="my-1 h-px bg-white/[0.06]" />
                <div className="max-h-64 overflow-y-auto">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedUser(u); setUserDropOpen(false); }}
                      className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition hover:bg-white/[0.04]", selectedUser?.id === u.id ? "text-lime-400" : "text-zinc-400")}
                    >
                      {selectedUser?.id === u.id ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className="w-3.5 shrink-0" />}
                      <span className="truncate">{u.name ?? u.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Client filter */}
        <div className="relative">
          <button
            onClick={() => { setClientDropOpen((v) => !v); setUserDropOpen(false); }}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] transition",
              selectedClient
                ? "border-lime-400/40 bg-lime-400/10 text-lime-400"
                : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/[0.12] hover:text-zinc-300"
            )}
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span className="max-w-[140px] truncate">{selectedClient || "All Clients"}</span>
            <ChevronDown className={cn("h-3 w-3 opacity-50 transition", clientDropOpen && "rotate-180")} />
          </button>
          {clientDropOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setClientDropOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-white/[0.08] bg-[#141416] p-1 shadow-2xl">
                <button
                  onClick={() => { setSelectedClient(""); setClientDropOpen(false); }}
                  className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition hover:bg-white/[0.04]", !selectedClient ? "text-lime-400" : "text-zinc-400")}
                >
                  {!selectedClient ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className="w-3.5 shrink-0" />}
                  All Clients
                </button>
                <div className="my-1 h-px bg-white/[0.06]" />
                <div className="max-h-64 overflow-y-auto">
                  {(allClients.length > 0 ? allClients : data?.byClient.map((c) => c.name) ?? []).map((name) => (
                    <button
                      key={name}
                      onClick={() => { setSelectedClient(name); setClientDropOpen(false); }}
                      className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition hover:bg-white/[0.04]", selectedClient === name ? "text-lime-400" : "text-zinc-400")}
                    >
                      {selectedClient === name ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className="w-3.5 shrink-0" />}
                      <span className="truncate">{name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-400" />
        </div>
      ) : data ? (
        <div className="space-y-10">

          {/* ── OVERVIEW STATS ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={<Clock className="h-4 w-4" />}
              label="Total Hours"
              value={`${data.overview.totalHours}`}
              suffix="h"
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Billable"
              value={`${data.overview.clientPercent}`}
              suffix="%"
              accent={data.overview.clientPercent >= 60}
              warn={data.overview.clientPercent < 40}
            />
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="Active Trackers"
              value={`${data.overview.activeUsers}/${data.overview.totalUsers}`}
              warn={data.overview.activeUsers < data.overview.totalUsers}
            />
            <StatCard
              icon={<Briefcase className="h-4 w-4" />}
              label="Clients"
              value={`${data.overview.totalClients}`}
            />
          </div>

          {/* ── COMPLIANCE CALLOUTS ── */}
          {(() => {
            const zeroHoursUsers = data.compliance.filter((p) => p.hours === 0).map((p) => p.name);
            const lowActivityUsers = data.compliance.filter((p) => p.hours > 0 && p.entries < 3).map((p) => p.name);
            const hasIssues = zeroHoursUsers.length > 0 || lowActivityUsers.length > 0 || data.missingUsers.length > 0;

            return (
              <div className="space-y-2">
                {zeroHoursUsers.length > 0 && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] px-4 py-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-red-400 shrink-0" />
                    <div>
                      <p className="text-[13px] font-medium text-red-400">
                        {zeroHoursUsers.length} {zeroHoursUsers.length === 1 ? "person" : "people"} with no hours logged
                      </p>
                      <p className="mt-1 text-[12px] text-zinc-500">{zeroHoursUsers.join(", ")}</p>
                    </div>
                  </div>
                )}
                {lowActivityUsers.length > 0 && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400 shrink-0" />
                    <div>
                      <p className="text-[13px] font-medium text-amber-400">
                        {lowActivityUsers.length} {lowActivityUsers.length === 1 ? "person" : "people"} with low activity
                      </p>
                      <p className="mt-1 text-[12px] text-zinc-500">
                        Less than 3 entries: {lowActivityUsers.join(", ")}
                      </p>
                    </div>
                  </div>
                )}
                {!hasIssues && (
                  <div className="flex items-start gap-3 rounded-xl border border-lime-500/20 bg-lime-500/[0.04] px-4 py-3">
                    <Check className="mt-0.5 h-4 w-4 text-lime-400 shrink-0" />
                    <p className="text-[13px] font-medium text-lime-400">All clear! Everyone is tracking time properly.</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── COMPLIANCE TABLE ── */}
          <Section num="01" title="Tracking" em="Compliance">
            {data.compliance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Person</th>
                      <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Hours</th>
                      <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Entries</th>
                      <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Days</th>
                      <th className="pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 pl-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.compliance.map((p) => (
                      <tr key={p.name} className="border-b border-white/[0.03]">
                        <td className={cn("py-2.5 font-medium", p.hours === 0 ? "text-red-400" : "text-white")}>{p.name}</td>
                        <td className="py-2.5 text-right font-mono text-white">{p.hours}</td>
                        <td className="py-2.5 text-right font-mono text-zinc-400">{p.entries}</td>
                        <td className="py-2.5 text-right font-mono text-zinc-400">{p.daysActive}</td>
                        <td className="py-2.5 pl-4">
                          {p.hours === 0 ? (
                            <span className="rounded-full bg-red-400/10 border border-red-400/20 px-2 py-0.5 text-[11px] font-medium text-red-400">
                              No entries
                            </span>
                          ) : p.entries < 3 ? (
                            <span className="rounded-full bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                              Low activity
                            </span>
                          ) : (
                            <span className="rounded-full bg-lime-400/10 border border-lime-400/20 px-2 py-0.5 text-[11px] font-medium text-lime-400">
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState />
            )}
          </Section>

          {/* ── CATEGORY BREAKDOWN ── */}
          <Section num="05" title="Category" em="Breakdown">
            {totalHours > 0 && (
              <>
                {/* Stacked bar */}
                <div className="space-y-3">
                  <div className="flex h-8 overflow-hidden rounded-lg">
                    {Object.entries(data.categoryTotals).map(([cat, hrs]) => {
                      const pct = (hrs / totalHours) * 100;
                      return (
                        <div
                          key={cat}
                          className={cn(categoryColors[cat] ?? "bg-zinc-500", "flex items-center justify-center text-[11px] font-semibold text-[#0a0a0b] transition-all")}
                          style={{ width: `${pct}%` }}
                          title={`${categoryLabels[cat] ?? cat}: ${hrs}h (${pct.toFixed(1)}%)`}
                        >
                          {pct >= 10 ? `${Math.round(pct)}%` : ""}
                        </div>
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(data.categoryTotals).map(([cat, hrs]) => (
                      <div key={cat} className="flex items-center gap-2">
                        <div className={cn("h-2.5 w-2.5 rounded-full", categoryColors[cat] ?? "bg-zinc-500")} />
                        <span className="text-[12px] text-zinc-400">
                          {categoryLabels[cat] ?? cat}: <span className="font-medium text-zinc-300">{hrs}h</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Per-person category table */}
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Person</th>
                        <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Client</th>
                        <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Internal</th>
                        <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Admin</th>
                        <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Training</th>
                        <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Billable %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.compliance.filter(p => p.hours > 0).map((p) => (
                        <tr key={p.name} className="border-b border-white/[0.03]">
                          <td className="py-2.5 font-medium text-white">{p.name}</td>
                          <td className="py-2.5 text-right font-mono text-lime-400">{p.clientHours || "—"}</td>
                          <td className="py-2.5 text-right font-mono text-violet-400">{p.internalHours || "—"}</td>
                          <td className="py-2.5 text-right font-mono text-amber-400">{p.adminHours || "—"}</td>
                          <td className="py-2.5 text-right font-mono text-blue-400">{p.trainingHours || "—"}</td>
                          <td className={cn("py-2.5 text-right font-mono font-semibold", p.billablePercent >= 60 ? "text-lime-400" : p.billablePercent >= 40 ? "text-white" : "text-amber-400")}>
                            {p.billablePercent}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {totalHours === 0 && <EmptyState />}
          </Section>

          {/* ── HOURS BY PERSON ── */}
          {!selectedUser && (
          <Section num="02" title="Hours by" em="Person">
            {data.compliance.length > 0 ? (
              <div className="space-y-4">
                {/* Target hours config */}
                <div className="flex items-center gap-4 pb-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <label className="text-[13px] text-zinc-400">Weekly Target:</label>
                    <input
                      type="number"
                      value={targetHours}
                      onChange={(e) => setTargetHours(Number(e.target.value) || 40)}
                      min="1"
                      max="100"
                      className="w-16 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[13px] text-white outline-none"
                    />
                    <span className="text-[12px] text-zinc-500">hours</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[13px] text-zinc-400">Period:</label>
                    <input
                      type="number"
                      value={weeksInPeriod}
                      onChange={(e) => setWeeksInPeriod(Number(e.target.value) || 1)}
                      min="1"
                      max="12"
                      className="w-12 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[13px] text-white outline-none"
                    />
                    <span className="text-[12px] text-zinc-500">weeks</span>
                  </div>
                </div>

                {/* Hours bars */}
                <div className="space-y-2">
                  {(() => {
                    const expectedTotal = targetHours * weeksInPeriod;
                    const maxHours = Math.max(...data.compliance.map((p) => p.hours), expectedTotal);
                    const targetPct = (expectedTotal / maxHours) * 100;

                    return data.compliance.map((p) => {
                      const pct = (p.hours / maxHours) * 100;
                      const barColor = p.hours === 0
                        ? "bg-red-400/60"
                        : p.hours < expectedTotal * 0.5
                        ? "bg-amber-400/60"
                        : "bg-lime-400/70";
                      const achievedPercent = expectedTotal > 0 ? Math.round((p.hours / expectedTotal) * 100) : 0;

                      return (
                        <div key={p.name} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 truncate text-[13px] text-zinc-400" title={p.name}>{p.name}</span>
                          <div className="flex-1 h-7 rounded-md bg-white/[0.03] overflow-hidden relative">
                            {/* Target line */}
                            {expectedTotal > 0 && (
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-white/20 pointer-events-none"
                                style={{ left: `${targetPct}%` }}
                              />
                            )}
                            {/* Hours bar */}
                            <div
                              className={cn("h-full rounded-md flex items-center transition-all", barColor)}
                              style={{ width: `${Math.max(pct, 3)}%` }}
                            >
                              <span className="pl-2 text-[12px] font-semibold text-[#0a0a0b] whitespace-nowrap">
                                {p.hours > 0 ? `${p.hours}h` : ""}
                              </span>
                            </div>
                          </div>
                          <span className="w-16 text-right text-[12px] font-mono text-zinc-500">
                            {achievedPercent}% of target
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <EmptyState />
            )}
          </Section>
          )}

          {/* ── HOURS BY CLIENT (expandable) ── */}
          <Section num="03" title="Hours by" em="Client">
            {data.byClient.length > 0 ? (
              <div className="space-y-2">
                {(() => {
                  const maxHours = data.byClient[0]?.hours ?? 1;
                  return data.byClient.map((c, index) => {
                    const pct = Math.max((c.hours / maxHours) * 100, 4);
                    const colorHex = CLIENT_COLORS_HEX[index % CLIENT_COLORS_HEX.length];
                    const isExpanded = expandedClient === c.name;
                    const maxTypeH = Math.max(...Object.values(c.byType), 1);
                    const sharePct = totalHours > 0 ? ((c.hours / totalHours) * 100).toFixed(1) : "0";
                    return (
                      <div
                        key={c.name}
                        className={cn(
                          "rounded-xl border overflow-hidden transition-all",
                          isExpanded
                            ? "border-white/[0.12] bg-white/[0.03]"
                            : "border-white/[0.06] hover:border-white/[0.09]"
                        )}
                      >
                        <button
                          onClick={() => setExpandedClient(isExpanded ? null : c.name)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                        >
                          <span className="w-32 shrink-0 truncate text-[13px] text-zinc-400" title={c.name}>{c.name}</span>
                          <div className="flex-1 h-7 rounded-md bg-white/[0.03] overflow-hidden">
                            <div
                              className="h-full rounded-md flex items-center transition-all"
                              style={{ width: `${pct}%`, backgroundColor: colorHex + "b3" }}
                            >
                              <span className="pl-2 text-[12px] font-semibold text-[#0a0a0b] whitespace-nowrap">
                                {c.hours}h
                              </span>
                            </div>
                          </div>
                          <span className="w-12 shrink-0 text-right text-[12px] text-zinc-500">
                            {c.peopleCount} ppl
                          </span>
                          <span className="w-12 shrink-0 text-right text-[11px] font-mono text-zinc-600">
                            {sharePct}%
                          </span>
                          <span className="shrink-0 text-[11px] text-zinc-600 w-3">
                            {isExpanded ? "▼" : "▶"}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                              <div>
                                <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
                                  Work Type
                                </p>
                                <div className="space-y-2.5">
                                  {Object.entries(c.byType)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([type, hrs]) => (
                                      <div key={type} className="flex items-center gap-2">
                                        <span className="w-32 shrink-0 truncate text-[12px] text-zinc-400" title={type}>
                                          {type}
                                        </span>
                                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                                          <div
                                            className="h-full rounded-full bg-violet-400/60"
                                            style={{ width: `${Math.max((hrs / maxTypeH) * 100, 4)}%` }}
                                          />
                                        </div>
                                        <span className="w-10 shrink-0 text-right text-[11px] font-mono text-zinc-400">
                                          {hrs}h
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </div>

                              <div>
                                <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
                                  People
                                </p>
                                <div className="space-y-2.5">
                                  {(c.byPerson ?? []).map((p) => {
                                    const initials = p.name
                                      .split(" ")
                                      .map((w) => w[0])
                                      .slice(0, 2)
                                      .join("")
                                      .toUpperCase();
                                    return (
                                      <div key={p.name} className="flex items-center gap-2">
                                        <div className="w-6 h-6 shrink-0 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-400">
                                          {initials}
                                        </div>
                                        <span className="flex-1 truncate text-[12px] text-zinc-400" title={p.name}>
                                          {p.name}
                                        </span>
                                        <span className="shrink-0 text-[11px] font-mono text-zinc-400">
                                          {p.hours}h
                                        </span>
                                      </div>
                                    );
                                  })}
                                  {(c.byPerson ?? []).length === 0 && (
                                    <p className="text-[12px] text-zinc-600">
                                      {c.peopleCount} {c.peopleCount === 1 ? "person" : "people"}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <EmptyState />
            )}
          </Section>

          {/* ── HOURS BY PROJECT & DELIVERABLE (left-join Asana) ── */}
          <Section num="04" title="Hours by" em="Project & Deliverable">
            {data.byProject.length > 0 ? (
              <ByProjectView
                projects={data.byProject}
                totalHours={totalHours}
                clientColors={CLIENT_COLORS_HEX}
              />
            ) : (
              <EmptyState />
            )}
          </Section>

          {/* ── WORK TYPE BREAKDOWN ── */}
          {data.workTypeTotals.length > 0 && (
            <Section num="07" title="Work Type" em="Breakdown">
              <div className="space-y-2">
                {(() => {
                  const maxHours = data.workTypeTotals[0]?.hours ?? 1;
                  return data.workTypeTotals.map((wt) => {
                    const pct = (wt.hours / maxHours) * 100;
                    return (
                      <div key={wt.name} className="flex items-center gap-3">
                        <span className="w-32 shrink-0 truncate text-[13px] text-zinc-400">{wt.name}</span>
                        <div className="flex-1 h-6 rounded-md bg-white/[0.03] overflow-hidden">
                          <div
                            className="h-full rounded-md bg-violet-400/60 flex items-center transition-all"
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          >
                            <span className="pl-2 text-[11px] font-semibold text-[#0a0a0b] whitespace-nowrap">
                              {wt.hours}h
                            </span>
                          </div>
                        </div>
                        <span className="w-10 text-right text-[12px] font-mono text-zinc-500">
                          {data.overview.clientHours > 0 ? `${Math.round((wt.hours / data.overview.clientHours) * 100)}%` : ""}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </Section>
          )}

          {/* ── DELIVERABLES ── */}
          <Section num="06" title="Project &" em="Deliverable">
            {/* Project search */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by client or task…"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-white/[0.14] transition"
              />
            </div>
            {filteredDeliverables.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Project</th>
                      <th className="pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Task</th>
                      <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Hours</th>
                      <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">People</th>
                      <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Entries</th>
                      <th className="pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 pl-4">Top Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeliverables.slice(0, 50).map((d, i) => (
                      <tr key={i} className="border-b border-white/[0.03]">
                        <td className="py-2.5 text-lime-400 max-w-[200px] truncate" title={d.client}>{d.client}</td>
                        <td className="py-2.5 text-zinc-400 max-w-[200px] truncate" title={d.task ?? ""}>
                          {d.task ?? <span className="text-zinc-600 italic">no task</span>}
                        </td>
                        <td className="py-2.5 text-right font-mono text-white">{d.hours}</td>
                        <td className="py-2.5 text-right font-mono text-zinc-400">{d.peopleCount}</td>
                        <td className="py-2.5 text-right font-mono text-zinc-400">{d.entries}</td>
                        <td className="py-2.5 pl-4">
                          {d.topType && (
                            <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-zinc-400">
                              {d.topType}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredDeliverables.length > 50 && (
                  <p className="mt-3 text-[12px] text-zinc-600">
                    Showing 50 of {filteredDeliverables.length} deliverables
                  </p>
                )}
              </div>
            ) : (
              <EmptyState />
            )}
          </Section>

          {/* ── DATA QUALITY ── */}
          {(() => {
            const entriesWithoutTask = data.byDeliverable.filter((d) => !d.task).reduce((sum, d) => sum + d.entries, 0);
            const lowActivityPeople = data.compliance.filter((p) => p.hours > 0 && p.entries < 3);
            const hasDataQualityIssues = entriesWithoutTask > 0 || lowActivityPeople.length > 0 || data.missingUsers.length > 0;

            return (
              <Section num="08" title="Data" em="Quality">
                {hasDataQualityIssues ? (
                  <div className="space-y-3">
                    {entriesWithoutTask > 0 && (
                      <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400 shrink-0" />
                        <div>
                          <p className="text-[13px] font-medium text-amber-400">
                            {entriesWithoutTask} {entriesWithoutTask === 1 ? "entry" : "entries"} without task assigned
                          </p>
                          <p className="mt-1 text-[12px] text-zinc-500">Severity: Medium — Entries need task linkage for better reporting</p>
                        </div>
                      </div>
                    )}
                    {lowActivityPeople.length > 0 && (
                      <div className="flex items-start gap-3 rounded-xl border border-orange-500/20 bg-orange-500/[0.04] px-4 py-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-orange-400 shrink-0" />
                        <div>
                          <p className="text-[13px] font-medium text-orange-400">
                            {lowActivityPeople.length} {lowActivityPeople.length === 1 ? "person" : "people"} with low activity
                          </p>
                          <p className="mt-1 text-[12px] text-zinc-500">
                            Less than 3 entries: {lowActivityPeople.map((p) => p.name).join(", ")}
                          </p>
                        </div>
                      </div>
                    )}
                    {data.missingUsers.length > 0 && (
                      <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] px-4 py-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-red-400 shrink-0" />
                        <div>
                          <p className="text-[13px] font-medium text-red-400">
                            {data.missingUsers.length} {data.missingUsers.length === 1 ? "person" : "people"} not logged this period
                          </p>
                          <p className="mt-1 text-[12px] text-zinc-500">
                            {data.missingUsers.map((u) => u.name || u.email).join(", ")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-lime-500/20 bg-lime-500/[0.04] px-4 py-3">
                    <Check className="mt-0.5 h-4 w-4 text-lime-400 shrink-0" />
                    <p className="text-[13px] font-medium text-lime-400">Data quality looks good! No quality issues detected.</p>
                  </div>
                )}
              </Section>
            );
          })()}

        </div>
      ) : null}

      {/* Import modal */}
      {importRows !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-xl border border-white/[0.08] bg-[#111] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Import XLSX</h2>
              <button
                onClick={() => { setImportRows(null); setImportResult(null); }}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {importResult ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1">Imported</p>
                    <p className="text-xl font-bold text-lime-400">{importResult.imported}</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1">Skipped</p>
                    <p className="text-xl font-bold text-amber-400">{importResult.skipped}</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1">Errors</p>
                    <p className="text-xl font-bold text-red-400">{importResult.errors.length}</p>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="rounded-lg bg-red-950/30 border border-red-500/20 p-3 space-y-1 max-h-40 overflow-y-auto">
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-[12px] text-red-400">{e}</p>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => { setImportRows(null); setImportResult(null); fetchReport(); }}
                  className="w-full rounded-lg bg-lime-400/10 border border-lime-400/20 px-4 py-2 text-[13px] font-medium text-lime-400 hover:bg-lime-400/20 transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[13px] text-zinc-400">
                  <span className="text-white font-semibold">{importRows.length}</span> rows found
                </p>
                {/* Preview table */}
                <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-left text-zinc-500">
                        {["Person", "Date", "Client", "Category", "Hours"].map((h) => (
                          <th key={h} className="px-3 py-2 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-b border-white/[0.03]">
                          <td className="px-3 py-2 text-zinc-300">{r.person}</td>
                          <td className="px-3 py-2 text-zinc-300">{r.date}</td>
                          <td className="px-3 py-2 text-zinc-400 truncate max-w-[120px]">{r.client || "—"}</td>
                          <td className="px-3 py-2 text-zinc-400">{r.category}</td>
                          <td className="px-3 py-2 text-white font-mono">{r.hours}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importRows.length > 5 && (
                    <p className="px-3 py-2 text-[11px] text-zinc-600">+{importRows.length - 5} more rows</p>
                  )}
                </div>
                <p className="text-[12px] text-zinc-600">Duplicate entries (same person, date, hours, category, client) will be skipped automatically.</p>
                <button
                  onClick={submitImport}
                  disabled={importing}
                  className="w-full rounded-lg bg-lime-400/10 border border-lime-400/20 px-4 py-2 text-[13px] font-medium text-lime-400 hover:bg-lime-400/20 transition disabled:opacity-50"
                >
                  {importing ? "Importing…" : `Import ${importRows.length} rows`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ num, title, em, children }: { num: string; title: string; em: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-lime-400/60 font-mono">{num}</p>
      <h2 className="mb-5 text-xl font-semibold text-white">
        {title} <span className="text-lime-400">{em}</span>
      </h2>
      {children}
    </div>
  );
}

function StatCard({ icon, label, value, suffix, accent, warn }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-zinc-600">{icon}</span>
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      </div>
      <p className={cn("text-2xl font-bold font-mono", accent ? "text-lime-400" : warn ? "text-amber-400" : "text-white")}>
        {value}
        {suffix && <span className="text-[14px] font-normal text-zinc-500">{suffix}</span>}
      </p>
    </div>
  );
}

function EmptyState() {
  return <p className="py-8 text-center text-[13px] text-zinc-600">No data for this period</p>;
}

type ByProjectItem = {
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
};

const TASK_ROW_LIMIT = 30;

function stripYearSuffix(name: string): string {
  return name.replace(/\s*\[\d{4}\]\s*$/, "").trim();
}

function ByProjectView({
  projects,
  totalHours,
  clientColors,
}: {
  projects: ByProjectItem[];
  totalHours: number;
  clientColors: string[];
}) {
  const totalUnlinked = projects.reduce(
    (sum, p) => sum + p.unlinkedHours,
    0
  );
  const maxProjectHours = Math.max(
    ...projects.map((p) => p.totalHours),
    1
  );

  return (
    <div className="space-y-6">
      {/* Data quality callout */}
      {totalUnlinked > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400 shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-amber-400">
              {Math.round(totalUnlinked * 100) / 100}h of client work not linked to any Asana project
            </p>
            <p className="mt-1 text-[12px] text-zinc-500">
              Ask the team to backfill the project &amp; task on these entries so they show up against the right deliverable.
            </p>
          </div>
        </div>
      )}

      {/* Part A: project summary bars */}
      <div className="space-y-2">
        {projects.map((p, index) => {
          const pct = (p.totalHours / maxProjectHours) * 100;
          const colorHex = clientColors[index % clientColors.length];
          const shareOfTotal =
            totalHours > 0 ? ((p.totalHours / totalHours) * 100).toFixed(1) : "0";
          return (
            <div key={p.projectGid} className="flex items-center gap-3">
              <div className="w-44 shrink-0 min-w-0">
                <p
                  className="truncate text-[13px] font-medium text-white"
                  title={p.clientName}
                >
                  {p.clientName}
                </p>
                <p
                  className="truncate text-[11px] text-zinc-600"
                  title={p.projectName}
                >
                  {stripYearSuffix(p.projectName)}
                </p>
              </div>
              <div className="flex-1 h-7 rounded-md bg-white/[0.03] overflow-hidden">
                <div
                  className="h-full rounded-md flex items-center transition-all"
                  style={{
                    width: `${Math.max(pct, p.totalHours > 0 ? 4 : 0)}%`,
                    backgroundColor: colorHex + "b3",
                  }}
                >
                  {p.totalHours > 0 && (
                    <span className="pl-2 text-[12px] font-semibold text-[#0a0a0b] whitespace-nowrap">
                      {p.totalHours}h
                    </span>
                  )}
                </div>
              </div>
              <div className="w-32 shrink-0 flex flex-col items-end gap-0.5">
                <span className="text-[12px] font-mono text-zinc-400 whitespace-nowrap">
                  {p.loggedTaskCount}/{p.totalTaskCount} tasks
                </span>
                <span className="text-[11px] text-zinc-600 font-mono">
                  {shareOfTotal}%
                </span>
              </div>
              {p.unlinkedHours > 0 && (
                <span
                  className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 whitespace-nowrap"
                  title="Hours logged against this client without an Asana project link"
                >
                  ⚠ {p.unlinkedHours}h unlinked
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Part B: per-project task tables */}
      <div className="space-y-5">
        {projects.map((p) => {
          const visibleTasks = p.tasks.slice(0, TASK_ROW_LIMIT);
          const overflow = p.tasks.length - visibleTasks.length;
          return (
            <div
              key={p.projectGid}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
            >
              {/* Sticky-ish project header row */}
              <div className="flex items-center justify-between border-b border-white/[0.06] bg-lime-400/[0.06] px-4 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-white truncate" title={p.projectName}>
                    {p.clientName}
                    <span className="ml-2 text-[12px] font-normal text-zinc-500">
                      {stripYearSuffix(p.projectName)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[12px] font-mono text-zinc-400">
                    {p.totalHours}h
                  </span>
                  <span className="text-[11px] text-zinc-600 font-mono">
                    {p.loggedTaskCount}/{p.totalTaskCount} tracked
                  </span>
                </div>
              </div>

              {p.tasks.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-zinc-600">
                  No tasks cached for this project
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-white/[0.04]">
                        <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Task</th>
                        <th className="px-4 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Hours</th>
                        <th className="px-4 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">People</th>
                        <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Work Types</th>
                        <th className="px-4 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTasks.map((t) => {
                        const isZero = t.hours === 0;
                        const workTypes = Object.entries(t.byWorkType)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 4);
                        return (
                          <tr
                            key={t.taskGid}
                            className="border-b border-white/[0.03] last:border-b-0"
                          >
                            <td
                              className={cn(
                                "px-4 py-2 max-w-[280px] truncate",
                                isZero
                                  ? "italic text-zinc-600"
                                  : "text-zinc-300"
                              )}
                              title={t.taskName}
                            >
                              {t.taskName}
                            </td>
                            <td
                              className={cn(
                                "px-4 py-2 text-right font-mono",
                                isZero ? "text-zinc-700" : "text-white"
                              )}
                            >
                              {isZero ? "—" : t.hours}
                            </td>
                            <td
                              className={cn(
                                "px-4 py-2 text-right font-mono",
                                isZero ? "text-zinc-700" : "text-zinc-400"
                              )}
                            >
                              {isZero ? "—" : t.peopleCount}
                            </td>
                            <td className="px-4 py-2">
                              {isZero ? (
                                <span className="text-zinc-700">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {workTypes.map(([type, hrs]) => (
                                    <span
                                      key={type}
                                      className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-zinc-400"
                                    >
                                      {type}: {hrs}h
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {t.completed ? (
                                <span className="rounded-full bg-lime-400/10 border border-lime-400/20 px-2 py-0.5 text-[11px] font-medium text-lime-400">
                                  complete
                                </span>
                              ) : isZero ? (
                                <span className="text-[11px] text-zinc-700">not tracked</span>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {overflow > 0 && (
                    <p className="px-4 py-2 text-[12px] text-zinc-600">
                      + {overflow} more {overflow === 1 ? "task" : "tasks"}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
