"use client";

/**
 * Single Task Hook
 *
 * Hook for fetching a single task by ID.
 * Uses React Query for caching and automatic refetching.
 * Permissions are handled by Supabase RLS policies.
 */

import { useQuery } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import type { TaskWithProject } from "@/types";

// Query keys for cache management
export const singleTaskKeys = {
  all: ["task"] as const,
  detail: (id: string) => [...singleTaskKeys.all, id] as const,
};

/**
 * Fetch a single task by ID with related data
 */
async function fetchTask(taskId: string): Promise<TaskWithProject | null> {
  const supabase = getClient();

  const result = await withTimeout(
    supabase
      .from("tasks")
      .select(
        `
        *,
        project:projects(*),
        assignee:profiles(*)
      `
      )
      .eq("id", taskId)
      .single(),
    TIMEOUTS.DATA_QUERY,
    "Fetching task timed out"
  );

  if (result.error) {
    // 404 or permission denied - both return null
    if (result.error.code === "PGRST116") {
      // Not found (no rows returned)
      logger.debug("Task not found or no access", { taskId });
      return null;
    }

    logger.error("Error fetching task", {
      taskId,
      error: result.error,
    });
    throw result.error;
  }

  return (result.data as TaskWithProject) || null;
}

/**
 * Hook to fetch a single task by ID
 *
 * @param taskId - Task ID to fetch, or null to disable query
 * @returns Task data, loading state, and error
 *
 * @example
 * const { task, isLoading, error } = useTask(taskId);
 */
export function useTask(taskId: string | null) {
  const {
    data: task = null,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: taskId ? singleTaskKeys.detail(taskId) : ["task", "null"],
    queryFn: () => (taskId ? fetchTask(taskId) : Promise.resolve(null)),
    enabled: !!taskId,
    staleTime: 30 * 1000, // Consider fresh for 30s
    refetchOnWindowFocus: true, // Refetch when returning from background
  });

  return {
    task,
    isLoading,
    error,
    refetch,
  };
}
