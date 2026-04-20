"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import type { ReportData } from "@/lib/report-generator";

interface Snapshot {
  id: string;
  type: "WEEKLY" | "MONTHLY";
  label: string;
  periodFrom: string;
  periodTo: string;
  generatedAt: string;
  data: ReportData;
}

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
  "#a3e635", "#60a5fa", "#34d399", "#fb923c",
  "#c084fc", "#f87171", "#facc15", "#22d3ee",
];

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function SnapshotPage() {
  const { token, id } = useParams<{ token: string; id: string }>();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/hub/snapshots/${id}?token=${token}`)
      .then((r) => {
        if (!r.ok) { setInvalid(true); return null; }
        return r.json();
      })
      .then((json) => { if (json) setSnapshot(json); })
      .finally(() => setLoading(false));
  }, [token, id]);

  // Auto-expand when client filter is selected
  useEffect(() => {
    if (selectedClient) setExpandedClient(selectedClient);
  }, [selectedClient]);

  const data = snapshot?.data;

  const clientList = useMemo(() => data?.byClient.map((c) => c.name) ?? [], [data]);
  const personList = useMemo(() => data?.compliance.map((p) => p.name) ?? [], [data]);

  const filteredByClient = useMemo(() => {
    if (!data) return [];
    if (selectedClient) return data.byClient.filter((c) => c.name === selectedClient);
    if (selectedPerson) return data.byClient.filter((c) =>
      (c.byPerson ?? []).some((p) => p.name === selectedPerson)
    );
    return data.byClient;
  }, [data, selectedClient, selectedPerson]);

  const filteredCompliance = useMemo(() => {
    if (!data) return [];
    if (selectedClient) {
      const clientData = data.byClient.find((c) => c.name === selectedClient);
      const clientPeople = new Set((clientData?.byPerson ?? []).map((p) => p.name));
      // Show people who worked on this client, with their hours FROM this client
      return (clientData?.byPerson ?? []).map((p) => {
        const global = data.compliance.find((c) => c.name === p.name);
        return {
          name: p.name,
          hours: p.hours,
          entries: global?.entries ?? 0,
          daysActive: global?.daysActive ?? 0,
          clientHours: p.hours,
          internalHours: 0,
          adminHours: 0,
          trainingHours: 0,
          billablePercent: 100,
        };
      });
    }
    if (selectedPerson) return data.compliance.filter((p) => p.name === selectedPerson);
    return data.compliance;
  }, [data, selectedClient, selectedPerson]);

  const filteredOverview = useMemo(() => {
    if (!data) return null;
    if (selectedClient) {
      const clientData = data.byClient.find((c) => c.name === selectedClient);
      if (!clientData) return data.overview;
      return {
        totalHours: clientData.hours,
        clientHours: clientData.hours,
        clientPercent: 100,
        activeUsers: clientData.peopleCount,
        totalUsers: clientData.peopleCount,
        totalClients: 1,
        avgDaily: 0,
      };
    }
    if (selectedPerson) {
      const person = data.compliance.find((p) => p.name === selectedPerson);
      if (!person) return data.overview;
      const personClients = data.byClient.filter((c) =>
        (c.byPerson ?? []).some((p) => p.name === selectedPerson)
      );
      return {
        totalHours: person.hours,
        clientHours: person.clientHours,
        clientPercent: person.billablePercent,
        activeUsers: 1,
        totalUsers: 1,
        totalClients: personClients.length,
        avgDaily: 0,
      };
    }
    return data.overview;
  }, [data, selectedClient, selectedPerson]);

  const filteredWorkTypeTotals = useMemo(() => {
    if (!data) return [];
    if (selectedClient) {
      const clientData = data.byClient.find((c) => c.name === selectedClient);
      if (!clientData) return [];
      return Object.entries(clientData.byType)
        .map(([name, hours]) => ({ name, hours }))
        .sort((a, b) => b.hours - a.hours);
    }
    if (selectedPerson) return []; // can't compute without per-person work type data
    return data.workTypeTotals;
  }, [data, selectedClient, selectedPerson]);

  const filteredCategoryTotals = useMemo(() => {
    if (!data) return {};
    if (selectedClient) return {}; // hide — insufficient data
    if (selectedPerson) {
      const person = data.compliance.find((p) => p.name === selectedPerson);
      if (!person) return {};
      const totals: Record<string, number> = {};
      if (person.clientHours > 0) totals.CLIENT_WORK = person.clientHours;
      if (person.internalHours > 0) totals.INTERNAL = person.internalHours;
      if (person.adminHours > 0) totals.ADMIN = person.adminHours;
      if (person.trainingHours > 0) totals.TRAINING = person.trainingHours;
      return totals;
    }
    return data.categoryTotals;
  }, [data, selectedClient, selectedPerson]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-400" />
      </div>
    );
  }

  if (invalid || !snapshot || !data || !filteredOverview) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0b] text-center">
        <p className="text-[14px] text-zinc-400">Invalid or expired link.</p>
      </div>
    );
  }

  const totalHours = filteredOverview.totalHours;
  const isWeekly = snapshot.type === "WEEKLY";
  const badgeClass = isWeekly
    ? "bg-violet-400/10 text-violet-400"
    : "bg-lime-400/10 text-lime-400";

  const hasFilter = !!(selectedClient || selectedPerson);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="mx-auto max-w-4xl space-y-10 px-6 py-12 pb-20">

        {/* Back link */}
        <a
          href={`/hub/${token}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 transition hover:text-zinc-300"
        >
          ← All reports
        </a>

        {/* Header */}
        <div className="border-b border-white/[0.06] pb-8">
          <div className="flex items-start justify-between">
            <div>
              <span className={cn("mb-3 inline-block rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase", badgeClass)}>
                {isWeekly ? "Weekly" : "Monthly"}
              </span>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">{snapshot.label}</h1>
              <p className="mt-1 text-[13px] text-zinc-500">
                {format(new Date(snapshot.periodFrom), "MMM d")} –{" "}
                {format(new Date(snapshot.periodTo), "MMM d, yyyy")}
              </p>
            </div>
            <p className="text-right text-[12px] text-zinc-600">
              Generated<br />
              {format(new Date(snapshot.generatedAt), "MMM d, yyyy · h:mm a")}
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-zinc-600 mr-1">Filter:</span>
          <select
            value={selectedClient ?? ""}
            onChange={(e) => {
              setSelectedClient(e.target.value || null);
              setSelectedPerson(null);
            }}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] text-zinc-300 focus:outline-none focus:border-white/20 cursor-pointer"
          >
            <option value="">All clients</option>
            {clientList.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={selectedPerson ?? ""}
            onChange={(e) => {
              setSelectedPerson(e.target.value || null);
              setSelectedClient(null);
            }}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] text-zinc-300 focus:outline-none focus:border-white/20 cursor-pointer"
          >
            <option value="">All people</option>
            {personList.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {hasFilter && (
            <button
              onClick={() => { setSelectedClient(null); setSelectedPerson(null); }}
              className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[13px] text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition"
            >
              Clear ×
            </button>
          )}
          {hasFilter && (
            <span className="text-[12px] text-zinc-600">
              Showing: <span className="text-zinc-400">{selectedClient ?? selectedPerson}</span>
            </span>
          )}
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Hours", value: `${filteredOverview.totalHours}h` },
            {
              label: "Billable",
              value: `${filteredOverview.clientPercent}%`,
              accent: filteredOverview.clientPercent >= 60,
              warn: filteredOverview.clientPercent < 40,
            },
            {
              label: "Active Trackers",
              value: `${filteredOverview.activeUsers}/${filteredOverview.totalUsers}`,
              warn: filteredOverview.activeUsers < filteredOverview.totalUsers,
            },
            {
              label: selectedClient ? "Client" : "Clients",
              value: selectedClient ? selectedClient : `${filteredOverview.totalClients}`,
            },
          ].map((kpi) => (
            <div key={kpi.label} className={cn(
              "rounded-xl border p-4",
              hasFilter ? "border-white/[0.10] bg-white/[0.04]" : "border-white/[0.06] bg-white/[0.02]"
            )}>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">{kpi.label}</p>
              <p className={cn("font-mono text-2xl font-bold truncate",
                kpi.accent ? "text-lime-400" : kpi.warn ? "text-amber-400" : "text-white"
              )}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>

        {/* Compliance Table */}
        <Section num="01" title="Tracking" em="Compliance">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Person</th>
                  <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Hours</th>
                  <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Entries</th>
                  <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Days</th>
                  <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">Billable %</th>
                  <th className="pb-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 pl-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompliance.map((p) => (
                  <tr key={p.name} className="border-b border-white/[0.03]">
                    <td className={cn("py-2.5 font-medium", p.hours === 0 ? "text-red-400" : "text-white")}>{p.name}</td>
                    <td className="py-2.5 text-right font-mono text-white">{p.hours}h</td>
                    <td className="py-2.5 text-right font-mono text-zinc-400">{p.entries}</td>
                    <td className="py-2.5 text-right font-mono text-zinc-400">{p.daysActive}</td>
                    <td className={cn("py-2.5 text-right font-mono font-semibold",
                      p.billablePercent >= 60 ? "text-lime-400" : p.billablePercent >= 40 ? "text-white" : "text-amber-400"
                    )}>
                      {p.billablePercent}%
                    </td>
                    <td className="py-2.5 pl-4">
                      {p.hours === 0 ? (
                        <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[11px] font-medium text-red-400">No entries</span>
                      ) : p.entries < 3 ? (
                        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">Low activity</span>
                      ) : (
                        <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-2 py-0.5 text-[11px] font-medium text-lime-400">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Hours by Client — expandable */}
        {filteredByClient.length > 0 && (
          <Section num="02" title="Hours by" em="Client">
            <div className="space-y-2">
              {filteredByClient.map((c, i) => {
                const maxH = filteredByClient[0]?.hours ?? 1;
                const pct = Math.max((c.hours / maxH) * 100, 4);
                const color = CLIENT_COLORS[i % CLIENT_COLORS.length];
                const isExpanded = expandedClient === c.name;
                const maxTypeH = c.byType
                  ? Math.max(...Object.values(c.byType), 1)
                  : 1;

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
                    {/* Row header */}
                    <button
                      onClick={() => setExpandedClient(isExpanded ? null : c.name)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                    >
                      <span className="w-32 shrink-0 truncate text-[13px] text-zinc-400" title={c.name}>
                        {c.name}
                      </span>
                      <div className="flex-1 h-7 rounded-md bg-white/[0.03] overflow-hidden">
                        <div
                          className="h-full rounded-md flex items-center transition-all"
                          style={{ width: `${pct}%`, backgroundColor: color + "b3" }}
                        >
                          <span className="pl-2 text-[12px] font-semibold text-[#0a0a0b] whitespace-nowrap">
                            {c.hours}h
                          </span>
                        </div>
                      </div>
                      <span className="w-12 shrink-0 text-right text-[11px] text-zinc-600">
                        {c.peopleCount} ppl
                      </span>
                      <span className="shrink-0 text-[11px] text-zinc-600">
                        {isExpanded ? "▼" : "▶"}
                      </span>
                    </button>

                    {/* Expanded breakdown */}
                    {isExpanded && (
                      <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
                        <div className="grid grid-cols-2 gap-6">
                          {/* Work types */}
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
                                    <span className="w-8 shrink-0 text-right text-[11px] font-mono text-zinc-400">
                                      {hrs}h
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>

                          {/* People */}
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
                                  {c.peopleCount} person{c.peopleCount !== 1 ? "s" : ""}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Category Breakdown — hidden when filtering by client */}
        {!selectedClient && Object.keys(filteredCategoryTotals).length > 0 && totalHours > 0 && (
          <Section num="03" title="Category" em="Breakdown">
            <div className="space-y-3">
              <div className="flex h-8 overflow-hidden rounded-lg">
                {Object.entries(filteredCategoryTotals).map(([cat, hrs]) => {
                  const pct = (hrs / totalHours) * 100;
                  return (
                    <div
                      key={cat}
                      className={cn(categoryColors[cat] ?? "bg-zinc-500", "flex items-center justify-center text-[11px] font-semibold text-[#0a0a0b]")}
                      style={{ width: `${pct}%` }}
                      title={`${categoryLabels[cat] ?? cat}: ${hrs}h`}
                    >
                      {pct >= 10 ? `${Math.round(pct)}%` : ""}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-4">
                {Object.entries(filteredCategoryTotals).map(([cat, hrs]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <div className={cn("h-2.5 w-2.5 rounded-full", categoryColors[cat] ?? "bg-zinc-500")} />
                    <span className="text-[12px] text-zinc-400">
                      {categoryLabels[cat] ?? cat}: <span className="font-medium text-zinc-300">{hrs}h</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* Work Type Breakdown — hidden when filtering by person */}
        {!selectedPerson && filteredWorkTypeTotals.length > 0 && (
          <Section num="04" title="Work Type" em="Breakdown">
            <div className="space-y-2">
              {filteredWorkTypeTotals.map((wt) => {
                const maxH = filteredWorkTypeTotals[0]?.hours ?? 1;
                const pct = Math.max((wt.hours / maxH) * 100, 4);
                const billableBase = selectedClient
                  ? filteredByClient[0]?.hours ?? 1
                  : data.overview.clientHours;
                const shareOfBillable = billableBase > 0
                  ? Math.round((wt.hours / billableBase) * 100)
                  : 0;
                return (
                  <div key={wt.name} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-[13px] text-zinc-400">{wt.name}</span>
                    <div className="flex-1 h-6 rounded-md bg-white/[0.03] overflow-hidden">
                      <div className="h-full rounded-md bg-violet-400/60 flex items-center" style={{ width: `${pct}%` }}>
                        <span className="pl-2 text-[11px] font-semibold text-[#0a0a0b] whitespace-nowrap">{wt.hours}h</span>
                      </div>
                    </div>
                    <span className="w-10 text-right text-[12px] font-mono text-zinc-500">{shareOfBillable}%</span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <p className="text-center text-[11px] text-zinc-700">Timelog · Auto-generated report</p>
      </div>
    </div>
  );
}

function Section({ num, title, em, children }: { num: string; title: string; em: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[11px] font-medium uppercase tracking-widest text-lime-400/60">{num}</p>
      <h2 className="mb-5 text-xl font-semibold text-white">
        {title} <span className="text-lime-400">{em}</span>
      </h2>
      {children}
    </div>
  );
}
