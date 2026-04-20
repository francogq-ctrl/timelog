import { prisma } from "@/lib/db";
import { format } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function HubPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const config = await prisma.hubConfig.findUnique({ where: { token } });
  if (!config) notFound();

  const snapshots = await prisma.reportSnapshot.findMany({
    select: {
      id: true,
      type: true,
      source: true,
      label: true,
      periodFrom: true,
      periodTo: true,
      generatedAt: true,
    },
    orderBy: { generatedAt: "desc" },
  });

  const automated = snapshots.filter((s) => s.source === "AUTO");
  const custom = snapshots.filter((s) => s.source === "MANUAL");

  const typeColor = {
    accent: (type: string) => type === "WEEKLY" ? "violet" : "lime",
  };

  function SnapshotCard({
    s,
    token: t,
  }: {
    s: typeof snapshots[number];
    token: string;
  }) {
    const isWeekly = s.type === "WEEKLY";
    const hoverBorder = isWeekly ? "hover:border-violet-400/20 hover:bg-violet-400/[0.03]" : "hover:border-lime-400/20 hover:bg-lime-400/[0.03]";
    const badgeClass = isWeekly
      ? "bg-violet-400/10 text-violet-400"
      : "bg-lime-400/10 text-lime-400";
    const arrowHover = isWeekly ? "group-hover:text-violet-400" : "group-hover:text-lime-400";

    return (
      <Link
        href={`/hub/${t}/${s.id}`}
        className={`group flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 transition ${hoverBorder}`}
      >
        <div className="flex items-center gap-3">
          <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${badgeClass}`}>
            {isWeekly ? "Weekly" : "Monthly"}
          </span>
          <span className="text-[14px] font-medium text-white">{s.label}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[12px] text-zinc-600">
            {format(new Date(s.periodFrom), "MMM d")} →{" "}
            {format(new Date(s.periodTo), "MMM d, yyyy")}
          </span>
          <span className={`text-zinc-600 transition ${arrowHover}`}>→</span>
        </div>
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-lime-400/60">
            Timelog
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Report Hub</h1>
          <p className="mt-2 text-[14px] text-zinc-500">
            Weekly and monthly time tracking summaries
          </p>
        </div>

        {snapshots.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-12 text-center">
            <p className="text-[14px] text-zinc-500">No reports generated yet.</p>
            <p className="mt-1 text-[12px] text-zinc-600">
              Reports are automatically generated every Friday at 10pm EST and at the end of each month.
            </p>
          </div>
        )}

        {/* Automated Reports */}
        {automated.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                Automated Reports
              </h2>
              <span className="text-[10px] text-zinc-700">
                · generated every Friday at 10pm EST
              </span>
            </div>
            <div className="space-y-2">
              {automated.map((s) => (
                <SnapshotCard key={s.id} s={s} token={token} />
              ))}
            </div>
          </section>
        )}

        {/* Custom Reports */}
        {custom.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                Custom Reports
              </h2>
              <span className="text-[10px] text-zinc-700">· generated on demand</span>
            </div>
            <div className="space-y-2">
              {custom.map((s) => (
                <SnapshotCard key={s.id} s={s} token={token} />
              ))}
            </div>
          </section>
        )}

        <p className="mt-16 text-center text-[11px] text-zinc-700">
          Generated automatically · Timelog
        </p>
      </div>
    </div>
  );
}
