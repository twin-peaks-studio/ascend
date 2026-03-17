/**
 * Enrich tasks with product data derived from project → entity → entity_links.
 *
 * Chain: task.project.entity_id (initiative) → entity_links (initiative_product) → target entity (product)
 *
 * Makes a single query for all unique entity_ids, so call cost is O(1) regardless of task count.
 */

import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import type { TaskWithProject, TaskProduct } from "@/types";

interface EntityLinkRow {
  source_entity_id: string;
  target_entity: { id: string; name: string } | null;
}

/**
 * Fetches a map of initiative entity_id → product[] for the given entity IDs.
 */
export async function fetchProductMapForEntityIds(
  entityIds: string[]
): Promise<Map<string, TaskProduct[]>> {
  const productMap = new Map<string, TaskProduct[]>();
  if (entityIds.length === 0) return productMap;

  const supabase = getClient();

  const { data, error } = await withTimeout(
    supabase
      .from("entity_links")
      .select(
        "source_entity_id, target_entity:entities!entity_links_target_entity_id_fkey(id, name)"
      )
      .in("source_entity_id", entityIds)
      .eq("link_type", "initiative_product"),
    TIMEOUTS.DATA_QUERY,
    "Fetching product links timed out"
  );

  if (error) {
    // Graceful degradation: product badges are non-critical. If this fails,
    // tasks still load — just without product labels. Don't throw here
    // because this runs inside fetchTasksForUser and would break the entire task list.
    logger.error("Error fetching product links for tasks", { error });
    return productMap;
  }

  for (const row of (data as EntityLinkRow[]) || []) {
    if (!row.target_entity) continue;
    const existing = productMap.get(row.source_entity_id) || [];
    existing.push({ id: row.target_entity.id, name: row.target_entity.name });
    productMap.set(row.source_entity_id, existing);
  }

  return productMap;
}

/**
 * Enriches an array of TaskWithProject with `products` from entity links.
 * Mutates the tasks in-place and returns the same array.
 */
export async function enrichTasksWithProducts<T extends TaskWithProject>(
  tasks: T[]
): Promise<T[]> {
  // Collect unique entity_ids from task projects
  const entityIds = [
    ...new Set(
      tasks
        .map((t) => t.project?.entity_id)
        .filter((id): id is string => !!id)
    ),
  ];

  const productMap = await fetchProductMapForEntityIds(entityIds);

  for (const task of tasks) {
    const entityId = task.project?.entity_id;
    task.products = entityId ? productMap.get(entityId) ?? [] : [];
  }

  return tasks;
}
