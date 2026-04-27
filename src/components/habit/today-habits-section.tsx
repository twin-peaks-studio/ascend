"use client";

import { useState } from "react";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HabitCheckInDialog } from "@/components/habit/habit-check-in-dialog";
import { HabitStreakBadge } from "@/components/habit/habit-streak-badge";
import { useHabits } from "@/hooks/use-habits";
import { useTodayHabitEntries } from "@/hooks/use-habit-entries";
import { computeHabitStats } from "@/hooks/use-habit-stats";
import { useAuth } from "@/hooks/use-auth";
import { useHabitEntries } from "@/hooks/use-habit-entries";
import { cn } from "@/lib/utils";
import type { Habit, HabitEntry } from "@/types";

function TodayHabitRow({
  habit,
  todayEntries,
  allEntries,
}: {
  habit: Habit;
  todayEntries: HabitEntry[];
  allEntries: HabitEntry[];
}) {
  const [checkInOpen, setCheckInOpen] = useState(false);
  const stats = computeHabitStats(habit, allEntries);
  const isCompletedToday = stats.isCompletedToday;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors",
          isCompletedToday && "opacity-70"
        )}
      >
        {/* Status indicator */}
        <button
          type="button"
          onClick={() => setCheckInOpen(true)}
          className="shrink-0 text-muted-foreground hover:text-green-500 transition-colors"
          aria-label={isCompletedToday ? "Already done" : "Check in"}
        >
          {isCompletedToday ? (
            <CheckCircle2 size={20} className="text-green-500" />
          ) : (
            <Circle size={20} />
          )}
        </button>

        {/* Icon + title */}
        <span className="text-base shrink-0">{habit.icon ?? "🎯"}</span>
        <div className="flex-1 min-w-0">
          <Link
            href={`/habits/${habit.id}`}
            className={cn(
              "text-sm font-medium hover:underline truncate block",
              isCompletedToday && "line-through text-muted-foreground"
            )}
          >
            {habit.title}
          </Link>
          <p className="text-xs text-muted-foreground">
            {stats.completedThisWeek}/{stats.targetThisWeek} this{" "}
            {habit.frequency_type === "monthly" ? "month" : "week"}
          </p>
        </div>

        {/* Streak + check-in */}
        <div className="flex items-center gap-2 shrink-0">
          <HabitStreakBadge streak={stats.currentStreak} />
          {!isCompletedToday && (
            <Button
              size="sm"
              variant="default"
              className="h-7 px-2.5 text-xs"
              onClick={() => setCheckInOpen(true)}
            >
              Check in
            </Button>
          )}
        </div>
      </div>

      <HabitCheckInDialog
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
        habit={habit}
      />
    </>
  );
}

function HabitEntriesLoader({
  habit,
  todayEntries,
}: {
  habit: Habit;
  todayEntries: HabitEntry[];
}) {
  const { entries } = useHabitEntries(habit.id);
  return <TodayHabitRow habit={habit} todayEntries={todayEntries} allEntries={entries} />;
}

export function TodayHabitsSection() {
  const { user } = useAuth();
  const { habits, loading: habitsLoading } = useHabits();
  const { entries: todayEntries, loading: entriesLoading } = useTodayHabitEntries(
    user?.id ?? null
  );

  const todayDow = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  const activeHabits = habits.filter((h) => {
    if (h.is_archived) return false;
    // For specific-day weekly habits, only show on required days
    if (h.frequency_type === "weekly" && h.frequency_days?.length) {
      return h.frequency_days.includes(todayDow);
    }
    return true;
  });

  if (habitsLoading || entriesLoading) return null;
  if (activeHabits.length === 0) return null;

  const completedToday = todayEntries
    ? activeHabits.filter((h) => todayEntries.some((e) => e.habit_id === h.id)).length
    : 0;

  const allDone = completedToday === activeHabits.length;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Habits
          </span>
          <span
            className={cn(
              "text-xs font-medium px-1.5 py-0.5 rounded-full",
              allDone
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            )}
          >
            {completedToday}/{activeHabits.length}
            {allDone && " 🎉"}
          </span>
        </div>
        <Link
          href="/habits"
          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          All habits
          <ChevronRight size={12} />
        </Link>
      </div>

      <div className="rounded-lg border bg-card">
        {activeHabits.map((habit) => (
          <HabitEntriesLoader
            key={habit.id}
            habit={habit}
            todayEntries={todayEntries}
          />
        ))}
      </div>
    </div>
  );
}
