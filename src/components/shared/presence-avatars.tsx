"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePresence } from "@/hooks/use-presence";
import { getInitials } from "@/lib/profile-utils";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";

interface PresenceAvatarsProps {
  entityType: "task" | "project";
  entityId: string | null;
  /** Max avatars to show before "+N" overflow. Default: 5 */
  maxVisible?: number;
  className?: string;
}

export function PresenceAvatars({
  entityType,
  entityId,
  maxVisible = 5,
  className,
}: PresenceAvatarsProps) {
  const { viewers, hasOtherViewers } = usePresence(entityType, entityId);

  // Don't render anything if user is alone
  if (!hasOtherViewers) return null;

  const visibleViewers = viewers.slice(0, maxVisible);
  const overflowCount = viewers.length - maxVisible;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center gap-1.5", className)}>
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          <AvatarGroup>
            {visibleViewers.map((viewer) => (
              <Avatar key={viewer.user_id} size="sm">
                <AvatarImage src={viewer.avatar_url || undefined} />
                <AvatarFallback>
                  {getInitials(viewer.display_name, viewer.email)}
                </AvatarFallback>
              </Avatar>
            ))}
            {overflowCount > 0 && (
              <AvatarGroupCount>+{overflowCount}</AvatarGroupCount>
            )}
          </AvatarGroup>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="flex flex-col gap-0.5">
          {viewers.map((v) => (
            <span key={v.user_id} className="text-xs">
              {v.is_self ? "You" : v.display_name}
            </span>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
