"use client";

/**
 * Hook to fetch tasks linked to an entity via task_entities junction table.
 * Returns TaskWithProject[] enriched with project + assignee data.
 */

import { useQuery } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { enrichTasksWithEntities } from "@/lib/utils/enrich-task-entities";
import type { TaskWithProject } from "@/types";

export const entityTaskKeys = {
  all: ["entity-tasks"] as const,
  list: (entityId: string) => [...entityTaskKeys.all, entityId] as const,
};

interface TaskEntityJoinRow {
  task_id: string;
  task: TaskWithProject | null;
}

async function fetchEntityTasks(entityId: string): Promise<TaskWithProject[]> {
  const supabase = getClient();

  const result = await withTimeout(
    supabase
      .from("task_entities")
      .select(`
        task_id,
        task:tasks(*, project:projects(*), assignee:profiles(*))
      `)
      .eq("entity_id", entityId),
    TIMEOUTS.DATA_QUERY,
    "Fetching entity tasks timed out"
  );

  if (result.error) {
    logger.error("Error fetching entity tasks", { entityId, error: result.error });
    throw result.error;
  }

  const rows = (result.data || []) as unknown as TaskEntityJoinRow[];
  const tasks = rows
    .map((r) => r.task)
    .filter((t): t is TaskWithProject => t !== null && !t.is_archived);

  // Enrich with all entity associations (a task may link to multiple entities)
  await enrichTasksWithEntities(tasks);

  return tasks;
}

export function useEntityTasks(entityId: string | null) {
  const {
    data: tasks = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: entityTaskKeys.list(entityId ?? ""),
    queryFn: () => fetchEntityTasks(entityId!),
    enabled: !!entityId,
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
