"use client";

import { useActivityFeed } from "@/hooks/use-activity-feed";
import { useRealtimeActivity } from "@/hooks/use-realtime-activity";
import { ActivityItem } from "./activity-item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History } from "lucide-react";

interface ActivityFeedProps {
  projectId: string;
}

export function ActivityFeed({ projectId }: ActivityFeedProps) {
  const { data: activities = [], isLoading, error } = useActivityFeed(projectId);

  // Subscribe to realtime updates (silent — no badges or counts)
  useRealtimeActivity(projectId);

  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Loading activity...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center text-sm text-destructive">
        Failed to load activity feed.
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
        <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm mb-1">No activity yet</p>
        <p className="text-xs">
          Changes to tasks, notes, comments, and members will appear here
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[400px]">
      <div className="divide-y divide-border/40">
        {activities.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} projectId={projectId} />
        ))}
      </div>
    </ScrollArea>
  );
}
