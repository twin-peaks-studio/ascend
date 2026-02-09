"use client";

/**
 * Notifications Data Hooks
 *
 * Hooks for fetching and mutating notification data.
 * Uses React Query for caching and deduplication.
 */

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { logger } from "@/lib/logger/logger";
import type { NotificationWithActor } from "@/types";

// Query keys for cache management
export const notificationKeys = {
  all: ["notifications"] as const,
  list: (userId: string) => [...notificationKeys.all, "list", userId] as const,
  unreadCount: (userId: string) =>
    [...notificationKeys.all, "unread-count", userId] as const,
};

/**
 * Fetch notifications for the current user
 */
async function fetchNotifications(
  userId: string
): Promise<NotificationWithActor[]> {
  const supabase = getClient();

  const { data, error } = await supabase
    .from("notifications")
    .select(
      `
      *,
      actor:profiles!notifications_actor_id_fkey(*)
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    logger.error("Error fetching notifications", { userId, error });
    throw new Error(error.message);
  }

  return data as NotificationWithActor[];
}

/**
 * Fetch unread notification count
 */
async function fetchUnreadCount(userId: string): Promise<number> {
  const supabase = getClient();

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) {
    logger.error("Error fetching unread count", { userId, error });
    throw new Error(error.message);
  }

  return count ?? 0;
}

/**
 * Hook to fetch notifications for the current user
 */
export function useNotifications(userId: string | null) {
  return useQuery({
    queryKey: userId
      ? notificationKeys.list(userId)
      : ["notifications", "list", "null"],
    queryFn: () => (userId ? fetchNotifications(userId) : Promise.resolve([])),
    enabled: !!userId,
    staleTime: 30000,
  });
}

/**
 * Hook to fetch unread notification count
 */
export function useUnreadNotificationCount(userId: string | null) {
  return useQuery({
    queryKey: userId
      ? notificationKeys.unreadCount(userId)
      : ["notifications", "unread-count", "null"],
    queryFn: () => (userId ? fetchUnreadCount(userId) : Promise.resolve(0)),
    enabled: !!userId,
    staleTime: 10000,
  });
}

/**
 * Hook for notification mutations (mark read, mark all read)
 */
export function useNotificationMutations(userId: string | null) {
  const queryClient = useQueryClient();
  const supabase = getClient();

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) {
        logger.error("Error marking notification as read", {
          notificationId,
          error,
        });
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({
          queryKey: notificationKeys.list(userId),
        });
        queryClient.invalidateQueries({
          queryKey: notificationKeys.unreadCount(userId),
        });
      }
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!userId) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);

      if (error) {
        logger.error("Error marking all notifications as read", {
          userId,
          error,
        });
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({
          queryKey: notificationKeys.list(userId),
        });
        queryClient.invalidateQueries({
          queryKey: notificationKeys.unreadCount(userId),
        });
      }
    },
  });

  return {
    markAsRead: markAsRead.mutateAsync,
    markAllAsRead: markAllAsRead.mutateAsync,
  };
}
