"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { logger } from "@/lib/logger/logger";
import { notificationKeys } from "@/hooks/use-notifications";

/**
 * Subscribe to real-time notification updates for the current user.
 *
 * When a new notification is inserted (e.g., someone @mentions this user),
 * this hook invalidates the React Query cache so the bell count updates.
 *
 * Supabase Realtime respects RLS — since the SELECT policy is
 * `user_id = auth.uid()`, only the recipient receives the event.
 */
export function useRealtimeNotifications(userId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const supabase = getClient();

    const channel = supabase
      .channel(`user:${userId}:notifications`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          logger.debug("Real-time notification received", {
            notificationId: payload.new?.id,
            userId,
          });

          // Invalidate both the list and unread count so they refetch
          queryClient.invalidateQueries({
            queryKey: notificationKeys.list(userId),
          });
          queryClient.invalidateQueries({
            queryKey: notificationKeys.unreadCount(userId),
          });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          logger.info("Subscribed to real-time notifications", { userId });
        } else if (status === "CHANNEL_ERROR") {
          logger.error("Failed to subscribe to real-time notifications", {
            userId,
          });
        }
      });

    return () => {
      logger.debug("Unsubscribing from real-time notifications", { userId });
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
