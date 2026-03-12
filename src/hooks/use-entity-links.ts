"use client";

/**
 * Entity Links Data Hooks
 *
 * Custom hooks for managing relationships between entities.
 * e.g., initiative ↔ product, stakeholder ↔ product
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { entityKeys } from "@/hooks/use-entities";
import type { EntityLink, EntityLinkInsert, EntityLinkType } from "@/types/database";
import { toast } from "sonner";

// Query keys
export const entityLinkKeys = {
  all: ["entity-links"] as const,
  list: (entityId: string) => [...entityLinkKeys.all, entityId] as const,
};

interface EntityLinkWithEntity extends EntityLink {
  source_entity?: { id: string; name: string; entity_type: string; slug: string };
  target_entity?: { id: string; name: string; entity_type: string; slug: string };
}

/**
 * Fetch all links for an entity (both as source and target)
 */
async function fetchEntityLinks(entityId: string): Promise<EntityLinkWithEntity[]> {
  const supabase = getClient();

  // Fetch links where entity is the source
  const sourceResult = await withTimeout(
    supabase
      .from("entity_links")
      .select("*, target_entity:entities!entity_links_target_entity_id_fkey(id, name, entity_type, slug)")
      .eq("source_entity_id", entityId),
    TIMEOUTS.DATA_QUERY,
    "Fetching entity links timed out"
  );

  // Fetch links where entity is the target
  const targetResult = await withTimeout(
    supabase
      .from("entity_links")
      .select("*, source_entity:entities!entity_links_source_entity_id_fkey(id, name, entity_type, slug)")
      .eq("target_entity_id", entityId),
    TIMEOUTS.DATA_QUERY,
    "Fetching entity links timed out"
  );

  if (sourceResult.error) {
    logger.error("Error fetching source entity links", { entityId, error: sourceResult.error });
  }
  if (targetResult.error) {
    logger.error("Error fetching target entity links", { entityId, error: targetResult.error });
  }

  const sourceLinks = (sourceResult.data as EntityLinkWithEntity[] | null) ?? [];
  const targetLinks = (targetResult.data as EntityLinkWithEntity[] | null) ?? [];

  return [...sourceLinks, ...targetLinks];
}

/**
 * Hook to fetch all links for an entity
 */
export function useEntityLinks(entityId: string | null) {
  const {
    data: links = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: entityLinkKeys.list(entityId ?? ""),
    queryFn: () => fetchEntityLinks(entityId!),
    enabled: !!entityId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    links,
    loading: isLoading,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook for entity link mutations (create, delete)
 */
export function useEntityLinkMutations() {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const createLink = useCallback(
    async (
      sourceEntityId: string,
      targetEntityId: string,
      linkType: EntityLinkType
    ): Promise<EntityLink | null> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const insertData: EntityLinkInsert = {
          source_entity_id: sourceEntityId,
          target_entity_id: targetEntityId,
          link_type: linkType,
        };

        const { data, error } = await withTimeout(
          supabase.from("entity_links").insert(insertData).select().single(),
          TIMEOUTS.MUTATION
        );

        if (error) {
          if (error.code === "23505") {
            // Duplicate link — silently succeed
            return null;
          }
          throw error;
        }

        // Invalidate both entities' link caches
        queryClient.invalidateQueries({ queryKey: entityLinkKeys.list(sourceEntityId) });
        queryClient.invalidateQueries({ queryKey: entityLinkKeys.list(targetEntityId) });
        // Also invalidate entity lists since link counts may change
        queryClient.invalidateQueries({ queryKey: entityKeys.lists() });

        return data as EntityLink;
      } catch (err) {
        logger.error("Error creating entity link", {
          sourceEntityId,
          targetEntityId,
          linkType,
          error: err,
        });
        toast.error("Failed to link entities");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  const deleteLink = useCallback(
    async (linkId: string, sourceEntityId: string, targetEntityId: string): Promise<boolean> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const { error } = await withTimeout(
          supabase.from("entity_links").delete().eq("id", linkId),
          TIMEOUTS.MUTATION
        );

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: entityLinkKeys.list(sourceEntityId) });
        queryClient.invalidateQueries({ queryKey: entityLinkKeys.list(targetEntityId) });
        queryClient.invalidateQueries({ queryKey: entityKeys.lists() });

        return true;
      } catch (err) {
        logger.error("Error deleting entity link", { linkId, error: err });
        toast.error("Failed to unlink entities");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  return {
    createLink,
    deleteLink,
    loading,
  };
}
