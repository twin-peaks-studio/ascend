"use client";

import { useMemo } from "react";
import type { Habit, HabitEntry, HabitStats, CalendarDay } from "@/types";

// ISO week: Monday = start, Sunday = end
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Returns all calendar dates from start to end inclusive (YYYY-MM-DD strings). */
function dateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endStr = toDateString(end);
  while (toDateString(cur) <= endStr) {
    dates.push(toDateString(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/**
 * A "completed day" is a date that has at least one entry AND meets the time goal
 * (if one is set). We aggregate all entries for the same date.
 */
function buildCompletedDates(
  entries: HabitEntry[],
  timeGoalMinutes: number | null
): Map<string, { totalDuration: number; count: number }> {
  const map = new Map<string, { totalDuration: number; count: number }>();
  for (const e of entries) {
    const existing = map.get(e.entry_date) ?? { totalDuration: 0, count: 0 };
    map.set(e.entry_date, {
      totalDuration: existing.totalDuration + (e.duration_minutes ?? 0),
      count: existing.count + 1,
    });
  }
  return map;
}

function isDayCompleted(
  dateData: { totalDuration: number; count: number } | undefined,
  timeGoalMinutes: number | null
): boolean {
  if (!dateData) return false;
  if (timeGoalMinutes == null || timeGoalMinutes === 0) return true;
  return dateData.totalDuration >= timeGoalMinutes;
}

function computeCurrentStreakDaily(
  completedDates: Map<string, { totalDuration: number; count: number }>,
  timeGoalMinutes: number | null,
  today: string
): number {
  let streak = 0;
  let check = new Date(today);
  // Allow streak to continue if today is not yet done — start from yesterday
  if (!isDayCompleted(completedDates.get(today), timeGoalMinutes)) {
    check = addDays(check, -1);
  }
  while (true) {
    const dateStr = toDateString(check);
    if (!isDayCompleted(completedDates.get(dateStr), timeGoalMinutes)) break;
    streak++;
    check = addDays(check, -1);
  }
  return streak;
}

function computeLongestStreakDaily(
  completedDates: Map<string, { totalDuration: number; count: number }>,
  timeGoalMinutes: number | null,
  startDate: string,
  today: string
): number {
  let longest = 0;
  let current = 0;
  const dates = dateRange(new Date(startDate), new Date(today));
  for (const d of dates) {
    if (isDayCompleted(completedDates.get(d), timeGoalMinutes)) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

/** Parse a YYYY-MM-DD string to a local Date without UTC offset shifting. */
function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Returns JS getDay() (0=Sun … 6=Sat) for a YYYY-MM-DD string, timezone-safe. */
function getDayOfWeek(dateStr: string): number {
  return parseDateStr(dateStr).getDay();
}

function computeCurrentStreakSpecificDays(
  completedDates: Map<string, { totalDuration: number; count: number }>,
  timeGoalMinutes: number | null,
  frequencyDays: number[],
  today: string
): number {
  let streak = 0;
  let check = new Date(today);
  const startMs = check.getTime();

  while (check.getTime() >= startMs - 365 * 2 * 86400000) {
    const dateStr = toDateString(check);
    const dow = check.getDay();

    if (frequencyDays.includes(dow)) {
      if (dateStr === today) {
        // today in-progress: count if done, don't break if not
        if (isDayCompleted(completedDates.get(dateStr), timeGoalMinutes)) streak++;
      } else {
        if (!isDayCompleted(completedDates.get(dateStr), timeGoalMinutes)) break;
        streak++;
      }
    }
    // non-required day: skip without breaking

    check = addDays(check, -1);
  }

  return streak;
}

function computeLongestStreakSpecificDays(
  completedDates: Map<string, { totalDuration: number; count: number }>,
  timeGoalMinutes: number | null,
  frequencyDays: number[],
  startDate: string,
  today: string
): number {
  let longest = 0;
  let current = 0;
  for (const d of dateRange(parseDateStr(startDate), parseDateStr(today))) {
    if (!frequencyDays.includes(getDayOfWeek(d))) continue;
    if (isDayCompleted(completedDates.get(d), timeGoalMinutes)) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function computeStreakWeekly(
  completedDates: Map<string, { totalDuration: number; count: number }>,
  timeGoalMinutes: number | null,
  frequencyCount: number,
  startDate: string,
  today: Date
): { current: number; longest: number } {
  // Build list of ISO weeks from startDate to today
  const start = getWeekStart(new Date(startDate));
  const todayWeekStart = getWeekStart(today);

  const weeks: Date[] = [];
  const cur = new Date(start);
  while (cur <= todayWeekStart) {
    weeks.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }

  const weekCompletions = weeks.map((weekStart) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const days = dateRange(weekStart, weekEnd);
    const completedCount = days.filter((d) =>
      isDayCompleted(completedDates.get(d), timeGoalMinutes)
    ).length;
    return completedCount;
  });

  // Current streak: count back from last complete week
  // In-progress week doesn't break streak
  let currentStreak = 0;
  const lastCompleteWeekIdx = weeks.length - 2; // exclude current in-progress week
  if (lastCompleteWeekIdx >= 0) {
    for (let i = lastCompleteWeekIdx; i >= 0; i--) {
      if (weekCompletions[i] >= frequencyCount) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  let longestStreak = 0;
  let runningStreak = 0;
  for (let i = 0; i <= lastCompleteWeekIdx; i++) {
    if (weekCompletions[i] >= frequencyCount) {
      runningStreak++;
      longestStreak = Math.max(longestStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
  }

  return { current: currentStreak, longest: longestStreak };
}

function buildCalendarData(
  completedDates: Map<string, { totalDuration: number; count: number }>,
  timeGoalMinutes: number | null,
  startDate: string,
  today: string,
  frequencyDays: number[] | null = null, // null = all days required
  daysBack = 91 // ~3 months
): CalendarDay[] {
  const todayDate = new Date(today);
  const fromDate = addDays(todayDate, -daysBack);
  const effectiveFrom =
    fromDate.toISOString().split("T")[0] > startDate
      ? toDateString(fromDate)
      : startDate;

  const allDates = dateRange(new Date(effectiveFrom), todayDate);
  const futureEnd = addDays(todayDate, 6);
  const futureDates = dateRange(addDays(todayDate, 1), futureEnd);

  const result: CalendarDay[] = [];

  for (const d of [...allDates, ...futureDates]) {
    const data = completedDates.get(d);
    const isRequired = frequencyDays === null || frequencyDays.includes(getDayOfWeek(d));
    let status: CalendarDay["status"];
    if (d > today) {
      status = "future";
    } else if (d === today) {
      status = isDayCompleted(data, timeGoalMinutes) ? "completed" : "today";
    } else if (isDayCompleted(data, timeGoalMinutes)) {
      status = "completed"; // show bonus check-ins on non-required days too
    } else if (data && data.count > 0) {
      status = "partial";
    } else if (!isRequired) {
      status = "future"; // non-required, no entry → show empty (reuse future style)
    } else {
      status = "missed";
    }

    result.push({
      date: d,
      status,
      durationMinutes: data?.totalDuration ?? 0,
      entryCount: data?.count ?? 0,
    });
  }

  return result;
}

export function computeHabitStats(habit: Habit, entries: HabitEntry[]): HabitStats {
  const today = new Date();
  const todayStr = toDateString(today);
  const weekStart = getWeekStart(today);
  const monthStart = getMonthStart(today);

  const completedDates = buildCompletedDates(entries, habit.time_goal_minutes);

  // Count completions for periods
  const weekDates = dateRange(weekStart, today);
  const last30Start = addDays(today, -29);
  const last30Dates = dateRange(last30Start, today);

  const completedThisWeek = weekDates.filter((d) =>
    isDayCompleted(completedDates.get(d), habit.time_goal_minutes)
  ).length;

  const completedThisMonth = dateRange(monthStart, today).filter((d) =>
    isDayCompleted(completedDates.get(d), habit.time_goal_minutes)
  ).length;

  const completedTotal = Array.from(completedDates.entries()).filter(([, data]) =>
    isDayCompleted(data, habit.time_goal_minutes)
  ).length;

  const completedLast30 = last30Dates.filter((d) =>
    isDayCompleted(completedDates.get(d), habit.time_goal_minutes)
  ).length;

  // Weekly target: for specific-day habits, count only required days elapsed this week
  const targetThisWeek = (() => {
    if (habit.frequency_type === "daily") return weekDates.length;
    if (habit.frequency_type === "weekly" && habit.frequency_days?.length) {
      return weekDates.filter((d) => habit.frequency_days!.includes(getDayOfWeek(d))).length;
    }
    return habit.frequency_count;
  })();

  const targetThisMonth =
    habit.frequency_type === "daily"
      ? dateRange(monthStart, today).length
      : habit.frequency_type === "monthly"
      ? habit.frequency_count
      : Math.ceil((habit.frequency_count / 7) * 30); // weekly → estimated monthly

  // Streaks
  let currentStreak: number;
  let longestStreak: number;

  if (habit.frequency_type === "daily") {
    currentStreak = computeCurrentStreakDaily(completedDates, habit.time_goal_minutes, todayStr);
    longestStreak = computeLongestStreakDaily(completedDates, habit.time_goal_minutes, habit.start_date, todayStr);
  } else if (habit.frequency_type === "weekly" && habit.frequency_days?.length) {
    currentStreak = computeCurrentStreakSpecificDays(completedDates, habit.time_goal_minutes, habit.frequency_days, todayStr);
    longestStreak = computeLongestStreakSpecificDays(completedDates, habit.time_goal_minutes, habit.frequency_days, habit.start_date, todayStr);
  } else {
    const { current, longest } = computeStreakWeekly(completedDates, habit.time_goal_minutes, habit.frequency_count, habit.start_date, today);
    currentStreak = current;
    longestStreak = longest;
  }

  const lastCheckedIn =
    entries.length > 0
      ? entries.reduce((latest, e) =>
          e.checked_in_at > latest.checked_in_at ? e : latest
        ).checked_in_at
      : null;

  return {
    currentStreak,
    longestStreak,
    completedThisWeek,
    completedThisMonth,
    completedTotal,
    targetThisWeek,
    targetThisMonth,
    completionRateThisWeek: targetThisWeek > 0 ? completedThisWeek / targetThisWeek : 0,
    completionRateLast30Days: 30 > 0 ? completedLast30 / 30 : 0,
    lastCheckedIn,
    isCompletedToday: isDayCompleted(completedDates.get(todayStr), habit.time_goal_minutes),
    calendarData: buildCalendarData(
      completedDates,
      habit.time_goal_minutes,
      habit.start_date,
      todayStr,
      habit.frequency_type === "weekly" ? (habit.frequency_days ?? null) : null
    ),
  };
}

export function useHabitStats(habit: Habit | null, entries: HabitEntry[]): HabitStats | null {
  return useMemo(() => {
    if (!habit) return null;
    return computeHabitStats(habit, entries);
  }, [habit, entries]);
}
