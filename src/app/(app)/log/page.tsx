"use client";

import { useState, useEffect, useCallback } from "react";
import { format, startOfWeek } from "date-fns";
import { Plus, Clock, ChevronDown } from "lucide-react";
import { useSession } from "next-auth/react";
import { DateNavigator } from "@/components/date-navigator";
import { EntryCard } from "@/components/entry-card";
import { EntryForm } from "@/components/entry-form";
import { CalendarImport } from "@/components/calendar-import";
import { Category } from "@/generated/prisma/client";

interface TimeEntry {
  id: string;
  category: Category;
  clientName: string | null;
  asanaProjectId: string | null;
  asanaTaskId: string | null;
  asanaTaskName: string | null;
  workTypeId: string | null;
  activityId: string | null;
  description: string | null;
  hours: number;
  notes: string | null;
  workType: { id: string; name: string } | null;
  activity: { id: string; name: string; category: Category } | null;
}

interface FormData {
  workTypes: { id: string; name: string }[];
  activities: { id: string; name: string; category: Category }[];
  asanaProjects: { id: string; gid: string; name: string }[];
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

export default function LogPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekHours, setWeekHours] = useState<number[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const dateStr = format(currentDate, "yyyy-MM-dd");

  // Fetch team members for admin selector
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data: User[]) => setUsers(data))
      .catch(() => {});
  }, [isAdmin]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date: dateStr });
      if (isAdmin && targetUserId) params.set("userId", targetUserId);
      const res = await fetch(`/api/entries?${params}`);
      const data = await res.json();
      setEntries(data);
    } catch {
      console.error("Failed to fetch entries");
    } finally {
      setLoading(false);
    }
  }, [dateStr, isAdmin, targetUserId]);

  const fetchFormData = useCallback(async () => {
    try {
      const res = await fetch("/api/entries/form-data");
      const data = await res.json();
      setFormData(data);
    } catch {
      console.error("Failed to fetch form data");
    }
  }, []);

  // Fetch week hours in a single request
  const fetchWeekHours = useCallback(async () => {
    try {
      const weekStart = format(startOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const params = new URLSearchParams({ weekStart });
      if (isAdmin && targetUserId) params.set("userId", targetUserId);
      const res = await fetch(`/api/entries/week?${params}`);
      const data = await res.json();
      setWeekHours(data);
    } catch {
      // Silently fail
    }
  }, [currentDate, isAdmin, targetUserId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { fetchFormData(); }, [fetchFormData]);
  useEffect(() => { fetchWeekHours(); }, [fetchWeekHours]);

  // Keyboard shortcut: N to open form
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "n" && !showForm && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        handleAdd();
      }
      if (e.key === "Escape" && showForm) {
        setShowForm(false);
        setEditingEntry(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showForm]);

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

  // Category breakdown
  const categoryHours = entries.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.hours;
    return acc;
  }, {} as Record<string, number>);

  function handleAdd() {
    setEditingEntry(null);
    setShowForm(true);
  }

  function handleEdit(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (entry) {
      setEditingEntry(entry);
      setShowForm(true);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/entries/${id}`, { method: "DELETE" });
    fetchEntries();
    fetchWeekHours();
  }

  async function handleSubmit(data: {
    category: Category;
    clientName?: string;
    asanaProjectId?: string;
    asanaTaskId?: string;
    asanaTaskName?: string;
    workTypeId?: string | string[];
    activityId?: string;
    description?: string;
    hours: number;
    notes?: string;
  }) {
    setSubmitError(null);
    try {
      let res: Response;
      if (editingEntry) {
        res = await fetch(`/api/entries/${editingEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        res = await fetch("/api/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            date: dateStr,
            ...(isAdmin && targetUserId ? { userId: targetUserId } : {}),
          }),
        });
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setSubmitError(errorData.error || `Error: ${res.status} ${res.statusText}`);
        return;
      }

      setShowForm(false);
      setEditingEntry(null);
      fetchEntries();
      fetchWeekHours();
    } catch (err) {
      setSubmitError("Failed to submit entry. Please check your connection and try again.");
    }
  }

  const categoryBarColors: Record<string, string> = {
    CLIENT_WORK: "bg-lime-400",
    INTERNAL: "bg-violet-400",
    ADMIN: "bg-amber-400",
    TRAINING: "bg-blue-400",
  };

  const selectedUser = users.find((u) => u.id === targetUserId);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {/* Admin: user selector */}
      {isAdmin && users.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#141416] px-4 py-3">
          <span className="text-[12px] text-zinc-500 shrink-0">Logging for</span>
          <div className="relative flex-1">
            <select
              value={targetUserId ?? ""}
              onChange={(e) => {
                setTargetUserId(e.target.value || null);
                setShowForm(false);
                setEditingEntry(null);
              }}
              className="w-full appearance-none bg-transparent text-[13px] font-medium text-white outline-none cursor-pointer pr-5"
            >
              <option value="">myself</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          </div>
          {selectedUser && (
            <button
              onClick={() => { setTargetUserId(null); setShowForm(false); setEditingEntry(null); }}
              className="text-[11px] text-zinc-600 hover:text-zinc-400 shrink-0"
            >
              clear
            </button>
          )}
        </div>
      )}

      <DateNavigator
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        weekHours={weekHours}
      />

      {/* Daily summary bar */}
      {entries.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#141416] px-4 py-3">
          <div className="flex items-center gap-2 flex-1">
            <Clock className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-[13px] text-zinc-400">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
            {/* Mini category breakdown bar */}
            <div className="ml-2 flex h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
              {Object.entries(categoryHours).map(([cat, hrs]) => (
                <div
                  key={cat}
                  className={`${categoryBarColors[cat] ?? "bg-zinc-500"} opacity-60`}
                  style={{ width: `${(hrs / totalHours) * 100}%` }}
                />
              ))}
            </div>
          </div>
          <span className="font-mono text-lg font-semibold text-white tabular-nums">
            {totalHours}<span className="text-[13px] text-zinc-500 font-normal">h</span>
          </span>
        </div>
      )}

      {/* Entries list */}
      <div className="space-y-2 stagger-children">
        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-400" />
          </div>
        ) : entries.length === 0 && !showForm ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04]">
              <Clock className="h-5 w-5 text-zinc-600" />
            </div>
            <p className="text-[14px] font-medium text-zinc-400">
              No entries yet
            </p>
            <p className="mt-1 text-[12px] text-zinc-600">
              Press <kbd className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">N</kbd> or tap the button below
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Error message */}
      {submitError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
          <p className="text-[13px] text-red-400">{submitError}</p>
        </div>
      )}

      {/* Inline form */}
      {showForm && formData && (
        <EntryForm
          initialData={
            editingEntry
              ? {
                  category: editingEntry.category,
                  clientName: editingEntry.clientName ?? undefined,
                  asanaProjectId: editingEntry.asanaProjectId ?? undefined,
                  asanaTaskId: editingEntry.asanaTaskId ?? undefined,
                  asanaTaskName: editingEntry.asanaTaskName ?? undefined,
                  workTypeId: editingEntry.workTypeId ?? undefined,
                  activityId: editingEntry.activityId ?? undefined,
                  description: editingEntry.description ?? undefined,
                  hours: editingEntry.hours,
                  notes: editingEntry.notes ?? undefined,
                }
              : undefined
          }
          workTypes={formData.workTypes}
          activities={formData.activities}
          asanaProjects={formData.asanaProjects}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingEntry(null); }}
        />
      )}

      {/* Add button + Calendar import */}
      {!showForm && (
        <div className="space-y-2">
          <button
            onClick={handleAdd}
            className="group flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.1] py-3.5 text-[13px] font-medium text-zinc-500 transition-gpu hover:border-lime-400/30 hover:bg-lime-400/5 hover:text-lime-400"
          >
            <Plus className="h-4 w-4 transition-gpu group-hover:rotate-90" />
            Log Time
          </button>
          {session?.user?.email === "franco@andgather.co" && (
            <CalendarImport date={currentDate} onImported={fetchEntries} />
          )}
        </div>
      )}
    </div>
  );
}
