"use client";

import { useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  startOfDay,
  isBefore,
  isToday,
  format,
  eachDayOfInterval,
} from "date-fns";
import { useTasks } from "@/hooks/use-tasks";
import type { TaskWithProject } from "@/types";

export interface WeekProjectGroup {
  projectId: string | null;
  projectName: string;
  projectColor: string | null;
  tasks: TaskWithProject[];
}

export interface WeekDayGroup {
  /** ISO date string "2026-03-23", or "overdue" for pre-week overdue tasks */
  dateKey: string;
  /** Display label e.g. "Monday, Mar 17" or "Overdue" */
  label: string;
  isOverdue: boolean;
  isToday: boolean;
  projectGroups: WeekProjectGroup[];
  totalCount: number;
}

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function buildProjectGroups(tasks: TaskWithProject[]): WeekProjectGroup[] {
  const map = new Map<string | null, WeekProjectGroup>();

  for (const task of tasks) {
    const key = task.project_id ?? null;
    if (!map.has(key)) {
      map.set(key, {
        projectId: key,
        projectName: task.project?.title ?? "No Project",
        projectColor: task.project?.color ?? null,
        tasks: [],
      });
    }
    map.get(key)!.tasks.push(task);
  }

  // Sort tasks within each project group by priority
  for (const group of map.values()) {
    group.tasks.sort(
      (a, b) => (PRIORITY_WEIGHT[a.priority] ?? 2) - (PRIORITY_WEIGHT[b.priority] ?? 2)
    );
  }

  // Named projects first (alphabetical), "No Project" last
  return Array.from(map.values()).sort((a, b) => {
    if (a.projectId === null) return 1;
    if (b.projectId === null) return -1;
    return a.projectName.localeCompare(b.projectName);
  });
}

/**
 * Returns tasks grouped first by day (overdue bucket + each day Mon–Sun),
 * then by project within each day. Days with no tasks are omitted.
 */
export function useWeekTasks() {
  const { tasks, loading, error } = useTasks();

  const dayGroups = useMemo((): WeekDayGroup[] => {
    const today = startOfDay(new Date());
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });     // Sunday

    // Bucket: tasks overdue before this week vs tasks within Mon–Sun
    const overdueTasks: TaskWithProject[] = [];
    const byDay = new Map<string, TaskWithProject[]>(); // key = "YYYY-MM-DD"

    for (const task of tasks) {
      if (!task.due_date || task.status === "done") continue;

      const due = startOfDay(new Date(task.due_date));

      if (isBefore(due, weekStart)) {
        // Before this week — overdue bucket
        overdueTasks.push(task);
      } else if (isWithinInterval(due, { start: weekStart, end: weekEnd })) {
        // Within this week — bucket by day
        const key = format(due, "yyyy-MM-dd");
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(task);
      }
    }

    const result: WeekDayGroup[] = [];

    // 1. Overdue bucket (sorted by priority within project groups)
    if (overdueTasks.length > 0) {
      const projectGroups = buildProjectGroups(overdueTasks);
      result.push({
        dateKey: "overdue",
        label: "Overdue",
        isOverdue: true,
        isToday: false,
        projectGroups,
        totalCount: overdueTasks.length,
      });
    }

    // 2. Each day of the week (Mon–Sun), skipping days with no tasks
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    for (const day of weekDays) {
      const key = format(day, "yyyy-MM-dd");
      const dayTasks = byDay.get(key);
      if (!dayTasks || dayTasks.length === 0) continue;

      const projectGroups = buildProjectGroups(dayTasks);
      result.push({
        dateKey: key,
        label: format(day, "EEEE, MMM d"),
        isOverdue: false,
        isToday: isToday(day),
        projectGroups,
        totalCount: dayTasks.length,
      });
    }

    return result;
  }, [tasks]);

  const totalCount = useMemo(
    () => dayGroups.reduce((sum, g) => sum + g.totalCount, 0),
    [dayGroups]
  );

  const overdueCount = useMemo(
    () => dayGroups.find((g) => g.isOverdue)?.totalCount ?? 0,
    [dayGroups]
  );

  return { dayGroups, totalCount, overdueCount, loading, error };
}
