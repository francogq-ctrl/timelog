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
  categoryTotals: Record<string, number>;
  workTypeTotals: { name: string; hours: number }[];
  missingUsers: { name: string | null; email: string }[];
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

type Period = "this-week" | "last-week" | "this-month" | "last-month";

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
    }
  }, [period]);

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

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

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

  const CLIENT_COLORS = [
    "bg-lime-400",
    "bg-blue-400",
    "bg-green-400",
    "bg-orange-400",
    "bg-purple-400",
    "bg-red-400",
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
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-1 w-fit">
        {(["this-week", "last-week", "this-month", "last-month"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
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
          <Section num="04" title="Category" em="Breakdown">
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

          {/* ── HOURS BY CLIENT ── */}
          <Section num="03" title="Hours by" em="Client">
            {data.byClient.length > 0 ? (
              <>
                {/* Bar chart */}
                <div className="space-y-2">
                  {(() => {
                    const maxHours = data.byClient[0]?.hours ?? 1;
                    return data.byClient.map((c, index) => {
                      const pct = (c.hours / maxHours) * 100;
                      const colorClass = CLIENT_COLORS[index % CLIENT_COLORS.length];
                      return (
                        <div key={c.name} className="flex items-center gap-3">
                          <span className="w-32 shrink-0 truncate text-[13px] text-zinc-400" title={c.name}>{c.name}</span>
                          <div className="flex-1 h-7 rounded-md bg-white/[0.03] overflow-hidden">
                            <div
                              className={cn("h-full rounded-md flex items-center transition-all", colorClass + "/70")}
                              style={{ width: `${Math.max(pct, 4)}%` }}
                            >
                              <span className="pl-2 text-[12px] font-semibold text-[#0a0a0b] whitespace-nowrap">
                                {c.hours}h
                              </span>
                            </div>
                          </div>
                          <span className="w-12 text-right text-[12px] text-zinc-500">
                            {c.peopleCount} ppl
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Client detail table */}
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Client</th>
                        <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Hours</th>
                        <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">% of Total</th>
                        <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">People</th>
                        <th className="pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 pl-4">Work Type Split</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byClient.map((c) => (
                        <tr key={c.name} className="border-b border-white/[0.03]">
                          <td className="py-2.5 font-medium text-lime-400">{c.name}</td>
                          <td className="py-2.5 text-right font-mono text-white">{c.hours}</td>
                          <td className="py-2.5 text-right font-mono text-zinc-400">
                            {totalHours > 0 ? `${((c.hours / totalHours) * 100).toFixed(1)}%` : "—"}
                          </td>
                          <td className="py-2.5 text-right font-mono text-zinc-400">{c.peopleCount}</td>
                          <td className="py-2.5 pl-4">
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(c.byType)
                                .sort((a, b) => b[1] - a[1])
                                .map(([type, hrs]) => (
                                  <span key={type} className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-zinc-400">
                                    {type}: {hrs}h
                                  </span>
                                ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <EmptyState />
            )}
          </Section>

          {/* ── WORK TYPE BREAKDOWN ── */}
          {data.workTypeTotals.length > 0 && (
            <Section num="06" title="Work Type" em="Breakdown">
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
          <Section num="05" title="Project &" em="Deliverable">
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
              <Section num="07" title="Data" em="Quality">
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
