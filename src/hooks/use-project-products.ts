"use client";

/**
 * Hook to fetch products linked to a project via its entity_id.
 *
 * Chain: project.entity_id (initiative) → entity_links (initiative_product) → product entity
 *
 * Returns a stable product array that can be spread onto TaskWithProject objects.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchProductMapForEntityIds } from "@/lib/utils/enrich-task-products";
import type { TaskProduct } from "@/types";

export const projectProductKeys = {
  all: ["project-products"] as const,
  list: (entityId: string) => [...projectProductKeys.all, entityId] as const,
};

async function fetchProjectProducts(entityId: string): Promise<TaskProduct[]> {
  const map = await fetchProductMapForEntityIds([entityId]);
  return map.get(entityId) ?? [];
}

/**
 * Returns the products linked to a project via its initiative entity.
 * Pass project.entity_id (may be null for non-migrated projects).
 */
export function useProjectProducts(entityId: string | null | undefined) {
  const { data: products = [] } = useQuery({
    queryKey: projectProductKeys.list(entityId ?? ""),
    queryFn: () => fetchProjectProducts(entityId!),
    enabled: !!entityId,
    staleTime: 5 * 60 * 1000, // products rarely change
    refetchOnWindowFocus: false,
  });

  return products;
}
