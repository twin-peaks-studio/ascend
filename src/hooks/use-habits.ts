"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";
import type { Habit, HabitInsert, HabitUpdate } from "@/types";
import { toast } from "sonner";

export const habitKeys = {
  all: ["habits"] as const,
  lists: () => [...habitKeys.all, "list"] as const,
  list: (userId: string) => [...habitKeys.lists(), userId] as const,
  detail: (habitId: string) => [...habitKeys.all, "detail", habitId] as const,
  byWorkspace: (workspaceId: string) =>
    [...habitKeys.all, "workspace", workspaceId] as const,
};

async function fetchHabits(userId: string): Promise<Habit[]> {
  const supabase = getClient();
  const { data, error } = await withTimeout(
    supabase
      .from("habits")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    TIMEOUTS.DATA_QUERY,
    "Fetching habits timed out"
  );
  if (error) {
    logger.error("Error fetching habits", { userId, error });
    throw error;
  }
  return (data as Habit[]) || [];
}

async function fetchHabit(habitId: string): Promise<Habit | null> {
  const supabase = getClient();
  const { data, error } = await withTimeout(
    supabase.from("habits").select("*").eq("id", habitId).single(),
    TIMEOUTS.DATA_QUERY,
    "Fetching habit timed out"
  );
  if (error) {
    logger.error("Error fetching habit", { habitId, error });
    return null;
  }
  return data as Habit;
}

export function useHabits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: habits = [], isLoading, error, refetch } = useQuery({
    queryKey: habitKeys.list(user?.id ?? ""),
    queryFn: () => fetchHabits(user!.id),
    enabled: !!user,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const setHabits = useCallback(
    (updater: Habit[] | ((prev: Habit[]) => Habit[])) => {
      queryClient.setQueryData(
        habitKeys.list(user?.id ?? ""),
        typeof updater === "function" ? updater(habits) : updater
      );
    },
    [queryClient, user?.id, habits]
  );

  return { habits, loading: isLoading, error: error as Error | null, refetch, setHabits };
}

export function useHabit(habitId: string | null) {
  const { data: habit = null, isLoading, refetch } = useQuery({
    queryKey: habitKeys.detail(habitId ?? ""),
    queryFn: () => fetchHabit(habitId!),
    enabled: !!habitId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
  return { habit, loading: isLoading, refetch };
}

export function useWorkspaceHabits(workspaceId: string | null) {
  const { user } = useAuth();

  const { data: habits = [], isLoading } = useQuery({
    queryKey: habitKeys.byWorkspace(workspaceId ?? ""),
    queryFn: async () => {
      const supabase = getClient();
      const { data, error } = await withTimeout(
        supabase
          .from("habits")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .order("created_at", { ascending: false }),
        TIMEOUTS.DATA_QUERY,
        "Fetching workspace habits timed out"
      );
      if (error) {
        logger.error("Error fetching workspace habits", { workspaceId, error });
        return [];
      }
      return (data as Habit[]) || [];
    },
    enabled: !!workspaceId && !!user,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  return { habits, loading: isLoading };
}

export function useHabitMutations() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createHabit = useCallback(
    async (input: Omit<HabitInsert, "user_id" | "created_by">): Promise<Habit | null> => {
      if (!user) {
        toast.error("You must be logged in");
        return null;
      }
      try {
        setLoading(true);
        const supabase = getClient();
        const { data, error } = await withTimeout(
          supabase
            .from("habits")
            .insert({ ...input, user_id: user.id, created_by: user.id })
            .select()
            .single(),
          TIMEOUTS.MUTATION,
          "Creating habit timed out"
        );
        if (error) throw error;
        const newHabit = data as Habit;
        queryClient.invalidateQueries({ queryKey: habitKeys.lists() });
        if (input.workspace_id) {
          queryClient.invalidateQueries({
            queryKey: habitKeys.byWorkspace(input.workspace_id),
          });
        }
        toast.success("Habit created");
        return newHabit;
      } catch (err) {
        logger.error("Error creating habit", { error: err });
        toast.error("Failed to create habit");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  const updateHabit = useCallback(
    async (habitId: string, input: HabitUpdate): Promise<Habit | null> => {
      if (!user) return null;
      try {
        setLoading(true);
        const supabase = getClient();
        const { data, error } = await withTimeout(
          supabase
            .from("habits")
            .update({ ...input, updated_at: new Date().toISOString() })
            .eq("id", habitId)
            .select()
            .single(),
          TIMEOUTS.MUTATION,
          "Updating habit timed out"
        );
        if (error) throw error;
        const updated = data as Habit;
        queryClient.setQueriesData<Habit[]>(
          { queryKey: habitKeys.lists() },
          (old) => old?.map((h) => (h.id === habitId ? { ...h, ...input } : h)) ?? []
        );
        queryClient.setQueryData(habitKeys.detail(habitId), updated);
        return updated;
      } catch (err) {
        logger.error("Error updating habit", { habitId, error: err });
        toast.error("Failed to update habit");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  const archiveHabit = useCallback(
    async (habitId: string): Promise<boolean> => {
      if (!user) return false;
      try {
        setLoading(true);
        const now = new Date().toISOString();
        const supabase = getClient();
        const { error } = await withTimeout(
          supabase
            .from("habits")
            .update({ is_archived: true, archived_at: now, updated_at: now })
            .eq("id", habitId),
          TIMEOUTS.MUTATION,
          "Archiving habit timed out"
        );
        if (error) throw error;
        queryClient.setQueriesData<Habit[]>(
          { queryKey: habitKeys.lists() },
          (old) =>
            old?.map((h) =>
              h.id === habitId ? { ...h, is_archived: true, archived_at: now } : h
            ) ?? []
        );
        toast.success("Habit archived");
        return true;
      } catch (err) {
        logger.error("Error archiving habit", { habitId, error: err });
        toast.error("Failed to archive habit");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  const deleteHabit = useCallback(
    async (habitId: string): Promise<boolean> => {
      if (!user) return false;
      try {
        setLoading(true);
        const supabase = getClient();
        const { error } = await withTimeout(
          supabase.from("habits").delete().eq("id", habitId),
          TIMEOUTS.MUTATION,
          "Deleting habit timed out"
        );
        if (error) throw error;
        queryClient.setQueriesData<Habit[]>(
          { queryKey: habitKeys.lists() },
          (old) => old?.filter((h) => h.id !== habitId) ?? []
        );
        queryClient.removeQueries({ queryKey: habitKeys.detail(habitId) });
        toast.success("Habit deleted");
        return true;
      } catch (err) {
        logger.error("Error deleting habit", { habitId, error: err });
        toast.error("Failed to delete habit");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient]
  );

  return { createHabit, updateHabit, archiveHabit, deleteHabit, loading };
}
