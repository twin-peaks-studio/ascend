import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getClient } from "@/lib/supabase/client-manager";
import { logger } from "@/lib/logger/logger";
import { notificationKeys, type Notification } from "@/hooks/use-notifications";

/**
 * Subscribe to real-time notification updates for the current user
 *
 * This hook subscribes to Supabase Realtime and updates the React Query cache
 * when notifications are created or marked as read.
 *
 * @param userId - User ID to subscribe to notifications for, or null to disable
 */
export function useRealtimeNotifications(userId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const supabase = getClient();

    // Subscribe to notification changes for this user
    const channel = supabase
      .channel(`user:${userId}:notifications`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification | null;
          const oldNotification = payload.old as Notification | null;

          logger.debug("Real-time notification update received", {
            event: payload.eventType,
            notificationId: newNotification?.id || oldNotification?.id,
            userId,
          });

          // Update the notifications list cache
          queryClient.setQueryData<Notification[]>(
            notificationKeys.list(userId),
            (oldData) => {
              if (!oldData) return oldData;

              switch (payload.eventType) {
                case "INSERT": {
                  const newNotification = payload.new as Notification;
                  // Check if notification already exists
                  const exists = oldData.some((n) => n.id === newNotification.id);
                  if (exists) return oldData;

                  // Add new notification to the beginning of the list
                  return [newNotification, ...oldData];
                }

                case "UPDATE": {
                  const updatedNotification = payload.new as Notification;
                  return oldData.map((notification) =>
                    notification.id === updatedNotification.id
                      ? updatedNotification
                      : notification
                  );
                }

                case "DELETE": {
                  const deletedNotificationId = payload.old?.id;
                  return oldData.filter((n) => n.id !== deletedNotificationId);
                }

                default:
                  return oldData;
              }
            }
          );

          // Update unread count cache
          queryClient.setQueryData<number>(
            notificationKeys.unreadCount(userId),
            (oldCount = 0) => {
              switch (payload.eventType) {
                case "INSERT": {
                  const newNotification = payload.new as Notification;
                  // Increment count if new notification is unread
                  return newNotification.read ? oldCount : oldCount + 1;
                }

                case "UPDATE": {
                  const oldRead = (payload.old as Notification)?.read ?? false;
                  const newRead = (payload.new as Notification)?.read ?? false;

                  // If notification was marked as read, decrement count
                  if (!oldRead && newRead) {
                    return Math.max(0, oldCount - 1);
                  }
                  // If notification was marked as unread, increment count
                  if (oldRead && !newRead) {
                    return oldCount + 1;
                  }
                  return oldCount;
                }

                case "DELETE": {
                  const deletedNotification = payload.old as Notification;
                  // Decrement count if deleted notification was unread
                  return deletedNotification.read
                    ? oldCount
                    : Math.max(0, oldCount - 1);
                }

                default:
                  return oldCount;
              }
            }
          );
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          logger.info("Subscribed to real-time notification updates", { userId });
        } else if (status === "CHANNEL_ERROR") {
          logger.error("Failed to subscribe to real-time notification updates", {
            userId,
          });
        }
      });

    // Cleanup subscription on unmount
    return () => {
      logger.debug("Unsubscribing from real-time notification updates", {
        userId,
      });
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
