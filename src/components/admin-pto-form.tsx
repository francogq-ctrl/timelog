"use client";

import { useMemo, useState } from "react";
import { format, parseISO, addDays, isWeekend } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface User {
  id: string;
  name: string | null;
  email: string;
  active: boolean;
}

interface Props {
  users: User[];
}

function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

export function AdminPtoForm({ users }: Props) {
  const [userId, setUserId] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [hoursPerDay, setHoursPerDay] = useState("8");
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewDays = useMemo(() => {
    if (!startDate || !endDate) return [];
    try {
      const s = parseISO(startDate);
      const e = parseISO(endDate);
      if (e < s) return [];
      const out: Date[] = [];
      let cur = s;
      while (cur <= e) {
        if (!skipWeekends || !isWeekend(cur)) out.push(cur);
        cur = addDays(cur, 1);
      }
      return out;
    } catch {
      return [];
    }
  }, [startDate, endDate, skipWeekends]);

  const totalHours = previewDays.length * (parseFloat(hoursPerDay) || 0);

  const activeUsers = users.filter((u) => u.active);

  async function submit() {
    setError(null);
    setResult(null);
    if (!userId) {
      setError("Pick a team member");
      return;
    }
    if (previewDays.length === 0) {
      setError("Date range yields no workdays");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/pto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          startDate,
          endDate,
          hoursPerDay: parseFloat(hoursPerDay),
          skipWeekends,
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to log PTO");
        return;
      }
      setResult({ created: json.created, skipped: json.skipped });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Log PTO for a team member across a date range. Creates one Time Off entry per day. Existing TIME_OFF entries on the same dates are skipped.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-zinc-500">Team member</label>
          <Select value={userId} onValueChange={(v) => setUserId(v ?? "")}>
            <SelectTrigger className="bg-zinc-900 border-zinc-800">
              <SelectValue placeholder="Pick a person..." />
            </SelectTrigger>
            <SelectContent>
              {activeUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-zinc-500">Hours per day</label>
          <Input
            type="number"
            step="0.25"
            min="0.25"
            value={hoursPerDay}
            onChange={(e) => setHoursPerDay(e.target.value)}
            className="bg-zinc-900 border-zinc-800"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-zinc-500">Start date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-zinc-900 border-zinc-800"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-zinc-500">End date</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-zinc-900 border-zinc-800"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs text-zinc-500">Notes (optional)</label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Vacation - Italy trip"
            className="bg-zinc-900 border-zinc-800"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={skipWeekends}
          onChange={(e) => setSkipWeekends(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
        />
        Skip weekends
      </label>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">Preview</span>
          <span className="font-mono text-zinc-300">
            {previewDays.length} day{previewDays.length === 1 ? "" : "s"} · {totalHours}h total
          </span>
        </div>
        {previewDays.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {previewDays.slice(0, 30).map((d) => (
              <span
                key={d.toISOString()}
                className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-400"
              >
                {format(d, "EEE MMM d")}
              </span>
            ))}
            {previewDays.length > 30 && (
              <span className="text-[11px] text-zinc-500">+{previewDays.length - 30} more</span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {result && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
          Logged {result.created} day{result.created === 1 ? "" : "s"} of PTO
          {result.skipped > 0 && ` (${result.skipped} skipped — already logged)`}.
        </div>
      )}

      <Button onClick={submit} disabled={submitting || !userId || previewDays.length === 0}>
        {submitting ? "Logging..." : `Log ${previewDays.length} day${previewDays.length === 1 ? "" : "s"} of PTO`}
      </Button>
    </div>
  );
}
