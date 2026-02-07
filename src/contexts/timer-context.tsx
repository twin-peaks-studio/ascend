"use client";

/**
 * Timer Context
 *
 * Provides global timer state across the app.
 * Handles the live elapsed time display and syncs with localStorage.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveTimer, timeEntryKeys, formatDuration } from "@/hooks/use-time-tracking";
import { useTimerRealtime } from "@/hooks/use-timer-realtime";
import { timerStorage, type ActiveTimerState } from "@/lib/timer-storage";
import { crossTabSync } from "@/lib/cross-tab-sync";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import type { TimeEntry, TimeTrackingEntityType } from "@/types/database";
import { toast } from "sonner";

interface TimerContextValue {
  /** The currently active timer entry (null if no timer running) */
  activeTimer: TimeEntry | null;
  /** Local storage state with entity name for display */
  activeTimerState: ActiveTimerState | null;
  /** Live elapsed time in seconds (updates every second) */
  elapsedSeconds: number;
  /** Formatted elapsed time string (e.g., "5:23" or "1:05:23") */
  formattedElapsedTime: string;
  /** Whether a timer is currently running */
  isTimerRunning: boolean;
  /** Whether initial data is still loading */
  loading: boolean;
  /** Whether a start/stop mutation is in progress */
  isMutating: boolean;
  /** Stop the currently running timer */
  stopTimer: () => Promise<void>;
  /** Start a new timer (will error if one is already running) */
  startTimer: (
    entityType: TimeTrackingEntityType,
    entityId: string,
    entityName: string
  ) => Promise<void>;
  /** Callback to open a task (set by app shell) */
  onOpenTask: (taskId: string) => void;
  /** Set the callback for opening tasks */
  setOnOpenTask: (callback: ((taskId: string) => void) | null) => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { activeTimer, loading } = useActiveTimer();

  // Subscribe to real-time timer updates (cross-tab & cross-device sync)
  useTimerRealtime();

  // Subscribe to same-browser cross-tab sync (faster than Realtime for local tabs)
  useEffect(() => {
    if (!user) return;

    return crossTabSync.subscribe(() => {
      // Another tab changed timer state, invalidate our cache
      queryClient.invalidateQueries({
        queryKey: timeEntryKeys.activeTimer(user.id),
      });
    });
  }, [user, queryClient]);

  // Local state for elapsed time (updates every second)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Local storage state for entity name
  const [localState, setLocalState] = useState<ActiveTimerState | null>(null);
  // Whether a start/stop mutation is in progress
  const [isMutating, setIsMutating] = useState(false);
  // Callback for opening a task from the timer indicator (use ref to avoid re-renders)
  const onOpenTaskRef = useRef<((taskId: string) => void) | null>(null);

  // Stable setter that won't trigger re-renders
  const setOnOpenTask = useCallback((callback: ((taskId: string) => void) | null) => {
    onOpenTaskRef.current = callback;
  }, []);

  // Stable wrapper that always calls current ref value
  const onOpenTask = useCallback((taskId: string) => {
    onOpenTaskRef.current?.(taskId);
  }, []);

  // Sync localStorage state on mount and when activeTimer changes
  useEffect(() => {
    const stored = timerStorage.get();
    setLocalState(stored);
  }, [activeTimer]);

  // Calculate initial elapsed time from active timer
  useEffect(() => {
    if (activeTimer?.start_time) {
      const startTime = new Date(activeTimer.start_time).getTime();
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - startTime) / 1000));
    } else {
      setElapsedSeconds(0);
    }
  }, [activeTimer?.start_time]);

  // Update elapsed time every second while timer is running
  useEffect(() => {
    if (!activeTimer?.start_time) return;

    const interval = setInterval(() => {
      const startTime = new Date(activeTimer.start_time).getTime();
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer?.start_time]);

  // Stop timer function
  const stopTimer = useCallback(async () => {
    if (!user || !activeTimer) return;

    setIsMutating(true);
    try {
      const supabase = getClient();
      const now = new Date().toISOString();
      const startTime = new Date(activeTimer.start_time).getTime();
      const duration = Math.floor((Date.now() - startTime) / 1000);

      const result = await withTimeout(
        supabase
          .from("time_entries")
          .update({
            end_time: now,
            duration,
            updated_at: now,
          })
          .eq("id", activeTimer.id)
          .select()
          .single(),
        TIMEOUTS.MUTATION
      );

      if (result.error) throw result.error;

      // Clear localStorage
      timerStorage.clear();
      setLocalState(null);

      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: timeEntryKeys.activeTimer(user.id),
      });
      queryClient.invalidateQueries({
        queryKey: timeEntryKeys.list(activeTimer.entity_type as TimeTrackingEntityType, activeTimer.entity_id),
      });

      // Broadcast to other tabs in same browser (instant sync)
      crossTabSync.broadcast();

      toast.success("Timer stopped");
    } catch (error) {
      logger.error("Failed to stop timer", {
        userId: user.id,
        activeTimerId: activeTimer.id,
        error
      });
      toast.error("Failed to stop timer");
    } finally {
      setIsMutating(false);
    }
  }, [user, activeTimer, queryClient]);

  // Start timer function
  const startTimer = useCallback(
    async (
      entityType: TimeTrackingEntityType,
      entityId: string,
      entityName: string
    ) => {
      if (!user) {
        toast.error("Must be logged in");
        return;
      }

      // Check for existing timer
      if (activeTimer) {
        toast.error("Another timer is already running. Stop it first.");
        return;
      }

      setIsMutating(true);
      try {
        const supabase = getClient();
        const now = new Date().toISOString();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

        const result = await withTimeout(
          supabase
            .from("time_entries")
            .insert({
              entity_type: entityType,
              entity_id: entityId,
              user_id: user.id,
              start_time: now,
              timezone,
            })
            .select()
            .single(),
          TIMEOUTS.MUTATION
        );

        if (result.error) throw result.error;

        const entry = result.data as TimeEntry;

        // Save to localStorage
        const state: ActiveTimerState = {
          entryId: entry.id,
          entityType,
          entityId,
          entityName,
          startTime: now,
        };
        timerStorage.set(state);
        setLocalState(state);

        // Invalidate queries
        queryClient.invalidateQueries({
          queryKey: timeEntryKeys.activeTimer(user.id),
        });
        queryClient.invalidateQueries({
          queryKey: timeEntryKeys.list(entityType, entityId),
        });

        // Broadcast to other tabs in same browser (instant sync)
        crossTabSync.broadcast();

        toast.success("Timer started");
      } catch (error) {
        const supabaseError = error as { message?: string; code?: string; details?: string };
        logger.error("Failed to start timer", {
          userId: user.id,
          entityType,
          entityId,
          error: {
            message: supabaseError.message,
            code: supabaseError.code,
            details: supabaseError.details,
          },
        });
        toast.error(supabaseError.message || "Failed to start timer");
      } finally {
        setIsMutating(false);
      }
    },
    [user, activeTimer, queryClient]
  );

  const value = useMemo<TimerContextValue>(
    () => ({
      activeTimer: activeTimer ?? null,
      activeTimerState: localState,
      elapsedSeconds,
      formattedElapsedTime: formatDuration(elapsedSeconds),
      isTimerRunning: !!activeTimer,
      loading,
      isMutating,
      stopTimer,
      startTimer,
      onOpenTask,
      setOnOpenTask,
    }),
    [activeTimer, localState, elapsedSeconds, loading, isMutating, stopTimer, startTimer, onOpenTask, setOnOpenTask]
  );

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}

export function useTimerContext() {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimerContext must be used within a TimerProvider");
  }
  return context;
}
