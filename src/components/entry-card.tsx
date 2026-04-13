"use client";

import { Trash2, Pencil, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

const categoryConfig = {
  CLIENT_WORK: {
    label: "Client",
    color: "text-lime-400",
    bg: "bg-lime-400/8",
    border: "border-lime-400/20",
    bar: "bg-lime-400",
    icon: "🎯",
  },
  INTERNAL: {
    label: "Internal",
    color: "text-violet-400",
    bg: "bg-violet-400/8",
    border: "border-violet-400/20",
    bar: "bg-violet-400",
    icon: "⚡",
  },
  ADMIN: {
    label: "Admin",
    color: "text-amber-400",
    bg: "bg-amber-400/8",
    border: "border-amber-400/20",
    bar: "bg-amber-400",
    icon: "📋",
  },
  TRAINING: {
    label: "Training",
    color: "text-blue-400",
    bg: "bg-blue-400/8",
    border: "border-blue-400/20",
    bar: "bg-blue-400",
    icon: "📚",
  },
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
  onRepeat?: (id: string) => void;
}

export function EntryCard({ entry, onEdit, onDelete, onRepeat }: EntryCardProps) {
  const cat = categoryConfig[entry.category];

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-xl border transition-gpu hover:border-white/[0.1]",
      "bg-[#141416] border-white/[0.06]"
    )}>
      {/* Category color bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", cat.bar)} />

      <div className="flex items-start justify-between p-4 pl-5">
        <div className="flex-1 min-w-0">
          {/* Category + primary info */}
          <div className="flex items-center gap-2">
            <span className={cn("text-[11px] font-semibold uppercase tracking-wider", cat.color)}>
              {cat.label}
            </span>
            {entry.workType && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-[11px] text-zinc-500">{entry.workType.name}</span>
              </>
            )}
          </div>

          {/* Main content */}
          {entry.category === "CLIENT_WORK" ? (
            <div className="mt-1.5">
              <p className="text-[14px] font-medium text-white leading-snug">
                {entry.clientName}
              </p>
              {entry.asanaTaskName && (
                <p className="mt-0.5 text-[13px] text-zinc-400 leading-snug truncate">
                  {entry.asanaTaskName}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-1.5">
              <p className="text-[14px] font-medium text-white leading-snug">
                {entry.activity?.name}
              </p>
              {entry.description && (
                <p className="mt-0.5 text-[13px] text-zinc-400 leading-snug">
                  {entry.description}
                </p>
              )}
            </div>
          )}

          {entry.notes && (
            <p className="mt-2 text-[12px] text-zinc-500 italic leading-snug">
              {entry.notes}
            </p>
          )}
        </div>

        {/* Hours + actions */}
        <div className="flex items-start gap-3 ml-4">
          <span className="font-mono text-lg font-semibold text-white tabular-nums">
            {entry.hours}<span className="text-[13px] text-zinc-500 font-normal">h</span>
          </span>

          {/* Hover actions */}
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-gpu">
            {onRepeat && (
              <button
                onClick={() => onRepeat(entry.id)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 transition-gpu hover:bg-white/[0.06] hover:text-zinc-300"
                title="Repeat entry"
              >
                <Copy className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={() => onEdit(entry.id)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 transition-gpu hover:bg-white/[0.06] hover:text-zinc-300"
              title="Edit"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => onDelete(entry.id)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 transition-gpu hover:bg-red-500/10 hover:text-red-400"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
