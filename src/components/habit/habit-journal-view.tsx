"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HabitEntryCard } from "@/components/habit/habit-entry-card";
import { HabitCheckInDialog } from "@/components/habit/habit-check-in-dialog";
import { cn } from "@/lib/utils";
import type { Habit, HabitEntry } from "@/types";

interface HabitJournalViewProps {
  habit: Habit;
  entries: HabitEntry[];
  className?: string;
}

/** Groups entries by calendar date for the scrollable journal layout. */
function groupByDate(entries: HabitEntry[]): Array<{ date: string; entries: HabitEntry[] }> {
  const map = new Map<string, HabitEntry[]>();
  for (const e of entries) {
    const existing = map.get(e.entry_date) ?? [];
    map.set(e.entry_date, [...existing, e]);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // newest first
    .map(([date, entries]) => ({ date, entries }));
}

export function HabitJournalView({ habit, entries, className }: HabitJournalViewProps) {
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<Date | undefined>();

  const groups = useMemo(() => groupByDate(entries), [entries]);

  const hasNotes = entries.some((e) => e.notes && e.notes.trim().length > 0);

  return (
    <div className={cn("space-y-0", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-muted-foreground" />
          <h3 className="font-semibold text-sm">Journal</h3>
          {entries.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {entries.length} entr{entries.length === 1 ? "y" : "ies"}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => {
            setPrefillDate(new Date());
            setCheckInOpen(true);
          }}
        >
          <Plus size={13} />
          Add entry
        </Button>
      </div>

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No journal entries yet.</p>
          <p className="text-xs mt-1">
            Start logging check-ins with notes to build your journal.
          </p>
        </div>
      )}

      {/* Journal entries — scrollable document */}
      {groups.map(({ date, entries: dayEntries }) => {
        const parsedDate = parseISO(date);
        const isToday = date === new Date().toISOString().split("T")[0];

        return (
          <div key={date} className="relative">
            {/* Date heading */}
            <div className="flex items-center gap-3 mb-2 sticky top-0 bg-background py-1 z-10">
              <div className="h-px flex-1 bg-border" />
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                onClick={() => {
                  setPrefillDate(parsedDate);
                  setCheckInOpen(true);
                }}
                title="Add entry for this day"
              >
                {isToday ? "Today" : format(parsedDate, "EEEE, MMMM d, yyyy")}
              </button>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Entries for this date */}
            <div className="pl-0 divide-y divide-border/50">
              {dayEntries.map((entry) => (
                <HabitEntryCard
                  key={entry.id}
                  entry={entry}
                  habit={habit}
                  showDate={false}
                />
              ))}
            </div>
          </div>
        );
      })}

      <HabitCheckInDialog
        open={checkInOpen}
        onOpenChange={(open) => {
          setCheckInOpen(open);
          if (!open) setPrefillDate(undefined);
        }}
        habit={habit}
        prefillDate={prefillDate}
      />
    </div>
  );
}
