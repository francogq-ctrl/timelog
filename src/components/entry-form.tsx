"use client";

import { useState, useEffect } from "react";
import { Category } from "@/generated/prisma/client";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface WorkType {
  id: string;
  name: string;
}

interface Activity {
  id: string;
  name: string;
  category: string;
}

interface AsanaProject {
  id: string;
  gid: string;
  name: string;
}

interface AsanaTask {
  id: string;
  gid: string;
  name: string;
}

interface EntryFormData {
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
}

interface EntryFormProps {
  initialData?: EntryFormData;
  workTypes: WorkType[];
  activities: Activity[];
  asanaProjects: AsanaProject[];
  onSubmit: (data: EntryFormData) => Promise<void>;
  onCancel: () => void;
}

const categories = [
  { value: "CLIENT_WORK" as Category, label: "Client", icon: "🎯", color: "lime" },
  { value: "INTERNAL" as Category, label: "Internal", icon: "⚡", color: "violet" },
  { value: "ADMIN" as Category, label: "Admin", icon: "📋", color: "amber" },
  { value: "TRAINING" as Category, label: "Training", icon: "📚", color: "blue" },
];

const categoryStyles: Record<string, { active: string; inactive: string }> = {
  lime: {
    active: "bg-lime-400/12 border-lime-400/30 text-lime-400",
    inactive: "border-white/[0.06] text-zinc-500 hover:border-white/[0.1] hover:text-zinc-300",
  },
  violet: {
    active: "bg-violet-400/12 border-violet-400/30 text-violet-400",
    inactive: "border-white/[0.06] text-zinc-500 hover:border-white/[0.1] hover:text-zinc-300",
  },
  amber: {
    active: "bg-amber-400/12 border-amber-400/30 text-amber-400",
    inactive: "border-white/[0.06] text-zinc-500 hover:border-white/[0.1] hover:text-zinc-300",
  },
  blue: {
    active: "bg-blue-400/12 border-blue-400/30 text-blue-400",
    inactive: "border-white/[0.06] text-zinc-500 hover:border-white/[0.1] hover:text-zinc-300",
  },
};

const hourPresets = [0.5, 1, 2, 4, 8];

