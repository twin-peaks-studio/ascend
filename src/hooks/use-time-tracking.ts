"use client";

/**
 * Time Tracking Hooks
 *
 * Custom hooks for managing time entries (start/stop timer, CRUD operations).
 * Uses React Query for caching and automatic refetching.
 */

import { useQuery, useMutation, useQueryClient } from "@tantml/react-query";
import { useMemo, useCallback } from "react";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";
import { timerStorage } from "@/lib/timer-storage";
import type {
  TimeEntry,
  TimeEntryInsert,
  TimeEntryUpdate,
  TimeTrackingEntityType,
} from "@/types/database";
import { toast } from "sonner";

// Query keys for cache management
export const timeEntryKeys = {
  all: ["time-entries"] as const,
  lists: () => [...timeEntryKeys.all, "list"] as const,
  list: (entityType: TimeTrackingEntityType, entityId: string) =>
    [...timeEntryKeys.lists(), entityType, entityId] as const,
  activeTimer: (userId: string) =>
    [...timeEntryKeys.all, "active", userId] as const,
  totalTime: (entityType: TimeTrackingEntityType, entityId: string) =>
    [...timeEntryKeys.all, "total", entityType, entityId] as const,
};

/**
 * Get the user's current timezone
 */
function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Calculate duration in seconds between two dates
 */
function calculateDuration(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return Math.floor((end - start) / 1000);
}

/**
 * Format seconds into a human-readable duration (HH:MM:SS or MM:SS)
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Fetch time entries for a specific entity
 */
async function fetchTimeEntries(
  entityType: TimeTrackingEntityType,
  entityId: string
): Promise<TimeEntry[]> {
  const supabase = getClient();

  const result = await withTimeout(
    supabase
      .from("time_entries")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("start_time", { ascending: false }),
    TIMEOUTS.DATA_QUERY,
    "Fetching time entries timed out"
  );

  if (result.error) throw result.error;
  return result.data as TimeEntry[];
}

/**
 * Fetch the user's active timer (entry with null end_time)
 */
async function fetchActiveTimer(userId: string): Promise<TimeEntry | null> {
  const supabase = getClient();

  const result = await withTimeout(
    supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", userId)
      .is("end_time", null)
      .maybeSingle(),  // Use maybeSingle() instead of single() to handle 0 rows gracefully
    TIMEOUTS.DATA_QUERY,
    "Fetching active timer timed out"
  );

  if (result.error) throw result.error;
  return result.data as TimeEntry | null;
}

/**
 * Hook to get the user's currently active timer
 * Used by the global timer indicator
 */
export function useActiveTimer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: activeTimer,
    isLoading,
    error,
  } = useQuery({
    queryKey: timeEntryKeys.activeTimer(user?.id ?? ""),
    queryFn: () => fetchActiveTimer(user!.id),
    enabled: !!user,
    staleTime: 5 * 1000, // Refresh every 5s to stay in sync
    refetchOnWindowFocus: true,
  });

  // Sync with localStorage on data change
  useMemo(() => {
    if (!activeTimer) {
      // Check if localStorage has stale data
      const stored = timerStorage.get();
      if (stored) {
        // Verify the stored timer still exists in DB
        // If not, clear localStorage
        timerStorage.clear();
      }
    }
  }, [activeTimer]);

  return {
    activeTimer: activeTimer ?? null,
    loading: isLoading,
    error: error as Error | null,
    invalidate: () =>
      queryClient.invalidateQueries({
        queryKey: timeEntryKeys.activeTimer(user?.id ?? ""),
      }),
  };
}

/**
 * Hook for time tracking on a specific entity (task, note, or project)
 */
