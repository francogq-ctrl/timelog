"use client";

import { useState, useEffect, useCallback } from "react";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReportData {
  overview: {
    totalHours: number;
    clientHours: number;
    clientPercent: number;
    activeUsers: number;
    totalUsers: number;
    avgDaily: number;
  };
  byProject: {
    name: string;
    hours: number;
    byType: Record<string, number>;
    peopleCount: number;
  }[];
  byPerson: {
    name: string;
    total: number;
    byCategory: Record<string, number>;
  }[];
  missingUsers: { name: string | null; email: string }[];
}

type Period = "this-week" | "last-week" | "this-month";

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [period, setPeriod] = useState<Period>("this-week");
  const [loading, setLoading] = useState(true);

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
    }
  }, [period]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange();
    try {
      const res = await fetch(`/api/reports?from=${from}&to=${to}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  function exportCSV() {
    if (!data) return;
    const rows = [["Persona", "Total Horas", "Client Work", "Internal", "Admin", "Training"]];
    for (const p of data.byPerson) {
      rows.push([
        p.name,
        String(p.total),
        String(p.byCategory.CLIENT_WORK ?? 0),
        String(p.byCategory.INTERNAL ?? 0),
        String(p.byCategory.ADMIN ?? 0),
        String(p.byCategory.TRAINING ?? 0),
      ]);
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timelog-report-${getDateRange().from}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const maxProjectHours = data?.byProject[0]?.hours ?? 1;

  const periodLabels: Record<Period, string> = {
    "this-week": "Esta semana",
    "last-week": "Semana pasada",
    "this-month": "Este mes",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reportes</h1>
        <Button
          onClick={exportCSV}
          variant="outline"
          size="sm"
          className="border-zinc-700"
          disabled={!data}
        >
          <Download className="mr-2 h-4 w-4" />
          CSV
        </Button>
      </div>

      {/* Period selector */}
      <div className="flex gap-1 rounded-lg bg-zinc-900 p-1 w-fit">
        {(["this-week", "last-week", "this-month"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition",
              period === p ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
            )}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-zinc-500">Cargando...</p>
      ) : data ? (
        <div className="space-y-8">
          {/* Overview cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total horas" value={`${data.overview.totalHours}h`} />
            <StatCard
              label="Client Work"
              value={`${data.overview.clientPercent}%`}
              sub={`${data.overview.clientHours}h de ${data.overview.totalHours}h`}
              accent
            />
            <StatCard
              label="Personas activas"
              value={`${data.overview.activeUsers}/${data.overview.totalUsers}`}
              sub={
                data.missingUsers.length > 0
                  ? `${data.missingUsers.length} sin loguear`
                  : undefined
              }
              warn={data.missingUsers.length > 0}
            />
            <StatCard label="Promedio diario" value={`${data.overview.avgDaily}h`} sub="por persona" />
          </div>

          {/* Missing users warning */}
          {data.missingUsers.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-400">Sin loguear este período</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {data.missingUsers.map((u) => u.name || u.email).join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* By Project */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">Horas por Proyecto</h2>
            <div className="space-y-4">
              {data.byProject.map((proj) => (
                <div key={proj.name}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm text-zinc-300">{proj.name}</span>
                    <span className="text-sm font-semibold text-white">{proj.hours}h</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-lime-400"
                      style={{ width: `${(proj.hours / maxProjectHours) * 100}%` }}
                    />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3">
                    {Object.entries(proj.byType).map(([type, hours]) => (
                      <span key={type} className="text-xs text-zinc-500">
                        {type} {hours}h
                      </span>
                    ))}
                    <span className="text-xs text-zinc-600">
                      {proj.peopleCount} persona{proj.peopleCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              ))}
              {data.byProject.length === 0 && (
                <p className="text-sm text-zinc-500">No hay datos de proyectos para este período</p>
              )}
            </div>
          </div>

          {/* By Person */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">Carga por Persona</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.byPerson.map((person) => (
                <div
                  key={person.name}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{person.name}</p>
                    <div className="flex gap-2 mt-0.5">
                      {person.byCategory.CLIENT_WORK && (
                        <span className="text-xs text-lime-400">{person.byCategory.CLIENT_WORK}h client</span>
                      )}
                      {person.byCategory.INTERNAL && (
                        <span className="text-xs text-violet-400">{person.byCategory.INTERNAL}h internal</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-lg font-bold",
                      person.total > 45 ? "text-red-400" : person.total < 30 ? "text-amber-400" : "text-white"
                    )}
                  >
                    {person.total}h
                  </span>
                </div>
              ))}
              {data.byPerson.length === 0 && (
                <p className="text-sm text-zinc-500">No hay datos para este período</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", accent ? "text-lime-400" : "text-white")}>
        {value}
      </p>
      {sub && (
        <p className={cn("mt-0.5 text-xs", warn ? "text-amber-400" : "text-zinc-500")}>{sub}</p>
      )}
    </div>
  );
}
