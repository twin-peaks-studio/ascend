"use client";

/**
 * Hook that provides a callback to link entities to a newly created task.
 * Used by task creation flows (TaskDialog, QuickAddTask) to associate
 * selected entities after the task is created.
 */

import { useRef, useCallback } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { logger } from "@/lib/logger/logger";
import type { Task } from "@/types";

interface EntityToLink {
  id: string;
  type: string;
}

/**
 * Returns:
 * - `trackCreatedTask`: call with the Task returned from createTask()
 * - `linkEntities`: pass as `onEntitiesSelected` to TaskDialog/QuickAddTask
 */
export function useLinkEntitiesToTask() {
  const lastCreatedTaskRef = useRef<Task | null>(null);

  const trackCreatedTask = useCallback((task: Task | null) => {
    lastCreatedTaskRef.current = task;
  }, []);

  const linkEntities = useCallback(async (entities: EntityToLink[]) => {
    const task = lastCreatedTaskRef.current;
    if (!task || entities.length === 0) return;

    try {
      const supabase = getClient();
      const rows = entities.map((e) => ({
        task_id: task.id,
        entity_id: e.id,
        entity_type: e.type as "product" | "initiative" | "stakeholder",
      }));
      const { error } = await supabase.from("task_entities").insert(rows);
      if (error) throw error;
    } catch (err) {
      logger.error("Failed to link entities to new task", { taskId: task.id, error: err });
    } finally {
      lastCreatedTaskRef.current = null;
    }
  }, []);

  return { trackCreatedTask, linkEntities };
}
