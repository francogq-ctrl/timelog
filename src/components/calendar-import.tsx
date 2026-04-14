"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { CalendarDays, Check, Loader2, X, AlertCircle } from "lucide-react";
import { Category } from "@/generated/prisma/client";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  hours: number;
  attendeesCount: number;
  alreadyLogged: boolean;
}

interface CalendarImportProps {
  date: Date;
  onImported: () => void;
}

function formatTime(iso: string) {
  return format(new Date(iso), "h:mm a");
}

export function CalendarImport({ date, onImported }: CalendarImportProps) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const dateStr = format(date, "yyyy-MM-dd");

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch(`/api/calendar/events?date=${dateStr}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "calendar_scope_missing") {
          setError("reauth");
        } else {
          setError(data.message ?? data.error ?? "Failed to load calendar events");
        }
        return;
      }
      setEvents(data);
      // Pre-select events that haven't been logged yet
      setSelected(new Set(data.filter((e: CalendarEvent) => !e.alreadyLogged).map((e: CalendarEvent) => e.id)));
    } catch {
      setError("Could not connect to Google Calendar");
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  function handleOpen() {
    setOpen(true);
    setEvents([]);
    setSelected(new Set());
    setError(null);
    setDone(false);
    fetchEvents();
  }

  function handleClose() {
    setOpen(false);
    setEvents([]);
    setSelected(new Set());
    setError(null);
    setDone(false);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);

    const toImport = events.filter((e) => selected.has(e.id) && !e.alreadyLogged);

    const results = await Promise.allSettled(
      toImport.map((e) =>
        fetch("/api/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: dateStr,
            category: Category.INTERNAL,
            description: e.title,
            hours: e.hours,
            notes: `Imported from Google Calendar (${formatTime(e.start)} – ${formatTime(e.end)})`,
            calendarEventId: e.id,
          }),
        })
      )
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    setImporting(false);

    if (succeeded > 0) {
      setDone(true);
      onImported();
      // Refresh event list to show newly logged ones
      fetchEvents();
    }
  }

  const availableEvents = events.filter((e) => !e.alreadyLogged);
  const selectedAvailable = events.filter((e) => selected.has(e.id) && !e.alreadyLogged);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="group flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] py-3.5 text-[13px] font-medium text-zinc-600 transition-gpu hover:border-violet-400/30 hover:bg-violet-400/5 hover:text-violet-400"
      >
        <CalendarDays className="h-4 w-4" />
        Import from Calendar
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Panel */}
          <div className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0f0f11] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
              <div>
                <h2 className="text-[15px] font-semibold text-white">
                  Import from Calendar
                </h2>
                <p className="text-[12px] text-zinc-500 mt-0.5">
                  {format(date, "EEEE, MMMM d")}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-12 gap-3 text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-[13px]">Loading calendar events…</span>
                </div>
              )}

              {error === "reauth" && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[13px] font-medium text-amber-300">Calendar access needed</p>
                      <p className="text-[12px] text-zinc-400 mt-1">
                        Sign out and back in to grant Google Calendar access. This only happens once.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {error && error !== "reauth" && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <p className="text-[13px] text-red-400">{error}</p>
                </div>
              )}

              {!loading && !error && events.length === 0 && (
                <div className="py-12 text-center">
                  <CalendarDays className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
                  <p className="text-[13px] text-zinc-500">No events found for this day</p>
                </div>
              )}

              {!loading && !error && events.length > 0 && (
                <div className="space-y-2">
                  {events.map((event) => {
                    const isSelected = selected.has(event.id);
                    const isLogged = event.alreadyLogged;

                    return (
                      <button
                        key={event.id}
                        onClick={() => !isLogged && toggleSelect(event.id)}
                        disabled={isLogged}
                        className={`
                          w-full text-left rounded-xl border px-4 py-3 transition-colors
                          ${isLogged
                            ? "border-white/[0.04] bg-white/[0.02] opacity-50 cursor-default"
                            : isSelected
                            ? "border-violet-400/30 bg-violet-400/8 cursor-pointer"
                            : "border-white/[0.06] bg-[#141416] hover:border-white/[0.12] cursor-pointer"
                          }
                        `}
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <div
                            className={`
                              mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors
                              ${isLogged
                                ? "border-white/[0.1] bg-white/[0.04]"
                                : isSelected
                                ? "border-violet-400 bg-violet-400"
                                : "border-white/[0.15]"
                              }
                            `}
                          >
                            {isLogged ? (
                              <Check className="h-2.5 w-2.5 text-zinc-500" />
                            ) : isSelected ? (
                              <Check className="h-2.5 w-2.5 text-black" />
                            ) : null}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[13px] font-medium text-white truncate">
                                {event.title}
                              </p>
                              <span className="text-[12px] font-mono text-zinc-400 shrink-0">
                                {event.hours}h
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                              {formatTime(event.start)} – {formatTime(event.end)}
                              {event.attendeesCount > 1 && (
                                <span className="ml-2 text-zinc-600">
                                  · {event.attendeesCount} attendees
                                </span>
                              )}
                            </p>
                            {isLogged && (
                              <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-zinc-600">
                                <Check className="h-2.5 w-2.5" /> Already logged
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {!loading && !error && availableEvents.length > 0 && (
              <div className="px-5 pb-5 pt-4 border-t border-white/[0.06] flex items-center justify-between gap-3">
                <p className="text-[12px] text-zinc-500">
                  {done
                    ? `Logged ${selectedAvailable.length > 0 ? "all selected" : "entries"} as Internal`
                    : `${selectedAvailable.length} of ${availableEvents.length} selected`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 rounded-lg text-[13px] text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    {done ? "Done" : "Cancel"}
                  </button>
                  {!done && (
                    <button
                      onClick={handleImport}
                      disabled={selectedAvailable.length === 0 || importing}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Log {selectedAvailable.length > 0 ? `${selectedAvailable.length} ` : ""}
                      {selectedAvailable.length === 1 ? "event" : "events"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
