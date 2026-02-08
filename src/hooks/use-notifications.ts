"use client";

/**
 * Notification Hooks
 *
 * Custom hooks for managing user notifications.
 * Handles mentions, task assignments, and activity updates.
 * Uses React Query for automatic request deduplication and caching.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { withTimeout, TIMEOUTS } from "@/lib/utils/with-timeout";
import { logger } from "@/lib/logger/logger";
import { useAuth } from "@/hooks/use-auth";

// Notification type from database
export interface Notification {
  id: string;
  user_id: string;
  type: "mention" | "comment" | "task_assigned" | "task_completed" | "project_update";
  entity_type: "task" | "project" | "comment" | "note";
  entity_id: string;
  actor_id: string | null;
  message: string;
  read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface CreateNotificationInput {
  user_id: string;
  type: Notification["type"];
  entity_type: Notification["entity_type"];
  entity_id: string;
  actor_id?: string | null;
  message: string;
}

// Query keys for cache management
export const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  list: (userId: string) => [...notificationKeys.lists(), userId] as const,
  unreadCount: (userId: string) => [...notificationKeys.all, "unread-count", userId] as const,
};

/**
 * Fetch all notifications for a user
 */
async function fetchNotifications(userId: string): Promise<Notification[]> {
  const supabase = getClient();

  const result = await withTimeout(
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50), // Limit to most recent 50
    TIMEOUTS.DATA_QUERY,
    "Fetching notifications timed out"
  );

  if (result.error) {
    logger.error("Error fetching notifications", {
      userId,
      error: result.error,
    });
    throw result.error;
  }

  return (result.data as Notification[]) || [];
}

/**
 * Fetch unread notification count
 */
async function fetchUnreadCount(userId: string): Promise<number> {
  const supabase = getClient();

  const result = await withTimeout(
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false),
    TIMEOUTS.DATA_QUERY,
    "Fetching unread count timed out"
  );

  if (result.error) {
    logger.error("Error fetching unread count", {
      userId,
      error: result.error,
    });
    throw result.error;
  }

  return result.count || 0;
}

/**
 * Hook to fetch notifications for the current user
 */
export function useNotifications() {
  const { user } = useAuth();

  const {
    data: notifications = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: notificationKeys.list(user?.id ?? ""),
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
    staleTime: 30 * 1000, // Cache for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to app
  });

  return {
    notifications,
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
  };
}

/**
 * Hook to get unread notification count
 * Useful for the notification bell badge
 */
export function useUnreadCount() {
  const { user } = useAuth();

  const {
    data: unreadCount = 0,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: notificationKeys.unreadCount(user?.id ?? ""),
    queryFn: () => fetchUnreadCount(user!.id),
    enabled: !!user,
    staleTime: 10 * 1000, // Cache for 10 seconds
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    unreadCount,
    loading: isLoading,
    refetch,
  };
}

/**
 * Hook to create a notification
 * Used when triggering notifications for @mentions, task assignments, etc.
 */
export function useCreateNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateNotificationInput) => {
      const supabase = getClient();

      const result = await withTimeout(
        supabase
          .from("notifications")
          .insert({
            user_id: input.user_id,
            type: input.type,
            entity_type: input.entity_type,
            entity_id: input.entity_id,
            actor_id: input.actor_id || null,
            message: input.message,
            read: false,
          })
          .select()
          .single(),
        TIMEOUTS.MUTATION,
        "Creating notification timed out"
      );

      if (result.error) {
        logger.error("Error creating notification", {
          input,
          error: result.error,
        });
        throw result.error;
      }

      return result.data as Notification;
    },
    onSuccess: (notification) => {
      // Invalidate notifications list for the recipient
      queryClient.invalidateQueries({
        queryKey: notificationKeys.list(notification.user_id),
      });

      // Invalidate unread count
      queryClient.invalidateQueries({
        queryKey: notificationKeys.unreadCount(notification.user_id),
      });
    },
  });
}

/**
 * Hook to mark a notification as read
 */
export function useMarkNotificationAsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const supabase = getClient();

      const result = await withTimeout(
        supabase
          .from("notifications")
          .update({
            read: true,
            read_at: new Date().toISOString(),
          })
          .eq("id", notificationId)
          .eq("user_id", user!.id) // Ensure user owns this notification
          .select()
          .single(),
        TIMEOUTS.MUTATION,
        "Marking notification as read timed out"
      );

      if (result.error) {
        logger.error("Error marking notification as read", {
          notificationId,
          userId: user?.id,
          error: result.error,
        });
        throw result.error;
      }

      return result.data as Notification;
    },
    onMutate: async (notificationId) => {
      if (!user) return;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: notificationKeys.list(user.id),
      });

      // Snapshot previous value
      const previousNotifications = queryClient.getQueryData<Notification[]>(
        notificationKeys.list(user.id)
      );

      // Optimistically update
      queryClient.setQueryData<Notification[]>(
        notificationKeys.list(user.id),
        (old) =>
          old?.map((n) =>
            n.id === notificationId
              ? { ...n, read: true, read_at: new Date().toISOString() }
              : n
          ) || []
      );

      // Optimistically update unread count
      queryClient.setQueryData<number>(
        notificationKeys.unreadCount(user.id),
        (old) => Math.max(0, (old || 0) - 1)
      );

      return { previousNotifications };
    },
    onError: (err, notificationId, context) => {
      // Rollback on error
      if (user && context?.previousNotifications) {
        queryClient.setQueryData(
          notificationKeys.list(user.id),
          context.previousNotifications
        );
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      if (user) {
        queryClient.invalidateQueries({
          queryKey: notificationKeys.list(user.id),
        });
        queryClient.invalidateQueries({
          queryKey: notificationKeys.unreadCount(user.id),
        });
      }
    },
  });
}

/**
 * Hook to mark all notifications as read
 */
export function useMarkAllNotificationsAsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const supabase = getClient();

      const result = await withTimeout(
        supabase
          .from("notifications")
          .update({
            read: true,
            read_at: new Date().toISOString(),
          })
          .eq("user_id", user!.id)
          .eq("read", false),
        TIMEOUTS.MUTATION,
        "Marking all notifications as read timed out"
      );

      if (result.error) {
        logger.error("Error marking all notifications as read", {
          userId: user?.id,
          error: result.error,
        });
        throw result.error;
      }

      return result.data;
    },
    onSuccess: () => {
      if (!user) return;

      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: notificationKeys.list(user.id),
      });
      queryClient.invalidateQueries({
        queryKey: notificationKeys.unreadCount(user.id),
      });
    },
  });
}

/**
 * Utility function to create notification message based on type
 */
export function createNotificationMessage(
  type: Notification["type"],
  actorName: string | null,
  entityName: string
): string {
  const actor = actorName || "Someone";

  switch (type) {
    case "mention":
      return `${actor} mentioned you in a comment`;
    case "comment":
      return `${actor} commented on ${entityName}`;
    case "task_assigned":
      return `${actor} assigned you to ${entityName}`;
    case "task_completed":
      return `${actor} completed ${entityName}`;
    case "project_update":
      return `${actor} updated ${entityName}`;
    default:
      return `${actor} performed an action`;
  }
}
