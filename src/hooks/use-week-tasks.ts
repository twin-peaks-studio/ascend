"use client";

import { useMemo } from "react";
import { startOfWeek, endOfWeek, isWithinInterval, isPast, startOfDay } from "date-fns";
import { useTasks } from "@/hooks/use-tasks";
import type { TaskWithProject } from "@/types";

export interface WeekTaskGroup {
  projectId: string | null;
  projectName: string;
  projectColor: string | null;
  tasks: TaskWithProject[];
}

/**
 * Returns tasks due within the current Mon–Sun week (plus overdue tasks),
 * grouped by project and sorted by due date then priority.
 */
export function useWeekTasks() {
  const { tasks, loading, error } = useTasks();

  const weekTasks = useMemo(() => {
    const today = startOfDay(new Date());
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });     // Sunday

    return tasks.filter((task) => {
      if (!task.due_date) return false;
      if (task.status === "done") return false;
      const due = startOfDay(new Date(task.due_date));
      // Include overdue (past) OR due this week
      return isPast(due) || isWithinInterval(due, { start: weekStart, end: weekEnd });
    });
  }, [tasks]);

  const groups = useMemo((): WeekTaskGroup[] => {
    const projectMap = new Map<string | null, WeekTaskGroup>();

    for (const task of weekTasks) {
      const key = task.project_id ?? null;
      if (!projectMap.has(key)) {
        projectMap.set(key, {
          projectId: key,
          projectName: task.project?.title ?? "No Project",
          projectColor: task.project?.color ?? null,
          tasks: [],
        });
      }
      projectMap.get(key)!.tasks.push(task);
    }

    const priorityWeight: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    const today = startOfDay(new Date());
    for (const group of projectMap.values()) {
      group.tasks.sort((a, b) => {
        // Overdue first
        const aOverdue = a.due_date ? new Date(a.due_date) < today : false;
        const bOverdue = b.due_date ? new Date(b.due_date) < today : false;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        // Then by due date
        if (a.due_date && b.due_date) {
          const diff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          if (diff !== 0) return diff;
        }
        return (priorityWeight[a.priority] ?? 2) - (priorityWeight[b.priority] ?? 2);
      });
    }

    return Array.from(projectMap.values()).sort((a, b) => {
      if (a.projectId === null) return 1;
      if (b.projectId === null) return -1;
      return a.projectName.localeCompare(b.projectName);
    });
  }, [weekTasks]);

  const overdueCount = useMemo(() => {
    const today = startOfDay(new Date());
    return weekTasks.filter(
      (t) => t.due_date && startOfDay(new Date(t.due_date)) < today
    ).length;
  }, [weekTasks]);

  return {
    groups,
    totalCount: weekTasks.length,
    overdueCount,
    loading,
    error,
  };
}
