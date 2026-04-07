"use client";

import { useState, useEffect } from "react";
import { Category } from "@/generated/prisma/client";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface WorkType {
  id: string;
  name: string;
}

interface Activity {
  id: string;
  name: string;
  category: Category;
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
  { value: "CLIENT_WORK" as Category, label: "Client Work", color: "lime" },
  { value: "INTERNAL" as Category, label: "Internal", color: "violet" },
  { value: "ADMIN" as Category, label: "Admin", color: "amber" },
  { value: "TRAINING" as Category, label: "Training", color: "blue" },
];

const categoryColors: Record<string, string> = {
  lime: "bg-lime-400/15 border-lime-400 text-lime-400",
  violet: "bg-violet-400/15 border-violet-400 text-violet-400",
  amber: "bg-amber-400/15 border-amber-400 text-amber-400",
  blue: "bg-blue-400/15 border-blue-400 text-blue-400",
  inactive: "bg-zinc-800/50 border-zinc-700 text-zinc-400",
};

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

  // Fetch tasks when project changes
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
        description: category !== "CLIENT_WORK" ? description || undefined : undefined,
        hours,
        notes: notes || undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Category selector */}
      <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
          Categoría
        </p>
        <div className="grid grid-cols-4 gap-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-center text-xs font-medium transition",
                category === cat.value
                  ? categoryColors[cat.color]
                  : categoryColors.inactive + " hover:bg-zinc-800"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client Work fields */}
      {category === "CLIENT_WORK" && (
        <>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
              Cliente / Proyecto
            </p>
            <Select value={selectedProject} onValueChange={(v) => setSelectedProject(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar proyecto..." />
              </SelectTrigger>
              <SelectContent>
                {asanaProjects.map((p) => (
                  <SelectItem key={p.gid} value={p.gid}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProject && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
                Task / Deliverable{" "}
                <span className="text-zinc-600">(desde Asana)</span>
              </p>
              <Select
                value={selectedTask}
                onValueChange={(v) => setSelectedTask(v ?? "")}
                disabled={loadingTasks}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingTasks ? "Cargando..." : "Seleccionar task..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((t) => (
                    <SelectItem key={t.gid} value={t.gid}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
              Tipo de trabajo
            </p>
            <div className="flex flex-wrap gap-1.5">
              {workTypes.map((wt) => (
                <button
                  key={wt.id}
                  onClick={() => setSelectedWorkType(wt.id)}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-xs font-medium transition",
                    selectedWorkType === wt.id
                      ? "bg-lime-400/15 border-lime-400 text-lime-400"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
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
            <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
              Actividad
            </p>
            <Select value={selectedActivity} onValueChange={(v) => setSelectedActivity(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar actividad..." />
              </SelectTrigger>
              <SelectContent>
                {filteredActivities.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
              Descripción{" "}
              <span className="text-zinc-600">(opcional)</span>
            </p>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalle breve..."
              className="bg-zinc-900 border-zinc-800"
            />
          </div>
        </>
      )}

      {/* Hours */}
      <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
          Horas
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setHours(Math.max(0.25, hours - 0.25))}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-[60px] text-center text-3xl font-bold text-white">
            {hours}
          </span>
          <button
            onClick={() => setHours(Math.min(24, hours + 0.25))}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
          Notas <span className="text-zinc-600">(opcional)</span>
        </p>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Algún detalle extra..."
          className="bg-zinc-900 border-zinc-800"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 bg-lime-400 text-zinc-900 font-semibold hover:bg-lime-300"
        >
          {loading ? "Guardando..." : initialData ? "Actualizar" : "Guardar entrada"}
        </Button>
        <Button variant="outline" onClick={onCancel} className="border-zinc-700">
          Cancelar
        </Button>
      </div>
    </div>
  );
}
