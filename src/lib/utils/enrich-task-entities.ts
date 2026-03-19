/**
 * Enrich tasks with entity data from the task_entities junction table.
 *
 * Single query for all task IDs — O(1) regardless of task count.
 * Replaces the old enrich-task-products.ts which derived entities indirectly
 * from project → entity_links (wrong granularity: every task in a project
 * got the same entity, regardless of what the task was actually about).
 */

import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import type { TaskWithProject, TaskEntity } from "@/types";

interface TaskEntityRow {
  task_id: string;
  entity: { id: string; name: string; entity_type: string } | null;
}

/**
 * Enriches an array of TaskWithProject with `entities` from task_entities.
 * Mutates the tasks in-place and returns the same array.
 */
export async function enrichTasksWithEntities<T extends TaskWithProject>(
  tasks: T[]
): Promise<T[]> {
  if (tasks.length === 0) return tasks;

  const taskIds = tasks.map((t) => t.id);
  const supabase = getClient();

  const result = await withTimeout(
    supabase
      .from("task_entities")
      .select("task_id, entity:entities(id, name, entity_type)")
      .in("task_id", taskIds),
    TIMEOUTS.DATA_QUERY,
    "Fetching task entities timed out"
  );

  const { data, error } = result as { data: TaskEntityRow[] | null; error: { message: string } | null };

  if (error) {
    // Graceful degradation: entity badges are non-critical
    logger.error("Error fetching task entities", { error });
    return tasks;
  }

  // Build Map<task_id, TaskEntity[]>
  const entityMap = new Map<string, TaskEntity[]>();
  for (const row of (data as TaskEntityRow[]) || []) {
    if (!row.entity) continue;
    const existing = entityMap.get(row.task_id) || [];
    existing.push({
      id: row.entity.id,
      name: row.entity.name,
      entity_type: row.entity.entity_type as TaskEntity["entity_type"],
    });
    entityMap.set(row.task_id, existing);
  }

  for (const task of tasks) {
    task.entities = entityMap.get(task.id) ?? [];
  }

  return tasks;
}
