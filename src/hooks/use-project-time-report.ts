"use client";

/**
 * Project Time Report Hook
 *
 * Fetches and aggregates time tracking data for a project,
 * providing both day-grouped and task-sorted views.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { useAuth } from "@/hooks/use-auth";
import { formatDuration } from "@/hooks/use-time-tracking";
import type { TaskStatus } from "@/types";

// Types for the time report data
export interface TaskTimeData {
  taskId: string;
  taskTitle: string;
  taskStatus: TaskStatus;
  isArchived: boolean;
  totalSeconds: number;
}

export interface DayTaskData {
  taskId: string;
  taskTitle: string;
  seconds: number;
}

export interface DayTimeData {
  date: string; // YYYY-MM-DD
  totalSeconds: number;
  tasks: DayTaskData[];
}

export interface ProjectTimeReport {
  totalSeconds: number;
  tasksByTime: TaskTimeData[];
  byDay: DayTimeData[];
}

// Query keys for cache management
export const projectTimeReportKeys = {
  all: ["project-time-report"] as const,
  report: (projectId: string) => [...projectTimeReportKeys.all, projectId] as const,
};

/**
 * Parse a date string to YYYY-MM-DD format in the user's local timezone
 */
function toLocalDateString(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-CA"); // en-CA gives YYYY-MM-DD format
}

/**
 * Hook to get the full time report for a project
 */
export function useProjectTimeReport(projectId: string) {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: projectTimeReportKeys.report(projectId),
    queryFn: async (): Promise<ProjectTimeReport> => {
      const supabase = getClient();

      // Fetch all tasks for this project (including archived)
      const tasksResult = await supabase
        .from("tasks")
        .select("id, title, status, is_archived")
        .eq("project_id", projectId);

      if (tasksResult.error) throw tasksResult.error;
      const tasks = tasksResult.data || [];

      if (tasks.length === 0) {
        return { totalSeconds: 0, tasksByTime: [], byDay: [] };
      }

      const taskIds = tasks.map((t) => t.id);
      const taskMap = new Map(tasks.map((t) => [t.id, t]));

      // Fetch all completed time entries for these tasks
      const entriesResult = await supabase
        .from("time_entries")
        .select("entity_id, start_time, duration")
        .eq("entity_type", "task")
        .in("entity_id", taskIds)
        .not("duration", "is", null)
        .order("start_time", { ascending: false });

      if (entriesResult.error) throw entriesResult.error;
      const entries = entriesResult.data || [];

      // Aggregate by task
      const taskTimeMap = new Map<string, number>();
      for (const entry of entries) {
        const current = taskTimeMap.get(entry.entity_id) || 0;
        taskTimeMap.set(entry.entity_id, current + (entry.duration || 0));
      }

      // Build tasksByTime (sorted by time descending)
      const tasksByTime: TaskTimeData[] = Array.from(taskTimeMap.entries())
        .map(([taskId, totalSeconds]) => {
          const task = taskMap.get(taskId)!;
          return {
            taskId,
            taskTitle: task.title,
            taskStatus: task.status as TaskStatus,
            isArchived: task.is_archived,
            totalSeconds,
          };
        })
        .sort((a, b) => b.totalSeconds - a.totalSeconds);

      // Aggregate by day
      const dayMap = new Map<string, Map<string, number>>();
      for (const entry of entries) {
        const dateKey = toLocalDateString(entry.start_time);
        if (!dayMap.has(dateKey)) {
          dayMap.set(dateKey, new Map());
        }
        const dayTaskMap = dayMap.get(dateKey)!;
        const current = dayTaskMap.get(entry.entity_id) || 0;
        dayTaskMap.set(entry.entity_id, current + (entry.duration || 0));
      }

      // Build byDay (sorted by date descending)
      const byDay: DayTimeData[] = Array.from(dayMap.entries())
        .map(([date, taskTimeMap]) => {
          const tasks: DayTaskData[] = Array.from(taskTimeMap.entries())
            .map(([taskId, seconds]) => ({
              taskId,
              taskTitle: taskMap.get(taskId)?.title || "Unknown Task",
              seconds,
            }))
            .sort((a, b) => b.seconds - a.seconds);

          const totalSeconds = tasks.reduce((sum, t) => sum + t.seconds, 0);

          return { date, totalSeconds, tasks };
        })
        .sort((a, b) => b.date.localeCompare(a.date));

      // Calculate total
      const totalSeconds = entries.reduce((sum, e) => sum + (e.duration || 0), 0);

      return { totalSeconds, tasksByTime, byDay };
    },
    enabled: !!user && !!projectId,
    staleTime: 60 * 1000, // Cache for 1 minute
  });

  // Format total time for display
  const formattedTotalTime = useMemo(() => {
    if (!data) return "0:00";
    return formatDuration(data.totalSeconds);
  }, [data]);

  return {
    report: data ?? null,
    totalSeconds: data?.totalSeconds ?? 0,
    formattedTotalTime,
    loading: isLoading,
    error: error as Error | null,
  };
}
