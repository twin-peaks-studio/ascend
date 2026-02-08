"use client";

/**
 * Notification List Component
 *
 * Displays a list of notifications in a dropdown.
 * Supports marking as read, navigation to entities, and filtering.
 */

import { useRouter } from "next/navigation";
import {
  CheckCheck,
  AtSign,
  MessageSquare,
  UserPlus,
  CheckCircle,
  FolderEdit,
  Loader2,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  type Notification,
} from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface NotificationListProps {
  /**
   * Callback when dropdown should close (after navigation)
   */
  onClose?: () => void;
}

/**
 * Get the URL to navigate to for a notification
 */
function getNotificationUrl(notification: Notification): string {
  switch (notification.entity_type) {
    case "task":
      return `/tasks/${notification.entity_id}`;
    case "project":
      return `/projects/${notification.entity_id}`;
    case "comment":
      // For comment notifications, navigate to the parent entity
      // (we'd need to store parent task/project ID in the future)
      return "#";
    case "note":
      // Notes require project context - for now just go to projects
      return "/projects";
    default:
      return "#";
  }
}

interface NotificationItemProps {
  notification: Notification;
  onNavigate: (url: string) => void;
  onMarkAsRead: (id: string) => void;
}

function NotificationItem({ notification, onNavigate, onMarkAsRead }: NotificationItemProps) {
  const url = getNotificationUrl(notification);

  const handleClick = () => {
    // Mark as read
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }

    // Navigate to entity
    if (url !== "#") {
      onNavigate(url);
    }
  };

  // Render icon based on notification type
  const renderIcon = () => {
    const iconClassName = cn(
      "h-4 w-4",
      notification.read ? "text-muted-foreground" : "text-primary"
    );

    switch (notification.type) {
      case "mention":
        return <AtSign className={iconClassName} />;
      case "comment":
        return <MessageSquare className={iconClassName} />;
      case "task_assigned":
        return <UserPlus className={iconClassName} />;
      case "task_completed":
        return <CheckCircle className={iconClassName} />;
      case "project_update":
        return <FolderEdit className={iconClassName} />;
      default:
        return <MessageSquare className={iconClassName} />;
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
        !notification.read && "bg-primary/5"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "mt-0.5 rounded-full p-2",
          notification.read ? "bg-muted" : "bg-primary/10"
        )}
      >
        {renderIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <p
          className={cn(
            "text-sm",
            notification.read ? "text-muted-foreground" : "font-medium"
          )}
        >
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
          })}
        </p>
      </div>

      {/* Unread indicator */}
      {!notification.read && (
        <div className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />
      )}
    </button>
  );
}

export function NotificationList({ onClose }: NotificationListProps) {
  const router = useRouter();
  const { notifications, loading } = useNotifications();
  const { mutate: markAsRead } = useMarkNotificationAsRead();
  const { mutate: markAllAsRead, isPending: isMarkingAllRead } =
    useMarkAllNotificationsAsRead();

  const unreadNotifications = notifications.filter((n) => !n.read);
  const hasUnread = unreadNotifications.length > 0;

  const handleNavigate = (url: string) => {
    router.push(url);
    onClose?.();
  };

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  return (
    <div className="flex flex-col h-full max-h-[500px]">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Notifications</h3>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAllRead}
              className="h-8 text-xs"
            >
              {isMarkingAllRead ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Marking...
                </>
              ) : (
                <>
                  <CheckCheck className="mr-1 h-3 w-3" />
                  Mark all read
                </>
              )}
            </Button>
          )}
        </div>
        {hasUnread && (
          <p className="text-xs text-muted-foreground mt-1">
            {unreadNotifications.length} unread
          </p>
        )}
      </div>

      {/* Notification list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <Bell className="h-12 w-12 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No notifications yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            You&apos;ll see mentions, comments, and updates here
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onNavigate={handleNavigate}
                onMarkAsRead={handleMarkAsRead}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
