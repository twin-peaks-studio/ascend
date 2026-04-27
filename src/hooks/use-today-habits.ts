"use client";

import { useMemo } from "react";
import { useHabits } from "@/hooks/use-habits";
import { useTodayHabitEntries } from "@/hooks/use-habit-entries";
import { useAuth } from "@/hooks/use-auth";
import { computeHabitStats } from "@/hooks/use-habit-stats";
import { useHabitEntries } from "@/hooks/use-habit-entries";
import type { Habit, HabitEntry, HabitStats } from "@/types";

export interface TodayHabit {
  habit: Habit;
  isCompletedToday: boolean;
  completedThisWeek: number;
  targetThisWeek: number;
  currentStreak: number;
  todayEntries: HabitEntry[];
}

// Enriches a single habit with today's entries and week stats
function enrichHabit(
  habit: Habit,
  allEntries: HabitEntry[],
  todayEntries: HabitEntry[]
): TodayHabit {
  const stats = computeHabitStats(habit, allEntries);
  const todayStr = new Date().toISOString().split("T")[0];
  const habitTodayEntries = todayEntries.filter((e) => e.habit_id === habit.id);

  return {
    habit,
    isCompletedToday: stats.isCompletedToday,
    completedThisWeek: stats.completedThisWeek,
    targetThisWeek: stats.targetThisWeek,
    currentStreak: stats.currentStreak,
    todayEntries: habitTodayEntries,
  };
}

/**
 * Hook for the Today page habits section.
 * Returns active habits enriched with today's completion status.
 * Uses a 90-day entry window for stats without over-fetching.
 */
export function useTodayHabits() {
  const { user } = useAuth();
  const { habits, loading: habitsLoading } = useHabits();
  const { entries: todayEntries, loading: todayLoading } = useTodayHabitEntries(
    user?.id ?? null
  );

  const activeHabits = useMemo(
    () => habits.filter((h) => !h.is_archived),
    [habits]
  );

  return {
    habits: activeHabits,
    todayEntries,
    loading: habitsLoading || todayLoading,
    enrichHabit,
  };
}