export function useTimeTracking(
  entityType: TimeTrackingEntityType,
  entityId: string
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch time entries for this entity
  const {
    data: entries = [],
    isLoading: entriesLoading,
    error: entriesError,
  } = useQuery({
    queryKey: timeEntryKeys.list(entityType, entityId),
    queryFn: () => fetchTimeEntries(entityType, entityId),
    enabled: !!user && !!entityId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  // Fetch active timer
  const { activeTimer, loading: activeTimerLoading } = useActiveTimer();

  // Check if this entity has the active timer
  const isTimerRunning =
    activeTimer?.entity_type === entityType &&
    activeTimer?.entity_id === entityId;

  // Calculate total time for this entity (completed entries only)
  const totalTime = useMemo(() => {
    return entries
      .filter((e) => e.duration !== null)
      .reduce((sum, e) => sum + (e.duration || 0), 0);
  }, [entries]);

  // Start timer mutation
  const startTimerMutation = useMutation({
    mutationFn: async (entityName: string) => {
      if (!user) throw new Error("Must be logged in");

      // Check if another timer is already running
      if (activeTimer) {
        throw new Error("TIMER_ALREADY_RUNNING");
      }

      const supabase = getClient();
      const now = new Date().toISOString();

      const insertData: TimeEntryInsert = {
        entity_type: entityType,
        entity_id: entityId,
        user_id: user.id,
        start_time: now,
        timezone: getUserTimezone(),
      };

      const result = await withTimeout(
        supabase.from("time_entries").insert(insertData).select().single(),
        TIMEOUTS.MUTATION
      );

      if (result.error) throw result.error;

      const entry = result.data as TimeEntry;

      // Save to localStorage for persistence
      timerStorage.set({
        entryId: entry.id,
        entityType,
        entityId,
        entityName,
        startTime: now,
      });

      return entry;
    },
    onSuccess: () => {
      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: timeEntryKeys.activeTimer(user?.id ?? ""),
      });
      queryClient.invalidateQueries({
        queryKey: timeEntryKeys.list(entityType, entityId),
      });
      toast.success("Timer started");
    },
    onError: (error: Error) => {
      if (error.message === "TIMER_ALREADY_RUNNING") {
        toast.error("Another timer is already running. Stop it first.");
      } else {
        toast.error("Failed to start timer");
        logger.error("Start timer error", {
          userId: user?.id,
          entityType,
          entityId,
          error
        });
      }
    },
  });

  // Stop timer mutation
  const stopTimerMutation = useMutation({
    mutationFn: async () => {
      if (!user || !activeTimer) throw new Error("No active timer");

      const supabase = getClient();
      const now = new Date().toISOString();
      const duration = calculateDuration(activeTimer.start_time, now);

      const updateData: TimeEntryUpdate = {
        end_time: now,
        duration,
        updated_at: now,
      };

      const result = await withTimeout(
        supabase
          .from("time_entries")
          .update(updateData)
          .eq("id", activeTimer.id)
          .select()
          .single(),
        TIMEOUTS.MUTATION
      );

      if (result.error) throw result.error;

      // Clear localStorage
      timerStorage.clear();

      return result.data as TimeEntry;
    },
    onSuccess: () => {
      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: timeEntryKeys.activeTimer(user?.id ?? ""),
      });
      queryClient.invalidateQueries({
        queryKey: timeEntryKeys.list(entityType, entityId),
      });
      toast.success("Timer stopped");
    },
    onError: (error: Error) => {
      toast.error("Failed to stop timer");
      logger.error("Stop timer error", {
        userId: user?.id,
        entityType,
        entityId,
        activeTimerId: activeTimer?.id,
        error
      });
    },
  });

  // Update entry mutation
  const updateEntryMutation = useMutation({
    mutationFn: async ({
      entryId,
      data,
    }: {
      entryId: string;
      data: Partial<Pick<TimeEntry, "start_time" | "end_time" | "description">>;
    }) => {
      const supabase = getClient();

      // Recalculate duration if times changed
      let duration: number | undefined;
      if (data.start_time || data.end_time) {
        const entry = entries.find((e) => e.id === entryId);
        if (entry) {
          const startTime = data.start_time || entry.start_time;
          const endTime = data.end_time || entry.end_time;
          if (startTime && endTime) {
            duration = calculateDuration(startTime, endTime);
            if (duration < 0) {
              throw new Error("End time must be after start time");
            }
          }
        }
      }

      const updateData: TimeEntryUpdate = {
        ...data,
        ...(duration !== undefined ? { duration } : {}),
        updated_at: new Date().toISOString(),
      };

      const result = await withTimeout(
        supabase
          .from("time_entries")
          .update(updateData)
          .eq("id", entryId)
          .select()
          .single(),
        TIMEOUTS.MUTATION
      );

      if (result.error) throw result.error;
      return result.data as TimeEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: timeEntryKeys.list(entityType, entityId),
      });
      toast.success("Time entry updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update time entry");
      logger.error("Update entry error", {
        entityType,
        entityId,
        error
      });
    },
  });

  // Delete entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const supabase = getClient();

      const result = await withTimeout(
        supabase.from("time_entries").delete().eq("id", entryId),
        TIMEOUTS.MUTATION
      );

      if (result.error) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: timeEntryKeys.list(entityType, entityId),
      });
      toast.success("Time entry deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete time entry");
      logger.error("Delete entry error", {
        entityType,
        entityId,
        error
      });
    },
  });

  return {
    // Data
    entries,
    activeTimer,
    isTimerRunning,
    totalTime,
    formattedTotalTime: formatDuration(totalTime),

    // Loading states
    loading: entriesLoading || activeTimerLoading,
    error: entriesError as Error | null,

    // Actions
    startTimer: (entityName: string) => startTimerMutation.mutateAsync(entityName),
    stopTimer: () => stopTimerMutation.mutateAsync(),
    updateEntry: (entryId: string, data: Parameters<typeof updateEntryMutation.mutateAsync>[0]["data"]) =>
      updateEntryMutation.mutateAsync({ entryId, data }),
    deleteEntry: (entryId: string) => deleteEntryMutation.mutateAsync(entryId),

    // Mutation loading states
    isStarting: startTimerMutation.isPending,
    isStopping: stopTimerMutation.isPending,
    isUpdating: updateEntryMutation.isPending,
    isDeleting: deleteEntryMutation.isPending,
  };
}

/**
 * Hook to get total time across all tasks in a project
 */
export function useProjectTotalTime(projectId: string) {
  const { user } = useAuth();

  const { data: totalSeconds = 0, isLoading } = useQuery({
    queryKey: ["project-total-time", projectId],
    queryFn: async () => {
      const supabase = getClient();

      // Get all task IDs for this project
      const tasksResult = await supabase
        .from("tasks")
        .select("id")
        .eq("project_id", projectId);

      if (tasksResult.error) throw tasksResult.error;
      const taskIds = tasksResult.data?.map((t) => t.id) || [];

      if (taskIds.length === 0) return 0;

      // Sum all completed time entries for these tasks
      const entriesResult = await supabase
        .from("time_entries")
        .select("duration")
        .eq("entity_type", "task")
        .in("entity_id", taskIds)
        .not("duration", "is", null);

      if (entriesResult.error) throw entriesResult.error;

      return (entriesResult.data || []).reduce(
        (sum, e) => sum + (e.duration || 0),
        0
      );
    },
    enabled: !!user && !!projectId,
    staleTime: 60 * 1000, // Cache for 1 minute
  });

  return {
    totalSeconds,
    formattedTime: formatDuration(totalSeconds),
    loading: isLoading,
  };
}