export function EntryForm({
  initialData,
  workTypes,
  activities,
  asanaProjects,
  onSubmit,
  onCancel,
}: EntryFormProps) {
  const [category, setCategory] = useState<Category>(
    initialData?.category ?? "CLIENT_WORK"
  );
  const [selectedProject, setSelectedProject] = useState(
    initialData?.asanaProjectId ?? ""
  );
  const [tasks, setTasks] = useState<AsanaTask[]>([]);
  const [selectedTask, setSelectedTask] = useState(
    initialData?.asanaTaskId ?? ""
  );
  const [selectedWorkType, setSelectedWorkType] = useState(
    initialData?.workTypeId ?? ""
  );
  const [selectedActivity, setSelectedActivity] = useState(
    initialData?.activityId ?? ""
  );
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [hours, setHours] = useState(initialData?.hours ?? 1);
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    if (!selectedProject) {
      setTasks([]);
      return;
    }
    setLoadingTasks(true);
    fetch(`/api/asana/tasks?projectGid=${selectedProject}`)
      .then((r) => r.json())
      .then((data) => {
        setTasks(data);
        setLoadingTasks(false);
      })
      .catch(() => setLoadingTasks(false));
  }, [selectedProject]);

  const filteredActivities = activities.filter((a) => a.category === category);

  async function handleSubmit() {
    setLoading(true);
    try {
      const selectedProjectObj = asanaProjects.find(
        (p) => p.gid === selectedProject
      );
      const selectedTaskObj = tasks.find((t) => t.gid === selectedTask);

      await onSubmit({
        category,
        clientName:
          category === "CLIENT_WORK" ? selectedProjectObj?.name : undefined,
        asanaProjectId:
          category === "CLIENT_WORK" ? selectedProject || undefined : undefined,
        asanaTaskId:
          category === "CLIENT_WORK" ? selectedTask || undefined : undefined,
        asanaTaskName:
          category === "CLIENT_WORK"
            ? selectedTaskObj?.name || undefined
            : undefined,
        workTypeId:
          category === "CLIENT_WORK" ? selectedWorkType || undefined : undefined,
        activityId:
          category !== "CLIENT_WORK" ? selectedActivity || undefined : undefined,
        description:
          category !== "CLIENT_WORK" ? description || undefined : undefined,
        hours,
        notes: notes || undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-entry-in rounded-xl border border-white/[0.08] bg-[#141416] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[14px] font-semibold text-white">
          {initialData ? "Edit Entry" : "New Entry"}
        </h3>
        <button
          onClick={onCancel}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-gpu hover:bg-white/[0.06] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5">
        {/* Category selector */}
        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Category
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {categories.map((cat) => {
              const styles = categoryStyles[cat.color];
              const isActive = category === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-[12px] font-medium transition-gpu",
                    isActive ? styles.active : styles.inactive
                  )}
                >
                  <span className="text-[13px]">{cat.icon}</span>
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Client Work fields */}
        {category === "CLIENT_WORK" && (
          <>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Project
              </label>
              <select
                value={selectedProject}
                onChange={(e) => { setSelectedProject(e.target.value); setSelectedTask(""); }}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white outline-none transition-gpu focus:border-lime-400/30 focus:ring-1 focus:ring-lime-400/20"
              >
                <option value="" className="bg-[#141416]">Select project...</option>
                {asanaProjects.map((p) => (
                  <option key={p.gid} value={p.gid} className="bg-[#141416]">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedProject && (
              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Task <span className="text-zinc-600">from Asana</span>
                </label>
                <select
                  value={selectedTask}
                  onChange={(e) => setSelectedTask(e.target.value)}
                  disabled={loadingTasks}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white outline-none transition-gpu focus:border-lime-400/30 focus:ring-1 focus:ring-lime-400/20 disabled:opacity-50"
                >
                  <option value="" className="bg-[#141416]">
                    {loadingTasks ? "Loading tasks..." : "Select task..."}
                  </option>
                  {tasks.map((t) => (
                    <option key={t.gid} value={t.gid} className="bg-[#141416]">
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Work type
              </label>
              <div className="flex flex-wrap gap-1.5">
                {workTypes.map((wt) => (
                  <button
                    key={wt.id}
                    onClick={() => setSelectedWorkType(selectedWorkType === wt.id ? "" : wt.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-gpu",
                      selectedWorkType === wt.id
                        ? "bg-lime-400/12 border-lime-400/30 text-lime-400"
                        : "border-white/[0.08] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300"
                    )}
                  >
                    {wt.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Non-client fields */}
        {category !== "CLIENT_WORK" && (
          <>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Activity
              </label>
              <select
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white outline-none transition-gpu focus:border-violet-400/30 focus:ring-1 focus:ring-violet-400/20"
              >
                <option value="" className="bg-[#141416]">Select activity...</option>
                {filteredActivities.map((a) => (
                  <option key={a.id} value={a.id} className="bg-[#141416]">
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Description <span className="text-zinc-600">optional</span>
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white placeholder:text-zinc-600 outline-none transition-gpu focus:border-white/[0.15]"
              />
            </div>
          </>
        )}

        {/* Hours */}
        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Hours
          </label>
          <div className="flex items-center gap-2">
            {/* Presets */}
            {hourPresets.map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={cn(
                  "flex h-10 items-center justify-center rounded-lg border px-3 font-mono text-[13px] font-medium transition-gpu",
                  hours === h
                    ? "border-lime-400/30 bg-lime-400/12 text-lime-400"
                    : "border-white/[0.08] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300"
                )}
              >
                {h}
              </button>
            ))}
            {/* Custom input */}
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(Math.max(0.25, Math.min(24, parseFloat(e.target.value) || 0)))}
                step={0.25}
                min={0.25}
                max={24}
                className="h-10 w-16 rounded-lg border border-white/[0.08] bg-white/[0.03] text-center font-mono text-[14px] font-semibold text-white outline-none transition-gpu focus:border-lime-400/30"
              />
              <span className="text-[13px] text-zinc-500">h</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Notes <span className="text-zinc-600">optional</span>
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any extra details..."
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white placeholder:text-zinc-600 outline-none transition-gpu focus:border-white/[0.15]"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 rounded-lg bg-lime-400 py-2.5 text-[13px] font-semibold text-[#0a0a0b] transition-gpu hover:bg-lime-300 disabled:opacity-50"
          >
            {loading ? "Saving..." : initialData ? "Update" : "Log Entry"}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-[13px] font-medium text-zinc-400 transition-gpu hover:bg-white/[0.04] hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
