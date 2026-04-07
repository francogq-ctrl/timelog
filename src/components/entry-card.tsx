"use client";

import { Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const categoryConfig = {
  CLIENT_WORK: { label: "Client Work", color: "text-lime-400", bg: "bg-lime-400/10" },
  INTERNAL: { label: "Internal", color: "text-violet-400", bg: "bg-violet-400/10" },
  ADMIN: { label: "Admin", color: "text-amber-400", bg: "bg-amber-400/10" },
  TRAINING: { label: "Training", color: "text-blue-400", bg: "bg-blue-400/10" },
};

interface EntryCardProps {
  entry: {
    id: string;
    category: keyof typeof categoryConfig;
    clientName?: string | null;
    asanaTaskName?: string | null;
    workType?: { name: string } | null;
    activity?: { name: string } | null;
    description?: string | null;
    hours: number;
    notes?: string | null;
  };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function EntryCard({ entry, onEdit, onDelete }: EntryCardProps) {
  const cat = categoryConfig[entry.category];

  return (
    <div className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-zinc-700">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className={cn("text-xs font-semibold uppercase tracking-wider", cat.color)}>
            {cat.label}
          </p>

          {entry.category === "CLIENT_WORK" ? (
            <>
              <p className="mt-1 text-sm font-medium text-white">
                {entry.clientName}
              </p>
              <p className="text-sm text-zinc-400">{entry.asanaTaskName}</p>
              {entry.workType && (
                <span
                  className={cn(
                    "mt-1.5 inline-block rounded px-2 py-0.5 text-xs",
                    cat.bg,
                    cat.color
                  )}
                >
                  {entry.workType.name}
                </span>
              )}
            </>
          ) : (
            <>
              <p className="mt-1 text-sm font-medium text-white">
                {entry.activity?.name}
              </p>
              {entry.description && (
                <p className="text-sm text-zinc-400">{entry.description}</p>
              )}
            </>
          )}

          {entry.notes && (
            <p className="mt-1 text-xs text-zinc-500 italic">{entry.notes}</p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          <span className="text-xl font-bold text-white">{entry.hours}h</span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={() => onEdit(entry.id)}
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(entry.id)}
              className="rounded-md p-1 text-zinc-500 hover:bg-red-900/50 hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
