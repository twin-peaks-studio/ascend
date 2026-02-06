"use client";

/**
 * Timer Realtime Synchronization Hook
 *
 * Subscribes to Supabase Realtime changes on the time_entries table.
 * When any client (browser tab, mobile app, etc.) modifies timer data,
 * this hook receives the update and invalidates the React Query cache.
 *
 * This enables cross-tab AND cross-device synchronization.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";
import { timeEntryKeys } from "@/hooks/use-time-tracking";
import type { TimeEntry, TimeTrackingEntityType } from "@/types/database";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

/**
 * Subscribe to real-time changes on time_entries table.
 * Automatically invalidates React Query cache when changes occur.
 */
export function useTimerRealtime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user) return;

    const supabase = getClient();

    // Create a unique channel for this user's timer updates
    const channel = supabase
      .channel(`timer-sync-${user.id}`)
      .on<TimeEntry>(
        "postgres_changes",
        {
          event: "*", // Listen for INSERT, UPDATE, DELETE
          schema: "public",
          table: "time_entries",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<TimeEntry>) => {
          logger.info("Timer realtime change received", {
            eventType: payload.eventType,
            userId: user.id
          });

          // Invalidate active timer query - this will trigger a refetch
          queryClient.invalidateQueries({
            queryKey: timeEntryKeys.activeTimer(user.id),
          });

          // Also invalidate the specific entity's time entries list if available
          const record = payload.new as TimeEntry | null;
          const oldRecord = payload.old as Partial<TimeEntry> | null;

          const entityType = record?.entity_type || oldRecord?.entity_type;
          const entityId = record?.entity_id || oldRecord?.entity_id;

          if (entityType && entityId) {
            queryClient.invalidateQueries({
              queryKey: timeEntryKeys.list(
                entityType as TimeTrackingEntityType,
                entityId
              ),
            });
          }
        }
      )
      .subscribe((status) => {
        logger.info("Timer realtime subscription status", {
          status,
          userId: user.id
        });
      });

    channelRef.current = channel;

    // Cleanup: remove channel on unmount or user change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient, user]);
}
