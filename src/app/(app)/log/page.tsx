"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { DateNavigator } from "@/components/date-navigator";
import { EntryCard } from "@/components/entry-card";
import { EntryForm } from "@/components/entry-form";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

export default function LogPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const dateStr = format(currentDate, "yyyy-MM-dd");

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/entries?date=${dateStr}`);
      const data = await res.json();
      setEntries(data);
    } catch {
      console.error("Failed to fetch entries");
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  const fetchFormData = useCallback(async () => {
    try {
      const res = await fetch("/api/entries/form-data");
      const data = await res.json();
      setFormData(data);
    } catch {
      console.error("Failed to fetch form data");
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    fetchFormData();
  }, [fetchFormData]);

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

  function handleAdd() {
    setEditingEntry(null);
    setSheetOpen(true);
  }

  function handleEdit(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (entry) {
      setEditingEntry(entry);
      setSheetOpen(true);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta entrada?")) return;
    await fetch(`/api/entries/${id}`, { method: "DELETE" });
    fetchEntries();
  }

  async function handleSubmit(data: {
    category: Category;
    clientName?: string;
    asanaProjectId?: string;
    asanaTaskId?: string;
    asanaTaskName?: string;
    workTypeId?: string;
    activityId?: string;
    description?: string;
    hours: number;
    notes?: string;
  }) {
    if (editingEntry) {
      await fetch(`/api/entries/${editingEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, date: dateStr }),
      });
    }
    setSheetOpen(false);
    fetchEntries();
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <DateNavigator currentDate={currentDate} onDateChange={setCurrentDate} />

      {/* Entries list */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-500">
            Cargando...
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-zinc-500">
              No hay entradas para este día
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Agregá tu primera entrada del día
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

      {/* Total bar */}
      {entries.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-lime-400/20 bg-lime-400/5 px-4 py-3">
          <span className="text-sm text-zinc-400">Total del día</span>
          <span className="text-2xl font-bold text-lime-400">{totalHours}h</span>
        </div>
      )}

      {/* Add button */}
      <button
        onClick={handleAdd}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 py-3.5 text-sm font-semibold text-zinc-900 transition hover:bg-lime-300"
      >
        <Plus className="h-4 w-4" />
        Agregar entrada
      </button>

      {/* Entry form sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800">
          <SheetHeader>
            <SheetTitle className="text-white">
              {editingEntry ? "Editar entrada" : "Nueva entrada"}
            </SheetTitle>
          </SheetHeader>
          {formData && (
            <div className="mt-4 pb-8">
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
                onCancel={() => setSheetOpen(false)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
