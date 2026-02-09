"use client";

import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import {
  useNotifications,
  useUnreadNotificationCount,
  useNotificationMutations,
} from "@/hooks/use-notifications";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";
import { getInitials } from "@/lib/profile-utils";
import { cn } from "@/lib/utils";
import type { NotificationWithActor } from "@/types";

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getNotificationMessage(type: string): string {
  switch (type) {
    case "mention":
      return "mentioned you in a comment";
    case "task_assigned":
      return "assigned a task to you";
    case "task_unassigned":
      return "removed you from a task";
    case "project_invited":
      return "invited you to a project";
    case "project_lead_assigned":
      return "made you lead of a project";
    case "project_lead_removed":
      return "removed you as project lead";
    default:
      return "sent you a notification";
  }
}

function getNotificationLink(notification: NotificationWithActor): string | null {
  if (notification.task_id) return `/tasks/${notification.task_id}`;
  if (notification.project_id) return `/projects/${notification.project_id}`;
  return null;
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onNavigate,
}: {
  notification: NotificationWithActor;
  onMarkAsRead: (id: string) => void;
  onNavigate: (path: string) => void;
}) {
  const actorName =
    notification.actor?.display_name ||
    notification.actor?.email ||
    "Someone";

  const link = getNotificationLink(notification);

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    if (link) {
      onNavigate(link);
    }
  };

  return (
    <button
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent",
        !notification.read && "bg-accent/50"
      )}
      onClick={handleClick}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={notification.actor?.avatar_url || undefined} />
        <AvatarFallback className="text-xs">
          {getInitials(notification.actor?.display_name, notification.actor?.email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate">
          <span className="font-medium">{actorName}</span>
          {" "}{getNotificationMessage(notification.type)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatTimeAgo(notification.created_at)}
        </p>
      </div>
      {!notification.read && (
        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
}

export function NotificationBell() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const { data: notifications = [] } = useNotifications(userId);
  const { data: unreadCount = 0 } = useUnreadNotificationCount(userId);
  const { markAsRead, markAllAsRead } = useNotificationMutations(userId);

  // Subscribe to real-time notification updates
  useRealtimeNotifications(userId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllAsRead()}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onNavigate={(path) => router.push(path)}
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
