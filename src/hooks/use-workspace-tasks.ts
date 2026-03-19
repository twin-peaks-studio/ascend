"use client";

/**
 * Hook to fetch all tasks across a workspace (via projects with workspace_id).
 * Returns TaskWithProject[] enriched with entity data.
 */

import { useQuery } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { enrichTasksWithEntities } from "@/lib/utils/enrich-task-entities";
import type { TaskWithProject } from "@/types";

export const workspaceTaskKeys = {
  all: ["workspace-tasks"] as const,
  list: (workspaceId: string) => [...workspaceTaskKeys.all, workspaceId] as const,
};

async function fetchWorkspaceTasks(workspaceId: string): Promise<TaskWithProject[]> {
  const supabase = getClient();

  // Get all project IDs in this workspace
  const projectsResult = await withTimeout(
    supabase
      .from("projects")
      .select("id")
      .eq("workspace_id", workspaceId),
    TIMEOUTS.DATA_QUERY,
    "Fetching workspace projects timed out"
  );

  if (projectsResult.error) {
    logger.error("Error fetching workspace projects for tasks", {
      workspaceId,
      error: projectsResult.error,
    });
    throw projectsResult.error;
  }

  const projectIds = projectsResult.data?.map((p: { id: string }) => p.id) || [];

  if (projectIds.length === 0) return [];

  const tasksResult = await withTimeout(
    supabase
      .from("tasks")
      .select(`
        *,
        project:projects(*),
        assignee:profiles(*)
      `)
      .in("project_id", projectIds)
      .eq("is_archived", false)
      .order("position", { ascending: true }),
    TIMEOUTS.DATA_QUERY,
    "Fetching workspace tasks timed out"
  );

  if (tasksResult.error) {
    logger.error("Error fetching workspace tasks", {
      workspaceId,
      error: tasksResult.error,
    });
    throw tasksResult.error;
  }

  const tasks = (tasksResult.data as TaskWithProject[]) || [];
  await enrichTasksWithEntities(tasks);

  return tasks;
}

export function useWorkspaceTasks(workspaceId: string | null) {
  const {
    data: tasks = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: workspaceTaskKeys.list(workspaceId ?? ""),
    queryFn: () => fetchWorkspaceTasks(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    tasks,
    loading: isLoading,
    error: error as Error | null,
    refetch,
  };
}
