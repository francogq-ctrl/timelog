"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays, startOfWeek, isToday, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

interface DateNavigatorProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  /** Number of hours logged per day of the week [Mon..Sun] */
  weekHours?: number[];
  /** Allow navigation to future dates (admin only) */
  allowFuture?: boolean;
}

const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

export function DateNavigator({ currentDate, onDateChange, weekHours, allowFuture = false }: DateNavigatorProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-3">
      {/* Date header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-zinc-500">
            {isToday(currentDate) ? "Today" : format(currentDate, "EEEE")}
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            {format(currentDate, "MMMM d")}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDateChange(subDays(currentDate, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-gpu hover:bg-white/[0.06] hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {!isToday(currentDate) && (
            <button
              onClick={() => onDateChange(new Date())}
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 transition-gpu hover:bg-white/[0.06] hover:text-white"
            >
              Today
            </button>
          )}
          <button
            onClick={() => onDateChange(addDays(currentDate, 1))}
            disabled={!allowFuture && isToday(currentDate)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-gpu hover:bg-white/[0.06] hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Week bar */}
      <div className="flex justify-between gap-1">
        {weekDays.map((day, i) => {
          const isSelected = isSameDay(day, currentDate);
          const isFuture = day > new Date();
          const blocked = isFuture && !allowFuture;
          const dayHours = weekHours?.[i] ?? 0;
          const hasEntries = dayHours > 0;

          return (
            <button
              key={i}
              disabled={blocked}
              onClick={() => onDateChange(day)}
              className={cn(
                "group relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-gpu",
                isSelected
                  ? "bg-white/[0.08] text-white"
                  : blocked
                  ? "text-zinc-700 cursor-not-allowed"
                  : isFuture
                  ? "text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-400"
                  : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
              )}
            >
              <span>{dayLabels[i]}</span>
              <span className={cn(
                "font-mono text-[10px]",
                isSelected ? "text-lime-400" : hasEntries ? "text-zinc-400" : "text-zinc-700"
              )}>
                {hasEntries ? `${dayHours}h` : "\u00B7"}
              </span>
              {/* Active indicator */}
              {isSelected && (
                <div className="absolute -bottom-0.5 h-0.5 w-4 rounded-full bg-lime-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
