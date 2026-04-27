"use client";

import { useState, useMemo } from "react";
import { Trash2, Clock, BookOpen, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAllHabitEntries, useHabitEntryMutations } from "@/hooks/use-habit-entries";
import { cn } from "@/lib/utils";
import type { Habit } from "@/types";
import type { HabitEntryWithHabit } from "@/hooks/use-habit-entries";

type DateFilter = "today" | "week" | "month" | "all";

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().split("T")[0];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (toDateStr(date) === toDateStr(today)) return "Today";
  if (toDateStr(date) === toDateStr(yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function formatTime(checkedInAt: string): string {
  return new Date(checkedInAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

interface LogEntryRowProps {
  entry: HabitEntryWithHabit;
  onDelete: (entryId: string, habitId: string, entryDate: string) => void;
  deleting: boolean;
}

function LogEntryRow({ entry, onDelete, deleting }: LogEntryRowProps) {
  const habit = entry.habits;
  const notesPreview = entry.notes ? stripHtml(entry.notes) : null;
  const truncatedNotes =
    notesPreview && notesPreview.length > 80
      ? notesPreview.slice(0, 80) + "…"
      : notesPreview;

  return (
    <div className="flex items-start gap-3 py-2.5 group">
      {/* Color dot */}
      <div
        className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
        style={{ backgroundColor: habit?.color ?? "#6366f1" }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/habits/${entry.habit_id}`}
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            {habit?.icon && <span className="mr-1">{habit.icon}</span>}
            {habit?.title ?? "Unknown habit"}
          </Link>
          <span className="text-xs text-muted-foreground">{formatTime(entry.checked_in_at)}</span>
          {entry.duration_minutes && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              <Clock size={10} />
              {entry.duration_minutes} min
            </span>
          )}
        </div>
        {truncatedNotes && (
          <p className="text-xs text-muted-foreground mt-0.5 flex items-start gap-1">
            <BookOpen size={10} className="mt-0.5 shrink-0" />
            {truncatedNotes}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDelete(entry.id, entry.habit_id, entry.entry_date)}
        disabled={deleting}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded"
        aria-label="Delete entry"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

interface HabitLogViewProps {
  habits: Habit[];
}

export function HabitLogView({ habits }: HabitLogViewProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [habitFilter, setHabitFilter] = useState<string>("all");
  const { deleteEntry, loading: deleting } = useHabitEntryMutations();

  const { from, to } = useMemo(() => {
    const today = new Date();
    const todayStr = toDateStr(today);
    if (dateFilter === "today") return { from: todayStr, to: todayStr };
    if (dateFilter === "week")
      return { from: toDateStr(getMonday(today)), to: todayStr };
    if (dateFilter === "month")
      return {
        from: toDateStr(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: todayStr,
      };
    return { from: undefined, to: undefined };
  }, [dateFilter]);

  const { entries, loading } = useAllHabitEntries({
    from,
    to,
    habitId: habitFilter !== "all" ? habitFilter : undefined,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, HabitEntryWithHabit[]>();
    for (const entry of entries) {
      const list = map.get(entry.entry_date) ?? [];
      list.push(entry);
      map.set(entry.entry_date, list);
    }
    return map;
  }, [entries]);

  const activeHabits = habits.filter((h) => !h.is_archived);
  const selectedHabitLabel =
    habitFilter === "all"
      ? "All habits"
      : activeHabits.find((h) => h.id === habitFilter)?.title ?? "All habits";

  const handleDelete = async (entryId: string, habitId: string, entryDate: string) => {
    await deleteEntry(entryId, habitId, entryDate);
  };

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          {DATE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setDateFilter(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                dateFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {activeHabits.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 ml-auto">
                {selectedHabitLabel}
                <ChevronDown size={13} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setHabitFilter("all")}>
                All habits
              </DropdownMenuItem>
              {activeHabits.map((h) => (
                <DropdownMenuItem key={h.id} onClick={() => setHabitFilter(h.id)}>
                  {h.icon && <span className="mr-1.5">{h.icon}</span>}
                  {h.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded bg-muted/60 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No entries in this period</p>
          <p className="text-xs mt-1">Check in on a habit to see your log here.</p>
        </div>
      )}

      {/* Grouped entries */}
      {!loading && entries.length > 0 && (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([date, dayEntries]) => (
            <div key={date}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {formatDateHeader(date)}
              </p>
              <div className="rounded-lg border bg-card divide-y divide-border">
                {dayEntries.map((entry) => (
                  <div key={entry.id} className="px-4">
                    <LogEntryRow
                      entry={entry}
                      onDelete={handleDelete}
                      deleting={deleting}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
