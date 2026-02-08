"use client";

/**
 * Notification Bell Component
 *
 * Displays a bell icon with unread count badge in the header/sidebar.
 * Opens a dropdown of notifications when clicked.
 */

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationList } from "./notification-list";
import { useUnreadCount } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  /**
   * Display mode - icon only or with label
   */
  mode?: "icon" | "full";

  /**
   * Optional className for positioning/styling
   */
  className?: string;
}

export function NotificationBell({ mode = "full", className }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const { unreadCount } = useUnreadCount();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={mode === "icon" ? "icon" : "sm"}
          className={cn(
            "relative",
            mode === "full" && "gap-2",
            className
          )}
          title={`${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
        >
          <div className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-2 -right-2 h-5 min-w-[20px] px-1 flex items-center justify-center text-xs font-bold"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </div>
          {mode === "full" && <span>Notifications</span>}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        className="w-96 p-0"
        sideOffset={8}
      >
        <NotificationList onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
