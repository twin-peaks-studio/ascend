"use client";

import { useMemo } from "react";
import { isToday, isPast, startOfDay } from "date-fns";
import { useTasks } from "@/hooks/use-tasks";
import type { TaskWithProject } from "@/types";

export interface TodayTaskGroup {
  projectId: string | null;
  projectName: string;
  projectColor: string | null;
  tasks: TaskWithProject[];
}

/**
 * Returns tasks that are due today or overdue (not done), grouped by project.
 * Overdue tasks appear first within each group.
 */
export function useTodayTasks() {
  const { tasks, loading, error } = useTasks();

  const todayTasks = useMemo(() => {
    const today = startOfDay(new Date());

    return tasks.filter((task) => {
      if (!task.due_date) return false;
      if (task.status === "done") return false;
      const due = new Date(task.due_date);
      return isToday(due) || (isPast(due) && due < today);
    });
  }, [tasks]);

  const groups = useMemo((): TodayTaskGroup[] => {
    const projectMap = new Map<string | null, TodayTaskGroup>();

    for (const task of todayTasks) {
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

    // Sort tasks within each group: overdue first, then by priority weight
    const priorityWeight: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    const today = startOfDay(new Date());
    for (const group of projectMap.values()) {
      group.tasks.sort((a, b) => {
        const aOverdue = a.due_date ? new Date(a.due_date) < today : false;
        const bOverdue = b.due_date ? new Date(b.due_date) < today : false;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        return (priorityWeight[a.priority] ?? 2) - (priorityWeight[b.priority] ?? 2);
      });
    }

    // Sort groups: named projects first (alphabetical), then "No Project"
    return Array.from(projectMap.values()).sort((a, b) => {
      if (a.projectId === null) return 1;
      if (b.projectId === null) return -1;
      return a.projectName.localeCompare(b.projectName);
    });
  }, [todayTasks]);

  const overdueCount = useMemo(() => {
    const today = startOfDay(new Date());
    return todayTasks.filter(
      (t) => t.due_date && new Date(t.due_date) < today
    ).length;
  }, [todayTasks]);

  return {
    groups,
    totalCount: todayTasks.length,
    overdueCount,
    loading,
    error,
  };
}
