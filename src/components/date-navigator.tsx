"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays, startOfWeek, isToday, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DateNavigatorProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

const dayLabels = ["L", "M", "M", "J", "V", "S", "D"];

export function DateNavigator({ currentDate, onDateChange }: DateNavigatorProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-4">
      {/* Date header with arrows */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500">
            {isToday(currentDate) ? "Hoy" : format(currentDate, "EEEE", { locale: es })}
          </p>
          <h2 className="text-xl font-semibold text-white">
            {format(currentDate, "d 'de' MMMM", { locale: es })}
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onDateChange(subDays(currentDate, 1))}
            className="rounded-lg bg-zinc-800/50 p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {!isToday(currentDate) && (
            <button
              onClick={() => onDateChange(new Date())}
              className="rounded-lg bg-zinc-800/50 px-3 py-2 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              Hoy
            </button>
          )}
          <button
            onClick={() => onDateChange(addDays(currentDate, 1))}
            disabled={isToday(currentDate)}
            className="rounded-lg bg-zinc-800/50 p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Week bar */}
      <div className="flex justify-center gap-1.5">
        {weekDays.map((day, i) => {
          const isSelected = isSameDay(day, currentDate);
          const isFuture = day > new Date();
          return (
            <button
              key={i}
              disabled={isFuture}
              onClick={() => onDateChange(day)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition",
                isSelected
                  ? "bg-lime-400/15 border border-lime-400/30 text-lime-400"
                  : isFuture
                  ? "bg-zinc-800/30 text-zinc-600 cursor-not-allowed"
                  : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              )}
            >
              {dayLabels[i]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
