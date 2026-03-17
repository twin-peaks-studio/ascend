"use client";

/**
 * Entity Mention Hooks
 *
 * Handles persisting and querying entity mentions from the entity_mentions table.
 * Mentions are created when content containing #entity mentions is saved.
 *
 * Key function: syncMentions() — diffs parsed mentions against existing DB records
 * and inserts/deletes as needed. Called from note, capture, and task save handlers.
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import type { EntityMention, MentionSourceType } from "@/types/database";

// Query keys
export const entityMentionKeys = {
  all: ["entity-mentions"] as const,
  byEntity: (entityId: string) =>
    [...entityMentionKeys.all, "entity", entityId] as const,
  bySource: (sourceType: MentionSourceType, sourceId: string) =>
    [...entityMentionKeys.all, "source", sourceType, sourceId] as const,
};

/**
 * Fetch all mentions for a specific entity (used on entity detail Mentions tab).
 * Returns mention records enriched with the source title from the notes table.
 */
export type MentionWithSource = EntityMention & { source_title?: string };

export function useEntityMentionsByEntity(entityId: string | null) {
  const {
    data: mentions = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: entityMentionKeys.byEntity(entityId ?? ""),
    queryFn: async (): Promise<MentionWithSource[]> => {
      const supabase = getClient();

      // Fetch mentions
      const { data, error } = await withTimeout(
        supabase
          .from("entity_mentions")
          .select("*")
          .eq("entity_id", entityId!)
          .order("created_at", { ascending: false }),
        TIMEOUTS.DATA_QUERY,
        "Fetching entity mentions timed out"
      );
      if (error) {
        logger.error("Error fetching entity mentions", { entityId, error });
        return [];
      }
      const mentionRows = (data as EntityMention[]) || [];
      if (mentionRows.length === 0) return [];

      // Fetch source titles from notes table (notes & captures share the same table)
      const sourceIds = [...new Set(mentionRows.map((m) => m.source_id))];
      const { data: sources } = await withTimeout(
        supabase
          .from("notes")
          .select("id, title")
          .in("id", sourceIds),
        TIMEOUTS.DATA_QUERY
      );
      const titleMap = new Map(
        (sources as Array<{ id: string; title: string }> || []).map((s) => [s.id, s.title])
      );

      return mentionRows.map((m) => ({
        ...m,
        source_title: titleMap.get(m.source_id),
      }));
    },
    enabled: !!entityId,
    staleTime: 60 * 1000,
  });

  return { mentions, loading: isLoading, error: error as Error | null, refetch };
}

/**
 * Hook that provides syncMentions() — call this after saving content that may
 * contain #entity mentions. It diffs the parsed entity IDs from HTML against
 * existing records and performs minimal inserts/deletes.
 *
 * Usage:
 *   const { syncMentions } = useMentionSync();
 *   // After saving note content:
 *   await syncMentions('note', noteId, workspaceId, parsedEntityIds);
 */
export function useMentionSync() {
  const queryClient = useQueryClient();

  const syncMentions = useCallback(
    async (
      sourceType: MentionSourceType,
      sourceId: string,
      workspaceId: string,
      entityIds: string[]
    ) => {
      try {
        const supabase = getClient();

        // 1. Fetch existing mentions for this source
        const { data: existing, error: fetchError } = await withTimeout(
          supabase
            .from("entity_mentions")
            .select("id, entity_id")
            .eq("source_type", sourceType)
            .eq("source_id", sourceId),
          TIMEOUTS.DATA_QUERY
        );

        if (fetchError) {
          logger.error("Error fetching existing mentions", {
            sourceType,
            sourceId,
            error: fetchError,
          });
          return;
        }

        const existingMentions = (existing as Array<{ id: string; entity_id: string }>) || [];
        const existingEntityIds = new Set(existingMentions.map((m) => m.entity_id));
        const newEntityIds = new Set(entityIds);

        // 2. Determine inserts and deletes
        const toInsert = entityIds.filter((id) => !existingEntityIds.has(id));
        const toDelete = existingMentions
          .filter((m) => !newEntityIds.has(m.entity_id))
          .map((m) => m.id);

        // 3. Perform inserts
        if (toInsert.length > 0) {
          const rows = toInsert.map((entityId) => ({
            entity_id: entityId,
            workspace_id: workspaceId,
            source_type: sourceType,
            source_id: sourceId,
          }));

          const { error: insertError } = await withTimeout(
            supabase.from("entity_mentions").insert(rows),
            TIMEOUTS.MUTATION
          );

          if (insertError) {
            logger.error("Error inserting entity mentions", {
              sourceType,
              sourceId,
              error: insertError,
            });
          }
        }

        // 4. Perform deletes
        if (toDelete.length > 0) {
          const { error: deleteError } = await withTimeout(
            supabase.from("entity_mentions").delete().in("id", toDelete),
            TIMEOUTS.MUTATION
          );

          if (deleteError) {
            logger.error("Error deleting entity mentions", {
              sourceType,
              sourceId,
              error: deleteError,
            });
          }
        }

        // 5. Invalidate relevant caches
        if (toInsert.length > 0 || toDelete.length > 0) {
          queryClient.invalidateQueries({
            queryKey: entityMentionKeys.bySource(sourceType, sourceId),
          });
          // Invalidate per-entity caches for affected entities
          const affectedEntityIds = new Set([...toInsert, ...toDelete.map(
            (deleteId) => existingMentions.find((m) => m.id === deleteId)?.entity_id
          ).filter(Boolean)]);
          affectedEntityIds.forEach((entityId) => {
            if (entityId) {
              queryClient.invalidateQueries({
                queryKey: entityMentionKeys.byEntity(entityId),
              });
            }
          });
        }
      } catch (err) {
        logger.error("Error syncing entity mentions", {
          sourceType,
          sourceId,
          error: err,
        });
      }
    },
    [queryClient]
  );

  return { syncMentions };
}
