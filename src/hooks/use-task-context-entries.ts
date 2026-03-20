"use client";

/**
 * Task Context Entries Hook
 *
 * CRUD for timestamped freeform knowledge entries scoped to a task.
 * Used for recording research notes, findings, decisions, and context.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";
import type { TaskContextEntry, TaskContextEntryInsert } from "@/types/database";
import { toast } from "sonner";

export const taskContextEntryKeys = {
  all: ["task-context-entries"] as const,
  list: (taskId: string) => [...taskContextEntryKeys.all, taskId] as const,
};

async function fetchTaskContextEntries(taskId: string): Promise<TaskContextEntry[]> {
  const supabase = getClient();

  const { data, error } = await withTimeout(
    supabase
      .from("task_context_entries")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false }),
    TIMEOUTS.DATA_QUERY,
    "Fetching task context entries timed out"
  );

  if (error) {
    logger.error("Error fetching task context entries", { taskId, error });
    return [];
  }

  return (data as TaskContextEntry[]) || [];
}

export function useTaskContextEntries(taskId: string | null) {
  const {
    data: entries = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: taskContextEntryKeys.list(taskId ?? ""),
    queryFn: () => fetchTaskContextEntries(taskId!),
    enabled: !!taskId,
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

export function useTaskContextEntryMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createEntry = useCallback(
    async (taskId: string, content: string): Promise<TaskContextEntry | null> => {
      if (!user) {
        toast.error("You must be logged in");
        return null;
      }
      if (!content.trim()) return null;

      try {
        setLoading(true);
        const supabase = getClient();

        const insertData: TaskContextEntryInsert = {
          task_id: taskId,
          content: content.trim(),
          created_by: user.id,
        };

        const { data, error } = await withTimeout(
          supabase.from("task_context_entries").insert(insertData).select().single(),
          TIMEOUTS.MUTATION
        );

        if (error) throw error;

        const entry = data as TaskContextEntry;

        // Optimistic cache update — prepend to list
        queryClient.setQueryData<TaskContextEntry[]>(
          taskContextEntryKeys.list(taskId),
          (old) => (old ? [entry, ...old] : [entry])
        );

        toast.success("Context entry added");
        return entry;
      } catch (err) {
        logger.error("Error creating task context entry", { taskId, error: err });
        toast.error("Failed to add context entry");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  const updateEntry = useCallback(
    async (entryId: string, taskId: string, content: string): Promise<boolean> => {
      if (!content.trim()) return false;

      try {
        setLoading(true);
        const supabase = getClient();

        const { error } = await withTimeout(
          supabase
            .from("task_context_entries")
            .update({ content: content.trim(), updated_at: new Date().toISOString() })
            .eq("id", entryId),
          TIMEOUTS.MUTATION
        );

        if (error) throw error;

        // Update cache in place
        queryClient.setQueryData<TaskContextEntry[]>(
          taskContextEntryKeys.list(taskId),
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
        logger.error("Error updating task context entry", { entryId, error: err });
        toast.error("Failed to update entry");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [queryClient]
  );

  const deleteEntry = useCallback(
    async (entryId: string, taskId: string): Promise<boolean> => {
      try {
        setLoading(true);
        const supabase = getClient();

        const { error } = await withTimeout(
          supabase.from("task_context_entries").delete().eq("id", entryId),
          TIMEOUTS.MUTATION
        );

        if (error) throw error;

        // Remove from cache
        queryClient.setQueryData<TaskContextEntry[]>(
          taskContextEntryKeys.list(taskId),
          (old) => old?.filter((e) => e.id !== entryId) ?? []
        );

        toast.success("Entry deleted");
        return true;
      } catch (err) {
        logger.error("Error deleting task context entry", { entryId, error: err });
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
