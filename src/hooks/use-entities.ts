"use client";

/**
 * Entity Data Hooks
 *
 * Custom hooks for fetching and mutating entity data.
 * Entities are products, initiatives, and stakeholders.
 * Uses React Query for request deduplication and caching.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";
import type { Entity, EntityType, EntityInsert, EntityUpdate } from "@/types/database";
import {
  createEntitySchema,
  updateEntitySchema,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/lib/validation";
import { toast } from "sonner";

// Query keys for cache management
export const entityKeys = {
  all: ["entities"] as const,
  lists: () => [...entityKeys.all, "list"] as const,
  list: (workspaceId: string, entityType?: EntityType) =>
    [...entityKeys.lists(), workspaceId, entityType ?? "all"] as const,
  details: () => [...entityKeys.all, "detail"] as const,
  detail: (id: string) => [...entityKeys.details(), id] as const,
};

/**
 * Generate a URL-safe slug from a name.
 * Used for @mention matching (e.g., "Online Ordering" → "online-ordering").
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Fetch entities for a workspace, optionally filtered by type
 */
async function fetchEntities(
  workspaceId: string,
  entityType?: EntityType
): Promise<Entity[]> {
  const supabase = getClient();

  let query = supabase
    .from("entities")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (entityType) {
    query = query.eq("entity_type", entityType);
  }

  const { data, error } = await withTimeout(
    query,
    TIMEOUTS.DATA_QUERY,
    "Fetching entities timed out"
  );

  if (error) {
    logger.error("Error fetching entities", { workspaceId, entityType, error });
    return [];
  }

  return (data as Entity[]) || [];
}

/**
 * Fetch a single entity by ID
 */
async function fetchEntity(entityId: string): Promise<Entity | null> {
  const supabase = getClient();

  const { data, error } = await withTimeout(
    supabase.from("entities").select("*").eq("id", entityId).single(),
    TIMEOUTS.DATA_QUERY,
    "Fetching entity timed out"
  );

  if (error) {
    logger.error("Error fetching entity", { entityId, error });
    return null;
  }

  return data as Entity;
}

/**
 * Hook to fetch all entities for a workspace
 */
export function useEntities(workspaceId: string | null, entityType?: EntityType) {
  const {
    data: entities = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: entityKeys.list(workspaceId ?? "", entityType),
    queryFn: () => fetchEntities(workspaceId!, entityType),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    entities,
    loading: isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook to fetch a single entity
 */
export function useEntity(entityId: string | null) {
  const {
    data: entity = null,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: entityKeys.detail(entityId ?? ""),
    queryFn: () => fetchEntity(entityId!),
    enabled: !!entityId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    entity,
    loading: isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook for entity mutations (create, update, delete)
 */
export function useEntityMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createEntity = useCallback(
    async (input: CreateEntityInput): Promise<Entity | null> => {
      if (!user) {
        toast.error("You must be logged in");
        return null;
      }

      try {
        setLoading(true);
        const supabase = getClient();
        const validated = createEntitySchema.parse(input);

        const slug = generateSlug(validated.name);
        if (!slug) {
          toast.error("Entity name must contain at least one letter or number");
          return null;
        }

        const insertData: EntityInsert = {
          workspace_id: validated.workspace_id,
          entity_type: validated.entity_type,
          name: validated.name,
          slug,
          description: validated.description ?? null,
          foundational_context: validated.foundational_context ?? null,
          created_by: user.id,
        };

        const { data, error } = await withTimeout(
          supabase.from("entities").insert(insertData).select().single(),
          TIMEOUTS.MUTATION
        );

        if (error) {
          if (error.code === "23505") {
            toast.error(`An entity with this name already exists in this workspace`);
            return null;
          }
          throw error;
        }

        const entity = data as Entity;

        // Invalidate list caches
        queryClient.invalidateQueries({ queryKey: entityKeys.lists() });

        toast.success(`${validated.entity_type} created`);
        return entity;
      } catch (err) {
        logger.error("Error creating entity", { input, error: err });
        toast.error("Failed to create entity");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  const updateEntity = useCallback(
    async (entityId: string, input: UpdateEntityInput): Promise<Entity | null> => {
      try {
        setLoading(true);
        const supabase = getClient();
        const validated = updateEntitySchema.parse(input);

        const updateData: EntityUpdate = {
          ...validated,
          updated_at: new Date().toISOString(),
        };

        // Regenerate slug if name changed
        if (validated.name) {
          updateData.slug = generateSlug(validated.name);
        }

        const { data, error } = await withTimeout(
          supabase
            .from("entities")
            .update(updateData)
            .eq("id", entityId)
            .select()
            .single(),
          TIMEOUTS.MUTATION
        );

        if (error) {
          if (error.code === "23505") {
            toast.error(`An entity with this name already exists in this workspace`);
            return null;
          }
          throw error;
        }

        const entity = data as Entity;

        // Update caches
        queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
        queryClient.setQueryData(entityKeys.detail(entityId), entity);

        toast.success("Entity updated");
        return entity;
      } catch (err) {
        logger.error("Error updating entity", { entityId, input, error: err });
        toast.error("Failed to update entity");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  const deleteEntity = useCallback(
    async (entityId: string): Promise<boolean> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const { error } = await withTimeout(
          supabase.from("entities").delete().eq("id", entityId),
          TIMEOUTS.MUTATION
        );

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
        queryClient.removeQueries({ queryKey: entityKeys.detail(entityId) });

        toast.success("Entity deleted");
        return true;
      } catch (err) {
        logger.error("Error deleting entity", { entityId, error: err });
        toast.error("Failed to delete entity");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  return {
    createEntity,
    updateEntity,
    deleteEntity,
    loading,
  };
}
