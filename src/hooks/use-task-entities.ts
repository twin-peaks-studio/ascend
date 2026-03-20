"use client";

/**
 * Hook to fetch, add, and remove entity links for a single task
 * via the task_entities junction table.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { taskKeys } from "@/hooks/use-tasks";
import { toast } from "sonner";
import type { TaskEntity } from "@/types";
import type { EntityType } from "@/types/database";

export interface TaskEntityRow {
  id: string; // junction row ID
  entity_id: string;
  entity_type: string;
  entity: { id: string; name: string; entity_type: string } | null;
}

export const taskEntityKeys = {
  all: ["task-entities"] as const,
  list: (taskId: string) => [...taskEntityKeys.all, taskId] as const,
};

async function fetchTaskEntities(taskId: string): Promise<TaskEntityRow[]> {
  const supabase = getClient();

  const result = await withTimeout(
    supabase
      .from("task_entities")
      .select(`
        id,
        entity_id,
        entity_type,
        entity:entities(id, name, entity_type)
      `)
      .eq("task_id", taskId),
    TIMEOUTS.DATA_QUERY,
    "Fetching task entities timed out"
  );

  const { data, error } = result as { data: TaskEntityRow[] | null; error: { message: string } | null };

  if (error) {
    logger.error("Error fetching task entities", { taskId, error });
    throw error;
  }

  return (data || []) as TaskEntityRow[];
}

export function useTaskEntities(taskId: string | null) {
  const queryClient = useQueryClient();
  const [mutating, setMutating] = useState(false);

  const {
    data: rows = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: taskEntityKeys.list(taskId ?? ""),
    queryFn: () => fetchTaskEntities(taskId!),
    enabled: !!taskId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  // Derive clean entity list
  const entities: (TaskEntity & { junctionId: string })[] = rows
    .filter((r: TaskEntityRow) => r.entity !== null)
    .map((r: TaskEntityRow) => ({
      junctionId: r.id,
      id: r.entity!.id,
      name: r.entity!.name,
      entity_type: r.entity!.entity_type as TaskEntity["entity_type"],
    }));

  const addEntity = useCallback(
    async (entityId: string, entityType: EntityType) => {
      if (!taskId) return;
      setMutating(true);
      try {
        const supabase = getClient();
        const { error } = await supabase
          .from("task_entities")
          .insert({ task_id: taskId, entity_id: entityId, entity_type: entityType });

        if (error) throw error;

        // Refresh this hook's cache + task list caches (for entity pills on list views)
        queryClient.invalidateQueries({ queryKey: taskEntityKeys.list(taskId) });
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      } catch (err) {
        logger.error("Error adding entity to task", { taskId, entityId, error: err });
        toast.error("Failed to link entity");
      } finally {
        setMutating(false);
      }
    },
    [taskId, queryClient]
  );

  const removeEntity = useCallback(
    async (junctionId: string) => {
      if (!taskId) return;
      setMutating(true);
      try {
        const supabase = getClient();
        const { error } = await supabase
          .from("task_entities")
          .delete()
          .eq("id", junctionId);

        if (error) throw error;

        // Optimistic: remove from local cache immediately
        queryClient.setQueryData(
          taskEntityKeys.list(taskId),
          (old: TaskEntityRow[] | undefined) =>
            (old ?? []).filter((r) => r.id !== junctionId)
        );
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      } catch (err) {
        logger.error("Error removing entity from task", { taskId, junctionId, error: err });
        toast.error("Failed to unlink entity");
        // Refetch to restore correct state
        queryClient.invalidateQueries({ queryKey: taskEntityKeys.list(taskId) });
      } finally {
        setMutating(false);
      }
    },
    [taskId, queryClient]
  );

  return {
    entities,
    loading: isLoading,
    mutating,
    error: error as Error | null,
    addEntity,
    removeEntity,
  };
}
