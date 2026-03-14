"use client";

/**
 * Entity Context Entries (Journal) Hook
 *
 * CRUD for timestamped freeform knowledge entries scoped to an entity.
 * These feed into the AI memory refresh alongside foundational_context.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";
import type { EntityContextEntry, EntityContextEntryInsert } from "@/types/database";
import { toast } from "sonner";

export const contextEntryKeys = {
  all: ["entity-context-entries"] as const,
  list: (entityId: string) => [...contextEntryKeys.all, entityId] as const,
};

async function fetchContextEntries(entityId: string): Promise<EntityContextEntry[]> {
  const supabase = getClient();

  const { data, error } = await withTimeout(
    supabase
      .from("entity_context_entries")
      .select("*")
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false }),
    TIMEOUTS.DATA_QUERY,
    "Fetching context entries timed out"
  );

  if (error) {
    logger.error("Error fetching context entries", { entityId, error });
    return [];
  }

  return (data as EntityContextEntry[]) || [];
}

export function useEntityContextEntries(entityId: string | null) {
  const {
    data: entries = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: contextEntryKeys.list(entityId ?? ""),
    queryFn: () => fetchContextEntries(entityId!),
    enabled: !!entityId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    entries,
    loading: isLoading,
    error: error as Error | null,
    refetch,
  };
}

export function useEntityContextEntryMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createEntry = useCallback(
    async (entityId: string, content: string): Promise<EntityContextEntry | null> => {
      if (!user) {
        toast.error("You must be logged in");
        return null;
      }
      if (!content.trim()) return null;

      try {
        setLoading(true);
        const supabase = getClient();

        const insertData: EntityContextEntryInsert = {
          entity_id: entityId,
          content: content.trim(),
          created_by: user.id,
        };

        const { data, error } = await withTimeout(
          supabase.from("entity_context_entries").insert(insertData).select().single(),
          TIMEOUTS.MUTATION
        );

        if (error) throw error;

        const entry = data as EntityContextEntry;

        // Optimistic cache update — prepend to list
        queryClient.setQueryData<EntityContextEntry[]>(
          contextEntryKeys.list(entityId),
          (old) => (old ? [entry, ...old] : [entry])
        );

        toast.success("Context entry added");
        return entry;
      } catch (err) {
        logger.error("Error creating context entry", { entityId, error: err });
        toast.error("Failed to add context entry");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  const updateEntry = useCallback(
    async (entryId: string, entityId: string, content: string): Promise<boolean> => {
      if (!content.trim()) return false;

      try {
        setLoading(true);
        const supabase = getClient();

        const { error } = await withTimeout(
          supabase
            .from("entity_context_entries")
            .update({ content: content.trim(), updated_at: new Date().toISOString() })
            .eq("id", entryId),
          TIMEOUTS.MUTATION
        );

        if (error) throw error;

        // Update cache in place
        queryClient.setQueryData<EntityContextEntry[]>(
          contextEntryKeys.list(entityId),
          (old) =>
            old?.map((e) =>
              e.id === entryId
                ? { ...e, content: content.trim(), updated_at: new Date().toISOString() }
                : e
            ) ?? []
        );

        toast.success("Entry updated");
        return true;
      } catch (err) {
        logger.error("Error updating context entry", { entryId, error: err });
        toast.error("Failed to update entry");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  const deleteEntry = useCallback(
    async (entryId: string, entityId: string): Promise<boolean> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const { error } = await withTimeout(
          supabase.from("entity_context_entries").delete().eq("id", entryId),
          TIMEOUTS.MUTATION
        );

        if (error) throw error;

        // Remove from cache
        queryClient.setQueryData<EntityContextEntry[]>(
          contextEntryKeys.list(entityId),
          (old) => old?.filter((e) => e.id !== entryId) ?? []
        );

        toast.success("Entry deleted");
        return true;
      } catch (err) {
        logger.error("Error deleting context entry", { entryId, error: err });
        toast.error("Failed to delete entry");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  return { createEntry, updateEntry, deleteEntry, loading };
}
