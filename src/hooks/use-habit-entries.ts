"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";
import type { HabitEntry, HabitEntryInsert, HabitEntryUpdate } from "@/types";
import { habitKeys } from "@/hooks/use-habits";
import { toast } from "sonner";

export const habitEntryKeys = {
  all: ["habit-entries"] as const,
  lists: () => [...habitEntryKeys.all, "list"] as const,
  list: (habitId: string) => [...habitEntryKeys.lists(), habitId] as const,
  range: (habitId: string, from: string, to: string) =>
    [...habitEntryKeys.list(habitId), from, to] as const,
  today: (userId: string) => [...habitEntryKeys.all, "today", userId] as const,
};

async function fetchHabitEntries(
  habitId: string,
  from?: string,
  to?: string
): Promise<HabitEntry[]> {
  const supabase = getClient();
  let query = supabase
    .from("habit_entries")
    .select("*")
    .eq("habit_id", habitId)
    .order("entry_date", { ascending: false })
    .order("checked_in_at", { ascending: false });

  if (from) query = query.gte("entry_date", from);
  if (to) query = query.lte("entry_date", to);

  const { data, error } = await withTimeout(
    query,
    TIMEOUTS.DATA_QUERY,
    "Fetching habit entries timed out"
  );
  if (error) {
    logger.error("Error fetching habit entries", { habitId, error });
    throw error;
  }
  return (data as HabitEntry[]) || [];
}

export function useHabitEntries(habitId: string | null, options?: { from?: string; to?: string }) {
  const queryKey = options?.from
    ? habitEntryKeys.range(habitId ?? "", options.from, options.to ?? "")
    : habitEntryKeys.list(habitId ?? "");

  const { data: entries = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchHabitEntries(habitId!, options?.from, options?.to),
    enabled: !!habitId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  return { entries, loading: isLoading, refetch };
}

export function useTodayHabitEntries(userId: string | null) {
  const today = new Date().toISOString().split("T")[0];

  const { data: entries = [], isLoading } = useQuery({
    queryKey: habitEntryKeys.today(userId ?? ""),
    queryFn: async () => {
      const supabase = getClient();
      const { data, error } = await withTimeout(
        supabase
          .from("habit_entries")
          .select("*")
          .eq("user_id", userId!)
          .eq("entry_date", today),
        TIMEOUTS.DATA_QUERY,
        "Fetching today habit entries timed out"
      );
      if (error) {
        logger.error("Error fetching today habit entries", { userId, error });
        return [];
      }
      return (data as HabitEntry[]) || [];
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  return { entries, loading: isLoading };
}

export function useHabitEntryMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const invalidateAfterMutation = useCallback(
    (habitId: string, entryDate: string) => {
      queryClient.invalidateQueries({ queryKey: habitEntryKeys.list(habitId) });
      queryClient.invalidateQueries({ queryKey: habitEntryKeys.today(user?.id ?? "") });
      queryClient.invalidateQueries({ queryKey: habitKeys.detail(habitId) });
    },
    [queryClient, user?.id]
  );

  const createEntry = useCallback(
    async (
      input: Omit<HabitEntryInsert, "user_id"> & { habit_id: string }
    ): Promise<HabitEntry | null> => {
      if (!user) {
        toast.error("You must be logged in");
        return null;
      }
      try {
        setLoading(true);
        const supabase = getClient();
        const { data, error } = await withTimeout(
          supabase
            .from("habit_entries")
            .insert({ ...input, user_id: user.id })
            .select()
            .single(),
          TIMEOUTS.MUTATION,
          "Creating habit entry timed out"
        );
        if (error) throw error;
        const newEntry = data as HabitEntry;
        invalidateAfterMutation(input.habit_id, input.entry_date);
        return newEntry;
      } catch (err) {
        logger.error("Error creating habit entry", { error: err });
        toast.error("Failed to save check-in");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, invalidateAfterMutation]
  );

  const updateEntry = useCallback(
    async (
      entryId: string,
      habitId: string,
      input: HabitEntryUpdate
    ): Promise<HabitEntry | null> => {
      if (!user) return null;
      try {
        setLoading(true);
        const supabase = getClient();
        const { data, error } = await withTimeout(
          supabase
            .from("habit_entries")
            .update({ ...input, updated_at: new Date().toISOString() })
            .eq("id", entryId)
            .select()
            .single(),
          TIMEOUTS.MUTATION,
          "Updating habit entry timed out"
        );
        if (error) throw error;
        const updated = data as HabitEntry;
        queryClient.setQueriesData<HabitEntry[]>(
          { queryKey: habitEntryKeys.list(habitId) },
          (old) => old?.map((e) => (e.id === entryId ? { ...e, ...input } : e)) ?? []
        );
        return updated;
      } catch (err) {
        logger.error("Error updating habit entry", { entryId, error: err });
        toast.error("Failed to update entry");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  const deleteEntry = useCallback(
    async (entryId: string, habitId: string, entryDate: string): Promise<boolean> => {
      if (!user) return false;
      try {
        setLoading(true);
        const supabase = getClient();
        const { error } = await withTimeout(
          supabase.from("habit_entries").delete().eq("id", entryId),
          TIMEOUTS.MUTATION,
          "Deleting habit entry timed out"
        );
        if (error) throw error;
        queryClient.setQueriesData<HabitEntry[]>(
          { queryKey: habitEntryKeys.list(habitId) },
          (old) => old?.filter((e) => e.id !== entryId) ?? []
        );
        invalidateAfterMutation(habitId, entryDate);
        toast.success("Entry deleted");
        return true;
      } catch (err) {
        logger.error("Error deleting habit entry", { entryId, error: err });
        toast.error("Failed to delete entry");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient, invalidateAfterMutation]
  );

  return { createEntry, updateEntry, deleteEntry, loading };
}
